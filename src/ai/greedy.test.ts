import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import type { CardDef, CardLibrary, GameConfig, GameState, PlayerIdx } from '../engine/types'
import { aiStep, AI_NORMAL } from './greedy'

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: id, en: id },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('a-van1', { cost: 1, attack: 1, health: 2 }),
    def('a-van2', {}),
    def('a-charge', { cost: 3, attack: 3, health: 2, keywords: ['charge'] }),
    def('a-wall', { cost: 3, attack: 2, health: 5, keywords: ['guard'] }),
    def('a-strat-bolt', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] },
    }),
  ].map((d) => [d.id, d]),
)

const POOL = Object.keys(LIB)
const deck = (offset: number) =>
  Array.from({ length: 30 }, (_, i) => POOL[(i + offset) % POOL.length])

function playAiGame(seed: number): { state: GameState; steps: number } {
  const cfg: GameConfig = {
    seed,
    heroIds: ['h0', 'h1'],
    deckIds: [deck(0), deck(2)],
    first: 0,
  }
  let state = createGame(cfg, LIB)
  const rngs: [number, number] = [seed ^ 0xaaaa, seed ^ 0xbbbb]
  let steps = 0
  while (state.phase !== 'ended') {
    expect(++steps).toBeLessThan(3000)
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const r0 = aiStep(state, actor, LIB, rngs[actor], AI_NORMAL)
    rngs[actor] = r0.rng
    const r = applyCommand(state, actor, r0.cmd, LIB)
    expect(r.ok, `AI issued illegal command: ${JSON.stringify(r0.cmd)}`).toBe(true)
    if (!r.ok) break
    state = r.state
  }
  return { state, steps }
}

describe('greedy AI', () => {
  it('finishes full AI-vs-AI games legally across seeds', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const { state } = playAiGame(seed)
      expect(state.winner).toBeDefined()
    }
  })

  it('is deterministic given the same seed', () => {
    const a = playAiGame(42)
    const b = playAiGame(42)
    expect(a.state).toEqual(b.state)
    expect(a.steps).toBe(b.steps)
  })

  it('takes obvious lethal: charge minion kills a 2hp hero', () => {
    const cfg: GameConfig = { seed: 7, heroIds: ['h0', 'h1'], deckIds: [deck(0), deck(0)], first: 0 }
    let state = createGame(cfg, LIB)
    // 构造:轮到 0 号,手里有冲锋,敌方英雄 2 血
    state = structuredClone(state)
    state.phase = 'main'
    state.players[0].mulliganDone = true
    state.players[1].mulliganDone = true
    state.activePlayer = 0
    state.turn = 5
    state.players[0].mana = { current: 10, max: 10 }
    state.players[1].heroHp = 2
    state.players[0].hand = [
      {
        iid: 555,
        defId: 'a-charge',
        attack: 3,
        health: 2,
        maxHealth: 2,
        keywords: ['charge'],
        exhausted: false,
        attacksUsed: 0,
        enchants: [],
      },
    ]
    // 两步内(出牌→冲脸)AI 应终结比赛
    const rngs: [number, number] = [1, 1]
    for (let i = 0; i < 4 && state.phase !== 'ended'; i++) {
      const s = aiStep(state, 0, LIB, rngs[0], AI_NORMAL)
      rngs[0] = s.rng
      const r = applyCommand(state, 0, s.cmd, LIB)
      expect(r.ok).toBe(true)
      if (r.ok) state = r.state
    }
    expect(state.phase).toBe('ended')
    expect(state.winner).toBe(0)
  })
})
