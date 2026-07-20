import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../engine/types'
import { ACHIEVEMENTS, mergeStats, tallyStats } from './achievementStore'

const HERO = 'liu-bei' // 王道

describe('achievement stats', () => {
  it('counts a win and attributes it to the hero doctrine', () => {
    const evs: GameEvent[] = [{ type: 'GameEnded', winner: 0 }]
    const s = tallyStats(evs, HERO)
    expect(s.matchesPlayed).toBe(1)
    expect(s.matchesWon).toBe(1)
    expect(s.won_royal).toBe(1)
    expect(s.won_hegemonic).toBeUndefined()
  })

  it('counts a loss as played but not won', () => {
    const s = tallyStats([{ type: 'GameEnded', winner: 1 }], HERO)
    expect(s.matchesPlayed).toBe(1)
    expect(s.matchesWon).toBeUndefined()
  })

  it('only counts effects the player inflicted on the opponent', () => {
    const evs: GameEvent[] = [
      { type: 'GeneralSilenced', player: 1, iid: 1 }, // 我沉默了敌将
      { type: 'GeneralSilenced', player: 0, iid: 2 }, // 敌人沉默了我 —— 不算
      { type: 'GeneralFrozen', player: 1, iid: 3 },
      { type: 'DivineShieldPopped', player: 1, iid: 4 },
      { type: 'DivineShieldPopped', player: 0, iid: 5 },
    ]
    const s = tallyStats(evs, HERO)
    expect(s.silences).toBe(1)
    expect(s.freezes).toBe(1)
    expect(s.shieldsPopped).toBe(1)
  })

  it('tracks best single-turn face damage, resetting each turn', () => {
    const evs: GameEvent[] = [
      { type: 'TurnStarted', player: 0, turn: 1, mana: 1 },
      { type: 'HeroDamaged', player: 1, amount: 6, hpAfter: 24 },
      { type: 'HeroDamaged', player: 1, amount: 5, hpAfter: 19 }, // 本回合 11
      { type: 'TurnStarted', player: 0, turn: 3, mana: 3 },
      { type: 'HeroDamaged', player: 1, amount: 8, hpAfter: 11 }, // 本回合 8
      { type: 'HeroDamaged', player: 0, amount: 30, hpAfter: 0 }, // 打我自己的不算
    ]
    const s = tallyStats(evs, HERO)
    expect(s.bestTurnDamage).toBe(11)
    expect(s.heroDamage).toBe(19)
  })

  it('mergeStats accumulates counters but takes the max for best-of stats', () => {
    const a = { matchesWon: 3, bestTurnDamage: 12, arenaBestWins: 5 }
    const b = { matchesWon: 2, bestTurnDamage: 9, arenaBestWins: 8 }
    const m = mergeStats(a, b)
    expect(m.matchesWon).toBe(5)
    expect(m.bestTurnDamage).toBe(12) // 取最大,不累加
    expect(m.arenaBestWins).toBe(8)
  })

  it('every achievement points at a stat the tally can actually produce', () => {
    // 防止加了成就却忘了埋点 —— 这类 bug 表现为「永远 0/N」,没人会发现
    const produced = new Set<string>([
      ...Object.keys(
        tallyStats(
          [
            { type: 'GameEnded', winner: 0 },
            { type: 'TurnStarted', player: 0, turn: 1, mana: 1 },
            { type: 'HeroDamaged', player: 1, amount: 1, hpAfter: 29 },
            { type: 'CardPlayed', player: 0, iid: 1, defId: 'guan-yu', cost: 7 },
            { type: 'EquipmentAttached', player: 0, targetIid: 1, defId: 'eq-teng-jia' },
            { type: 'DuelFought', challenger: 0, challengerIid: 1, defenderIid: 2, challengerDied: false, defenderDied: true },
            { type: 'HeroPowerUsed', player: 0, heroId: HERO, powerId: 'hp-rende', cost: 2 },
            { type: 'GeneralSilenced', player: 1, iid: 3 },
            { type: 'GeneralFrozen', player: 1, iid: 4 },
            { type: 'DivineShieldPopped', player: 1, iid: 5 },
          ],
          HERO,
        ),
      ),
      // 这三个由 store 外部 bump 进来
      'cardsCrafted',
      'packsOpened',
      'arenaBestWins',
      // 六主义各一条,tally 只会产出当前主公那一个
      'won_hegemonic',
      'won_ritual',
      'won_fame',
      'won_separatist',
      'won_reclusion',
      'stratagemsCast',
    ])
    for (const a of ACHIEVEMENTS) {
      expect(produced.has(a.stat), `${a.id} 依赖的 ${a.stat} 没有任何地方在埋点`).toBe(true)
    }
  })

  it('achievement ids are unique', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
