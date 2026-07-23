import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LETHAL_PUZZLES } from '../content/lethalPuzzles'
import { useCollection } from './collectionStore'

// 斩杀谜题进度。只记「解开了哪几道」+「全套通关奖是否已发」。
//
// 奖励刻意保守(经济很敏感,卡包产出会冲击「一局一包」基线):
// 每道题**首解**给少量功勋,**全部解开**再给一个卡包 —— 且都只发一次,重解不给。
const FIRST_SOLVE_MERIT = 20
const COMPLETE_ALL_PACKS = 1
// 每日谜题:每天首解给一点功勋(略高于静态题,鼓励每天来),同一天重解不再给。不发卡包。
const DAILY_MERIT = 30

export interface PuzzleReward {
  firstSolve: boolean // 是否首次解开(false = 重解,无奖励)
  merit: number
  packs: number
  allComplete: boolean // 本次是否凑齐了全套(触发通关奖)
}

interface LethalState {
  solved: string[] // 已解开的谜题 id
  completedRewardGiven: boolean // 全套通关奖是否已发(防重复)
  dailySolvedDate: string | null // 每日谜题最近一次解开的日期(YYYY-MM-DD)
  isSolved(id: string): boolean
  solvedCount(): number
  // 记一次成功。返回本次实际发放的奖励(幂等:重解返回 firstSolve:false、零奖励)
  solve(id: string): PuzzleReward
  isDailySolved(date: string): boolean
  // 记一次每日谜题成功。同一天重解幂等(firstSolve:false、零奖励)
  solveDaily(date: string): PuzzleReward
  reset(): void
}

export const useLethal = create<LethalState>()(
  persist(
    (set, get) => ({
      solved: [],
      completedRewardGiven: false,
      dailySolvedDate: null,

      isSolved(id) {
        return get().solved.includes(id)
      },

      isDailySolved(date) {
        return get().dailySolvedDate === date
      },

      solveDaily(date) {
        if (get().dailySolvedDate === date) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        set({ dailySolvedDate: date })
        useCollection.setState({ merit: useCollection.getState().merit + DAILY_MERIT })
        return { firstSolve: true, merit: DAILY_MERIT, packs: 0, allComplete: false }
      },

      solvedCount() {
        return get().solved.length
      },

      solve(id) {
        // 只认真实存在的谜题 id
        if (!LETHAL_PUZZLES.some((p) => p.id === id)) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        if (get().solved.includes(id)) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        const solved = [...get().solved, id]
        set({ solved })
        // 首解功勋
        useCollection.setState({ merit: useCollection.getState().merit + FIRST_SOLVE_MERIT })
        // 全套通关:再补一个卡包(只一次)
        let packs = 0
        let allComplete = false
        const all = LETHAL_PUZZLES.every((p) => solved.includes(p.id))
        if (all && !get().completedRewardGiven) {
          set({ completedRewardGiven: true })
          useCollection.getState().grantPacks(COMPLETE_ALL_PACKS)
          packs = COMPLETE_ALL_PACKS
          allComplete = true
        }
        return { firstSolve: true, merit: FIRST_SOLVE_MERIT, packs, allComplete }
      },

      reset() {
        set({ solved: [], completedRewardGiven: false, dailySolvedDate: null })
      },
    }),
    { name: 'qiangu-lethal' },
  ),
)
