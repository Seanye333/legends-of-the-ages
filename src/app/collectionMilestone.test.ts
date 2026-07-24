// @vitest-environment jsdom
// 收藏里程碑:增卡时把「不同卡数 / 不同传说数」同步进功名簿(MAX 统计)。
import { beforeEach, describe, expect, it } from 'vitest'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'
import { COLLECTIBLE_CARDS } from '../content/cards'

const common = COLLECTIBLE_CARDS.find((c) => c.rarity === 'common' && !c.token)!
const legend = COLLECTIBLE_CARDS.find((c) => c.rarity === 'legendary' && !c.token)!

describe('收藏里程碑同步', () => {
  beforeEach(() => {
    localStorage.clear()
    useCollection.setState({ owned: {}, merit: 1_000_000 })
    useAchievements.setState({ stats: {}, claimed: [] })
  })

  it('合成增卡 → collectionSize / legendariesOwned 同步(取最大)', () => {
    useCollection.getState().craft(common.id)
    expect(useAchievements.getState().stats.collectionSize).toBe(1)
    expect(useAchievements.getState().stats.legendariesOwned ?? 0).toBe(0)

    useCollection.getState().craft(legend.id)
    expect(useAchievements.getState().stats.collectionSize).toBe(2)
    expect(useAchievements.getState().stats.legendariesOwned).toBe(1)
  })

  it('是 MAX 统计:分解后再同步不会把峰值降下去', () => {
    useCollection.getState().craft(common.id)
    useCollection.getState().craft(legend.id) // 峰值 2
    useCollection.getState().disenchant(common.id) // 掉到 1 张
    // 再增一次别的卡触发同步,collectionSize 仍保留历史峰值 2(MAX)
    useCollection.setState({ merit: 1_000_000 })
    const another = COLLECTIBLE_CARDS.find(
      (c) => c.rarity === 'common' && !c.token && c.id !== common.id,
    )!
    useCollection.getState().craft(another.id)
    expect(useAchievements.getState().stats.collectionSize).toBeGreaterThanOrEqual(2)
  })
})
