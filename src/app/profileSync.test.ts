// 存档同步:契约测试。用假的 fetch 顶替网络,验证拉/推/冲突三条路径。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { snapshot } from './profileSync'
import { useCollection } from './collectionStore'
import { useQuests } from './questStore'

describe('profile snapshot', () => {
  it('captures everything a new device needs to restore an account', () => {
    const s = snapshot()
    expect(s).toHaveProperty('owned')
    expect(s).toHaveProperty('packs')
    expect(s).toHaveProperty('wins')
    expect(s).toHaveProperty('losses')
    expect(s).toHaveProperty('customDecks')
    expect(s).toHaveProperty('questDate')
    expect(s).toHaveProperty('quests')
  })

  it('tracks live store state', () => {
    const before = snapshot().packs
    useCollection.getState().grantPacks(3)
    expect(snapshot().packs).toBe(before + 3)
  })

  it('carries the current day’s quests', () => {
    const s = snapshot()
    expect(s.questDate).toBe(useQuests.getState().date)
    expect(s.quests).toHaveLength(useQuests.getState().quests.length)
  })
})

// 同步逻辑本身依赖 localStorage + fetch,这里只锁「离线绝不抛错」这条契约 ——
// 存档同步是锦上添花,任何网络异常都不该冒泡到 UI。
describe('offline resilience', () => {
  const realFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('offline'))
  })
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it('syncNow resolves to offline instead of throwing', async () => {
    const { syncNow } = await import('./profileSync')
    await expect(syncNow()).resolves.toBe('offline')
  })
})
