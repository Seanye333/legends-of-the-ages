import { describe, expect, it } from 'vitest'
import { judgeBudget, type ChunkCeiling } from './perfBudgetGate'

const KB = 1024
const CEILINGS: ChunkCeiling[] = [
  { re: /\/assets\/index-.*\.js$/, ceilKB: 190, label: '首屏主包' },
  { re: /\/assets\/content-.*\.js$/, ceilKB: 150, label: '内容层' },
  { re: /\/assets\/vendor-.*\.js$/, ceilKB: 75, label: '第三方' },
]

// 2026-08-04 实测的形状:合计 356 / 400,三个 chunk 分别 159.6 / 128.7 / 60.2
const REAL = [
  { file: '/assets/index-abc.js', gz: 159.6 * KB },
  { file: '/assets/content-def.js', gz: 128.7 * KB },
  { file: '/assets/vendor-ghi.js', gz: 60.2 * KB },
  { file: '/assets/index-abc.css', gz: 7.8 * KB },
]

describe('首屏体积闸门 · 不该红的不许红', () => {
  it('实测那一组在预算内', () => {
    const v = judgeBudget({ files: REAL, budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems).toEqual([])
    expect(v.totalKB).toBeCloseTo(356.3, 0)
  })
})

describe('首屏体积闸门 · 该红的必须红', () => {
  it('总量超预算', () => {
    const files = REAL.map((f) =>
      f.file.includes('content') ? { ...f, gz: 200 * KB } : f,
    )
    const v = judgeBudget({ files, budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems.some((p) => p.includes('超预算'))).toBe(true)
  })

  it('单个 chunk 超基线(总量还没撞线)', () => {
    // content 从 128.7 涨到 149 —— 总量 376 仍在 400 内,但接近基线
    const files = REAL.map((f) =>
      f.file.includes('content') ? { ...f, gz: 155 * KB } : f,
    )
    const v = judgeBudget({ files, budgetKB: 400, ceilings: CEILINGS })
    expect(v.totalKB).toBeLessThan(400) // 总预算没红
    expect(v.problems.some((p) => p.includes('内容层'))).toBe(true) // chunk 基线红了
  })

  it('**chunk 找不到时必须红,不能只 warn** —— 这是原来那个静默失效', () => {
    // 模拟 vite.config 改了 manualChunks:content 这块被合进主包,正则失配
    const files = REAL.filter((f) => !f.file.includes('content'))
    const v = judgeBudget({ files, budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems.some((p) => p.includes('找不到目标文件'))).toBe(true)
    expect(v.chunks.find((c) => c.label === '内容层')?.missing).toBe(true)
  })

  it('全部 chunk 都失配时,三条都要报 —— 不能只报第一条就算了', () => {
    const v = judgeBudget({ files: [], budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems.filter((p) => p.includes('找不到目标文件'))).toHaveLength(3)
  })
})

describe('首屏体积闸门 · 边界', () => {
  it('正好等于预算不算超', () => {
    const v = judgeBudget({
      files: [{ file: '/assets/index-a.js', gz: 400 * KB }],
      budgetKB: 400,
      ceilings: [],
    })
    expect(v.problems).toEqual([])
  })

  it('没有 ceilings 时只看总量', () => {
    const v = judgeBudget({ files: REAL, budgetKB: 400, ceilings: [] })
    expect(v.problems).toEqual([])
    expect(v.chunks).toEqual([])
  })
})
