import type {
  ApplyResult,
  CardLibrary,
  Command,
  GameEvent,
  GameState,
  PlayerIdx,
  TargetRef,
  Winner,
} from './types'
import { BOARD_LIMIT, MANA_CAP, TURN_LIMIT } from './types'
import { rngShuffle } from './rng'
import {
  chosenTargetPool,
  drawCards,
  findGeneral,
  other,
  processDeaths,
  requiresChosenTarget,
  runScript,
} from './resolve'
import { hasKeyword, performAttack, performDuel } from './combat'

// 纯函数核心:不修改入参,返回新状态 + 事件流。
// AI 模拟、UI 乐观更新、服务器权威校验共用这一个入口。
export function applyCommand(
  state: GameState,
  player: PlayerIdx,
  cmd: Command,
  lib: CardLibrary,
): ApplyResult {
  if (state.phase === 'ended') return { ok: false, error: 'game-ended' }

  const next = structuredClone(state)
  const events: GameEvent[] = []

  switch (cmd.type) {
    case 'Concede': {
      endGame(next, events, other(player))
      return { ok: true, state: next, events }
    }
    case 'Mulligan': {
      if (next.phase !== 'mulligan') return { ok: false, error: 'not-mulligan-phase' }
      const p = next.players[player]
      if (p.mulliganDone) return { ok: false, error: 'mulligan-already-done' }
      const handIids = new Set(p.hand.map((c) => c.iid))
      for (const iid of cmd.keepIids) {
        if (!handIids.has(iid)) return { ok: false, error: `iid-not-in-hand: ${iid}` }
      }
      const keep = new Set(cmd.keepIids)
      const replaced = p.hand.filter((c) => !keep.has(c.iid))
      p.hand = p.hand.filter((c) => keep.has(c.iid))
      // 先从剩余牌库补抽,再把换掉的牌洗回 —— 保证换掉的牌不会立刻抽回(炉石规则)
      if (replaced.length > 0) {
        for (let i = 0; i < replaced.length; i++) {
          const card = p.deck.pop()
          if (card) {
            p.hand.push(card)
            events.push({ type: 'CardDrawn', player, iid: card.iid, defId: card.defId })
          }
        }
        p.deck.push(...replaced)
        const shuffledDeck = rngShuffle(next.rng, p.deck)
        next.rng = shuffledDeck.next
        p.deck = shuffledDeck.result
      }
      p.mulliganDone = true
      events.push({ type: 'MulliganDone', player, replacedCount: replaced.length })
      if (next.players[0].mulliganDone && next.players[1].mulliganDone) {
        next.phase = 'main'
        beginTurn(next, events, lib)
      }
      return { ok: true, state: next, events }
    }
    case 'EndTurn': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      events.push({ type: 'TurnEnded', player, turn: next.turn })
      next.activePlayer = other(next.activePlayer)
      beginTurn(next, events, lib)
      return { ok: true, state: next, events }
    }
    case 'PlayCard': {
      const error = playCard(next, player, cmd.iid, cmd.boardPos, cmd.target, events, lib)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    case 'Attack': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      const error = performAttack(next, events, lib, player, cmd.attackerIid, cmd.target)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    default: {
      const exhaustive: never = cmd
      return { ok: false, error: `unknown-command: ${JSON.stringify(exhaustive)}` }
    }
  }
}

