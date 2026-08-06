// 假数据发生器 —— 给 fit-price 当排练场。
//
// 【为什么需要它】
// fit-price 要回答「这套权重比那套准吗」。但在拿它去读真实数据之前,得先知道
// **它自己靠不靠谱**:一台连植入的已知信号都捞不回来的机器,读出来的任何东西
// 都不能信(ARCHITECTURE 铁律 11、ROADMAP 陷阱 8「先验证尺子,再读数」)。
//
// 这里造一份真值已知的 dump:每张卡的 Δ = 信号 × (按 TRUE 权重算出的超模程度) + 噪声。
// 于是可以问三个真问题:
//   1. 噪声调到 0 附近,回归能不能把 TRUE 的那几个权重解出来?(能 —— 见下)
//   2. 噪声调到实测水平(60 局 = ±9pp),还能不能?(不能)
//   3. 那要多少局才够?
//
// 【排练结论(2026-08-05)】
//   ±0.2pp  38 个参数全部收敛到真值附近,样本外 ρ +0.061(z = 12.5)—— 机器是好的
//   ±1pp    仍然赢(z = 3.0)
//   ±2pp    开始输(z = −2.2)
//   ±9pp    系数飞到 ±30,彻底不可读;砍到 4 个参数、甚至用「神谕」直接指定
//           真正被植入信号的那 4 个,照样输
// 60 局/张的实测噪声正是 ±9pp。噪声 ∝ 1/√局数,所以要压到 ±1pp 需要
// **每张卡约 5000 局** —— 全池两千四百张就是一千两百万局。
// 也就是说:这条路不是走不通,是**贵一百倍**。
//
// 运行:OUT=x.json NOISE=9 SIGNAL=0.5 npm run synth-deltas
import { writeFileSync } from 'node:fs'
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import { DEFAULT_WEIGHTS, buildCurve, cardValue, excessValue, type Weights } from './pricing'
import { spearman } from './correlation'

const OUT = process.env.OUT
if (!OUT) {
  console.error('用法:OUT=<输出路径> [NOISE=9] [SIGNAL=0.5] npm run synth-deltas')
  process.exit(1)
}

// 真值:在默认表上动四个权重。挑的是卡数差别很大的四个 ——
// damage 上百张、tutor 几十张、returnToHand 二十来张、swapStats 十几张,
// 正好能看出「多稀有的 op 开始估不动」。
// DRIFT 是「真值离当前表有多远」的倍数。DRIFT=1 是上面那组温和的偏差;
// 调大就等于假设当前表错得更离谱。它回答的问题是:
// **这张表要错到什么程度,60 局/张才看得见?**
const DRIFT = Number(process.env.DRIFT ?? 1)
const shift = (base: number, target: number) => base + (target - base) * DRIFT
const TRUE: Weights = {
  ...DEFAULT_WEIGHTS,
  damage: shift(1.5, 2.5),
  tutor: shift(2.8, 5.0),
  returnToHand: shift(2.4, 6.0),
  swapStats: shift(1.5, 0.0),
}

const pool = COLLECTIBLE_CARDS.filter((c) => !c.token)
const valueOf = new Map(pool.map((c) => [c.id, cardValue(c, undefined, TRUE)]))
const curve = buildCurve(pool.map((c) => ({ cost: c.cost, value: valueOf.get(c.id)! })))
const excess = (id: string, cost: number) => excessValue(curve, cost, valueOf.get(id)!)

// 确定性噪声:FNV 哈希驱动的 Box–Muller。
// **不用 Math.random** —— 两次跑必须给同一份假数据,否则「这次赢了」有可能
// 只是这一版噪声比较配合,重跑一遍就没了。
const noise = (s: string): number => {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  const u1 = ((h >>> 8) % 100000) / 100000 || 1e-6
  h = Math.imul(h ^ 0x9e3779b9, 0x01000193) >>> 0
  const u2 = ((h >>> 8) % 100000) / 100000
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

const SIGNAL = Number(process.env.SIGNAL ?? 0.5) // 每「点」超模换多少个百分点胜率
const NOISE = Number(process.env.NOISE ?? 9) // 60 局/张的实测噪声就是这个量级
const rows = pool.map((c) => ({
  id: c.id,
  name: c.name.zh,
  cost: c.cost,
  rate: 50,
  delta: SIGNAL * excess(c.id, c.cost) + NOISE * noise(c.id),
  base: '(合成)',
}))
// 局数按噪声反推,好让 fit-price 的表头说得通:噪声 = √(2·0.25/局数)·100
const games = Math.max(1, Math.round(0.5 / (NOISE / 100) ** 2))
writeFileSync(OUT, JSON.stringify({ games, copies: 2, cards: rows }))

// 【天花板】用**真值那张表**去和这份数据求相关 —— 没有任何一张表能比它更准。
// 这个数字是解读 fit-price 输出的关键:如果当前表已经贴着天花板,
// 那「改完没变准」不是拟合失败,是**没有空间可改**。
const ceil = spearman(
  rows.map((r) => excess(r.id, r.cost)),
  rows.map((r) => r.delta),
)
console.log(
  `造了 ${rows.length} 张假数据(信号 ${SIGNAL} pp/点,噪声 ±${NOISE} pp ≈ ${games} 局/张)→ ${OUT}\n` +
    `这份数据的**天花板** ρ = ${ceil.r.toFixed(3)}(用植入的真值表算的,没有表能更高)。`,
)
