import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { WEEKLY_BRAWL_MERIT } from '../content/weeklyBrawl'
import { useCollection } from './collectionStore'
import { safeStorage } from './safeStorage'

// 每周乱斗进度:只记「上一次拿到首胜的是哪一周」。
// 奖励每周只发一次 —— 否则当值乱斗会变成刷功勋的农场。
interface WeeklyBrawlState {
  wonWeek: string // 已领过首胜奖励的周键
  isWon(week: string): boolean
  settleWin(week: string): number // 返回本次发放的功勋(0 = 本周已领过)
  reset(): void
}

export const useWeeklyBrawl = create<WeeklyBrawlState>()(
  persist(
    (set, get) => ({
      wonWeek: '',
      isWon: (week) => get().wonWeek === week,
      settleWin(week) {
        if (get().wonWeek === week) return 0
        set({ wonWeek: week })
        useCollection.setState({ merit: useCollection.getState().merit + WEEKLY_BRAWL_MERIT })
        return WEEKLY_BRAWL_MERIT
      },
      reset: () => set({ wonWeek: '' }),
    }),
    { name: 'qiangu-weekly-brawl', storage: safeStorage },
  ),
)
