// 第十五卡包机制层:施法触发(onSpellCast)。
// 契约:①打出锦囊后触发(自增益/点伤)②只吃自己的锦囊 ③多个 onSpellCast 各触发一次
// ④被沉默不触发 ⑤连击脚本(也是锦囊)照样触发。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance, findGeneral } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 88000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'strategist', cost: 2, attack: 1, health: 3, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('wyrm', { attack: 1, health: 3, onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] } }),
  def('pyro', { attack: 2, health: 4, onSpellCast: { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] } }),
  def('dummy', { attack: 2, health: 5 }),
  def('bolt', { type: 'stratagem', cost: 1, attack: undefined, health: undefined, spell: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] } }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }

describe('施法触发 onSpellCast', () => {
  it('打出锦囊后通神 +1 攻', () => {
    const w = inst('wyrm')
    const b = inst('bolt')
    const foe = inst('dummy')
    const s = game({ board: [w], hand: [b] }, { board: [foe] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: b.iid, target: { kind: 'general', iid: foe.iid } }, LIB))
    expect(findGeneral(r.state, w.iid)?.inst.attack).toBe(2) // 1 + 1
  })

  it('纵火每施法点一下随机敌将', () => {
    const p = inst('pyro')
    const b = inst('bolt')
    const foe = inst('dummy') // 5 血
    const s = game({ board: [p], hand: [b] }, { board: [foe] })
    // 惊雷点脸,纵火再补 1 给随机敌将(只有 foe)
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: b.iid, target: { kind: 'hero', player: 1 } }, LIB))
    expect(r.state.players[1].heroHp).toBe(28) // 惊雷 2 上脸
    expect(findGeneral(r.state, foe.iid)?.inst.health).toBe(4) // 纵火 1
  })

  it('多个 onSpellCast 各触发一次', () => {
    const w1 = inst('wyrm')
    const w2 = inst('wyrm')
    const b = inst('bolt')
    const foe = inst('dummy')
    const s = game({ board: [w1, w2], hand: [b] }, { board: [foe] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: b.iid, target: { kind: 'general', iid: foe.iid } }, LIB))
    expect(findGeneral(r.state, w1.iid)?.inst.attack).toBe(2)
    expect(findGeneral(r.state, w2.iid)?.inst.attack).toBe(2)
  })

  it('只吃自己的锦囊:对手的通神不触发', () => {
    const mine = inst('bolt')
    const foeWyrm = inst('wyrm')
    const foe = inst('dummy')
    const s = game({ hand: [mine] }, { board: [foeWyrm, foe] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: mine.iid, target: { kind: 'general', iid: foe.iid } }, LIB))
    expect(findGeneral(r.state, foeWyrm.iid)?.inst.attack).toBe(1) // 没长
  })

  it('被沉默不触发', () => {
    const w = inst('wyrm', { silenced: true })
    const b = inst('bolt')
    const foe = inst('dummy')
    const s = game({ board: [w], hand: [b] }, { board: [foe] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: b.iid, target: { kind: 'general', iid: foe.iid } }, LIB))
    expect(findGeneral(r.state, w.iid)?.inst.attack).toBe(1) // 沉默掉了
  })

  it('打出武将不触发施法', () => {
    const w = inst('wyrm')
    const body = inst('dummy')
    const s = game({ board: [w], hand: [body] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: body.iid }, LIB))
    expect(findGeneral(r.state, w.iid)?.inst.attack).toBe(1) // 武将不是锦囊
  })
})
