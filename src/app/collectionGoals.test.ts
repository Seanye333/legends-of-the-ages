// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useCollection } from './collectionStore'
import { claimableGoals, eraProgress, goalId, ERA_ORDER } from '../content/collectionGoals'
import { COLLECTIBLE_CARDS } from '../content/cards'
import { ERA_OF } from '../content/eras'

beforeEach(() => {
  localStorage.clear()
  useCollection.setState({ owned: {}, merit: 0, collectionClaimed: [] })
})

// 全收先秦所需的那一批
const preQin = COLLECTIBLE_CARDS.filter((c) => ERA_OF[c.dynasty] === 'pre-qin')
const ownAll = (cards: typeof preQin) =>
  Object.fromEntries(cards.map((c) => [c.id, 1])) as Record<string, number>

describe('收藏度', () => {
  it('六个时代块都统计得到,总数加起来是整个可收集卡池', () => {
    const p = eraProgress({})
    expect(p).toHaveLength(ERA_ORDER.length)
    expect(p.reduce((n, x) => n + x.total, 0)).toBe(COLLECTIBLE_CARDS.length)
  })

  it('一张没有时进度全 0,不会出现 NaN', () => {
    for (const p of eraProgress({})) {
      expect(p.owned).toBe(0)
      expect(Number.isFinite(p.ratio)).toBe(true)
    }
  })

  it('全收一个时代块 → 三档全部可领', () => {
    const owned = ownAll(preQin)
    const goals = claimableGoals(owned, []).filter((g) => g.era === 'pre-qin')
    expect(goals).toHaveLength(3)
    expect(goals.map((g) => g.id)).toContain(goalId('pre-qin', 1))
  })

  it('领过的不再出现,功勋只发一次', () => {
    useCollection.setState({ owned: ownAll(preQin) })
    const id = goalId('pre-qin', 0.3)
    expect(useCollection.getState().claimCollectionGoal(id)).toBe(150)
    expect(useCollection.getState().merit).toBe(150)
    // 再领一次拿不到
    expect(useCollection.getState().claimCollectionGoal(id)).toBe(0)
    expect(useCollection.getState().merit).toBe(150)
  })

  it('没达成的档位领不了', () => {
    expect(useCollection.getState().claimCollectionGoal(goalId('ming-qing', 1))).toBe(0)
    expect(useCollection.getState().merit).toBe(0)
  })
})
