import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCollection } from './collectionStore'
import { safeStorage } from './safeStorage'

// 稽古(历史小测验)进度:只按天封顶发奖 —— 题库是生成的、几乎无限,
// 不封顶就是无限功勋泵。答对仍然给正反馈,只是超出当日额度不再计功勋。
const DAILY_CAP = 60

interface QuizState {
  day: string // 上次结算的日期
  earnedToday: number
  bestStreak: number
  totalCorrect: number
  award(day: string, correct: number): number // 返回实际发放的功勋
  noteStreak(n: number): void
  reset(): void
}

export const useQuiz = create<QuizState>()(
  persist(
    (set, get) => ({
      day: '',
      earnedToday: 0,
      bestStreak: 0,
      totalCorrect: 0,
      award(day, correct) {
        const s = get()
        const earned = s.day === day ? s.earnedToday : 0
        const room = Math.max(0, DAILY_CAP - earned)
        const give = Math.min(room, correct)
        set({ day, earnedToday: earned + give, totalCorrect: s.totalCorrect + 0 })
        if (give > 0) {
          useCollection.setState({ merit: useCollection.getState().merit + give })
        }
        return give
      },
      noteStreak(n) {
        set((s) => ({ bestStreak: Math.max(s.bestStreak, n), totalCorrect: s.totalCorrect + n }))
      },
      reset: () => set({ day: '', earnedToday: 0, bestStreak: 0, totalCorrect: 0 }),
    }),
    { name: 'qiangu-quiz', storage: safeStorage },
  ),
)
export const QUIZ_DAILY_CAP = DAILY_CAP