function playCard(
  state: GameState,
  player: PlayerIdx,
  iid: number,
  boardPos: number | undefined,
  target: TargetRef | undefined,
  events: GameEvent[],
  lib: CardLibrary,
): string | null {
  if (state.phase !== 'main') return 'not-main-phase'
  if (player !== state.activePlayer) return 'not-your-turn'
  const p = state.players[player]
  const handIndex = p.hand.findIndex((c) => c.iid === iid)
  if (handIndex < 0) return 'card-not-in-hand'
  const inst = p.hand[handIndex]
  const def = lib[inst.defId]
  if (!def) return `unknown-card-def: ${inst.defId}`
  if (def.cost > p.mana.current) return 'not-enough-mana'

  // ---- 打出前校验目标(校验失败不产生任何变化) ----
  const script = def.type === 'general' ? def.battlecry : def.spell
  const needsChosen = requiresChosenTarget(script)
  const pool = needsChosen ? chosenTargetPool(state, player, script) : []
  const targetInPool = (t: TargetRef) =>
    pool.some((x) =>
      x.kind === 'hero'
        ? t.kind === 'hero' && t.player === x.player
        : t.kind === 'general' && t.iid === x.iid,
    )
  const canDuel =
    def.type === 'general' &&
    hasKeyword(inst, 'duel') &&
    target?.kind === 'general' &&
    findGeneral(state, target.iid)?.player === other(player)
  let chosenForScript: TargetRef | undefined
  if (def.type === 'general') {
    if (p.board.length >= BOARD_LIMIT) return 'board-full'
    if (needsChosen && target && targetInPool(target)) chosenForScript = target
    else if (needsChosen && pool.length > 0 && target && !targetInPool(target) && !canDuel)
      return 'invalid-target'
    // 战吼需要目标但未给:目标池非空时要求给目标(单挑目标除外),池空则跳过对应操作
    if (needsChosen && pool.length > 0 && !target) return 'target-required'
  } else {
    if (!def.spell) return 'stratagem-without-spell'
    if (needsChosen) {
      if (pool.length === 0) return 'no-legal-target'
      if (!target) return 'target-required'
      if (!targetInPool(target)) return 'invalid-target'
      chosenForScript = target
    }
  }

  // ---- 执行 ----
  p.mana.current -= def.cost
  p.hand.splice(handIndex, 1)
  events.push({ type: 'CardPlayed', player, iid, defId: inst.defId, cost: def.cost })

  if (def.type === 'general') {
    const pos = Math.max(0, Math.min(boardPos ?? p.board.length, p.board.length))
    inst.exhausted = true
    inst.attacksUsed = 0
    p.board.splice(pos, 0, inst)
    events.push({
      type: 'GeneralSummoned',
      player,
      iid: inst.iid,
      defId: inst.defId,
      position: pos,
      attack: inst.attack,
      health: inst.health,
    })
    if (def.battlecry) {
      events.push({
        type: 'EffectTriggered',
        player,
        sourceIid: inst.iid,
        sourceDefId: inst.defId,
        kind: 'battlecry',
      })
      runScript(state, events, lib, player, inst.defId, inst.iid, def.battlecry, chosenForScript, false)
    }
    // 单挑:战吼结算后,若单挑者仍在场且目标仍在场
    if (canDuel && target?.kind === 'general' && findGeneral(state, inst.iid)) {
      if (findGeneral(state, target.iid)) {
        performDuel(state, events, lib, player, inst.iid, target.iid)
      }
    }
  } else {
    events.push({
      type: 'EffectTriggered',
      player,
      sourceDefId: inst.defId,
      kind: 'spell',
    })
    runScript(state, events, lib, player, inst.defId, undefined, def.spell!, chosenForScript, false)
    p.graveyard.push(inst.defId)
  }

  processDeaths(state, events, lib)
  return null
}

function beginTurn(state: GameState, events: GameEvent[], lib: CardLibrary): void {
  state.turn += 1
  if (state.turn > TURN_LIMIT) {
    endGame(state, events, 'draw')
    return
  }
  const p = state.players[state.activePlayer]
  p.mana.max = Math.min(MANA_CAP, p.mana.max + 1)
  p.mana.current = p.mana.max
  for (const unit of p.board) {
    unit.exhausted = false
    unit.attacksUsed = 0
  }
  events.push({
    type: 'TurnStarted',
    player: state.activePlayer,
    turn: state.turn,
    mana: p.mana.max,
  })
  drawCards(state, state.activePlayer, 1, events)
  processDeaths(state, events, lib)
  checkGameEnd(state, events)
}

export function checkGameEnd(state: GameState, events: GameEvent[]): void {
  if (state.phase === 'ended') return
  const dead0 = state.players[0].heroHp <= 0
  const dead1 = state.players[1].heroHp <= 0
  if (!dead0 && !dead1) return
  const winner: Winner = dead0 && dead1 ? 'draw' : dead0 ? 1 : 0
  endGame(state, events, winner)
}

function endGame(state: GameState, events: GameEvent[], winner: Winner): void {
  if (state.phase === 'ended') return
  state.phase = 'ended'
  state.winner = winner
  events.push({ type: 'GameEnded', winner })
}
