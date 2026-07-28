import { describe, expect, it } from 'vitest'
import { RANKS, rankOf, toNextRank, warMerit } from './ranks'

describe('军衔', () => {
  it('衔级门槛严格递增', () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].merit).toBeGreaterThan(RANKS[i - 1].merit)
    }
  })

  it('零战功是白身,越界不会掉出数组', () => {
    expect(rankOf(0).rank.name.zh).toBe('白身')
    expect(rankOf(-5).rank.name.zh).toBe('白身')
    expect(rankOf(999_999).rank.name.zh).toBe(RANKS[RANKS.length - 1].name.zh)
    expect(rankOf(999_999).next).toBeUndefined()
  })

  // 权重按「这一局有多难」给,不按模式受不受欢迎
  it('难的模式给的战功更多', () => {
    expect(warMerit({ bossRushBest: 1 })).toBeGreaterThan(warMerit({ casualWins: 1 }))
    expect(warMerit({ campaignCleared: 1 })).toBeGreaterThan(warMerit({ ladderWins: 1 }))
  })

  it('缺项按 0 算 —— 没玩过的模式不该让战功变成 NaN', () => {
    expect(warMerit({})).toBe(0)
    expect(Number.isFinite(warMerit({ towerBest: 3 }))).toBe(true)
  })

  it('到下一衔的进度落在 0..1', () => {
    for (const m of [0, 25, 300, 1500]) {
      const p = toNextRank(m)!
      expect(p.ratio).toBeGreaterThanOrEqual(0)
      expect(p.ratio).toBeLessThanOrEqual(1)
      expect(p.need).toBeGreaterThan(0)
    }
    expect(toNextRank(999_999)).toBeNull()
  })
})
