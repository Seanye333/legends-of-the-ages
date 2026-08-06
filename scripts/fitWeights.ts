// 从实测胜率**回归**出定价权重 —— 而不是照着「平均 Δ」那一列手改。
//
// 【为什么要回归,不能手改】
// sim-cards 的按效果归组给出的是「带这个 op 的卡整体偏强多少个百分点」。
// 一张卡常带好几个 op(一张 3 费的可能同时有伤害、抽牌、身材),归组时它在
// 每一组里都算一次 —— 所以那一列里,`damage` 的 +4.1 有一部分其实是同卡的
// `draw` 贡献的。照着它改,等于把混杂当成了效应。
//
// 回归天然处理这件事:每张卡是一个方程,每个 op 是一个未知数,
// 一起解出「在控制住其他 op 之后,这个 op 单独值多少」。
//
// 【模型】
//   Δ_i ≈ β_body·身材_i + β_kw·关键词_i + Σ_k β_k · x_ik + (费用档固定效应)
// 其中 x_ik = ∂卡面价值_i/∂w_k,也就是「这张卡带了多少份 op k」。
//
// 费用档用**组内去心**处理,不铺哑变量:同费用档的 Δ 和每一列都减掉本档均值。
// 这正是固定效应估计量,而且省掉了「哪些列不该被惩罚」的麻烦。
// 必须控制费用 —— 否则回归学到的第一件事会是「高费卡更强」,那是废话,
// 而且它会把所有和费用相关的 op(群体伤害多半在高费)全部污染。
//
// 【尺度怎么定】
// β 的单位是「百分点/份」,而定价表的单位是「点」(1 点 ≈ 1 攻)。
// 把 β_body 归一到 1 就换算完了 —— 这恰好保住了表里那条最老的约定
// 「1 点 = 1 点攻击」。β_body ≤ 0 说明这次拟合整个是噪声,直接拒绝。
//
// 【为什么必须留出样本外】
// 39 个自由度去拟合两千个带着 ±9 个百分点噪声的观测,**一定**能把 in-sample
// 的相关拉高 —— 那是拟合噪声,不是学到东西。所以按卡 id 哈希对半分,
// 一半拟合、另一半评判。样本外不涨,这次拟合就不算数。

/** 岭回归的正规方程组:(XᵀX + λI)β = Xᵀy,高斯消元 + 部分主元。 */
export function solveSym(A: number[][], b: number[]): number[] {
  const n = b.length
  // 拷贝一份增广矩阵,别改调用方的数组
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    // 部分主元:不选主元的话,某一列近似共线时会除以一个接近 0 的数,
    // 解会炸成 1e15 量级 —— 而卡池里共线是常态(比如某个 op 只出现在一张卡上)。
    let piv = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    }
    if (Math.abs(M[piv][col]) < 1e-12) continue // 整列都是 0,该系数留 0
    ;[M[col], M[piv]] = [M[piv], M[col]]
    const p = M[col][col]
    for (let c = col; c <= n; c++) M[col][c] /= p
    for (let r = 0; r < n; r++) {
      if (r === col) continue
      const f = M[r][col]
      if (f === 0) continue
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c]
    }
  }
  return M.map((row) => row[n])
}

/**
 * 岭回归。**先把每列标准化**再上惩罚 —— 否则 λ 对不同量纲的列惩罚力度天差地别
 * (「伤害点数」的列取值 0~8,「身材当量」的列取值 0~20,同一个 λ 意思完全不同)。
 * 解完再换算回原尺度。
 *
 * 不带截距:调用方应当先做组内去心(见本文件开头),那一步已经把截距吸收掉了。
 */
