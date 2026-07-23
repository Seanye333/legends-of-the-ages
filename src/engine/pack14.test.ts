// 第十四卡包机制层:移形换位(swapStats)。
// 契约:①攻血对调 ②保留伤害 ③再换一次换回来 ④和已有附魔叠加后按当前值换 ⑤不会把人换死。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance, findGeneral, addEnchant } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameEvent, GameState, PlayerState } from './types'

let nextIid = 77000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('bruiser', { attack: 8, health: 1 }),
  def('wall', { attack: 1, health: 8 }),
  def('tank', { attack: 3, health: 10 }),
  def('swap-enemy', { type: 'stratagem', cost: 3, attack: undefined, health: undefined, spell: { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] } }),
  def('swap-friendly', { type: 'stratagem', cost: 2, attack: undefined, health: undefined, spell: { ops: [{ op: 'swapStats', target: 'chosenFriendlyGeneral' }] } }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }

describe('移形换位 swapStats', () => {
  it('把敌方 8/1 换成 1/8(拆牙)', () => {
    const s0 = inst('swap-enemy')
    const big = inst('bruiser') // 8/1
    const s = game({ hand: [s0] }, { board: [big] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: s0.iid, target: { kind: 'general', iid: big.iid } }, LIB))
    const now = findGeneral(r.state, big.iid)?.inst
    expect(now?.attack).toBe(1)
    expect(now?.health).toBe(8)
    expect(now?.maxHealth).toBe(8)
  })

  it('把自己的 1/8 墙换成 8/1(反打)', () => {
    const s0 = inst('swap-friendly')
    const wall = inst('wall') // 1/8
    const s = game({ hand: [s0], board: [wall] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: s0.iid, target: { kind: 'general', iid: wall.iid } }, LIB))
    const now = findGeneral(r.state, wall.iid)?.inst
    expect(now?.attack).toBe(8)
    expect(now?.health).toBe(1)
  })

  it('换位不杀人:带 3 伤的 1/8 墙换成 8/1,把伤夹到存活(留 1 血)', () => {
    const s0 = inst('swap-friendly')
    const wall = inst('wall', { damage: 3 }) // 1/8 现血 5
    const s = game({ hand: [s0], board: [wall] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: s0.iid, target: { kind: 'general', iid: wall.iid } }, LIB))
    const now = findGeneral(r.state, wall.iid)?.inst
    // 换成 8/1:maxHealth 1,旧伤 3 > 1 本会换死,clampAlive 夹到留 1 血
    expect(now, '换位不应把武将换死').toBeDefined()
    expect(now?.attack).toBe(8)
    expect(now?.maxHealth).toBe(1)
    expect(now?.health).toBe(1)
  })

  it('伤害在不致死时保留:带 2 伤的 3/10 换成 10/3,现血 = 3-2 = 1', () => {
    const s0 = inst('swap-friendly')
    const big = inst('tank', { damage: 2 }) // 3/10 现血 8
    const s = game({ hand: [s0], board: [big] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: s0.iid, target: { kind: 'general', iid: big.iid } }, LIB))
    const now = findGeneral(r.state, big.iid)?.inst
    expect(now?.attack).toBe(10)
    expect(now?.maxHealth).toBe(3)
    expect(now?.health).toBe(1) // 3 - 2 伤
  })

  it('再换一次换回来', () => {
    const big = inst('bruiser') // 8/1
    const s = game({ hand: [inst('swap-enemy'), inst('swap-enemy')] }, { board: [big] })
    const [c1, c2] = s.players[0].hand
    const r1 = must(applyCommand(s, 0, { type: 'PlayCard', iid: c1.iid, target: { kind: 'general', iid: big.iid } }, LIB))
    expect(findGeneral(r1.state, big.iid)?.inst.attack).toBe(1) // 1/8
    const r2 = must(applyCommand(r1.state, 0, { type: 'PlayCard', iid: c2.iid, target: { kind: 'general', iid: big.iid } }, LIB))
    const now = findGeneral(r2.state, big.iid)?.inst
    expect(now?.attack).toBe(8) // 换回 8/1
    expect(now?.maxHealth).toBe(1)
  })

  it('按当前值换:已有 +2/+2 附魔的 8/1(变 10/3)换成 3/10', () => {
    const s0 = inst('swap-enemy')
    const big = inst('bruiser') // 8/1
    const ev: GameEvent[] = []
    addEnchant(big, LIB, { attack: 2, health: 2 }, ev, 1) // → 10/3
    const s = game({ hand: [s0] }, { board: [big] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: s0.iid, target: { kind: 'general', iid: big.iid } }, LIB))
    const now = findGeneral(r.state, big.iid)?.inst
    expect(now?.attack).toBe(3) // 当前 maxHealth 3
    expect(now?.maxHealth).toBe(10) // 当前 attack 10
  })
})
