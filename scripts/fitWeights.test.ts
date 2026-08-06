import { describe, expect, it } from 'vitest'
import { cvLambda, demeanByGroup, hashFold, ridge, solveSym } from './fitWeights'

describe('solveSym', () => {
  it('解得出已知答案', () => {
    // 2x + y = 5 ; x + 3y = 10  →  x = 1, y = 3
    const x = solveSym(
      [
        [2, 1],
        [1, 3],
      ],
      [5, 10],
    )
    expect(x[0]).toBeCloseTo(1, 10)
    expect(x[1]).toBeCloseTo(3, 10)
  })

  it('主元很小的方程组不会炸掉', () => {
    // 不选主元的话第一步就要除以 1e-14,解会飞到 1e14 量级。
    // 卡池里共线是常态(某个 op 只出现在一两张卡上),这条路一定会被走到。
    const x = solveSym(
      [
        [1e-14, 1],
        [1, 1],
      ],
      [1, 2],
    )
    expect(x[0]).toBeCloseTo(1, 6)
    expect(x[1]).toBeCloseTo(1, 6)
    expect(x.every((v) => Number.isFinite(v))).toBe(true)
  })

  it('整列为 0 时该系数留 0,不返回 NaN', () => {
    const x = solveSym(
      [
        [1, 0],
        [0, 0],
      ],
      [3, 0],
    )
    expect(x[0]).toBeCloseTo(3, 10)
    expect(Number.isNaN(x[1])).toBe(false)
  })

  it('不改调用方的数组', () => {
    const A = [
      [2, 1],
      [1, 3],
    ]
    const b = [5, 10]
    solveSym(A, b)
    expect(A).toEqual([
      [2, 1],
      [1, 3],
    ])
    expect(b).toEqual([5, 10])
  })
})

describe('ridge', () => {
  it('λ = 0 且无噪声时还原真系数', () => {
    const X: number[][] = []
    const y: number[] = []
    for (let i = 0; i < 60; i++) {
      const a = i % 7
      const b = (i * 3) % 5
      X.push([a, b])
      y.push(2.5 * a - 1.5 * b)
    }
    const beta = ridge(X, y, 0)
    expect(beta[0]).toBeCloseTo(2.5, 6)
    expect(beta[1]).toBeCloseTo(-1.5, 6)
  })

  it('λ 变大把系数往 0 收', () => {
    const X: number[][] = []
    const y: number[] = []
    for (let i = 0; i < 60; i++) {
      X.push([i % 7])
      y.push(3 * (i % 7))
    }
    const a = ridge(X, y, 1)[0]
    const b = ridge(X, y, 100)[0]
    expect(Math.abs(b)).toBeLessThan(Math.abs(a))
    expect(Math.abs(a)).toBeLessThan(3.0001)
  })

  it('惩罚对量纲不敏感 —— 把一列放大 1000 倍,预测值不变', () => {
    // 这是「先标准化再上惩罚」的全部理由:不标准化的话,同一个 λ 对
    // 「伤害点数」(0~8)和「身材当量」(0~20)的压制力度完全不同,
    // 于是拟合结果取决于这些列碰巧用了什么单位。
    const rows = 80
    const X: number[][] = []
    const Xs: number[][] = []
    const y: number[] = []
    for (let i = 0; i < rows; i++) {
      const a = i % 7
      const b = (i * 3) % 5
      X.push([a, b])
      Xs.push([a, b * 1000])
      y.push(2.5 * a - 1.5 * b + ((i % 3) - 1))
    }
    const beta = ridge(X, y, 5)
    const betaS = ridge(Xs, y, 5)
    for (let i = 0; i < rows; i++) {
      const p = X[i][0] * beta[0] + X[i][1] * beta[1]
      const ps = Xs[i][0] * betaS[0] + Xs[i][1] * betaS[1]
      expect(ps).toBeCloseTo(p, 6)
    }
  })

  it('空输入不炸', () => {
    expect(ridge([], [], 1)).toEqual([])
  })
})