export function ridge(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length
  const p = n > 0 ? X[0].length : 0
  if (n === 0 || p === 0) return new Array(p).fill(0)

  const sd = new Array<number>(p).fill(0)
  for (let k = 0; k < p; k++) {
    let m = 0
    for (let i = 0; i < n; i++) m += X[i][k]
    m /= n
    let v = 0
    for (let i = 0; i < n; i++) v += (X[i][k] - m) ** 2
    // 只缩放不再去心:去心是调用方的事(组内去心),这里再去一次会把固定效应破坏掉。
    // 常数列(方差 0)记 1,它的系数会被下面的正规方程压到 0。
    sd[k] = Math.sqrt(v / n) || 1
  }

  const XtX: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  const Xty = new Array<number>(p).fill(0)
  for (let i = 0; i < n; i++) {
    const row = X[i]
    for (let a = 0; a < p; a++) {
      const xa = row[a] / sd[a]
      Xty[a] += xa * y[i]
      for (let b = a; b < p; b++) {
        const prod = xa * (row[b] / sd[b])
        XtX[a][b] += prod
        if (b !== a) XtX[b][a] += prod
      }
    }
  }
  for (let a = 0; a < p; a++) XtX[a][a] += lambda
  const beta = solveSym(XtX, Xty)
  return beta.map((b, k) => b / sd[k])
}

/**
 * 组内去心:每一行减掉它所在组的均值(y 和 X 都减)。
 * 这就是固定效应估计量 —— 等价于给每个组铺一个不受惩罚的哑变量,但不必真去铺。
 *
 * 单成员的组去心之后整行是 0,对拟合没有贡献也不会有害(它本来也提供不了组内信息)。
 */
export function demeanByGroup(
  X: number[][],
  y: number[],
  group: number[],
): { X: number[][]; y: number[] } {
  const p = X.length > 0 ? X[0].length : 0
  const sums = new Map<number, { n: number; y: number; x: number[] }>()
  for (let i = 0; i < X.length; i++) {
    const g = sums.get(group[i]) ?? { n: 0, y: 0, x: new Array<number>(p).fill(0) }
    g.n++
    g.y += y[i]
    for (let k = 0; k < p; k++) g.x[k] += X[i][k]
    sums.set(group[i], g)
  }
  const outX: number[][] = []
  const outY: number[] = []
  for (let i = 0; i < X.length; i++) {
    const g = sums.get(group[i])!
    outY.push(y[i] - g.y / g.n)
    outX.push(X[i].map((v, k) => v - g.x[k] / g.n))
  }
  return { X: outX, y: outY }
}

/**
 * 用交叉验证从网格里挑 λ。
 *
 * **不能拿留出集来挑** —— 那等于让留出集参与了训练,再拿它宣布「样本外涨了」
 * 就是自证。这里只在训练集内部切 k 折,留出集全程没被看过一眼。
 *
 * 判据是预测均方误,不是相关 —— λ 的作用本来就是在偏差和方差之间取舍,
 * 均方误正好是这两项的和。
 */
export function cvLambda(X: number[][], y: number[], grid: number[], folds = 5): number {
  const n = X.length
  if (n < folds * 2 || grid.length === 0) return grid[0] ?? 0
  let best = grid[0]
  let bestErr = Infinity
  for (const lambda of grid) {
    let err = 0
    let count = 0
    for (let f = 0; f < folds; f++) {
      const trX: number[][] = []
      const trY: number[] = []
      const teIdx: number[] = []
      for (let i = 0; i < n; i++) {
        // 等距切分而不是随机切分:同一份输入两次跑必须给同一个 λ
        if (i % folds === f) teIdx.push(i)
        else {
          trX.push(X[i])
          trY.push(y[i])
        }
      }
      const beta = ridge(trX, trY, lambda)
      for (const i of teIdx) {
        let pred = 0
        for (let k = 0; k < beta.length; k++) pred += X[i][k] * beta[k]
        err += (y[i] - pred) ** 2
        count++
      }
    }
    const mse = err / Math.max(1, count)
    if (mse < bestErr) {
      bestErr = mse
      best = lambda
    }
  }
  return best
}

/**
 * 按字符串确定性分组 —— 拿来切训练/留出集。
 *
 * 不能用 Math.random:两次跑必须切出同一份留出集,否则「样本外涨了」
 * 有可能只是这次的切法比较走运,重跑一遍就没了。
 * FNV-1a,够散且只有几行。
 */
export function hashFold(id: string, folds = 2): number {
  let h = 0x811c9dc5
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % folds
}
