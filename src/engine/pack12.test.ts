// 第十二卡包机制层:碾压(trample)。
// 契约:①攻击武将时溢出穿透到敌方主公 ②铁壁挡下则无穿透 ③剧毒不叠加穿透
// ④刚好致死(无溢出)不穿透 ⑤攻脸不涉及碾压 ⑥守护挡得住攻击、挡不住溢出。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance, findGeneral } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 55000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 2, health: 2, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('trampler', { attack: 6, health: 5, keywords: ['trample'] }),
  def('poison-trample', { attack: 1, health: 5, keywords: ['trample', 'poison'] }),
  def('small', { attack: 0, health: 3 }),
  def('shield', { attack: 0, health: 3, keywords: ['divineShield'] }),
  def('guardwall', { attack: 0, health: 3, keywords: ['guard'] }),
  def('wall6', { attack: 0, health: 6 }),
  def('bigwall', { attack: 0, health: 8 }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o, exhausted: false }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 60000 } }
const must = (r: ReturnType<typeof applyCommand>) => { if (!r.ok) throw new Error(r.error); return r }
const attack = (s: GameState, aiid: number, tiid: number) =>
  must(applyCommand(s, 0, { type: 'Attack', attackerIid: aiid, target: { kind: 'general', iid: tiid } }, LIB))

describe('碾压 trample', () => {
  it('溢出穿透到敌方主公', () => {
    const a = inst('trampler') // 6 攻
    const d = inst('small') // 0/3
    const s = game({ board: [a] }, { board: [d], heroHp: 30 })
    const r = attack(s, a.iid, d.iid)
    // 6 攻打 3 血:溢出 3 上脸
    expect(findGeneral(r.state, d.iid)).toBeUndefined()
    expect(r.state.players[1].heroHp).toBe(27)
  })

  it('守护挡得住攻击,挡不住溢出', () => {
    const a = inst('trampler') // 6 攻
    const wall = inst('guardwall') // 0/3 守护
    const s = game({ board: [a] }, { board: [wall], heroHp: 30 })
    const r = attack(s, a.iid, wall.iid)
    expect(r.state.players[1].heroHp).toBe(27) // 6-3=3 穿透
  })

  it('铁壁完整挡下 → 无穿透', () => {
    const a = inst('trampler') // 6 攻
    const sh = inst('shield') // 0/3 铁壁
    const s = game({ board: [a] }, { board: [sh], heroHp: 30 })
    const r = attack(s, a.iid, sh.iid)
    // 铁壁吃掉整下:防守方存活、脸上无伤
    expect(findGeneral(r.state, sh.iid)?.inst.keywords).not.toContain('divineShield') // 壁破了
    expect(r.state.players[1].heroHp).toBe(30)
  })

  it('刚好致死(无溢出)不穿透', () => {
    const a = inst('trampler') // 6 攻
    const d = inst('wall6') // 0/6 —— 6 攻正好打死,溢出 0
    const s = game({ board: [a] }, { board: [d], heroHp: 30 })
    const r = attack(s, a.iid, d.iid)
    expect(findGeneral(r.state, d.iid)).toBeUndefined()
    expect(r.state.players[1].heroHp).toBe(30) // 无溢出
  })

  it('未致死(目标血更厚)不穿透', () => {
    const a = inst('trampler') // 6 攻
    const big = inst('bigwall') // 0/8,6 攻打不死(还剩 2)
    const s = game({ board: [a] }, { board: [big], heroHp: 30 })
    const r = attack(s, a.iid, big.iid)
    expect(findGeneral(r.state, big.iid)?.inst.health).toBe(2)
    expect(r.state.players[1].heroHp).toBe(30) // 没死就没有溢出
  })

  it('剧毒不叠加穿透:穿的是伤害量,不是死亡', () => {
    const a = inst('poison-trample') // 1 攻 + 剧毒 + 碾压
    const d = inst('bigwall') // 0/8
    const s = game({ board: [a] }, { board: [d], heroHp: 30 })
    const r = attack(s, a.iid, d.iid)
    // 剧毒把 8 血截到死,但只打了 1 点 → 溢出 = 1-8 < 0,不穿透
    expect(findGeneral(r.state, d.iid)).toBeUndefined() // 剧毒杀死
    expect(r.state.players[1].heroHp).toBe(30)
  })

  it('攻脸不涉及碾压(直接就是攻击力)', () => {
    const a = inst('trampler') // 6 攻
    const s = game({ board: [a] }, { heroHp: 30 })
    const r = must(applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'hero', player: 1 } }, LIB))
    expect(r.state.players[1].heroHp).toBe(24) // 就是 6,不会二次穿透
  })
})
