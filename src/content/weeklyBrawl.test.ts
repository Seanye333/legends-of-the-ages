import { describe, expect, it } from 'vitest'
import { BRAWLS } from './brawls'
import { weekKey, weeklyBrawlFor, weeklyBrawlIndexFor } from './weeklyBrawl'

describe('每周乱斗', () => {
  it('weekKey 形如 YYYY-Www,且同一周内每天相同', () => {
    // 2026-07-20(周一)~ 2026-07-26(周日)属同一 ISO 周
    const mon = weekKey(new Date(2026, 6, 20))
    const sun = weekKey(new Date(2026, 6, 26))
    expect(mon).toMatch(/^\d{4}-W\d{2}$/)
    expect(sun).toBe(mon)
  })

  it('跨周会换周键', () => {
    const w1 = weekKey(new Date(2026, 6, 20))
    const w2 = weekKey(new Date(2026, 6, 27))
    expect(w2).not.toBe(w1)
  })

  it('当值下标确定性且落在池内', () => {
    const k = '2026-W30'
    expect(weeklyBrawlIndexFor(k)).toBe(weeklyBrawlIndexFor(k))
    expect(weeklyBrawlIndexFor(k)).toBeGreaterThanOrEqual(0)
    expect(weeklyBrawlIndexFor(k)).toBeLessThan(BRAWLS.length)
    expect(weeklyBrawlFor(k)).toBeTruthy()
  })

  it('不同周会轮到不同规则(抽样若干周)', () => {
    const seen = new Set<number>()
    for (let w = 1; w <= 20; w++) seen.add(weeklyBrawlIndexFor(`2026-W${String(w).padStart(2, '0')}`))
    expect(seen.size).toBeGreaterThan(1)
  })
})
