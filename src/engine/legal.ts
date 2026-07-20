import type { CardLibrary, Command, GameState, PlayerIdx, TargetRef } from './types'
import { BOARD_LIMIT } from './types'
import { chosenTargetPool, findGeneral, other, requiresChosenTarget } from './resolve'
import { hasKeyword, legalAttackTargets } from './combat'

// 当前玩家的合法命令。驱动 AI 决策和 UI 可点判定。
// 契约:此处返回的每一条命令,applyCommand 都必须接受(fuzz 测试强制)。
// 注:调度阶段换牌组合是指数级,只列「全保留」代表项;任意子集由 applyCommand 校验。
export function legalCommands(state: GameState, player: PlayerIdx, lib: CardLibrary): Command[] {
  if (state.phase === 'ended') return []
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
    if (!def || def.cost > p.mana.current) continue
    if (def.type === 'general') {
      if (p.board.length >= BOARD_LIMIT) continue
      const script = def.battlecry
      const needsChosen = requiresChosenTarget(script)
      const pool = needsChosen ? chosenTargetPool(state, player, script) : []
      const duelTargets: TargetRef[] = hasKeyword(card, 'duel')
        ? state.players[other(player)].board.map((c) => ({ kind: 'general', iid: c.iid }))
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
    } else {
      const needsChosen = requiresChosenTarget(def.spell)
      if (needsChosen) {
        const pool = chosenTargetPool(state, player, def.spell)
        for (const target of pool) commands.push({ type: 'PlayCard', iid: card.iid, target })
      } else {
        commands.push({ type: 'PlayCard', iid: card.iid })
      }
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
