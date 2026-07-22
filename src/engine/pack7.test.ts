// 第七卡包机制层:费用消减(costDelta)+ 牌生成(addToHand)。
//
// 费用消减是 build-around 大哥的地基,危险点在**有效费用**必须处处一致:
// playCard 扣费、legalCommands 可打判定、UI 显示,全走 effectiveCost。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { createInstance } from './init'
import { effectiveCost, refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'
import { HAND_LIMIT } from './types'

let nextIid = 20000

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
    cost: 4,
    attack: 3,
    health: 3,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('shu-big', { cost: 5, dynasty: 'shu', attack: 5, health: 5 }),
    def('wei-big', { cost: 5, dynasty: 'wei', attack: 5, health: 5 }),
    def('bolt', { type: 'stratagem', cost: 3, attack: undefined, health: undefined, spell: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] } }),
    // 战吼:使手牌中所有同势力(蜀)牌 -2 费
    def('shu-discount', {
      cost: 2,
      dynasty: 'shu',
      battlecry: { ops: [{ op: 'reduceCost', amount: 2, filter: 'dynasty' }] },
    }),
    // 战吼:使所有锦囊 -1 费
    def('spell-discount', {
      cost: 2,
      battlecry: { ops: [{ op: 'reduceCost', amount: 1, filter: 'stratagems' }] },
    }),
    // 战吼:生成两个死士到手牌
    def('generator', {
      cost: 3,
      battlecry: { ops: [{ op: 'addToHand', defId: 'token-die', count: 2 }] },
    }),
    def('token-die', { cost: 1, attack: 1, health: 1, token: true }),
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
    heroId: 'hero', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0,
    mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [],
    mulliganDone: true, heroPowerUsed: false, secrets: [],
    overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0,
    heroPowerCostDelta: 0, ...over,
  }
}

function game(p0: Partial<PlayerState>): GameState {
  return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player()], nextIid: 40000 }
}

const must = (r: ReturnType<typeof applyCommand>) => {
  if (!r.ok) throw new Error(`rejected: ${r.error}`)
  return r
}

describe('费用消减', () => {
  it('号令减费只作用于同势力手牌', () => {
    const discount = inst('shu-discount')
    const shuBig = inst('shu-big') // 5 费蜀
    const weiBig = inst('wei-big') // 5 费魏
    const s = game({ hand: [discount, shuBig, weiBig] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: discount.iid }, LIB))
    const hand = r.state.players[0].hand
    const shu = hand.find((c) => c.defId === 'shu-big')!
    const wei = hand.find((c) => c.defId === 'wei-big')!
    expect(effectiveCost(shu, LIB)).toBe(3) // 5 - 2
    expect(effectiveCost(wei, LIB)).toBe(5) // 不同势力,不变
  })

  it('有效费用真的用于扣费 —— 折后能打出原本打不起的牌', () => {
    const discount = inst('spell-discount')
    const bolt = inst('bolt') // 3 费锦囊
    // 只剩 2 法力,原价 3 费打不起;减 1 费后 2 费,可打
    const s = game({ hand: [discount, bolt], mana: { current: 2, max: 10 } })
    // 先减费(减费卡自己 2 费,正好花光)
    let st = must(applyCommand(s, 0, { type: 'PlayCard', iid: discount.iid }, LIB)).state
    // 现在 0 法力,还是打不起。给回法力测有效费用生效
    st = { ...st, players: [{ ...st.players[0], mana: { current: 2, max: 10 } }, st.players[1]] as [PlayerState, PlayerState] }
    const boltInst = st.players[0].hand.find((c) => c.defId === 'bolt')!
    expect(effectiveCost(boltInst, LIB)).toBe(2)
    const legal = legalCommands(st, 0, LIB).filter((c) => c.type === 'PlayCard' && c.iid === boltInst.iid)
    expect(legal.length).toBeGreaterThan(0) // 2 费可打
  })

  it('费用不会减成负数(有效费用截到 0)', () => {
    const shuBig = inst('shu-big', { costDelta: -99 })
    expect(effectiveCost(shuBig, LIB)).toBe(0)
  })

  it('多次减费叠加', () => {
    const shuBig = inst('shu-big') // 5 费
    const s = game({ hand: [inst('shu-discount'), inst('shu-discount'), shuBig] })
    let st = s
    for (const d of st.players[0].hand.filter((c) => c.defId === 'shu-discount')) {
      st = must(applyCommand(st, 0, { type: 'PlayCard', iid: d.iid }, LIB)).state
    }
    const big = st.players[0].hand.find((c) => c.defId === 'shu-big')!
    expect(effectiveCost(big, LIB)).toBe(1) // 5 - 2 - 2
  })
})

describe('牌生成 addToHand', () => {
  it('生成指定牌进手牌', () => {
    const gen = inst('generator')
    const s = game({ hand: [gen] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: gen.iid }, LIB))
    const dies = r.state.players[0].hand.filter((c) => c.defId === 'token-die')
    expect(dies).toHaveLength(2)
    expect(r.events.filter((e) => e.type === 'CardGenerated')).toHaveLength(2)
  })

  it('手满则生成的牌被烧掉,不突破上限', () => {
    const gen = inst('generator')
    const filler = Array.from({ length: HAND_LIMIT - 1 }, () => inst('shu-big'))
    const s = game({ hand: [gen, ...filler] }) // 手牌满 HAND_LIMIT
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: gen.iid }, LIB))
    // 打出 generator 后手牌 HAND_LIMIT-1,生成 2 张 → 填到 HAND_LIMIT,再烧 1
    expect(r.state.players[0].hand.length).toBe(HAND_LIMIT)
    expect(r.events.some((e) => e.type === 'CardBurned')).toBe(true)
  })
})
