import { describe, expect, it } from 'vitest'
import { dailyGeneralIdFor, dailyStoryFor } from './dailyGeneral'
import { CARDS_BY_ID } from './cards'

describe('今日战事', () => {
  it('同一天永远同一条 —— 它要能被讨论、被截图', () => {
    expect(dailyStoryFor('2026-07-27')).toEqual(dailyStoryFor('2026-07-27'))
  })

  it('不同的天会换', () => {
    const days = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05']
    const titles = new Set(days.map((d) => dailyStoryFor(d)!.title.zh))
    expect(titles.size).toBeGreaterThan(1)
  })

  // 与每日一将同一套哈希但换了盐 —— 不换的话两者会同步跳动,看起来像只换了一样东西
  it('和每日一将不同步', () => {
    const days = Array.from({ length: 30 }, (_, i) => `2026-06-${String(i + 1).padStart(2, '0')}`)
    const pairs = days.map((d) => `${dailyGeneralIdFor(d)}|${dailyStoryFor(d)!.title.zh}`)
    expect(new Set(pairs).size).toBe(days.length)
  })

  it('列出来的人都是真实的卡', () => {
    for (let i = 1; i <= 28; i++) {
      const s = dailyStoryFor(`2026-05-${String(i).padStart(2, '0')}`)!
      for (const id of s.people) expect(CARDS_BY_ID[id], id).toBeDefined()
    }
  })

  it('宿敌那一类带史料', () => {
    const days = Array.from({ length: 60 }, (_, i) => `2026-04-${String((i % 30) + 1).padStart(2, '0')}`)
    const rival = days.map((d) => dailyStoryFor(d)!).find((s) => s.kind === 'rival')
    expect(rival?.lore?.zh.length ?? 0).toBeGreaterThan(0)
  })
})
