import { describe, expect, it } from 'vitest'
import { judgeBudget, type ChunkCeiling } from './perfBudgetGate'

const KB = 1024
const CEILINGS: ChunkCeiling[] = [
  { re: /\/assets\/index-.*\.js$/, ceilKB: 190, label: '首屏主包' },
  { re: /\/assets\/content-.*\.js$/, ceilKB: 150, label: '内容层' },
  { re: /\/assets\/vendor-.*\.js$/, ceilKB: 75, label: '第三方' },
  { re: /\/assets\/.*\.css$/, ceilKB: 12, label: '样式' },
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
    expect(v.problems.some((p) => p.msg.includes('超预算'))).toBe(true)
  })

  it('单个 chunk 超基线(总量还没撞线)', () => {
    // content 从 128.7 涨到 149 —— 总量 376 仍在 400 内,但接近基线
    const files = REAL.map((f) =>
      f.file.includes('content') ? { ...f, gz: 155 * KB } : f,
    )
    const v = judgeBudget({ files, budgetKB: 400, ceilings: CEILINGS })
    expect(v.totalKB).toBeLessThan(400) // 总预算没红
    expect(v.problems.some((p) => p.msg.includes('内容层'))).toBe(true) // chunk 基线红了
  })

  it('**chunk 找不到时必须红,不能只 warn** —— 这是原来那个静默失效', () => {
    // 模拟 vite.config 改了 manualChunks:content 这块被合进主包,正则失配
    const files = REAL.filter((f) => !f.file.includes('content'))
    const v = judgeBudget({ files, budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems.some((p) => p.msg.includes('找不到目标文件'))).toBe(true)
    expect(v.chunks.find((c) => c.label === '内容层')?.missing).toBe(true)
  })

  it('全部 chunk 都失配时,每一条都要报 —— 不能只报第一条就算了', () => {
    const v = judgeBudget({ files: [], budgetKB: 400, ceilings: CEILINGS })
    expect(v.problems.filter((p) => p.kind === 'missing')).toHaveLength(CEILINGS.length)
  })

  // ---- 镜像的那一半:没人管的 chunk ----
  // 这一组是真事复现:查第 51 条时在 manualChunks 里加了一行,
  // 主包 189.8 → 75.7,而新出来那块 116.6 KB 首屏照样下载。
  // 三条基线一条都不匹配,于是当时的闸门一声不吭,报表上还像是瘦了一半。
  it('**首屏冒出一个不在基线表上的 chunk 必须红** —— 否则改一行分块就能刷绿报表', () => {
    const files = [
      { file: '/assets/index-abc.js', gz: 75.7 * KB }, // 主包「瘦」了
      { file: '/assets/TMPmodes-xyz.js', gz: 116.6 * KB }, // 胖的部分挪到了这儿
      { file: '/assets/content-def.js', gz: 128.7 * KB },
      { file: '/assets/vendor-ghi.js', gz: 60.2 * KB },
      { file: '/assets/index-abc.css', gz: 7.8 * KB },
    ]
    const v = judgeBudget({ files, budgetKB: 500, ceilings: CEILINGS })
    // 每条基线都在自己的上限内、总量也没超 —— 旧版本这里是全绿的
    expect(v.chunks.every((c) => !c.missing && c.kb! <= c.ceilKB)).toBe(true)
    expect(v.totalKB).toBeLessThan(500)
    expect(v.problems.some((p) => p.msg.includes('TMPmodes'))).toBe(true)
  })

  it('同一条基线匹配到两个文件时**合起来算**,不是只量第一个', () => {
    // 分块规则一改就可能出现两个 index-*.js:各 100KB 都在 190 以内,
    // 合起来 200 才是玩家真正下载的。只取第一个的话这一格永远绿。
    const files = [
      { file: '/assets/index-a.js', gz: 100 * KB },
      { file: '/assets/index-b.js', gz: 100 * KB },
    ]
    const v = judgeBudget({ files, budgetKB: 400, ceilings: [CEILINGS[0]] })
    expect(v.chunks[0].kb).toBeCloseTo(200, 0)
    expect(v.problems.some((p) => p.msg.includes('首屏主包'))).toBe(true)
  })
})

describe('首屏体积闸门 · 边界', () => {
  it('正好等于预算不算超', () => {
    // 基线给足,免得被覆盖检查带红 —— 这一条验的是总量的边界,不是覆盖。
    const v = judgeBudget({
      files: [{ file: '/assets/index-a.js', gz: 400 * KB }],
      budgetKB: 400,
      ceilings: [{ re: /\/assets\/index-.*\.js$/, ceilKB: 400, label: '主包' }],
    })
    expect(v.problems).toEqual([])
  })

  it('没有 ceilings = 每个文件都没人管,全部报出来', () => {
    // 这一条的契约 2026-08-09 变了:从前是「没有 ceilings 就只看总量」,
    // 而那等于「把基线表清空」是一种关掉覆盖检查的合法写法 ——
    // 恰恰是这道闸门最该防的那种「悄悄不守了」。
    const v = judgeBudget({ files: REAL, budgetKB: 400, ceilings: [] })
    expect(v.chunks).toEqual([])
    expect(v.problems).toHaveLength(REAL.length)
  })
})
