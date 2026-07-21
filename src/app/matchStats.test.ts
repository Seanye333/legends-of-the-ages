import { describe, expect, it } from 'vitest'
import { EMPTY_STATS, foldStats } from './matchStats'
import type { GameEvent, GameState } from '../engine/types'

const boardState = (n: number): GameState =>
  ({ players: [{ board: Array.from({ length: n }, (_, i) => ({ iid: i })) }, { board: [] }] }) as unknown as GameState

describe('终局战绩', () => {
  it('伤害按承受方归账:敌方承受的算我打出的', () => {
    const evs: GameEvent[] = [
      { type: 'HeroDamaged', player: 1, amount: 5, hpAfter: 25 },
      { type: 'GeneralDamaged', player: 1, iid: 2, amount: 3, healthAfter: 1 },
      { type: 'HeroDamaged', player: 0, amount: 4, hpAfter: 26 },
      { type: 'GeneralDamaged', player: 0, iid: 9, amount: 2, healthAfter: 1 },
    ]
    const s = foldStats(EMPTY_STATS, evs, null)
    expect(s.damageDealt).toBe(8) // 5 + 3
    expect(s.damageToFace).toBe(5) // 只算主公那部分
    expect(s.damageTaken).toBe(4) // 我方武将挨的不算「我承受」——那是场面损失,不是血线
  })

  it('登场/阵亡/抽牌/耗费法力分边计数', () => {
    const evs: GameEvent[] = [
      { type: 'GeneralSummoned', player: 0, iid: 1, defId: 'a', position: 0, attack: 1, health: 1 },
      { type: 'GeneralSummoned', player: 1, iid: 2, defId: 'b', position: 0, attack: 1, health: 1 },
      { type: 'GeneralDied', player: 1, iid: 2, defId: 'b' },
      { type: 'GeneralDied', player: 0, iid: 1, defId: 'a' },
      { type: 'CardDrawn', player: 0, iid: 3, defId: 'c' },
      { type: 'CardDrawn', player: 1, iid: 4, defId: 'd' },
      { type: 'CardPlayed', player: 0, iid: 3, defId: 'c', cost: 4 },
      { type: 'CardPlayed', player: 1, iid: 4, defId: 'd', cost: 7 },
    ]
    const s = foldStats(EMPTY_STATS, evs, null)
    expect(s.generalsPlayed).toBe(1)
    expect(s.enemyGeneralsSlain).toBe(1)
    expect(s.cardsDrawn).toBe(1)
    expect(s.manaSpent).toBe(4)
  })

  it('场面峰值从状态取,不靠事件加减推 —— 弹回/沉默会把推算算歪', () => {
    let s = foldStats(EMPTY_STATS, [{ type: 'TurnStarted', player: 0, turn: 1, mana: 1 }], boardState(4))
    s = foldStats(s, [{ type: 'TurnStarted', player: 0, turn: 3, mana: 3 }], boardState(2))
    expect(s.peakBoard).toBe(4)
  })

  it('第四卡包的两项只记我方的', () => {
    const evs: GameEvent[] = [
      { type: 'SecretRevealed', player: 0, iid: 1, defId: 'x' },
      { type: 'SecretRevealed', player: 1, iid: 2, defId: 'y' },
      { type: 'ComboTriggered', player: 0, iid: 3, defId: 'z' },
    ]
    const s = foldStats(EMPTY_STATS, evs, null)
    expect(s.secretsRevealed).toBe(1)
    expect(s.combosTriggered).toBe(1)
  })

  it('空事件批原样返回同一个对象(每帧都新建一份是白费)', () => {
    expect(foldStats(EMPTY_STATS, [], null)).toBe(EMPTY_STATS)
  })

  it('不改入参', () => {
    const before = { ...EMPTY_STATS }
    foldStats(EMPTY_STATS, [{ type: 'HeroDamaged', player: 1, amount: 3, hpAfter: 27 }], null)
    expect(EMPTY_STATS).toEqual(before)
  })
})
