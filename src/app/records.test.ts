// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { isBetter, useRecords, type RecordKey } from './recordsStore'
import { EMPTY_STATS, type MatchStats } from './matchStats'
import { bossHpFor, legacyModifiers, LEGACY_HP_PER_CYCLE } from '../content/campaign'

const stats = (over: Partial<MatchStats>): MatchStats => ({ ...EMPTY_STATS, ...over })

describe('個人紀錄', () => {
  beforeEach(() => {
    localStorage.clear()
    useRecords.setState({ best: {} })
  })

  it('速勝是唯一「越小越好」的一项', () => {
    expect(isBetter('fastestWin', 5, 8)).toBe(true)
    expect(isBetter('fastestWin', 9, 8)).toBe(false)
    expect(isBetter('mostDamage', 40, 30)).toBe(true)
    expect(isBetter('mostDamage', 20, 30)).toBe(false)
    // 没有旧纪录时一律算破
    for (const k of ['fastestWin', 'mostDamage'] as RecordKey[]) {
      expect(isBetter(k, 1, undefined)).toBe(true)
    }
  })

  it('输了不记速勝 —— 输得快不是纪录', () => {
    const R = () => useRecords.getState()
    R().submit(stats({ turns: 4, damageDealt: 10 }), false, '2026-07-20')
    expect(R().best.fastestWin).toBeUndefined()
    expect(R().best.mostDamage?.value).toBe(10)
  })

  it('零值不算纪录 —— 否则第一局会把每一项都「破」一遍', () => {
    const R = () => useRecords.getState()
    const broken = R().submit(stats({ turns: 6 }), true, '2026-07-20')
    expect(broken).toEqual(['fastestWin'])
    expect(R().best.mostSlain).toBeUndefined()
  })

  it('返回本局刷新了哪几项,并记下日期', () => {
    const R = () => useRecords.getState()
    R().submit(stats({ turns: 9, damageDealt: 30, enemyGeneralsSlain: 3 }), true, '2026-07-20')
    const broken = R().submit(
      stats({ turns: 12, damageDealt: 50, enemyGeneralsSlain: 2 }),
      true,
      '2026-07-21',
    )
    // 伤害破了(30→50);回合数更长、斩将更少,都不算
    expect(broken).toEqual(['mostDamage'])
    expect(R().best.mostDamage).toEqual({ value: 50, date: '2026-07-21' })
    expect(R().best.fastestWin).toEqual({ value: 9, date: '2026-07-20' })
  })

  it('连胜单独提交,且只在更长时才更新', () => {
    const R = () => useRecords.getState()
    expect(R().submitStreak(3, '2026-07-20')).toBe(true)
    expect(R().submitStreak(2, '2026-07-21')).toBe(false)
    expect(R().best.longestStreak?.value).toBe(3)
  })
})

describe('傳承', () => {
  it('cycle 为 0 时两条曲线都退化成恒等式 —— 首轮一个数都没变', () => {
    expect(bossHpFor(52, 0)).toBe(52)
    expect(legacyModifiers(0)).toBeUndefined()
  })

  it('Boss 血量按轮次连续涨,玩家的傳承是台阶', () => {
    expect(bossHpFor(100, 1)).toBe(Math.round(100 * (1 + LEGACY_HP_PER_CYCLE)))
    expect(bossHpFor(100, 2)).toBeGreaterThan(bossHpFor(100, 1))
    // 台阶:第 1 轮只有护甲,第 2 轮多抽,第 3 轮主公技减费
    expect(legacyModifiers(1)).toEqual({ startArmor: 3 })
    expect(legacyModifiers(2)?.bonusHandSize).toBe(1)
    expect(legacyModifiers(2)?.heroPowerCostDelta).toBeUndefined()
    expect(legacyModifiers(3)?.heroPowerCostDelta).toBe(-1)
  })

  it('护甲封顶 —— 再多就不是「资本」而是「免打」了', () => {
    expect(legacyModifiers(99)?.startArmor).toBe(12)
  })
})
