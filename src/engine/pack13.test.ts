// 第十三卡包机制层:激怒(enrage,派生攻击)。
// 契约:①受伤即 +N 攻 ②治疗回满收回 ③部分治疗仍激怒 ④沉默清除 ⑤和附魔叠加。
import { describe, expect, it } from 'vitest'
import { createInstance } from './init'
import { refreshInstance, damageGeneral, healGeneral, addEnchant } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameEvent, GameState, PlayerState } from './types'

let nextIid = 66000
function def(id: string, over: Partial<CardDef>): CardDef {
  return { id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral', dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 4, attack: 2, health: 6, keywords: [], ...over }
}
const LIB: CardLibrary = Object.fromEntries([
  def('brute', { attack: 2, health: 6, enrage: 3 }),
].map((d) => [d.id, d]))
function inst(id: string, o: Partial<CardInstance> = {}): CardInstance { const b = createInstance(id, nextIid++, LIB); const m = { ...b, ...o }; refreshInstance(m, LIB); return m }
function player(o: Partial<PlayerState> = {}): PlayerState { return { heroId: 'h', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0, mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [], mulliganDone: true, heroPowerUsed: false, secrets: [], overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...o } }
function game(p0: Partial<PlayerState>): GameState { return { seed: 1, rng: 1, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player()], nextIid: 60000 } }

describe('激怒 enrage', () => {
  it('满血不激怒,受伤即 +3 攻', () => {
    const b = inst('brute')
    expect(b.attack).toBe(2) // 满血
    const s = game({ board: [b] })
    const ev: GameEvent[] = []
    damageGeneral(s, { inst: b, player: 0, index: 0 }, 2, ev, LIB)
    expect(b.health).toBe(4)
    expect(b.attack).toBe(5) // 2 + 3
  })

  it('治疗回满收回加成', () => {
    const b = inst('brute')
    const s = game({ board: [b] })
    const ev: GameEvent[] = []
    damageGeneral(s, { inst: b, player: 0, index: 0 }, 3, ev, LIB)
    expect(b.attack).toBe(5)
    healGeneral(s, { inst: b, player: 0, index: 0 }, 3, ev, LIB) // 回满
    expect(b.damage).toBe(0)
    expect(b.attack).toBe(2) // 收回
  })

  it('只治疗一部分仍带伤 → 仍激怒', () => {
    const b = inst('brute')
    const s = game({ board: [b] })
    const ev: GameEvent[] = []
    damageGeneral(s, { inst: b, player: 0, index: 0 }, 4, ev, LIB)
    healGeneral(s, { inst: b, player: 0, index: 0 }, 2, ev, LIB) // 还差 2 血
    expect(b.damage).toBe(2)
    expect(b.attack).toBe(5) // 仍激怒
  })

  it('沉默清除激怒(即使带伤)', () => {
    const b = inst('brute', { silenced: true })
    const s = game({ board: [b] })
    const ev: GameEvent[] = []
    damageGeneral(s, { inst: b, player: 0, index: 0 }, 2, ev, LIB)
    expect(b.attack).toBe(2) // 沉默掉了激怒
  })

  it('和附魔叠加:激怒 + (+2/+2)', () => {
    const b = inst('brute')
    const s = game({ board: [b] })
    const ev: GameEvent[] = []
    addEnchant(b, LIB, { attack: 2, health: 2 }, ev, 0) // → 4/8
    expect(b.attack).toBe(4) // 满血,基础2+附魔2
    damageGeneral(s, { inst: b, player: 0, index: 0 }, 1, ev, LIB)
    expect(b.attack).toBe(7) // 2 + 2(附魔) + 3(激怒)
  })
})
