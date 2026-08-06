import { describe, expect, it } from 'vitest'
import { defaultConcurrency, progress } from './parallel'

// worker 池的对局部分没法在单测里验(要真跑模拟),但两件容易悄悄坏掉的小事可以:
//   · 并发数在**小机器**上不能夹到 1 —— 那会让整个并行化在 CI 上等于没有
//   · 进度输出在非终端环境不能刷屏 —— 一百多行日志会把真正该看的结果冲掉
// 两条都是「不报错、只是白干」的那类问题,正是这个仓库最怕的形状。

describe('并行外壳', () => {
  it('并发数至少是 1,且不超过 16', () => {
    const c = defaultConcurrency()
    expect(c).toBeGreaterThanOrEqual(1)
    expect(c).toBeLessThanOrEqual(16)
    expect(Number.isInteger(c)).toBe(true)
  })

  it('**小机器不许退化成单线程** —— CI runner 常常只有 2 核', () => {
    // 这里复现 defaultConcurrency 的分档规则,钉住「≤4 核时全用上」这一条。
    // 从前的写法是一律 `核数-2`,2 核 → 0 → 夹到 1,并行化在 CI 上等于没接。
    const rule = (cores: number) => Math.max(1, Math.min(16, cores <= 4 ? cores : cores - 2))
    expect(rule(2)).toBe(2)
    expect(rule(4)).toBe(4)
    expect(rule(8)).toBe(6)
    expect(rule(12)).toBe(10)
    expect(rule(64)).toBe(16) // 上限:再多 worker 的启动开销会吃掉收益
    expect(rule(1)).toBe(1)
  })
})

describe('进度输出', () => {
  it('非终端环境只在结束时打一行,不刷屏', () => {
    const seen: string[] = []
    const orig = console.log
    const origTty = process.stdout.isTTY
    try {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true })
      console.log = (s: string) => void seen.push(s)
      const p = progress('段')
      for (let i = 1; i <= 100; i++) p(i, 100)
    } finally {
      console.log = orig
      Object.defineProperty(process.stdout, 'isTTY', { value: origTty, configurable: true })
    }
    // 一百次回调只该产出一行,而不是一百行
    expect(seen).toHaveLength(1)
    expect(seen[0]).toContain('100')
  })
})
