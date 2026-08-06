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

/**
 * 带「均衡项」的模型:Δ = β_攻·攻 + β_血·血 + β_均·min(攻,血) + 费用档固定效应
 *
 * 【为什么要加这一项 —— 2026-08-06 实测逼出来的】
 * 纯线性模型(只有攻和血)在实测数据上**解释不了最大的那个效应**。
 * 6 费、同样 15 点身材总量:
 *   14/1 → Δ −18.9    8/7 → Δ −1.4    1/14 → Δ −12.1
 * 相差 17 个百分点,而线性模型对这三张卡给出的预测**几乎相同**
 * (攻+血 的加权和只差一点点)。于是它把这一整块结构全丢进残差,
 * 两个斜率的 z 都掉到 1.0 附近 —— 看起来像「测不出来」,实际是**模型错了**。
 *
 * `min(攻,血)` 正好捕捉「均衡」:1 血的怪碰谁死谁,1 攻的怪换不掉任何东西,
 * 两头都是废的,而它们的 min 都是 1。均衡的 8/7 min 是 7。
 *
 * 这对定价表是个结构性结论:`bodyValue = 攻×1 + 血×0.8` 是**线性的**,
 * 表达不了「均衡值钱」,所以它系统性高估极端身材的卡。
 */
export interface BodyFit2 extends BodyFit {
  perBalance: number
  seBalance: number
  zBalance: number
}

export function fitBodyBalanced(rows: BodyRow[]): BodyFit2 {
  const n = rows.length
  const zero: BodyFit2 = {
    perAttack: 0, perHealth: 0, perBalance: 0,
    seAttack: Infinity, seHealth: Infinity, seBalance: Infinity,
    zAttack: 0, zHealth: 0, zBalance: 0, residSd: 0, n,
  }
  if (n < 6) return zero

  // 组内去心(按费用档),三列:攻 / 血 / min(攻,血)
  const cols = (r: BodyRow) => [r.attack, r.health, Math.min(r.attack, r.health)]
  const sums = new Map<number, { n: number; x: number[]; d: number }>()
  for (const r of rows) {
    const g = sums.get(r.cost) ?? { n: 0, x: [0, 0, 0], d: 0 }
    g.n++
    const c = cols(r)
    for (let k = 0; k < 3; k++) g.x[k] += c[k]
    g.d += r.delta
    sums.set(r.cost, g)
  }
  const X: number[][] = []
  const y: number[] = []
  for (const r of rows) {
    const g = sums.get(r.cost)!
    X.push(cols(r).map((v, k) => v - g.x[k] / g.n))
    y.push(r.delta - g.d / g.n)
  }

  // 正规方程 3×3
  const A = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]
  const b = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    for (let p = 0; p < 3; p++) {
      b[p] += X[i][p] * y[i]
      for (let q = 0; q < 3; q++) A[p][q] += X[i][p] * X[i][q]
    }
  }
  const beta = solveSym(A, b)
  if (beta.some((v) => !Number.isFinite(v))) return zero

  let rss = 0
  for (let i = 0; i < n; i++) {
    let pred = 0
    for (let p = 0; p < 3; p++) pred += X[i][p] * beta[p]
    rss += (y[i] - pred) ** 2
  }
  const df = Math.max(1, n - 3 - sums.size)
  const s2 = rss / df
  // 系数方差 = s² · (XᵀX)⁻¹ 的对角。用伴随矩阵求逆的对角元即可。
  const inv = invert3(A)
  const se = [0, 1, 2].map((k) => Math.sqrt(Math.max(0, s2 * (inv?.[k][k] ?? 0))))

  return {
    perAttack: beta[0], perHealth: beta[1], perBalance: beta[2],
    seAttack: se[0], seHealth: se[1], seBalance: se[2],
    zAttack: se[0] > 0 ? beta[0] / se[0] : 0,
    zHealth: se[1] > 0 ? beta[1] / se[1] : 0,
    zBalance: se[2] > 0 ? beta[2] / se[2] : 0,
    residSd: Math.sqrt(rss / Math.max(1, n)),
    n,
  }
}

/** 3×3 求逆(伴随矩阵)。奇异时返回 null —— 别返回一堆 Infinity。 */
function invert3(m: number[][]): number[][] | null {
  const [[a, b, c], [d, e, f], [g, h, i]] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-9) return null
  return [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ]
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
