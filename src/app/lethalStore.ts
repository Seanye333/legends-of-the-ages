import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { LESSONS_BY_ID } from '../content/lessons'
import { LETHAL_PUZZLES } from '../content/lethalPuzzles'
import { DAILY_SLOTS, daysBetween } from '../content/dailyPuzzle'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

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
  // 讲堂实练完成的课(与谜题分开记 —— 混进 solved 会让「全套通关」永远凑不齐)
  lessonsDone: string[]
  completedRewardGiven: boolean // 全套通关奖是否已发(防重复)
  dailySolvedDate: string | null // 每日谜题最近一次解开的日期(YYYY-MM-DD)
  dailyStreak: number // 当前连续解题天数
  dailyBestStreak: number // 历史最长连续
  // 每日三题:今天解开了哪几阵。**可选持久字段** —— 老存档没有它,
  // 读作「今天一阵都没解」;而 dailySolvedDate 仍然是连击的唯一依据,
  // 所以老玩家的连击一天都不会丢。
  dailySlots?: { date: string; slots: number[] }
  isSolved(id: string): boolean
  solvedCount(): number
  // 记一次成功。返回本次实际发放的奖励(幂等:重解返回 firstSolve:false、零奖励)
  solve(id: string): PuzzleReward
  isDailySolved(date: string): boolean
  // 今天这一阵解了没有
  isSlotSolved(date: string, slot: number): boolean
  solvedSlots(date: string): number[]
  // 记一次每日谜题成功。同一天同一阵重解幂等(firstSolve:false、零奖励)
  solveDaily(date: string, slot?: number): PuzzleReward
  // 连击是否仍然连续(今天没解、但昨天解了 → 仍显示当前连击;隔了两天以上 → 已断)
  streakAsOf(today: string): number
  reset(): void
}

export const useLethal = create<LethalState>()(
  persist(
    (set, get) => ({
      solved: [],
      lessonsDone: [],
      completedRewardGiven: false,
      dailySolvedDate: null,
      dailyStreak: 0,
      dailyBestStreak: 0,

      isSolved(id) {
        return get().solved.includes(id)
      },

      isDailySolved(date) {
        return get().dailySolvedDate === date
      },

      isSlotSolved(date, slot) {
        const d = get().dailySlots
        return d?.date === date && d.slots.includes(slot)
      },

      solvedSlots(date) {
        const d = get().dailySlots
        return d?.date === date ? d.slots : []
      },

      streakAsOf(today) {
        const { dailySolvedDate, dailyStreak } = get()
        if (!dailySolvedDate) return 0
        const gap = daysBetween(dailySolvedDate, today)
        // 今天已解(gap 0)或昨天解的(gap 1)→ 连击仍算数;隔两天以上 → 已断
        return gap <= 1 ? dailyStreak : 0
      },

      solveDaily(date, slot = 0) {
        if (get().isSlotSolved(date, slot)) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        const prevSlots = get().solvedSlots(date)
        const nextSlots = [...prevSlots, slot].sort((a, b) => a - b)
        // 连击按**天**算,不按阵算:今天解开第一阵就续上,后两阵不再动连击。
        // 三阵全解才续连击的话,断连的门槛会从「今天没空」变成「今天没空全打完」,
        // 那正好是连击机制最不该惩罚的那种人。
        const firstOfDay = prevSlots.length === 0
        const prevDate = get().dailySolvedDate
        const streak = firstOfDay
          ? prevDate && daysBetween(prevDate, date) === 1
            ? get().dailyStreak + 1
            : 1
          : get().dailyStreak
        set({
          dailySolvedDate: date,
          dailyStreak: streak,
          dailyBestStreak: Math.max(get().dailyBestStreak, streak),
          dailySlots: { date, slots: nextSlots },
        })
        // 三阵均分,合计仍是原来一题的额度 —— 这次改动对功勋经济零净影响。
        // 三阵同档(挖矿池全部 difficulty 2),按难度差别给钱是在给一个
        // 不存在的梯度定价。
        const merit = Math.round(DAILY_MERIT / DAILY_SLOTS)
        useCollection.setState({ merit: useCollection.getState().merit + merit })
        useAchievements.getState().bump('puzzlesSolved')
        if (firstOfDay) useAchievements.getState().bump('bestPuzzleStreak', streak) // MAX 统计
        return {
          firstSolve: true,
          merit,
          packs: 0,
          allComplete: nextSlots.length >= DAILY_SLOTS,
        }
      },

      solvedCount() {
        return get().solved.length
      },

      solve(id) {
        // 讲堂实练走同一条谜题通道,但它不是「谜题」——
        // 不计进 solved(否则「全套通关」永远凑不齐)、不发首解功勋,
        // 只记一条自己的成就进度。
        if (LESSONS_BY_ID[id]) {
          if (get().lessonsDone.includes(id)) {
            return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
          }
          set({ lessonsDone: [...get().lessonsDone, id] })
          useAchievements.getState().bump('lessonsDone')
          return { firstSolve: true, merit: 0, packs: 0, allComplete: false }
        }
        // 只认真实存在的谜题 id
        if (!LETHAL_PUZZLES.some((p) => p.id === id)) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        if (get().solved.includes(id)) {
          return { firstSolve: false, merit: 0, packs: 0, allComplete: false }
        }
        const solved = [...get().solved, id]
        set({ solved })
        // 首解功勋 + 永久进度
        useCollection.setState({ merit: useCollection.getState().merit + FIRST_SOLVE_MERIT })
        useAchievements.getState().bump('puzzlesSolved')
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
        set({
          solved: [],
          lessonsDone: [],
          completedRewardGiven: false,
          dailySolvedDate: null,
          dailyStreak: 0,
          dailyBestStreak: 0,
          dailySlots: undefined,
        })
      },
    }),
    { name: 'qiangu-lethal' },
  ),
)
