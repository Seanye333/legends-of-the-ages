import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import type { CardDef, CardLibrary, GameConfig, GameEvent, GameState } from './types'
import { DECK_SIZE, HAND_LIMIT, MANA_CAP, START_HP, TURN_LIMIT } from './types'

function vanilla(id: string): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: '步卒', en: 'Foot Soldier' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
  }
}

const LIB: CardLibrary = { 'foot-soldier': vanilla('foot-soldier') }
const DECK = Array.from({ length: DECK_SIZE }, () => 'foot-soldier')

function makeCfg(seed: number): GameConfig {
  return { seed, heroIds: ['liu-bei', 'cao-cao'], deckIds: [[...DECK], [...DECK]], first: 0 }
}

function mustApply(
  state: GameState,
  player: 0 | 1,
  cmd: Parameters<typeof applyCommand>[2],
): { state: GameState; events: GameEvent[] } {
  const r = applyCommand(state, player, cmd, LIB)
  if (!r.ok) throw new Error(`applyCommand failed: ${r.error}`)
  return r
}

function afterMulligan(seed = 42): GameState {
  let s = createGame(makeCfg(seed), LIB)
  s = mustApply(s, 0, { type: 'Mulligan', keepIids: s.players[0].hand.map((c) => c.iid) }).state
  s = mustApply(s, 1, { type: 'Mulligan', keepIids: s.players[1].hand.map((c) => c.iid) }).state
  return s
}

describe('createGame', () => {
  it('is deterministic for the same seed and diverges across seeds', () => {
    expect(createGame(makeCfg(42), LIB)).toEqual(createGame(makeCfg(42), LIB))
    const order = (s: GameState) => s.players[0].deck.map((c) => c.iid)
    expect(order(createGame(makeCfg(1), LIB))).not.toEqual(order(createGame(makeCfg(2), LIB)))
  })

  it('deals 3/4 opening hands and starts in mulligan', () => {
    const s = createGame(makeCfg(42), LIB)
    expect(s.phase).toBe('mulligan')
    expect(s.players[0].hand).toHaveLength(3)
    expect(s.players[1].hand).toHaveLength(4)
    expect(s.players[0].deck).toHaveLength(DECK_SIZE - 3)
    expect(s.players[1].deck).toHaveLength(DECK_SIZE - 4)
    expect(s.players[0].heroHp).toBe(START_HP)
  })

  it('deals opening hands by turn order, not seat (first: 1)', () => {
    const cfg = makeCfg(42)
    cfg.first = 1
    const s = createGame(cfg, LIB)
    expect(s.players[1].hand).toHaveLength(3) // 先手 3 张
    expect(s.players[0].hand).toHaveLength(4) // 后手 4 张
    expect(s.activePlayer).toBe(1)
  })

  it('rejects invalid decks', () => {
    const bad = makeCfg(1)
    bad.deckIds[0] = bad.deckIds[0].slice(0, 10)
    expect(() => createGame(bad, LIB)).toThrow(/30 cards/)
    const unknown = makeCfg(1)
    unknown.deckIds[1][0] = 'no-such-card'
    expect(() => createGame(unknown, LIB)).toThrow(/unknown card/)
  })
})

