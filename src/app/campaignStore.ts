import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BOSSES } from '../content/campaign'
import { useCollection } from './collectionStore'

// 冒险模式进度。只记两件事:打通了哪几关、当前正在挑战哪一关。
// 关卡按顺序解锁 —— 通了第 N 关才能打第 N+1 关。
//
// 奖励**只发一次**(首通),重打不给。否则最简单的第一关会变成刷奖励的农场,
// 而它的难度是按「新手第一关」定的。

interface CampaignState {
  cleared: string[] // 已通关的 boss id
  active: string | null // 正在挑战的 boss id(对局结算时用它认关卡)
  unlockedCount(): number
  isUnlocked(bossId: string): boolean
  begin(bossId: string): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  abandon(): void
  reset(): void
}

export const useCampaign = create<CampaignState>()(
  persist(
    (set, get) => ({
      cleared: [],
      active: null,

      // 已解锁的关卡数 = 已通关数 + 1(下一关),上限为总关数
      unlockedCount() {
        return Math.min(BOSSES.length, get().cleared.length + 1)
      },

      isUnlocked(bossId) {
        const idx = BOSSES.findIndex((b) => b.id === bossId)
        return idx >= 0 && idx < get().unlockedCount()
      },

      begin(bossId) {
        if (!get().isUnlocked(bossId)) return false
        set({ active: bossId })
        return true
      },

      // 返回本次发放的奖励;没有则返回 null(输了、或这一关早就通过了)
      settle(win) {
        const { active, cleared } = get()
        if (!active) return null
        set({ active: null })
        if (!win) return null
        const boss = BOSSES.find((b) => b.id === active)
        if (!boss) return null
        if (cleared.includes(active)) return null // 重打不再发奖
        set({ cleared: [...cleared, active] })
        useCollection.getState().grantPacks(boss.rewardPacks)
        useCollection.setState({
          merit: useCollection.getState().merit + boss.rewardMerit,
        })
        return { merit: boss.rewardMerit, packs: boss.rewardPacks }
      },

      abandon() {
        set({ active: null })
      },

      reset() {
        set({ cleared: [], active: null })
      },
    }),
    { name: 'qiangu-campaign' },
  ),
)
