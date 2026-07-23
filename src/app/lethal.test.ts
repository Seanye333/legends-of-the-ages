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