describe('demeanByGroup', () => {
  it('每组的均值被减掉', () => {
    const { X, y } = demeanByGroup(
      [[1], [3], [10], [20]],
      [5, 7, 100, 200],
      [1, 1, 2, 2],
    )
    expect(y).toEqual([-1, 1, -50, 50])
    expect(X).toEqual([[-1], [1], [-5], [5]])
  })

  it('单成员的组整行归零', () => {
    const { X, y } = demeanByGroup([[4]], [9], [1])
    expect(y).toEqual([0])
    expect(X).toEqual([[0]])
  })

  it('吸收掉的正是「组间差异」这个混杂', () => {
    // 造一份数据:x 和 y 组内**毫无关系**,但高费组的 x 和 y 都更大。
    // 不去心的话会回归出一个漂亮的正系数 —— 学到的其实只是「高费卡更强」。
    const X: number[][] = []
    const y: number[] = []
    const g: number[] = []
    for (const cost of [1, 5, 9]) {
      for (let i = 0; i < 20; i++) {
        X.push([cost * 2 + (i % 2)])
        y.push(cost * 3 + ((i + 1) % 2)) // 组内 x 与 y 反相关
        g.push(cost)
      }
    }
    const naive = ridge(X, y, 0)[0]
    const d = demeanByGroup(X, y, g)
    const fixed = ridge(d.X, d.y, 0)[0]
    expect(naive).toBeGreaterThan(0.5)
    expect(fixed).toBeLessThan(0)
  })
})

describe('cvLambda', () => {
  it('信号干净时挑小 λ', () => {
    const X: number[][] = []
    const y: number[] = []
    for (let i = 0; i < 100; i++) {
      const a = i % 9
      X.push([a, (i * 7) % 5])
      y.push(2 * a)
    }
    expect(cvLambda(X, y, [0.01, 1, 100, 10000])).toBeLessThanOrEqual(1)
  })

  it('全是噪声时挑大 λ —— 把系数压向 0 才是最优预测', () => {
    const X: number[][] = []
    const y: number[] = []
    for (let i = 0; i < 100; i++) {
      X.push([i % 9, (i * 7) % 5, (i * 3) % 11])
      y.push((i % 2) - 0.5) // 与 X 无关
    }
    expect(cvLambda(X, y, [0.01, 1, 100, 10000])).toBeGreaterThanOrEqual(100)
  })

  it('两次跑给同一个 λ', () => {
    const X = Array.from({ length: 60 }, (_, i) => [i % 7, (i * 3) % 4])
    const y = X.map(([a, b]) => a * 2 - b + (a % 3))
    expect(cvLambda(X, y, [0.1, 1, 10])).toBe(cvLambda(X, y, [0.1, 1, 10]))
  })

  it('样本太少时不假装选过', () => {
    expect(cvLambda([[1]], [1], [7, 9])).toBe(7)
    expect(cvLambda([[1]], [1], [])).toBe(0)
  })
})

describe('hashFold', () => {
  it('同一个 id 永远落同一折', () => {
    // 用 Math.random 切留出集的话,「样本外涨了」可能只是这次切得走运。
    expect(hashFold('guan-yu')).toBe(hashFold('guan-yu'))
    expect(hashFold('guan-yu', 5)).toBe(hashFold('guan-yu', 5))
  })

  it('落在 [0, folds) 内', () => {
    for (const id of ['a', 'bb', 'ccc', 'zhang-fei', '', '曹操']) {
      expect(hashFold(id, 3)).toBeGreaterThanOrEqual(0)
      expect(hashFold(id, 3)).toBeLessThan(3)
    }
  })

  it('分得够均匀 —— 两折各占四成以上', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => `card-${i}`)
    const zero = ids.filter((s) => hashFold(s) === 0).length
    expect(zero).toBeGreaterThan(ids.length * 0.4)
    expect(zero).toBeLessThan(ids.length * 0.6)
  })
})
