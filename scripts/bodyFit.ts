// 身材回归的判定层 —— 纯函数,配 bodyFit.test.ts(铁律 11)。
//
// 模型:Δ_i = β_攻·攻_i + β_血·血_i + (费用档固定效应)
//
// 【为什么一定要费用档固定效应】
// 探针撒在好几个费用档上,而**每个档换掉的是不同的牌**,基准贡献也不同。
// 不控制费用的话,回归学到的第一件事会是「高费探针的 Δ 更高/更低」——
// 那是换牌对象的差别,不是身材的价值。
// 用组内去心(within transform)实现:每个费用档的 Δ、攻、血各减掉本档均值。
// 这等价于给每档铺一个不受惩罚的哑变量,但不必真去铺。
//
// 【为什么不能只撒均衡劈法】
// 只撒 (a≈h) 的话,攻和血两列几乎完全共线,回归解不动(或者解出一对
// 互相抵消的巨大系数)。所以探针里必须有偏攻和偏血的极端劈法 ——
// 这一条在 bodyProbes.ts 里,测试也钉住了。
import { solveSym } from './fitWeights'

export interface BodyRow {
  cost: number
  attack: number
  health: number
  delta: number
}

export interface BodyFit {
  perAttack: number
  perHealth: number
  seAttack: number
  seHealth: number
  zAttack: number
  zHealth: number
  /** 残差标准差(百分点)—— 和理论噪声比一比就知道模型漏了什么 */
  residSd: number
  n: number
}

export function fitBody(rows: BodyRow[]): BodyFit {
  const n = rows.length
  const empty: BodyFit = {
    perAttack: 0, perHealth: 0, seAttack: Infinity, seHealth: Infinity,
    zAttack: 0, zHealth: 0, residSd: 0, n,
  }
  if (n < 4) return empty

  // 组内去心:按费用档
  const sums = new Map<number, { n: number; a: number; h: number; d: number }>()
  for (const r of rows) {
    const g = sums.get(r.cost) ?? { n: 0, a: 0, h: 0, d: 0 }
    g.n++
    g.a += r.attack
    g.h += r.health
    g.d += r.delta
    sums.set(r.cost, g)
  }
  const X: number[][] = []
  const y: number[] = []
  for (const r of rows) {
    const g = sums.get(r.cost)!
    X.push([r.attack - g.a / g.n, r.health - g.h / g.n])
    y.push(r.delta - g.d / g.n)
  }

  // 普通最小二乘(2 个未知数,不需要岭 —— 探针是我们自己撒的,共线性可控)
  let saa = 0
  let sah = 0
  let shh = 0
  let say = 0
  let shy = 0
  for (let i = 0; i < n; i++) {
    const [a, h] = X[i]
    saa += a * a
    sah += a * h
    shh += h * h
    say += a * y[i]
    shy += h * y[i]
  }
  const det = saa * shh - sah * sah
  // 行列式接近 0 = 攻和血两列共线,解不动。返回零而不是一对互相抵消的巨大系数。
  if (Math.abs(det) < 1e-9) return empty

  const beta = solveSym(
    [
      [saa, sah],
      [sah, shh],
    ],
    [say, shy],
  )

  // 残差与系数标准误
  let rss = 0
  for (let i = 0; i < n; i++) {
    const pred = X[i][0] * beta[0] + X[i][1] * beta[1]
    rss += (y[i] - pred) ** 2
  }
  // 自由度:样本数 − 2 个斜率 − 每个费用档一个截距
  const df = Math.max(1, n - 2 - sums.size)
  const s2 = rss / df
  const seA = Math.sqrt((s2 * shh) / det)
  const seH = Math.sqrt((s2 * saa) / det)

  return {
    perAttack: beta[0],
    perHealth: beta[1],
    seAttack: seA,
    seHealth: seH,
    zAttack: seA > 0 ? beta[0] / seA : 0,
    zHealth: seH > 0 ? beta[1] / seH : 0,
    residSd: Math.sqrt(rss / Math.max(1, n)),
    n,
  }
}
