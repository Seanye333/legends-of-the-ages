import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BATTLES_BY_ID } from '../content/historyBattles'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

// 历史名战进度。与 campaign 不同,这些是**可自由重打的设定局**,不做线性解锁 ——
// 想打哪场打哪场。只记两件事:通了哪几场、当前正在打哪一场(结算时认关)。
//
// 奖励**只发一次**(首通),重打不给 —— 否则最软的一场会变成刷奖励的农场。
// 持久化沿用 campaign 的做法(zustand persist + 本地 key),不接云端同步;
// 若日后要同步,与 campaign 一并处理更一致。

interface HistoryState {
  cleared: string[] // 已通关的战役 id
  active: string | null // 正在挑战的战役 id
  isCleared(battleId: string): boolean
  begin(battleId: string): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  abandon(): void
  reset(): void
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      cleared: [],
      active: null,

      isCleared(battleId) {
        return get().cleared.includes(battleId)
      },

      begin(battleId) {
        if (!BATTLES_BY_ID[battleId]) return false
        set({ active: battleId })
        return true
      },

      // 返回本次发放的奖励;没有则返回 null(输了、或这场早就通过了)
      settle(win) {
        const { active, cleared } = get()
        if (!active) return null
        set({ active: null })
        if (!win) return null
        const battle = BATTLES_BY_ID[active]
        if (!battle) return null
        if (cleared.includes(active)) return null // 重打不再发奖
        set({ cleared: [...cleared, active] })
        useAchievements.getState().bump('historyCleared')
        useCollection.getState().grantPacks(battle.rewardPacks)
        useCollection.setState({
          merit: useCollection.getState().merit + battle.rewardMerit,
        })
        return { merit: battle.rewardMerit, packs: battle.rewardPacks }
      },

      abandon() {
        set({ active: null })
      },

      reset() {
        set({ cleared: [], active: null })
      },
    }),
    { name: 'qiangu-history' },
  ),
)
