import type { CardLibrary, Command, GameState, PlayerIdx, TargetRef } from './types'
import { BOARD_LIMIT, SECRET_LIMIT } from './types'
import { chosenTargetPool, effectiveCost, findGeneral, other, requiresChosenTarget } from './resolve'
import { hasKeyword, legalAttackTargets } from './combat'
import { hasSecretNamed } from './secrets'

// 当前玩家的合法命令。驱动 AI 决策和 UI 可点判定。
// 契约:此处返回的每一条命令,applyCommand 都必须接受(fuzz 测试强制)。
// 注:调度阶段换牌组合是指数级,只列「全保留」代表项;任意子集由 applyCommand 校验。
export function legalCommands(state: GameState, player: PlayerIdx, lib: CardLibrary): Command[] {
  if (state.phase === 'ended') return []
  // 发现挂起:只有选择方能动,而且只能选。其他一切被 applyCommand 顶部的闸门拒掉。
  if (state.pendingChoice) {
    if (state.pendingChoice.player !== player) return []
    return state.pendingChoice.options.map((_, i) => ({ type: 'ResolveChoice', index: i }))
  }
  if (state.phase === 'mulligan') {
    const p = state.players[player]
    if (p.mulliganDone) return []
    return [
      { type: 'Mulligan', keepIids: p.hand.map((c) => c.iid) },
      { type: 'Concede' },
    ]
  }
  if (player !== state.activePlayer) return []

  const p = state.players[player]
  const commands: Command[] = []

  // 出牌
  for (const card of p.hand) {
    const def = lib[card.defId]
    if (!def || effectiveCost(card, lib) > p.mana.current) continue
    // 连击态要在这里就判掉:combo 脚本和基础脚本的**目标要求可能不同**,
    // 这里按基础脚本列命令、applyCommand 按 combo 脚本校验,就会漏出
    // 「legalCommands 给的命令被 applyCommand 拒绝」—— fuzz 测试专门盯这个契约。
    const comboActive = def.combo !== undefined && p.cardsPlayedThisTurn > 0
    // ---- 抉择:每个模式各自算目标要求(模式之间可能不同),逐模式列命令 ----
    // 必须精确对齐 reducer 的目标语义,否则「legal 给的命令 apply 拒绝」——
    // 武将模式:池空时无目标也可打(脚本里的 chosen op 跳过);
    // 锦囊模式:池空 = 该模式无法施放(reducer 返回 no-legal-target),整个模式不列。
    if (def.choose) {
      if (def.type === 'general' && p.board.length >= BOARD_LIMIT) continue
      def.choose.modes.forEach((m, mode) => {
        const needsChosen = requiresChosenTarget(m.script)
        const pool = needsChosen ? chosenTargetPool(state, player, m.script) : []
        if (needsChosen && pool.length > 0) {
          for (const target of pool)
            commands.push({ type: 'PlayCard', iid: card.iid, target, mode })
        } else if (needsChosen && def.type === 'stratagem') {
          // 锦囊模式池空 → 不可施放,跳过
        } else {
          commands.push({ type: 'PlayCard', iid: card.iid, mode })
        }
      })
      continue
    }
    if (def.type === 'general') {
      if (p.board.length >= BOARD_LIMIT) continue
      const script = comboActive ? def.combo : def.battlecry
      const needsChosen = requiresChosenTarget(script)
      const pool = needsChosen ? chosenTargetPool(state, player, script) : []
      const duelTargets: TargetRef[] = hasKeyword(card, 'duel')
        ? state.players[other(player)].board
            .filter((c) => !hasKeyword(c, 'stealth'))
            .map((c) => ({ kind: 'general', iid: c.iid }))
        : []
      if (needsChosen && pool.length > 0) {
        for (const target of pool) commands.push({ type: 'PlayCard', iid: card.iid, target })
      } else if (duelTargets.length > 0) {
        // 单挑可选:带目标与不带目标都合法
        for (const target of duelTargets) commands.push({ type: 'PlayCard', iid: card.iid, target })
        commands.push({ type: 'PlayCard', iid: card.iid })
      } else {
        commands.push({ type: 'PlayCard', iid: card.iid })
      }
    } else if (def.type === 'equipment') {
      // 装备:目标为任一友方在场武将;无友军则不可打出
      for (const c of p.board) {
        commands.push({ type: 'PlayCard', iid: card.iid, target: { kind: 'general', iid: c.iid } })
      }
    } else if (def.secret) {
      // 伏兵:区满或已埋同名则打不出
      if (p.secrets.length >= SECRET_LIMIT) continue
      if (hasSecretNamed(state, player, def.id)) continue
      commands.push({ type: 'PlayCard', iid: card.iid })
    } else {
      const spell = comboActive ? def.combo : def.spell
      const needsChosen = requiresChosenTarget(spell)
      if (needsChosen) {
        const pool = chosenTargetPool(state, player, spell)
        for (const target of pool) commands.push({ type: 'PlayCard', iid: card.iid, target })
      } else {
        commands.push({ type: 'PlayCard', iid: card.iid })
      }
    }
  }

  // 主公技(每回合一次)
  if (p.heroPower && !p.heroPowerUsed && Math.max(0, p.heroPower.cost + p.heroPowerCostDelta) <= p.mana.current) {
    if (requiresChosenTarget(p.heroPower.script)) {
      for (const target of chosenTargetPool(state, player, p.heroPower.script)) {
        commands.push({ type: 'UseHeroPower', target })
      }
    } else {
      commands.push({ type: 'UseHeroPower' })
    }
  }

  // 攻击
  for (const attacker of p.board) {
    for (const target of legalAttackTargets(state, player, attacker)) {
      commands.push({ type: 'Attack', attackerIid: attacker.iid, target })
    }
  }

  commands.push({ type: 'EndTurn' }, { type: 'Concede' })
  return commands
}

// 检查某玩家死后重找:供 UI 判断一个 TargetRef 是否仍有效
export function isTargetAlive(state: GameState, target: TargetRef): boolean {
  if (target.kind === 'hero') return state.players[target.player].heroHp > 0
  return findGeneral(state, target.iid) !== undefined
}
