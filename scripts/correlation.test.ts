import { describe, expect, it } from 'vitest'
import { pearson, ranks, spearman, diffZ } from './correlation'

describe('pearson', () => {
  it('完全同向 = 1,完全反向 = −1', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8]).r).toBeCloseTo(1, 10)
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2]).r).toBeCloseTo(-1, 10)
  })

  it('一边是常数时返回 0,不是 NaN', () => {
    // 方差 0 会让分母为 0。NaN 的比较永远是 false,会一路渗进报表还不报错。
    const r = pearson([1, 1, 1, 1], [1, 2, 3, 4]).r
    expect(Number.isNaN(r)).toBe(false)
    expect(r).toBe(0)
  })

  it('样本不足时不假装有结论', () => {
    expect(pearson([1], [2])).toEqual({ r: 0, n: 1, se: Infinity, z: 0 })
    // n = 3 时 Fisher 的 1/√(n−3) 会除以 0
    expect(pearson([1, 2, 3], [3, 2, 1]).se).toBe(Infinity)
    expect(pearson([1, 2, 3], [3, 2, 1]).z).toBe(0)
  })

  it('z 走 Fisher 变换,不是 r/se', () => {
    const xs = Array.from({ length: 103 }, (_, i) => i)
    const ys = xs.map((x) => x + (x % 7)) // 强相关但不完美
    const c = pearson(xs, ys)
    expect(c.se).toBeCloseTo(1 / Math.sqrt(100), 10)
    expect(c.z).toBeCloseTo(Math.atanh(c.r) * Math.sqrt(100), 6)
    // 直接 r/se 会把这个数低估:atanh(0.99) ≈ 2.6,而 r 本身只有 0.99
    expect(c.z).toBeGreaterThan(c.r / c.se)
  })

  it('r = 1 时 z 有限,不是 Infinity', () => {
    const xs = Array.from({ length: 20 }, (_, i) => i)
    expect(Number.isFinite(pearson(xs, xs).z)).toBe(true)
  })
})

describe('ranks', () => {
  it('并列取平均名次', () => {
    // 5 5 排在第 2、3 位 → 都得 2.5
    expect(ranks([1, 5, 5, 9])).toEqual([1, 2.5, 2.5, 4])
  })

  it('并列的秩不依赖输入顺序', () => {
    // 按出现顺序编号的话,同分卡会因为数组位置不同拿到不同的秩,
    // 相关系数就会随着卡池的排列而变 —— 定价表里同分非常多(一堆白板卡同价)。
    const a = ranks([7, 7, 7, 1])
    const b = ranks([7, 7, 1, 7])
    expect(a[0]).toBe(a[1])
    expect(b[0]).toBe(b[1])
    expect([...a].sort()).toEqual([...b].sort())
  })

  it('全部并列时每个都是中间名次', () => {
    expect(ranks([4, 4, 4])).toEqual([2, 2, 2])
  })
})

describe('spearman', () => {
  it('对单调但非线性的关系给满分,而 pearson 不会', () => {
    const xs = [1, 2, 3, 4, 5]
    const ys = xs.map((x) => Math.exp(x)) // 单调递增,但远非线性
    expect(spearman(xs, ys).r).toBeCloseTo(1, 10)
    expect(pearson(xs, ys).r).toBeLessThan(0.95)
  })

  it('不被单个离群点带跑', () => {
    // 这正是选秩相关当主指标的理由:一张离谱的传奇不该主导「整张表准不准」的判断。
    const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000]
    const ys = [9, 8, 7, 6, 5, 4, 3, 2, 1, 1000]
    expect(spearman(xs, ys).r).toBeLessThan(0)
    expect(pearson(xs, ys).r).toBeGreaterThan(0.9)
  })
})

describe('diffZ', () => {
  it('两个相关一样时差异为 0', () => {
    expect(diffZ(0.4, 0.4, 0.8, 500)).toBeCloseTo(0, 10)
  })

  it('预测量彼此越像,同样大小的改进越显著', () => {
    // 这是用相依检验而不是「两个置信区间比一比」的全部理由:
    // 改前改后的两把尺子高度相关(同一批卡、同一份实测),
    // 当成独立会把差异的标准误算得太大,真实的改进被判成噪声。
    const near = diffZ(0.35, 0.25, 0.95, 400)
    const far = diffZ(0.35, 0.25, 0.2, 400)
    expect(near).toBeGreaterThan(far)
  })

  it('方向正确且样本越大越显著', () => {
    expect(diffZ(0.4, 0.2, 0.9, 400)).toBeGreaterThan(0)
    expect(diffZ(0.2, 0.4, 0.9, 400)).toBeLessThan(0)
    expect(diffZ(0.4, 0.2, 0.9, 1600)).toBeGreaterThan(diffZ(0.4, 0.2, 0.9, 400))
  })

  it('样本不足时返回 0', () => {
    expect(diffZ(0.9, 0.1, 0.5, 3)).toBe(0)
  })
})
