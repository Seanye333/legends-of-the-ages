import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCollection } from './collectionStore'
import { safeStorage } from './safeStorage'

// 連日到營 —— 连续登录。
//
// 【为什么值得做】
// 这个游戏的每日内容(每日一将、每日军令、每日谜题、今日战事)已经不少了,
// 但**没有任何东西奖励「连续」** —— 断一天和断一个月对玩家是一样的。
// 连续性是留存里最便宜的一根杠杆:它不要求你今天多玩,只要求你别断。
//
// 【为什么奖励压得很低】
// 功勋的出入口是记在 ARCHITECTURE 经济一节里的一张表,任何新入口都会往那边压。
// 每天 10 点、七天封顶 40 —— 一周不到一包的量。它买的是「回来看一眼」,
// 不是「肝」。**刻意不发卡包**:卡包产出会直接冲击「一局一包」的基线。
//
// 【断签的判定】
// 只认「昨天」。跨时区/改系统时间这类问题不做防御 —— 这是单机的每日奖励,
// 防作弊的收益低于代码复杂度(而联机侧一个字节都不依赖它)。
const DAILY_MERIT = 10
const STREAK_CAP = 7

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isYesterday(prev: string, today: string): boolean {
  const [py, pm, pd] = prev.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  if (!py || !ty) return false
  const a = Date.UTC(py, pm - 1, pd)
  const b = Date.UTC(ty, tm - 1, td)
  return b - a === 86_400_000
}

interface StreakState {
  lastDay: string
  streak: number
  best: number
  // 今天第一次打开时调用:返回本次发放的功勋(0 = 今天已经领过)
  checkIn(today?: string): { merit: number; streak: number; isNew: boolean }
  reset(): void
}

export const useStreak = create<StreakState>()(
  persist(
    (set, get) => ({
      lastDay: '',
      streak: 0,
      best: 0,

      checkIn(today = dayKey()) {
        const { lastDay, streak, best } = get()
        if (lastDay === today) return { merit: 0, streak, isNew: false }
        const next = isYesterday(lastDay, today) ? streak + 1 : 1
        const merit = Math.min(next, STREAK_CAP) * DAILY_MERIT
        set({ lastDay: today, streak: next, best: Math.max(best, next) })
        useCollection.setState({ merit: useCollection.getState().merit + merit })
        return { merit, streak: next, isNew: true }
      },

      reset() {
        set({ lastDay: '', streak: 0, best: 0 })
      },
    }),
    { name: 'qiangu-streak', storage: safeStorage },
  ),
)

export const STREAK_DAILY_MERIT = DAILY_MERIT
export const STREAK_CAP_DAYS = STREAK_CAP
