// 相关系数 —— 用来回答「定价表的判断和实测胜率对得上吗」。
//
// 【为什么需要它,而不是眼看排行榜】
// 校准定价表的诱惑是:看一眼「returnToHand 平均 +10.1」,就把它的分值调高,
// 然后宣布修好了。但那只是把一个拍出来的数字换成另一个拍出来的数字 ——
// 没有任何东西能证明改完之后整张表**变准了**。
// 一个拟合优度指标才能:改之前测一次,改之后测一次,变高才留。
//
// 用秩相关(Spearman)当主指标,不用 Pearson:
//   · 定价表的输出是「点数」,实测的输出是「百分点」,两者不同量纲,
//     我们关心的是**排序对不对**,不是斜率是多少;
//   · 卡池里有一小撮极端卡(传奇、超模的那几张),Pearson 会被它们主导 ——
//     那反而会奖励「把几张离群卡拟合好、其余全错」的改法。
// Pearson 一并给出,当参考。

export interface CorrResult {
  /** 相关系数,[-1, 1] */
  r: number
  /** 样本数 */
  n: number
  /** Fisher z 变换后的标准误(1/√(n−3)),n ≤ 3 时为 Infinity */
  se: number
  /** r 显著异于 0 的 z 值(在 Fisher 尺度上算,不是 r/se) */
  z: number
}

/** 皮尔逊相关。长度不等或不足 2 个点时返回 r = 0。 */
export function pearson(xs: number[], ys: number[]): CorrResult {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { r: 0, n, se: Infinity, z: 0 }
  let mx = 0
  let my = 0
  for (let i = 0; i < n; i++) {
    mx += xs[i]
    my += ys[i]
  }
  mx /= n
  my /= n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  // 任一边是常数(方差 0)时相关无定义 —— 返回 0 而不是 NaN。
  // NaN 会一路渗进报表且比较永远为 false,那是本仓库最贵的一类 bug。
  const denom = Math.sqrt(sxx * syy)
  const r = denom === 0 ? 0 : sxy / denom
  return withSe(r, n)
}

/**
 * 秩(rank):升序名次,**并列取平均名次**。
 *
 * 并列必须取平均,不能按出现顺序编号 —— 否则同分的卡会因为在数组里的位置不同
 * 而拿到不同的秩,相关系数就会依赖输入顺序。定价表的输出里同分很常见
 * (一大批白板卡的价值完全相同)。
 */
export function ranks(xs: number[]): number[] {
  const idx = xs.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<number>(xs.length)
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++
    const avg = (i + j) / 2 + 1 // 名次从 1 起
    for (let k = i; k <= j; k++) out[idx[k].i] = avg
    i = j + 1
  }
  return out
}

/** 斯皮尔曼秩相关 = 在秩上算的皮尔逊。 */
export function spearman(xs: number[], ys: number[]): CorrResult {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { r: 0, n, se: Infinity, z: 0 }
  return pearson(ranks(xs.slice(0, n)), ranks(ys.slice(0, n)))
}

function withSe(r: number, n: number): CorrResult {
  if (n <= 3) return { r, n, se: Infinity, z: 0 }
  // Fisher z 变换:atanh(r) 近似正态,标准误 1/√(n−3)。
  // 直接拿 r/SE 当 z 在 |r| 大的时候会严重高估显著性,因为 r 的分布在边界被压扁。
  // r = ±1 时 atanh 发散 —— 夹一下,免得输出 Infinity。
  const clamped = Math.max(-0.999999, Math.min(0.999999, r))
  const se = 1 / Math.sqrt(n - 3)
  return { r, n, se, z: Math.atanh(clamped) / se }
}

/**
 * 两个相关系数之差是否显著(同一批样本、配对的两个预测量)。
 *
 * 这正是「改完定价表有没有变准」要问的问题。注意**不能**把两个 r 各自的
 * 置信区间比一比就下结论:两次相关用的是同一批卡(同一份实测 Δ),
 * 误差高度相关,独立假设会把差异的标准误算得太大,真实的改进会被判成噪声。
 *
 * 这里用 Steiger 的相依相关检验(1980),需要第三个量:两个预测量彼此的相关。
 */
export function diffZ(r1: number, r2: number, r12: number, n: number): number {
  if (n <= 3) return 0
  const cl = (r: number) => Math.max(-0.999999, Math.min(0.999999, r))
  const z1 = Math.atanh(cl(r1))
  const z2 = Math.atanh(cl(r2))
  const rm2 = (cl(r1) ** 2 + cl(r2) ** 2) / 2
  const f = (1 - cl(r12)) / (2 * (1 - rm2))
  const h = (1 - f * rm2) / (1 - rm2)
  return ((z1 - z2) * Math.sqrt(n - 3)) / Math.sqrt(2 * (1 - cl(r12)) * h)
}
