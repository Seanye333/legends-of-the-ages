import { beforeAll, describe, expect, it } from 'vitest'
import { loadLore, relationPath, relationsNow } from './loreLazy'
import { CARDS_BY_ID } from './cards'

// 「這兩個人有關係嗎」的最短链。链子的价值全在**每一跳都有出处** ——
// 所以这里除了验路径通不通,还要验每一跳的两端确实相邻、且带着原文。
describe('史料关系的最短链', () => {
  beforeAll(async () => {
    await loadLore()
  })

  it('同一个人是零跳', () => {
    expect(relationPath('guan-yu', 'guan-yu')).toEqual([])
  })

  it('直接相邻的是一跳', () => {
    const near = relationsNow('guan-yu')[0]
    expect(near, '關羽在关系网里应当有邻居').toBeDefined()
    const other = near.a === 'guan-yu' ? near.b : near.a
    expect(relationPath('guan-yu', other)).toHaveLength(1)
  })

  it('链子首尾接得上,中间每一跳都真的相邻并带着出处', () => {
    const path = relationPath('guan-yu', 'sima-yi')
    expect(path, '關羽与司馬懿之间应当查得到牵连').toBeTruthy()
    let cur = 'guan-yu'
    for (const e of path!) {
      expect([e.a, e.b], `第 ${path!.indexOf(e) + 1} 跳接不上`).toContain(cur)
      cur = e.a === cur ? e.b : e.a
      expect(CARDS_BY_ID[cur]).toBeDefined()
      // 出处是这个功能存在的理由 —— 摆不出原文的那一跳不该存在
      expect(e.quote.length).toBeGreaterThan(3)
    }
    expect(cur).toBe('sima-yi')
  })

  it('查不到就明说 null,不许编一条出来', () => {
    // 孤立 id:不在关系网里,任何人都到不了
    expect(relationPath('guan-yu', '__no_such_general__')).toBeNull()
  })
})
