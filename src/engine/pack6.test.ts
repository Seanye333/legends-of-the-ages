// 第六卡包机制层:ifKeywordCount 条件 + buffPer 缩放增益。
//
// 这两个原语是「势力羁绊」和「关键词流派 payoff」的地基。核心风险只有一个:
// buffPer 的计数必须在**施加前**定死,不能自我滚雪球(先数再加)。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 15000

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: id, en: id },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('shu-a', { dynasty: 'shu' }),
    def('shu-b', { dynasty: 'shu' }),
    def('wei-a', { dynasty: 'wei' }),
    def('leech', { keywords: ['lifesteal'] }),
    // 战吼:此牌每有一个同势力(蜀)友军 +1/+1
    def('shu-lord', {
      dynasty: 'shu',
      battlecry: { ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' }] },
    }),
    // 战吼:每有一个吸血友军,全体友军 +1/+0
    def('leech-lord', {
      keywords: ['lifesteal'],
      battlecry: { ops: [{ op: 'buffPer', per: { kind: 'friendlyKeyword', keyword: 'lifesteal' }, attack: 1, health: 0, target: 'allFriendlyGenerals' }] },
    }),
    // 战吼:若你有 3 个吸血友军,抽两张牌
    def('leech-payoff', {
      type: 'stratagem',
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }], condition: { ifKeywordCount: { keyword: 'lifesteal', atLeast: 3 } } },
    }),
  ].map((d) => [d.id, d]),
)

function inst(defId: string, over: Partial<CardInstance> = {}): CardInstance {
  const base = createInstance(defId, nextIid++, LIB)
  const merged: CardInstance = { ...base, ...over }
  refreshInstance(merged, LIB)
  return merged
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    heroId: 'hero',
    heroHp: 30,
    heroMaxHp: 30,
    armor: 0,
    fatigue: 0,
    mana: { current: 10, max: 10 },
    deck: [inst('shu-a'), inst('shu-a'), inst('shu-a')],
    hand: [],
    board: [],
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
    secrets: [],
    overloadNext: 0,
    overloadLocked: 0,
    cardsPlayedThisTurn: 0,
    heroPowerCostDelta: 0,
    ...over,
  }
}

function game(p0: Partial<PlayerState>): GameState {
  return {
    seed: 1,
    rng: 1,
    turn: 5,
    activePlayer: 0,
    phase: 'main',
    players: [player(p0), player()],
    nextIid: 30000,
  }
}

function must(r: ReturnType<typeof applyCommand>) {
  if (!r.ok) throw new Error(`rejected: ${r.error}`)
  return r
}

describe('buffPer · 同势力缩放', () => {
  it('场上已有 2 个蜀友军时,蜀号令自身 +3/+3(含它自己进场后算 3)', () => {
    // 场上 2 个蜀,打出第 3 个蜀号令 → 它进场后 friendlyDynasty=3(含自己)
    const card = inst('shu-lord')
    const s = game({ hand: [card], board: [inst('shu-a'), inst('shu-b')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    const lord = r.state.players[0].board.find((c) => c.defId === 'shu-lord')!
    // 基础 2/2,+3/+3 = 5/5
    expect([lord.attack, lord.health]).toEqual([5, 5])
  })

  it('异势力友军不计数', () => {
    const card = inst('shu-lord')
    // 场上 1 蜀 + 2 魏 → 打出蜀号令后同势力=2(1 旧蜀 + 自己)
    const s = game({ hand: [card], board: [inst('shu-a'), inst('wei-a'), inst('wei-a')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    const lord = r.state.players[0].board.find((c) => c.defId === 'shu-lord')!
    expect([lord.attack, lord.health]).toEqual([4, 4]) // 2/2 + 2/2
  })

  it('计数先定死,不自我滚雪球 —— 空场打出只 +1/+1(只有自己)', () => {
    const card = inst('shu-lord')
    const s = game({ hand: [card], board: [] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    const lord = r.state.players[0].board[0]
    expect([lord.attack, lord.health]).toEqual([3, 3]) // 2/2 + 1/1
  })
})

describe('buffPer · 关键词缩放', () => {
  it('每有一个吸血友军,全体 +1/+0', () => {
    const card = inst('leech-lord') // 自身也带吸血
    const s = game({ hand: [card], board: [inst('leech'), inst('shu-a')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    // 吸血友军 = leech + leech-lord 自己 = 2 → 全体 +2/+0
    const board = r.state.players[0].board
    const plainShu = board.find((c) => c.defId === 'shu-a')!
    expect(plainShu.attack).toBe(2 + 2) // 2 基础 + 2
  })
})

describe('ifKeywordCount 条件', () => {
  it('吸血友军够 3 个才抽牌', () => {
    const card = inst('leech-payoff')
    const enough = game({
      hand: [card],
      board: [inst('leech'), inst('leech'), inst('leech')],
      deck: [inst('shu-a'), inst('shu-a')],
    })
    const deckBefore = enough.players[0].deck.length
    const r = must(applyCommand(enough, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    expect(r.state.players[0].deck.length).toBe(deckBefore - 2)
  })

  it('不够 3 个则不抽', () => {
    const card = inst('leech-payoff')
    const few = game({ hand: [card], board: [inst('leech'), inst('leech')], deck: [inst('shu-a'), inst('shu-a')] })
    const deckBefore = few.players[0].deck.length
    const r = must(applyCommand(few, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    expect(r.state.players[0].deck.length).toBe(deckBefore) // 没抽
  })
})
