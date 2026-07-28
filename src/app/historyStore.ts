import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { REVERSE_BY_BATTLE } from '../content/historyBattles'
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
  // 逆位挑战(用历史上输的那一方打赢)通过的战役 id。
  // 与正位分开记 —— 它是第二种打法,不是同一场的重打(和关底试炼同一个口径)。
  reversed: string[]
  active: string | null // 正在挑战的战役 id
  activeReverse: boolean
  isCleared(battleId: string): boolean
  isReverseUnlocked(battleId: string): boolean
  begin(battleId: string, reverse?: boolean): boolean
  settle(win: boolean): { merit: number; packs: number } | null
  abandon(): void
  reset(): void
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      cleared: [],
      reversed: [],
      active: null,
      activeReverse: false,

      isCleared(battleId) {
        return get().cleared.includes(battleId)
      },

      // 逆位要先正位通关才解锁 —— 先把这一仗按史实打赢一次,再来问「反过来呢」
      isReverseUnlocked(battleId) {
        return get().cleared.includes(battleId) && Boolean(REVERSE_BY_BATTLE[battleId])
      },

      begin(battleId, reverse = false) {
        if (!BATTLES_BY_ID[battleId]) return false
        if (reverse && !get().isReverseUnlocked(battleId)) return false
        set({ active: battleId, activeReverse: reverse })
        return true
      },

      // 返回本次发放的奖励;没有则返回 null(输了、或这场早就通过了)
      settle(win) {
        const { active, activeReverse, cleared, reversed } = get()
        if (!active) return null
        set({ active: null, activeReverse: false })
        if (!win) return null
        const battle = BATTLES_BY_ID[active]
        if (!battle) return null
        // 逆位走自己那条账:只给功勋不给卡包(与关底试炼同一条原则 ——
        // 卡包产出会冲击「一局一包」的基线),也不 bump historyCleared:
        // 那条成就数的是战役数,不是打法数。
        if (activeReverse) {
          const rev = REVERSE_BY_BATTLE[active]
          if (!rev || reversed.includes(active)) return null
          set({ reversed: [...reversed, active] })
          useCollection.setState({
            merit: useCollection.getState().merit + rev.rewardMerit,
          })
          return { merit: rev.rewardMerit, packs: 0 }
        }
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
        set({ active: null, activeReverse: false })
      },

      reset() {
        set({ cleared: [], reversed: [], active: null, activeReverse: false })
      },
    }),
    { name: 'qiangu-history' },
  ),
)
