// 第十六卡包机制层:搜将(recruit)。
// 契约:①从牌库拉武将上场并从库里消失 ②只拉武将(跳过锦囊)③空库/无武将 no-op
// ④满场即停 ⑤count=2 拉两个。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance, findGeneral } from './resolve'
import { BOARD_LIMIT } from './types'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 99000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('body', { attack: 2, health: 2 }),
  def('bolt', { type: 'stratagem', cost: 1, attack: undefined, health: undefined, spell: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] } }),
  def('muster', { type: 'stratagem', cost: 4, attack: undefined, health: undefined, spell: { ops: [{ op: 'recruit', count: 1 }] } }),
  def('muster2', { type: 'stratagem', cost: 4, attack: undefined, health: undefined, spell: { ops: [{ op: 'recruit', count: 2 }] } }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }

describe('搜将 recruit', () => {
  it('从牌库拉一个武将上场,并从库里消失', () => {
    const m = inst('muster')
    const s = game({ hand: [m], board: [], deck: [inst('body'), inst('body')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: m.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(1) // 拉了一个上场
    expect(r.state.players[0].deck).toHaveLength(1) // 库里少一个
  })

  it('只拉武将,跳过锦囊', () => {
    const m = inst('muster')
    // 牌库里只有一个武将 + 两个锦囊 → 只会拉那个武将
    const s = game({ hand: [m], deck: [inst('bolt'), inst('body'), inst('bolt')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: m.iid }, LIB))
    expect(r.state.players[0].board.map((c) => c.defId)).toEqual(['body'])
    expect(r.state.players[0].deck.map((c) => c.defId).sort()).toEqual(['bolt', 'bolt']) // 锦囊没被拉
  })

  it('空库 / 库里没有武将 → 什么都不发生', () => {
    const m = inst('muster')
    const s = game({ hand: [m], deck: [inst('bolt')] }) // 库里只有锦囊
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: m.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(0)
    expect(r.state.players[0].deck).toHaveLength(1) // 锦囊还在
  })

  it('满场即停,不炸', () => {
    const m = inst('muster2')
    const full = Array.from({ length: BOARD_LIMIT }, () => inst('body'))
    const s = game({ hand: [m], board: full, deck: [inst('body'), inst('body')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: m.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(BOARD_LIMIT) // 没超
    expect(r.state.players[0].deck).toHaveLength(2) // 满场没拉,库不动
  })

  it('count=2 拉两个', () => {
    const m = inst('muster2')
    const s = game({ hand: [m], board: [], deck: [inst('body'), inst('body'), inst('body')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: m.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(2)
    expect(r.state.players[0].deck).toHaveLength(1)
    // 拉上场的实例是新建的(iid 不复用牌库里的)—— 校验都在场且存活
    for (const c of r.state.players[0].board) expect(findGeneral(r.state, c.iid)).toBeDefined()
  })
})
