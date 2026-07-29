// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { OMENS, omenFor } from '../content/stargazing'
import { DIVERGENCES, BATTLES_BY_ID } from '../content/historyBattles'
import { useHistory } from './historyStore'

describe('觀星', () => {
  it('同一天永远是同一颗星 —— 所有人对得上话', () => {
    for (const d of ['2026-07-29', '2026-01-01', '2027-12-31']) {
      expect(omenFor(d).id).toBe(omenFor(d).id)
    }
  })

  it('修正压在「开局多两点护甲」这个量级 —— 玩家选不了天象,大修正会变成「今天别玩」', () => {
    for (const o of OMENS) {
      const m = o.modifiers
      expect(m.startArmor ?? 0).toBeLessThanOrEqual(3)
      expect(m.bonusHandSize ?? 0).toBeLessThanOrEqual(1)
      expect(Math.abs(m.handCostDelta ?? 0)).toBeLessThanOrEqual(1)
      expect(Math.abs(m.heroPowerCostDelta ?? 0)).toBeLessThanOrEqual(1)
      expect(Math.abs(m.startMorale ?? 0)).toBeLessThanOrEqual(1)
      expect(m.startSupply ?? 0).toBeLessThanOrEqual(2)
      // 天象不该往场上放东西:开局白送单位是最不「像天气」的一种修正
      expect(m.startTokens).toBeUndefined()
    }
  })

  it('一年下来八种天象都轮得到', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 365; i++) {
      const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
      seen.add(omenFor(d).id)
    }
    expect(seen.size).toBe(OMENS.length)
  })
})

describe('史實分歧點', () => {
  beforeEach(() => {
    localStorage.clear()
    useHistory.setState({
      cleared: [],
      reversed: [],
      diverged: [],
      active: null,
      activeReverse: false,
      activeDiverge: false,
    })
  })

  it('每个分歧点都钉在一场真实存在的名局上', () => {
    for (const d of DIVERGENCES) expect(BATTLES_BY_ID[d.battleId], d.battleId).toBeDefined()
  })

  it('要先按史实赢一次才解锁 ——「如果没有东风」得先靠东风赢过', () => {
    const H = () => useHistory.getState()
    expect(H().isDivergeUnlocked('hb-chibi')).toBe(false)
    expect(H().begin('hb-chibi', false, true)).toBe(false)
    useHistory.setState({ cleared: ['hb-chibi'] })
    expect(H().isDivergeUnlocked('hb-chibi')).toBe(true)
    expect(H().begin('hb-chibi', false, true)).toBe(true)
  })

  it('分歧点走自己那条账:只给功勋、不给卡包、不计进 cleared', () => {
    const H = () => useHistory.getState()
    useHistory.setState({ cleared: ['hb-chibi'] })
    H().begin('hb-chibi', false, true)
    const r = H().settle(true)
    expect(r?.packs).toBe(0)
    expect(r?.merit).toBeGreaterThan(0)
    expect(H().diverged).toEqual(['hb-chibi'])
    expect(H().cleared).toEqual(['hb-chibi']) // 没有被重复记一次
    // 重打不再发
    H().begin('hb-chibi', false, true)
    expect(H().settle(true)).toBeNull()
  })
})
