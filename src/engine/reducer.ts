import type {
  ApplyResult,
  CardLibrary,
  Command,
  GameEvent,
  GameState,
  PlayerIdx,
  Winner,
} from './types'
import { HAND_LIMIT, MANA_CAP, TURN_LIMIT } from './types'
import { rngShuffle } from './rng'

// 纯函数核心:不修改入参,返回新状态 + 事件流。
// AI 模拟、UI 乐观更新、服务器权威校验共用这一个入口。
export function applyCommand(
  state: GameState,
  player: PlayerIdx,
  cmd: Command,
  lib: CardLibrary,
): ApplyResult {
  if (state.phase === 'ended') return { ok: false, error: 'game-ended' }
  void lib // Phase 1 的 PlayCard/Attack 会用到卡牌定义

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
      // 换掉的牌洗回牌库,再补抽相同数量
      p.deck.push(...replaced)
      const shuffledDeck = rngShuffle(next.rng, p.deck)
      next.rng = shuffledDeck.next
      p.deck = shuffledDeck.result
      for (let i = 0; i < replaced.length; i++) {
        const card = p.deck.pop()
        if (card) p.hand.push(card)
      }
      p.mulliganDone = true
      events.push({ type: 'MulliganDone', player, replacedCount: replaced.length })
      if (next.players[0].mulliganDone && next.players[1].mulliganDone) {
        next.phase = 'main'
        beginTurn(next, events)
      }
      return { ok: true, state: next, events }
    }
    case 'EndTurn': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      events.push({ type: 'TurnEnded', player, turn: next.turn })
      next.activePlayer = other(next.activePlayer)
      beginTurn(next, events)
      return { ok: true, state: next, events }
    }
    case 'PlayCard':
    case 'Attack':
      return { ok: false, error: 'not-implemented-yet' } // Phase 1
    default: {
      const exhaustive: never = cmd
      return { ok: false, error: `unknown-command: ${JSON.stringify(exhaustive)}` }
    }
  }
}

function other(p: PlayerIdx): PlayerIdx {
  return p === 0 ? 1 : 0
}

function beginTurn(state: GameState, events: GameEvent[]): void {
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
  checkGameEnd(state, events)
}

export function drawCards(
  state: GameState,
  player: PlayerIdx,
  count: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  for (let i = 0; i < count; i++) {
    const card = p.deck.pop()
    if (!card) {
      // 疲劳:每次空抽伤害递增
      p.fatigue += 1
      events.push({ type: 'FatigueDamage', player, amount: p.fatigue })
      damageHero(state, player, p.fatigue, events)
      continue
    }
    if (p.hand.length >= HAND_LIMIT) {
      p.graveyard.push(card.defId)
      events.push({ type: 'CardBurned', player, defId: card.defId })
      continue
    }
    p.hand.push(card)
    events.push({ type: 'CardDrawn', player, iid: card.iid, defId: card.defId })
  }
}

export function damageHero(
  state: GameState,
  player: PlayerIdx,
  amount: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  const absorbed = Math.min(p.armor, amount)
  p.armor -= absorbed
  const dealt = amount - absorbed
  p.heroHp -= dealt
  events.push({ type: 'HeroDamaged', player, amount: dealt, hpAfter: p.heroHp })
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