describe('mulligan', () => {
  it('full replace keeps hand size and card count', () => {
    const s0 = createGame(makeCfg(42), LIB)
    const r = mustApply(s0, 0, { type: 'Mulligan', keepIids: [] })
    expect(r.state.players[0].hand).toHaveLength(3)
    expect(r.state.players[0].deck).toHaveLength(DECK_SIZE - 3)
    expect(r.state.players[0].mulliganDone).toBe(true)
    expect(r.events.at(-1)).toMatchObject({ type: 'MulliganDone', replacedCount: 3 })
  })

  it('when both players are done, turn 1 starts with 1 mana and a draw', () => {
    const s = afterMulligan()
    expect(s.phase).toBe('main')
    expect(s.turn).toBe(1)
    expect(s.activePlayer).toBe(0)
    expect(s.players[0].mana).toEqual({ current: 1, max: 1 })
    expect(s.players[0].hand).toHaveLength(4) // 3 + 回合开始抽 1
  })

  it('never deals back the tossed cards and emits CardDrawn for redraws', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const s0 = createGame(makeCfg(seed), LIB)
      const tossed = new Set(s0.players[0].hand.map((c) => c.iid))
      const r = mustApply(s0, 0, { type: 'Mulligan', keepIids: [] })
      for (const c of r.state.players[0].hand) {
        expect(tossed.has(c.iid), `seed ${seed}: drew back tossed iid ${c.iid}`).toBe(false)
      }
      expect(r.events.filter((e) => e.type === 'CardDrawn')).toHaveLength(3)
    }
  })

  it('rejects double mulligan and foreign iids', () => {
    const s0 = createGame(makeCfg(42), LIB)
    const r1 = mustApply(s0, 0, { type: 'Mulligan', keepIids: [] })
    expect(applyCommand(r1.state, 0, { type: 'Mulligan', keepIids: [] }, LIB)).toMatchObject({
      ok: false,
      error: 'mulligan-already-done',
    })
    expect(applyCommand(s0, 0, { type: 'Mulligan', keepIids: [99999] }, LIB).ok).toBe(false)
  })
})

describe('turns', () => {
  it('rejects EndTurn from the non-active player', () => {
    const s = afterMulligan()
    expect(applyCommand(s, 1, { type: 'EndTurn' }, LIB)).toMatchObject({
      ok: false,
      error: 'not-your-turn',
    })
  })

  it('mana ramps to the cap', () => {
    let s = afterMulligan()
    for (let i = 0; i < 2 * MANA_CAP; i++) {
      s = mustApply(s, s.activePlayer, { type: 'EndTurn' }).state
    }
    expect(s.players[0].mana.max).toBe(MANA_CAP)
    expect(s.players[1].mana.max).toBe(MANA_CAP)
  })

  it('does not mutate the input state', () => {
    const s = afterMulligan()
    const snapshot = JSON.stringify(s)
    applyCommand(s, s.activePlayer, { type: 'EndTurn' }, LIB)
    expect(JSON.stringify(s)).toBe(snapshot)
  })

  it('concede ends the game immediately', () => {
    const s = afterMulligan()
    const r = mustApply(s, 1, { type: 'Concede' })
    expect(r.state.phase).toBe('ended')
    expect(r.state.winner).toBe(0)
    expect(legalCommands(r.state, 0, LIB)).toHaveLength(0)
  })
})

describe('full game via EndTurn only', () => {
  function runOut(seed: number): { final: GameState; all: GameEvent[]; steps: number } {
    let s = afterMulligan(seed)
    const all: GameEvent[] = []
    let steps = 0
    while (s.phase !== 'ended') {
      const r = mustApply(s, s.activePlayer, { type: 'EndTurn' })
      s = r.state
      all.push(...r.events)
      steps++
      expect(steps).toBeLessThan(TURN_LIMIT + 5)
      // 不变量
      for (const p of s.players) {
        expect(p.hand.length).toBeLessThanOrEqual(HAND_LIMIT)
        expect(p.heroHp).toBeLessThanOrEqual(START_HP)
        expect(p.mana.max).toBeLessThanOrEqual(MANA_CAP)
      }
    }
    return { final: s, all, steps }
  }

  it('burns cards at hand limit, then fatigue ends the game', () => {
    const { final, all } = runOut(42)
    expect(all.some((e) => e.type === 'CardBurned')).toBe(true)
    expect(all.some((e) => e.type === 'FatigueDamage')).toBe(true)
    expect(final.winner).toBeDefined()
    expect(final.players.some((p) => p.heroHp <= 0)).toBe(true)
  })

  it('is fully deterministic end to end', () => {
    const a = runOut(7)
    const b = runOut(7)
    expect(a.final).toEqual(b.final)
    expect(a.all).toEqual(b.all)
    expect(a.steps).toBe(b.steps)
  })

  it('terminates across many seeds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { final } = runOut(seed)
      expect(final.phase).toBe('ended')
    }
  })
})
