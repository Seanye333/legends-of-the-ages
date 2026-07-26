import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 每日一将只需记「上次看的是哪天」—— 用来在标题页给未看的当日名将加个高亮。
// 纯 UI 状态,本地 localStorage 即可,不进云存档(换设备重看一眼无所谓)。
interface DailyGeneralState {
  lastSeen: string // YYYY-MM-DD
  markSeen(day: string): void
}

export const useDailyGeneral = create<DailyGeneralState>()(
  persist(
    (set) => ({
      lastSeen: '',
      markSeen: (day) => set({ lastSeen: day }),
    }),
    { name: 'qiangu-daily-general' },
  ),
)
