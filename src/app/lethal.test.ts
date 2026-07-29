// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useLethal } from './lethalStore'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'
import { LETHAL_PUZZLES } from '../content/lethalPuzzles'

const FIRST = LETHAL_PUZZLES[0].id
const SECOND = LETHAL_PUZZLES[1].id

describe('lethalStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useLethal.setState({
      solved: [],
      completedRewardGiven: false,
      dailySolvedDate: null,
      dailyStreak: 0,
      dailyBestStreak: 0,
      // 每日三题的槽位。**这一行漏了的话上面那些用例会互相污染** ——
      // 这里是手写的字段清单,不是 store 的 reset(),加了新持久字段就得补进来。
      // 三题上线时就是这么红的:「解谜计入成就」那条突然只涨了 1。
      dailySlots: undefined,
    })
    useCollection.setState({ merit: 0 })
    useAchievements.setState({ stats: {}, claimed: [] })
  })

  it('首解记进度并发功勋', () => {
    const before = useCollection.getState().merit
    const r = useLethal.getState().solve(FIRST)
    expect(r.firstSolve).toBe(true)
    expect(r.merit).toBeGreaterThan(0)
    expect(useLethal.getState().isSolved(FIRST)).toBe(true)
    expect(useCollection.getState().merit).toBe(before + r.merit)
  })

  it('重解幂等:不再计入、不再发奖', () => {
    useLethal.getState().solve(FIRST)
    const meritAfterFirst = useCollection.getState().merit
    const r = useLethal.getState().solve(FIRST)
    expect(r.firstSolve).toBe(false)
    expect(r.merit).toBe(0)
    expect(useLethal.getState().solvedCount()).toBe(1)
    expect(useCollection.getState().merit).toBe(meritAfterFirst)
  })

  it('未知 id 不改状态', () => {
    const r = useLethal.getState().solve('lp-does-not-exist')
    expect(r.firstSolve).toBe(false)
    expect(useLethal.getState().solvedCount()).toBe(0)
  })

  it('两道不同题各自计入', () => {
    useLethal.getState().solve(FIRST)
    useLethal.getState().solve(SECOND)
    expect(useLethal.getState().solvedCount()).toBe(2)
  })

  it('全部解开触发通关卡包奖,且只发一次', () => {
    let allCompleteHits = 0
    let packsTotal = 0
    for (const p of LETHAL_PUZZLES) {
      const r = useLethal.getState().solve(p.id)
      if (r.allComplete) allCompleteHits++
      packsTotal += r.packs
    }
    expect(useLethal.getState().solvedCount()).toBe(LETHAL_PUZZLES.length)
    expect(allCompleteHits).toBe(1) // 只有最后一道触发
    expect(packsTotal).toBeGreaterThanOrEqual(1)
    // 已全部解开后再解(重解)不会再发包
    const again = useLethal.getState().solve(FIRST)
    expect(again.packs).toBe(0)
    expect(again.allComplete).toBe(false)
  })

  it('reset 清空进度与通关奖标记', () => {
    for (const p of LETHAL_PUZZLES) useLethal.getState().solve(p.id)
    useLethal.getState().solveDaily('2026-07-23')
    useLethal.getState().reset()
    expect(useLethal.getState().solvedCount()).toBe(0)
    expect(useLethal.getState().completedRewardGiven).toBe(false)
    expect(useLethal.getState().dailySolvedDate).toBeNull()
  })

  it('每日谜题:当天首解发功勋、同天重解幂等', () => {
    const before = useCollection.getState().merit
    const r = useLethal.getState().solveDaily('2026-07-23')
    expect(r.firstSolve).toBe(true)
    expect(r.merit).toBeGreaterThan(0)
    expect(useLethal.getState().isDailySolved('2026-07-23')).toBe(true)
    const merit1 = useCollection.getState().merit
    expect(merit1).toBe(before + r.merit)
    // 同一天再解:不再发
    const again = useLethal.getState().solveDaily('2026-07-23')
    expect(again.firstSolve).toBe(false)
    expect(useCollection.getState().merit).toBe(merit1)
  })

  it('每日谜题:换一天可再得奖', () => {
    useLethal.getState().solveDaily('2026-07-23')
    const merit1 = useCollection.getState().merit
    const r = useLethal.getState().solveDaily('2026-07-24')
    expect(r.firstSolve).toBe(true)
    expect(useCollection.getState().merit).toBeGreaterThan(merit1)
  })

  it('每日连击:连续天数累加,记录最长', () => {
    const L = () => useLethal.getState()
    L().solveDaily('2026-07-20')
    L().solveDaily('2026-07-21')
    L().solveDaily('2026-07-22')
    expect(L().dailyStreak).toBe(3)
    expect(L().dailyBestStreak).toBe(3)
  })

  it('每日连击:断一天则从头起,但最长保留', () => {
    const L = () => useLethal.getState()
    L().solveDaily('2026-07-20')
    L().solveDaily('2026-07-21') // streak 2
    L().solveDaily('2026-07-24') // 隔了两天 → 重置为 1
    expect(L().dailyStreak).toBe(1)
    expect(L().dailyBestStreak).toBe(2)
  })

  it('streakAsOf:昨天解过今天没解仍显示连击,隔两天则归零', () => {
    const L = () => useLethal.getState()
    L().solveDaily('2026-07-22')
    L().solveDaily('2026-07-23') // streak 2,最后解于 23 号
    expect(L().streakAsOf('2026-07-23')).toBe(2) // 当天
    expect(L().streakAsOf('2026-07-24')).toBe(2) // 昨天解的,连击还在
    expect(L().streakAsOf('2026-07-25')).toBe(0) // 隔两天,已断
  })

  it('每日三题:三阵各记各的,同一阵重解不重复发奖', () => {
    const L = () => useLethal.getState()
    const day = '2026-07-20'
    expect(L().solveDaily(day, 0).firstSolve).toBe(true)
    expect(L().solveDaily(day, 0).firstSolve).toBe(false) // 同一阵重解幂等
    expect(L().solveDaily(day, 2).firstSolve).toBe(true)
    expect(L().solvedSlots(day)).toEqual([0, 2])
    expect(L().isSlotSolved(day, 1)).toBe(false)
    // 三阵全解才算 allComplete
    expect(L().solveDaily(day, 1).allComplete).toBe(true)
  })

  it('每日三题:连击按天算,解开第一阵就续上,后两阵不再动它', () => {
    const L = () => useLethal.getState()
    L().solveDaily('2026-07-20', 0)
    L().solveDaily('2026-07-21', 0)
    expect(L().dailyStreak).toBe(2)
    // 同一天再解两阵,连击不该跳到 4
    L().solveDaily('2026-07-21', 1)
    L().solveDaily('2026-07-21', 2)
    expect(L().dailyStreak).toBe(2)
  })

  it('每日三题:三阵合计的功勋不超过原来一题的额度(经济零净影响)', () => {
    const before = useCollection.getState().merit
    const L = () => useLethal.getState()
    for (const slot of [0, 1, 2]) L().solveDaily('2026-07-20', slot)
    expect(useCollection.getState().merit - before).toBeLessThanOrEqual(30)
  })

  it('解谜计入永久成就进度 puzzlesSolved', () => {
    expect(useAchievements.getState().stats.puzzlesSolved ?? 0).toBe(0)
    useLethal.getState().solve(FIRST) // 手搓首解 +1
    useLethal.getState().solve(FIRST) // 重解不计
    useLethal.getState().solveDaily('2026-07-23') // 每日首解 +1
    expect(useAchievements.getState().stats.puzzlesSolved).toBe(2)
  })

  it('连击最长进永久成就 bestPuzzleStreak(取最大)', () => {
    const L = () => useLethal.getState()
    L().solveDaily('2026-07-20')
    L().solveDaily('2026-07-21')
    L().solveDaily('2026-07-22') // streak 3
    L().solveDaily('2026-07-24') // 断,streak 1
    expect(useAchievements.getState().stats.bestPuzzleStreak).toBe(3) // 保留最大
  })
})

// ---- 讲堂实练走同一条谜题通道,但它不是「谜题」----
describe('讲堂实练与谜题分开记', () => {
  it('实练不计进 solved —— 混进去会让「全套通关」永远凑不齐', () => {
    const before = useLethal.getState().solved.length
    useLethal.getState().solve('lesson-formation')
    expect(useLethal.getState().solved.length).toBe(before)
    expect(useLethal.getState().lessonsDone).toContain('lesson-formation')
  })

  it('实练不发首解功勋,但记成就进度', () => {
    const merit = useCollection.getState().merit
    const r = useLethal.getState().solve('lesson-field')
    expect(r.merit).toBe(0)
    expect(useCollection.getState().merit).toBe(merit)
    expect(useAchievements.getState().stats.lessonsDone).toBeGreaterThan(0)
  })

  it('同一课重做不重复计数', () => {
    useLethal.getState().solve('lesson-troop')
    const n = useAchievements.getState().stats.lessonsDone
    useLethal.getState().solve('lesson-troop')
    expect(useAchievements.getState().stats.lessonsDone).toBe(n)
  })
})
