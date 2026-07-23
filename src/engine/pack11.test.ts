// 第十一卡包机制层:onAttack(攻击后触发)。
// 关键契约:①攻击并存活才触发 ②互击战死则不触发 ③self 目标要指到攻击者本人
// ④被沉默则不触发 ⑤单挑不是「攻击」,不触发。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance, findGeneral } from './resolve'
import { performDuel } from './combat'
import type { CardDef, CardInstance, CardLibrary, GameEvent, GameState, PlayerState } from './types'

let nextIid = 44000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('van', { attack: 2, health: 2 }),
  def('bruiser', { attack: 5, health: 5 }),
  // 攻击后抽一张
  def('vanguard', { attack: 3, health: 4, keywords: ['rush'], onAttack: { ops: [{ op: 'draw', count: 1 }] } }),
  // 攻击后自增益(self 目标)
  def('berserker', { attack: 3, health: 5, keywords: ['rush'], onAttack: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] } }),
  // 攻击后放血(随机敌将)
  def('poisoner', { attack: 2, health: 6, onAttack: { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] } }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o, exhausted: false }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }

describe('onAttack:攻击后触发', () => {
  it('攻击并存活 → 触发(抽一张)', () => {
    const a = inst('vanguard')
    const d = inst('van')
    const s = game({ board: [a], deck: [inst('van'), inst('van')] }, { board: [d] })
    const before = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'general', iid: d.iid } }, LIB))
    // 3/4 打 2/2:自己 4→2 存活,触发抽牌
    expect(findGeneral(r.state, a.iid)?.inst.health).toBe(2)
    expect(r.state.players[0].deck.length).toBe(before - 1)
  })

  it('互击战死 → 不触发', () => {
    const a = inst('vanguard', { damage: 3 }) // 3/4 现血 1
    const d = inst('bruiser') // 5/5,一击带走
    const s = game({ board: [a], deck: [inst('van'), inst('van')] }, { board: [d] })
    const before = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'general', iid: d.iid } }, LIB))
    expect(findGeneral(r.state, a.iid)).toBeUndefined() // 攻击者死了
    expect(r.state.players[0].deck.length).toBe(before) // 没抽
  })

  it('self 目标指到攻击者本人(+1/+1)', () => {
    const a = inst('berserker')
    const d = inst('van')
    const s = game({ board: [a] }, { board: [d] })
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'general', iid: d.iid } }, LIB))
    const now = findGeneral(r.state, a.iid)?.inst
    // 3/5 打 2/2:先 +1/+1 → 4/6,身上挨 2 → 现血 4;攻击 4
    expect(now?.attack).toBe(4)
    expect(now?.health).toBe(4)
  })

  it('攻脸也算攻击 → 触发', () => {
    const a = inst('vanguard')
    const s = game({ board: [a], deck: [inst('van')] }, {})
    const before = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'hero', player: 1 } }, LIB))
    expect(r.state.players[1].heroHp).toBe(27) // 30-3
    expect(r.state.players[0].deck.length).toBe(before - 1) // 攻脸零反伤,必存活必触发
  })

  it('被沉默 → 不触发', () => {
    const a = inst('vanguard', { silenced: true })
    const d = inst('van')
    const s = game({ board: [a], deck: [inst('van')] }, { board: [d] })
    const before = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'general', iid: d.iid } }, LIB))
    expect(r.state.players[0].deck.length).toBe(before) // 沉默掉了 onAttack
  })

  it('单挑不算「攻击」→ 不触发', () => {
    const a = inst('vanguard')
    const d = inst('van')
    const s = game({ board: [a], deck: [inst('van')] }, { board: [d] })
    const before = s.players[0].deck.length
    const events: GameEvent[] = []
    performDuel(s, events, LIB, 0, a.iid, d.iid)
    expect(s.players[0].deck.length).toBe(before) // 单挑不走 onAttack
  })
})
