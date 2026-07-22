import { describe, expect, it } from 'vitest'
import { createGame, createInstance } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import type { CardDef, CardLibrary, GameConfig, GameState, PlayerIdx } from '../engine/types'
import { aiStep, AI_NORMAL, evaluate } from './greedy'

let nextIid = 3000

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
    def('a-glass', { cost: 3, attack: 4, health: 1 }), // 高攻脆皮:一换一很划算
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
    state.players[0].hand = [createInstance('a-charge', 555, LIB)]
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


describe('一层前瞻(名将档)', () => {
  // 场面:我方一个 3/2 冲锋;敌方三个 4/1 —— 下回合合计 12 点扑上来。
  // 我 10 血:直接打脸就是死;拿冲锋换掉一个 4/1,进来的伤害降到 8,能活。
  //
  // 关键是这一步**对贪心来说是亏的**:3/2 换 4/1 丢了自己的场面,
  // 而打脸能实打实推进 3 点。所以无前瞻的一定选打脸 —— 然后下回合被带走。
  const mk = (defId: string) => {
    const c = createInstance(defId, nextIid++, LIB)
    c.exhausted = false
    return c
  }
  const side = (heroHp: number, board: string[]) => ({
    heroId: 'h',
    heroHp,
    heroMaxHp: 30,
    armor: 0,
    fatigue: 0,
    mana: { current: 0, max: 6 },
    deck: [],
    hand: [],
    board: board.map(mk),
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
    secrets: [],
    overloadNext: 0,
    overloadLocked: 0,
    cardsPlayedThisTurn: 0,
    heroPowerCostDelta: 0,
  })
  const scene = (myHp: number): GameState =>
    ({
      seed: 1,
      rng: 7,
      turn: 9,
      activePlayer: 0,
      phase: 'main',
      nextIid: 4000,
      players: [side(myHp, ['a-charge']), side(30, ['a-glass', 'a-glass', 'a-glass'])],
    }) as unknown as GameState

  const PLAIN = { blunderChance: 0, lethalSearch: true, foresight: false }
  const SEER = { blunderChance: 0, lethalSearch: true, foresight: true }
  const hitsFace = (c: { type: string; target?: { kind: string } }) =>
    c.type === 'Attack' && c.target?.kind === 'hero'

  it('能靠一次交换活下来时,前瞻会去换,不前瞻的会打脸然后死', () => {
    const s = scene(10) // 进来 12 > 10;换掉一个 4/1 之后 8 < 10
    expect(hitsFace(aiStep(s, 0, LIB, 1, PLAIN).cmd)).toBe(true)
    expect(hitsFace(aiStep(s, 0, LIB, 1, SEER).cmd)).toBe(false)
  })

  it('血线安全时前瞻不改变选择 —— 它不该把 AI 变成缩头乌龟', () => {
    const s = scene(30)
    expect(hitsFace(aiStep(s, 0, LIB, 1, SEER).cmd)).toBe(true)
  })

  it('怎么换都活不了时,前瞻不再浪费这一步,照样打脸', () => {
    // 8 血面对 12:换掉一个还剩 8,正好还是致死 —— 换了也没用,那就换血
    const s = scene(8)
    expect(hitsFace(aiStep(s, 0, LIB, 1, SEER).cmd)).toBe(true)
  })

  it('断崖罚分只在会被带走时出现', () => {
    const safe = scene(30)
    const doomed = scene(10)
    expect(evaluate(safe, 0, LIB, true)).toBeCloseTo(evaluate(safe, 0, LIB, false) - 12 * 0.3, 5)
    // 12 攻扑脸 + 断崖 400
    expect(evaluate(doomed, 0, LIB, false) - evaluate(doomed, 0, LIB, true)).toBeCloseTo(
      12 * 0.3 + 400,
      5,
    )
  })
})
