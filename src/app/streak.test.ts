// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useStreak, STREAK_DAILY_MERIT, STREAK_CAP_DAYS } from './streakStore'
import { useCollection } from './collectionStore'

beforeEach(() => {
  localStorage.clear()
  useStreak.setState({ lastDay: '', streak: 0, best: 0 })
  useCollection.setState({ merit: 0 })
})

describe('连日到营', () => {
  it('第一天从 1 起,发一天的量', () => {
    const r = useStreak.getState().checkIn('2026-07-01')
    expect(r.streak).toBe(1)
    expect(r.merit).toBe(STREAK_DAILY_MERIT)
    expect(useCollection.getState().merit).toBe(STREAK_DAILY_MERIT)
  })

  it('同一天只发一次', () => {
    useStreak.getState().checkIn('2026-07-01')
    const again = useStreak.getState().checkIn('2026-07-01')
    expect(again.merit).toBe(0)
    expect(again.isNew).toBe(false)
    expect(useCollection.getState().merit).toBe(STREAK_DAILY_MERIT)
  })

  it('连着来会累加', () => {
    useStreak.getState().checkIn('2026-07-01')
    useStreak.getState().checkIn('2026-07-02')
    expect(useStreak.getState().streak).toBe(2)
    expect(useCollection.getState().merit).toBe(STREAK_DAILY_MERIT * 3) // 1 + 2
  })

  // 断一天和断一个月对玩家应当是一样的 —— 都从头再来
  it('断一天就归 1,但最长记录保留', () => {
    useStreak.getState().checkIn('2026-07-01')
    useStreak.getState().checkIn('2026-07-02')
    useStreak.getState().checkIn('2026-07-05')
    expect(useStreak.getState().streak).toBe(1)
    expect(useStreak.getState().best).toBe(2)
  })

  it('封顶之后不再涨 —— 它买的是「回来看一眼」,不是「肝」', () => {
    let day = 1
    for (; day <= 12; day++) {
      useStreak.getState().checkIn(`2026-07-${String(day).padStart(2, '0')}`)
    }
    const last = useStreak.getState().checkIn('2026-07-13')
    expect(last.merit).toBe(STREAK_CAP_DAYS * STREAK_DAILY_MERIT)
  })

  it('跨月也认得出「昨天」', () => {
    useStreak.getState().checkIn('2026-07-31')
    useStreak.getState().checkIn('2026-08-01')
    expect(useStreak.getState().streak).toBe(2)
  })
})
