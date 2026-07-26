import { describe, expect, it } from 'vitest'
import { DAILY_GENERAL_POOL, dailyGeneralFor, dailyGeneralIdFor } from './dailyGeneral'
import { LORE } from './generated/lore.gen'

describe('每日一将', () => {
  it('池非空,且每位都有卡 + 有中文列传', () => {
    expect(DAILY_GENERAL_POOL.length).toBeGreaterThan(0)
    for (const id of DAILY_GENERAL_POOL) {
      expect(LORE[id]?.bio?.zh, id).toBeTruthy()
    }
  })

  it('同一天确定性:同日期恒返回同一位', () => {
    expect(dailyGeneralIdFor('2026-07-26')).toBe(dailyGeneralIdFor('2026-07-26'))
  })

  it('不同日期会换人(抽样若干天,至少出现两位不同)', () => {
    const seen = new Set<string>()
    for (let d = 1; d <= 20; d++) {
      const id = dailyGeneralIdFor(`2026-08-${String(d).padStart(2, '0')}`)
      if (id) seen.add(id)
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('dailyGeneralFor 返回可用的卡 + 列传', () => {
    const g = dailyGeneralFor('2026-07-26')
    expect(g).not.toBeNull()
    expect(g!.card.name.zh).toBeTruthy()
    expect(g!.lore.bio.zh).toBeTruthy()
  })
})
