// 第十卡包机制层:damagePer(缩放伤害)+ 献祭(destroy 友军 + payoff,无新 opcode)。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 33000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('van', { attack: 2, health: 2 }),
  // 对敌方主公造成伤害 = 你的武将数
  def('warcry', { type: 'stratagem', cost: 4, attack: undefined, health: undefined, spell: { ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }] } }),
  // 献祭:消灭一个友军,抽两张牌(无新 opcode,destroy 友军 + draw)
  def('sacrifice', { type: 'stratagem', cost: 2, attack: undefined, health: undefined, spell: { ops: [{ op: 'destroy', target: 'chosenFriendlyGeneral' }, { op: 'draw', count: 2 }] } }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }

describe('damagePer', () => {
  it('对敌方主公造成伤害 = 我方武将数', () => {
    const w = inst('warcry')
    const s = game({ hand: [w], board: [inst('van'), inst('van'), inst('van')] }, { heroHp: 30 })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: w.iid }, LIB))
    expect(r.state.players[1].heroHp).toBe(27) // 30 - 3
  })
  it('空场则不打', () => {
    const w = inst('warcry')
    const s = game({ hand: [w], board: [] }, { heroHp: 30 })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: w.iid }, LIB))
    expect(r.state.players[1].heroHp).toBe(30)
  })
})

describe('献祭(无新 opcode)', () => {
  it('消灭一个友军并抽两张', () => {
    const sac = inst('sacrifice')
    const victim = inst('van')
    const s = game({ hand: [sac], board: [victim], deck: [inst('van'), inst('van')] })
    const before = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: sac.iid, target: { kind: 'general', iid: victim.iid } }, LIB))
    expect(r.state.players[0].board.find((c) => c.iid === victim.iid)).toBeUndefined() // 死了
    expect(r.state.players[0].deck.length).toBe(before - 2) // 抽了两张
  })
})
