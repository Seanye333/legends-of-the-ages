// 定价表的拟合优度 —— 「那把尺子量得准吗」的可证伪版本。
//
// 【要解决的问题】
// price-cards 的点数表从来没有外部参照:它的注释说数值「取自同类卡的实际定价」,
// 也就是**从现状反推现状**。卡池里某一类效果整体定价偏低时,这张表会忠实地把偏差
// 学过来,再拿去给新卡定价 —— 偏差自我复制,而且用它自己量自己永远查不出来。
//
// 唯一在这个环之外的东西是**对局结果**。sim-cards 把一张卡换进预组打若干局,
// 和没换的同一套牌比胜率,得到的 Δ 不依赖任何人对「这个效果值几分」的看法。
//
// 【怎么用】
//   DUMP=cards.json SAMPLE=3000 npm run sim-cards   # 扫全池,落盘实测 Δ
//   DELTAS=cards.json npm run fit-price             # 报告拟合优度 + 回归出一套权重
//
// 【指标:秩相关】
// 主指标是 Spearman ρ —— 定价表的输出是「点数」,实测是「百分点」,量纲不同,
// 关心的是排序对不对。而且卡池里有一小撮极端卡,Pearson 会被它们主导,
// 那等于奖励「把几张离群卡拟合好、其余全错」的改法。
//
// 【别期待 ρ 很高】
// 单张卡 60 局的实测噪声是 ±9 个百分点,而真实效应的量级只有几个点 ——
// 信噪比本来就低,天花板远不到 1。这个脚本要回答的不是「ρ 够不够高」,而是
// **「换一套权重之后,在没参与过拟合的那一半卡上,ρ 有没有变高」**。
import { readFileSync } from 'node:fs'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../src/content/cards'
import type { CardDef } from '../src/engine/types'
import {
  DEFAULT_WEIGHTS,
  KEYWORD_VALUE,
  type Weights,
  bodyValue,
  buildCurve,
  cardValue,
  excessValue,
  impliedCost,
  DEFAULT_BODY,
  LEGACY_BODY,
  type BodyWeights,
  opsOf,
} from './pricing'
import { diffZ, pearson, spearman } from './correlation'
import { cvLambda, demeanByGroup, hashFold, ridge } from './fitWeights'

const PATH = process.env.DELTAS ?? ''
if (!PATH) {
  console.error(
    '用法:DELTAS=<sim-cards 的 DUMP 文件> npm run fit-price\n' +
      '先跑:DUMP=cards.json SAMPLE=3000 npm run sim-cards',
  )
  process.exit(1)
}

interface Dump {
  games: number
  copies: number
  cards: { id: string; name: string; cost: number; rate: number; delta: number; base: string }[]
}
const dump: Dump = JSON.parse(readFileSync(PATH, 'utf8'))

const pool = COLLECTIBLE_CARDS.filter((c) => !c.token)

/**
 * 拿一组权重给全池定价,返回「每张卡比它那个费用档的正常水平高出多少点」。
 * 曲线也跟着这组权重重算 —— 换了权重,「正常水平」本来就该跟着变。
 */
function excessFor(w: Weights, body: BodyWeights = DEFAULT_BODY): Map<string, number> {
  const valueOf = new Map(pool.map((c) => [c.id, cardValue(c, undefined, w, body)]))
  const curve = buildCurve(pool.map((c) => ({ cost: c.cost, value: valueOf.get(c.id)! })))
  return new Map(pool.map((c) => [c.id, excessValue(curve, c.cost, valueOf.get(c.id)!)]))
}

// 实测那一侧。dump 里可能有卡池里已经没有的卡(改版删掉的),对不上就跳过并点名 ——
// 悄悄少几张不至于改变结论,但悄悄少几百张会。
const measured: { card: CardDef; delta: number }[] = []
const missing: string[] = []
for (const row of dump.cards) {
  const c = CARDS_BY_ID[row.id]
  if (!c) {
    missing.push(row.id)
    continue
  }
  measured.push({ card: c, delta: row.delta })
}

console.log(
  `拟合样本:${measured.length} 张(${dump.games} 局/张,每张换入 ${dump.copies} 份)` +
    (missing.length ? `,对不上卡池的 ${missing.length} 张已跳过` : ''),
)

const ys = measured.map((m) => m.delta)
const costs = measured.map((m) => m.card.cost)

/** 在给定的卡集合上,把一组权重的「超出本档多少点」取出来。 */
const xsOf = (w: Weights, idx: number[]): number[] => {
  const ex = excessFor(w)
  return idx.map((i) => ex.get(measured[i].card.id)!)
}

const ALL = measured.map((_, i) => i)

/**
 * 这张表让 `price-cards` 报出多少张「偏离 2 费及以上」。
 *
 * 【为什么这也是个指标】
 * 2026-08-06 吃过一次亏:照实测改完效果权重,留出集 ρ 明显变好,
 * 但 `price-cards` 的可疑名单从 200 张涨到 574 张(8.3% → 23.8%),榜首整页
 * 都是低费伤害锦囊 —— **一份四分之一卡池都上榜的「线索清单」不是线索清单**。
 * ρ 量的是「排序对不对」,这一列量的是「这份报表还能不能用」。
 * 两个都要看:只看 ρ 会把工具优化成没人读得下去的样子。
 */
function offCount(w: Weights, body: BodyWeights = DEFAULT_BODY): string {
  const valueOf = new Map(pool.map((c) => [c.id, cardValue(c, undefined, w, body)]))
  const curve = buildCurve(pool.map((c) => ({ cost: c.cost, value: valueOf.get(c.id)! })))
  const off = pool.filter((c) => Math.abs(impliedCost(curve, valueOf.get(c.id)!) - c.cost) >= 2).length
  return `${String(off).padStart(4)} 张 ${((off / pool.length) * 100).toFixed(1)}%`
}

function report(label: string, xs: number[], y: number[], w?: Weights, body?: BodyWeights): void {
  const sp = spearman(xs, y)
  const pe = pearson(xs, y)
  console.log(
    `${label.padEnd(10)} ρ(秩) ${sp.r >= 0 ? '+' : ''}${sp.r.toFixed(3)}  z ${sp.z.toFixed(1).padStart(5)}` +
      `   r(线性) ${pe.r >= 0 ? '+' : ''}${pe.r.toFixed(3)}  z ${pe.z.toFixed(1).padStart(5)}` +
      (w ? `   报表可疑 ${offCount(w, body)}` : ''),
  )
}

console.log('\n---- 当前表的拟合优度(全样本)----')
console.log('「卡面价值超出本费用档多少」 vs 「实测胜率 Δ」。正相关 = 尺子指对了方向。\n')
report('当前表', xsOf(DEFAULT_WEIGHTS, ALL), ys)

// ---- 身材那三个系数换回旧式,看差多少 ----
//
// 2026-08-06 把 bodyValue 从「攻×1 + 血×0.8」换成带 min(攻,血) 的形式,
// 依据是 26 张对照卡的独立实验(z(均衡) = 8.7,见 npm run sim-body)。
// 那是**另一份数据**;这里再拿卡池这一份验一遍 —— 两份独立数据都指向同一个方向,
// 才算真的站得住。注意旧式已经归一过均值,所以差的只是形状。
{
  const legacyAll = (() => {
    const ex = excessFor(DEFAULT_WEIGHTS, LEGACY_BODY)
    return ALL.map((i) => ex.get(measured[i].card.id)!)
  })()
  report('旧身材', legacyAll, ys)
  const a = spearman(legacyAll, ys).r
  const b = spearman(xsOf(DEFAULT_WEIGHTS, ALL), ys).r
  const z = diffZ(b, a, spearman(legacyAll, xsOf(DEFAULT_WEIGHTS, ALL)).r, measured.length)
  console.log(
    `\n身材换成带均衡项之后:Δρ ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(3)}  z ${z.toFixed(2)}` +
      `(相依检验)\n  ${
        Math.abs(z) < 2
          ? '→ 在卡池这份数据上分不出高下(但对照卡那份数据上 z = 8.7)。'
          : z > 0
            ? '→ **卡池这份数据也说新式更准** —— 两份独立数据同向。'
            : '→ 卡池这份数据说新式更差,和对照卡冲突,要查。'
      }`,
  )
}

// ---- 回归:从实测里解出权重,而不是照着「平均 Δ」手改 ----
//
// 【手改为什么不行】
// 按效果归组给的是「带这个 op 的卡整体偏强多少」。一张卡常带好几个 op,
// 归组时它在每一组里都算一次 —— `damage` 的 +4.1 里有一部分其实是同卡的
// `draw` 贡献的。照着它改等于把混杂当成了效应。
// 回归天然处理这件事:每张卡一个方程,一起解出「控制住其他 op 之后,它单独值多少」。
//
// 【留出集】
// 39 个自由度拟合两千个带 ±9 个百分点噪声的观测,**一定**能把 in-sample 相关拉高。
// 所以按卡 id 哈希对半分:一半拟合,另一半评判。样本外不涨,这次拟合就不算数。
//
// 【⚠ 60 局/张的数据喂不动这个回归 —— 先读这一段再读输出】
// 拿植入了已知真值的假数据排练过(`npm run synth-deltas`):
//   噪声 ±0.2pp → 38 个参数全部收敛到真值附近,样本外 ρ +0.061(z = 12.5)
//   噪声 ±1pp   → 仍然赢(z = 3.0)
//   噪声 ±2pp   → 开始输(z = −2.2)
//   噪声 ±9pp   → 系数飞到 ±30,彻底不可读
// 而 60 局/张的实测噪声正是 ±9pp。**机器是好的,数据不够。**
//
// TOPOPS 是往这个方向试过的补救:只给卡数最多的几个 op 各留一个参数,
// 其余固定在默认值(被丢掉的 op 进残差,只让噪声略增,不引入偏倚)。
// **它没救回来** —— ±9pp 下砍到 8 个、4 个,甚至用「神谕」直接指定真正被植入
// 信号的那 4 个,样本外照样不涨。留着这个开关是为了让下一个人不必重试一遍。
//
// **但「回归喂不动」不等于「这件事做不成」。** 我一度据此在 ROADMAP 里写下
// 「这个预算下不可判定」,依据是合成数据算出的天花板 ρ = 0.095。那个天花板是假的 ——
// 假数据的信号强度是我随手设的,比真实低一半(真实数据当前表就有 ρ ≈ 0.25)。
// 换成**按效果归组**就做成了(留出集 z ≈ 3~4,见下面的「归组版」)。
// 教训写进了铁律 11:**排练能证伪一个方法,不能证明一件事不可能。**
const TOPOPS = Number(process.env.TOPOPS ?? 8)
const ALL_FITTABLE: (keyof Weights)[] = (Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]).filter(
  // delayDecay 是个衰减率不是分值,对它做线性回归没有意义 —— 固定在默认值。
  (k) => k !== 'delayDecay',
)

/** 一张卡在某个权重上「带了多少份」= ∂卡面价值/∂w_k。价值对权重是线性的,所以差分即导数。 */
const loadOf = (c: CardDef, k: keyof Weights): number =>
  cardValue(c, undefined, { ...DEFAULT_WEIGHTS, [k]: DEFAULT_WEIGHTS[k] + 1 }) -
  cardValue(c, undefined, DEFAULT_WEIGHTS)

// 按「有多少张卡带它」排,取前 TOPOPS 个。
// 用**训练集**的卡数排序,不是全池 —— 留出集连选变量这一步都不该参与。
const opCount = new Map<keyof Weights, number>()
for (const k of ALL_FITTABLE) {
  opCount.set(k, 0)
}
const trainCards = measured.filter((_, i) => hashFold(measured[i].card.id) === 0)
for (const k of ALL_FITTABLE) {
  let n = 0
  for (const m of trainCards) if (Math.abs(loadOf(m.card, k)) > 1e-9) n++
  opCount.set(k, n)
}
// FITOPS=damage,tutor,… 手工指定要拟合哪几个 —— 拿按效果归组的显著项来选,
// 比「按卡数取前 N 个」准得多:卡数最多的那几个 op 未必是定价错得最厉害的。
// 选变量这一步只许看训练集或归组结果,**不许看留出集**。
const PICKED = (process.env.FITOPS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean) as (keyof Weights)[]
const unknown = PICKED.filter((k) => !ALL_FITTABLE.includes(k))
if (unknown.length) {
  console.error(`FITOPS 里有不认识的权重名:${unknown.join(' · ')}`)
  process.exit(1)
}
const FITTABLE = PICKED.length
  ? PICKED
  : [...ALL_FITTABLE]
      .sort((a, b) => opCount.get(b)! - opCount.get(a)! || a.localeCompare(b))
      .slice(0, TOPOPS)

function designRow(c: CardDef): number[] {
  const row = FITTABLE.map((k) => loadOf(c, k))
  // 身材单列。它同时是**尺度的锚**:β 的单位是「百分点/份」,而定价表的单位是
  // 「点」(1 点 ≈ 1 攻)。把 β_body 归一到 1 就换算完了,也正好保住表里那条最老的约定。
  row.push(bodyValue(c))
  // 关键词单列:KEYWORD_VALUE 不在 Weights 里,但不放进来的话它的贡献会被
  // 别的列吸收掉(带关键词的卡往往也带效果)。
  row.push(c.keywords.reduce((a, kw) => a + (KEYWORD_VALUE[kw] ?? 0.5), 0))
  return row
}

const BODY_COL = FITTABLE.length
const KW_COL = FITTABLE.length + 1

const trainIdx: number[] = []
const holdIdx: number[] = []
measured.forEach((m, i) => (hashFold(m.card.id) === 0 ? trainIdx : holdIdx).push(i))

const design = measured.map((m) => designRow(m.card))

// 只拟合训练集。费用档用组内去心吸收 —— 不控制费用的话,回归学到的第一件事
// 会是「高费卡更强」(废话),而且会污染所有与费用相关的 op(群体伤害多半在高费)。
const trD = demeanByGroup(
  trainIdx.map((i) => design[i]),
  trainIdx.map((i) => ys[i]),
  trainIdx.map((i) => costs[i]),
)
const lambda = cvLambda(trD.X, trD.y, [0.1, 1, 3, 10, 30, 100, 300, 1000, 3000])
const beta = ridge(trD.X, trD.y, lambda)

console.log(
  `\n---- 回归拟合(训练 ${trainIdx.length} 张 / 留出 ${holdIdx.length} 张,λ=${lambda})----\n` +
    `拟合 ${FITTABLE.length} 个 op(括号是训练集里的卡数),其余固定在默认值:\n  ` +
    FITTABLE.map((k) => `${k}(${opCount.get(k)})`).join(' · ') +
    `\n⚠ ${dump.games} 局/张 ≈ ±${(Math.sqrt(2 * (0.25 / dump.games)) * 100).toFixed(1)}pp 噪声。` +
    `排练结论:**±2pp 以上这个回归就开始拟合噪声**,下面这组权重仅供参考,别照抄。`,
)

let FITTED: Weights | null = null
if (beta[BODY_COL] <= 0) {
  // 身材的系数是负的 = 「身材越好的卡越弱」。那不是一个可能的世界,
  // 是这次拟合整个落在噪声里。此时任何换算出来的权重都是假的。
  console.log(
    `⚠ 身材系数 ${beta[BODY_COL].toFixed(4)} ≤ 0 —— 这次拟合整个是噪声,不换算权重。\n` +
      `  (身材是尺度的锚,它为负意味着「身材越好越弱」,那不是一个可能的世界。)`,
  )
} else {
  const scale = 1 / beta[BODY_COL] // 归一到「1 点 = 1 攻」
  const out: Weights = { ...DEFAULT_WEIGHTS }
  const lines: string[] = []
  FITTABLE.forEach((k, i) => {
    const fitted = beta[i] * scale
    out[k] = fitted
    const old = DEFAULT_WEIGHTS[k]
    if (Math.abs(fitted - old) > 0.4) {
      lines.push(
        `  ${String(k).padEnd(18)} ${old.toFixed(2).padStart(6)} → ${fitted.toFixed(2).padStart(6)}` +
          `  (${fitted > old ? '+' : ''}${(fitted - old).toFixed(2)})`,
      )
    }
  })
  FITTED = out
  console.log(
    `身材系数 ${beta[BODY_COL].toFixed(4)} 个百分点/点,关键词 ${beta[KW_COL].toFixed(4)}。\n` +
      `改动超过 0.4 点的权重:`,
  )
  console.log(lines.length ? lines.join('\n') : '  (无)')
}

// ---- 候选二:按效果归组,**只看训练集**,规则化地改 ----
//
// 【为什么这条路走得通而回归走不通】
// 回归要同时解 40 个未知数,每个的方差都吃满 ±9pp 的噪声。
// 归组只问一件事:「带这个 op 的卡整体偏强多少」—— 那是 n 张卡的均值,
// 噪声按 √n 缩小(returnToHand 有 51 张,均值标准误只有 ±1.0pp)。
// 代价是它**分不开同卡的多个 op**(混杂),但混杂只让估计有偏,不让它爆炸。
// 在这个信噪比下,有偏但稳,胜过无偏但方差无穷。
//
// 【三步,每一步只用训练集】
//   1. 每个 op 的平均 Δ,和全池均值比,算 z;
//   2. 单变量回归 Δ ~ 当前表的「超出本档多少点」,斜率就是**每点值多少个百分点**,
//      拿它把 pp 换算成点(这一步以前是拍脑袋拍出来的 3pp/点);
//   3. |z| > 2 的 op 才动,改动量 = (该 op 均值 − 全池均值) / 斜率。
// 然后拿留出集裁决。留出集全程没参与:没参与拟合,也没参与**选哪几个 op**。
// 「点 → 百分点胜率」的实测汇率。bodyValue 归一时用的 0.6334 就是「pp → 点」,
// 所以反过来 1 点 = 1/0.6334 pp。来自 sim-body 那份独立实验,不依赖任何人对效果的看法。
const BODY_PP_PER_POINT = 1 / 0.6334

const excessDefault = excessFor(DEFAULT_WEIGHTS)

/** 在给定的卡集合上跑一遍归组规则,返回新权重表和一份改动清单。 */
function groupedFrom(idx: number[]): {
  weights: Weights
  lines: string[]
  slope: number
  regressionSlope: number
} {
  const rows = idx.map((i) => ({
    ops: opsOf(measured[i].card),
    delta: ys[i],
    excess: excessDefault.get(measured[i].card.id)!,
  }))
  const gPoolMean = rows.reduce((a, r) => a + r.delta, 0) / Math.max(1, rows.length)
  const gSpread = Math.sqrt(
    rows.reduce((a, r) => a + (r.delta - gPoolMean) ** 2, 0) / Math.max(1, rows.length),
  )
  // 每「点」卡面价值换多少个百分点胜率 —— 拿它把 pp 换算成点。
  //
  // 【为什么用实测的身材汇率,不用这里回归出来的斜率】
  // 回归斜率是拿**当前这张表**算出的「超出本档多少点」对 Δ 回归得到的,
  // 它是身材与效果的**混合汇率**,而当前表的效果那一半正是我们怀疑错了的东西 ——
  // 用它去校正它自己,又是一个闭环。
  //
  // 身材那边有独立实测(`npm run sim-body`,26 张对照卡 × 800 局):
  // `bodyValue` 归一时用的 0.6334 就是「点 → pp」的系数,所以 1 点 = 1/0.6334 = 1.579 pp。
  // 那份数据完全不依赖任何人对效果的看法。
  //
  // 差别是实打实的:混合斜率约 1.0,而实测身材汇率 1.579 —— 用前者会把每个 op 的
  // 改动量**放大约六成**。2026-08-06 实测:用 1.0 时 price-cards 的可疑名单
  // 涨到 481 张(19.9%),用 1.579 时明显收敛(见输出里的「报表可疑」一列)。
  const regressionSlope = (() => {
    const mx = rows.reduce((a, r) => a + r.excess, 0) / Math.max(1, rows.length)
    let sxy = 0
    let sxx = 0
    for (const r of rows) {
      sxy += (r.excess - mx) * (r.delta - gPoolMean)
      sxx += (r.excess - mx) ** 2
    }
    return sxx === 0 ? 0 : sxy / sxx
  })()
  const slope = BODY_PP_PER_POINT

  const GROUPED: Weights = { ...DEFAULT_WEIGHTS }
  const groupedLines: string[] = []
  if (slope > 0) {
    const byOpTrain = new Map<string, number[]>()
    for (const r of rows) {
      for (const op of r.ops) {
        const arr = byOpTrain.get(op) ?? []
        arr.push(r.delta)
        byOpTrain.set(op, arr)
      }
    }
  // op 名字 → 受它影响的权重键。
  //
  // 【为什么一个 op 可能要动好几个键】
  // 归组只知道「带 damage 的卡整体偏强 X」,它**分不开**打脸和打随从
  // (卡池里两者都记成 `damage`)。只把 `damage` 从 1.5 提到 4.0 而 `damageFace`
  // 留在 1.1,等于宣布「3 点打脸只值打随从的四分之一」—— 那不是数据说的,
  // 那是归组分不开的东西被我随手赋给了其中一边。
  // 同一个 op 的几个分支按**同样的绝对量**一起动:效应是「这个 op 每份多值 X 点」,
  // 它对每个分支都成立。
  const KEYS_OF: Record<string, (keyof Weights)[]> = {
    damage: ['damage', 'damageFace'],
    damageAll: ['aoeDamage'],
    buffStats: ['buffStats', 'buffStatsTemp'],
    gainMana: ['gainMana', 'gainManaTemp'],
    mill: ['millEnemy', 'millSelf'],
    summonForEnemy: ['summon'],
  }
  // 这两个 op 的价值不由**单个权重**决定,归组的结论没法落到表上:
  //   grantKeyword —— 主体是 KEYWORD_VALUE(不在 Weights 里),
  //                   只动 grantKeywordTemp 等于把结论全按到「短效」那一支上;
  //   delay        —— delayDecay 是个衰减率不是分值,加减「点」没有意义。
  const SKIP = new Set(['grantKeyword', 'delay'])
  for (const [op, ds] of byOpTrain) {
    if (ds.length < 5 || SKIP.has(op)) continue
    const keys = KEYS_OF[op] ?? [op as keyof Weights]
    if (keys.some((k) => !(k in DEFAULT_WEIGHTS))) continue
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length
    const z = (mean - gPoolMean) / (gSpread / Math.sqrt(ds.length))
    if (Math.abs(z) <= 2) continue
    // 【单位:归组的均值是「每张卡」,而权重有的是「每点 / 每张」】
    // 这里踩过一个真错。归组说「带 aoeDamage 的卡整体强 8.6pp」——那是**一张卡**的效应。
    // 但 `aoeDamage` 这个权重是**乘在伤害点数上**的(3 点群伤 = 3 × 权重),
    // 直接把每卡的改动量加到权重上,等于又乘了一遍平均点数(群伤普遍 2~3 点),
    // 于是 aoeDamage 被顶到 7.2/点,一张 2 费的群伤锦囊卡面价值 24.5,
    // 直接判成 10 费 —— 榜单前十全是低费伤害锦囊。
    //
    // 正确做法是先除掉那个倍数:`loadOf` 给的正是 ∂卡面价值/∂权重,
    // 也就是「这张卡带了几份」。取带此 op 的卡的平均份数即可。
    // 对 destroy / seize / returnToHand 这种一张卡就是一份的 op,倍数是 1,不受影响。
    const loads = idx
      .filter((i) => opsOf(measured[i].card).includes(op))
      .map((i) => Math.abs(loadOf(measured[i].card, keys[0])))
      .filter((v) => v > 1e-9)
    const meanLoad = loads.length ? loads.reduce((a, b) => a + b, 0) / loads.length : 1
    const deltaPoints = (mean - gPoolMean) / slope / meanLoad
    // 夹一下:一个 op 一次最多动 4 点。归组带混杂,极端值多半是同卡别的 op 的功劳。
    const adj = Math.max(-4, Math.min(4, deltaPoints))
    for (const key of keys) {
      // 【下限:原值的两成,不许归零】
      // 归零是一句**断言**:「这个效果一分不值」。这类测量给不出这种结论 ——
      // 单个 op 的均值标准误约 ±1pp,而 ±4 的夹子会把任何一个小权重(护甲 0.7、
      // 治疗 0.7)直接压穿到 0,那是夹子的产物不是数据的结论。
      // 更要紧的是铁律 8:**贪心 AI 对治疗和护甲的评分近乎为零**,这把尺子
      // 对防守向的东西系统性低估(先手补偿那一轮实测:6 点护甲只值 4.2pp,
      // 不到一张牌的一半)。把它测出来的 0 原样刻进定价表,等于把 AI 的盲区
      // 变成卡池的官方口径,而这份报表是给**人**看的。
      GROUPED[key] = Math.max(0.2 * DEFAULT_WEIGHTS[key], DEFAULT_WEIGHTS[key] + adj)
      groupedLines.push(
        `  ${String(key).padEnd(18)} ${DEFAULT_WEIGHTS[key].toFixed(2).padStart(6)} → ` +
          `${GROUPED[key].toFixed(2).padStart(6)}  (${op}, n=${ds.length}, z=${z.toFixed(1)})`,
      )
      }
    }
  }
  return { weights: GROUPED, lines: groupedLines, slope, regressionSlope }
}

const gTrain = groupedFrom(trainIdx)
const GROUPED = gTrain.weights
console.log(
  `\n---- 归组版(只用训练集,${trainIdx.length} 张)----\n` +
    `每点卡面价值 ≈ ${gTrain.slope.toFixed(3)} 个百分点胜率(单变量回归,训练集)。\n` +
    `|z|>2 的 op 才动,改动量 = (该 op 均值 − 全池均值) / 斜率,单次最多 ±4 点:`,
)
console.log(gTrain.lines.length ? gTrain.lines.join('\n') : '  (无)')

// ---- 候选一:照着 sim-cards 的按效果归组手改的那一版 ----
//
// 留着它是为了和回归对照。它正是「看一眼榜单就动手」的那种改法,
// 换算尺度(平均 Δ 每 3 个百分点 ≈ 1 点)也是拍的 —— 拿它当对照组:
// 如果手改和回归打成平手,说明这套数据还撑不起那么精细的拟合。
const HAND: Weights = {
  ...DEFAULT_WEIGHTS,
  returnToHand: 2.4 + 3.4, // 归组 +10.1(n=25, z=6.3)
  aoeDamage: 3.2 + 1.0, //          +9.4 (16, 4.6) 每点
  recruit: 3.5 + 2.9, //            +8.8 (7,  2.9)
  damage: 1.5 + 0.5, //             +4.1 (129, 5.3) 每点
  tutor: 2.8 + 1.2, //              +3.5 (52, 2.8)
  swapStats: 1.5 - 1.5, //          −5.8 (14, −3.1) 唯一显著偏**高**的
}

// ---- 裁决:只看留出集 ----
//
// 训练集上的 ρ 不算数 —— 那一半卡参与过拟合。
// 两个 ρ 也不能各自比置信区间:用的是同一批卡,误差高度相关,
// 独立假设会把差异的标准误算得太大,真实的改进被判成噪声。用 Steiger 的相依检验。
console.log(`\n---- 裁决:留出集 ${holdIdx.length} 张(全程没参与拟合)----`)
const holdY = holdIdx.map((i) => ys[i])
const holdBase = xsOf(DEFAULT_WEIGHTS, holdIdx)
report('当前表', holdBase, holdY, DEFAULT_WEIGHTS)
report('归组版', xsOf(GROUPED, holdIdx), holdY, GROUPED)
report('手改版', xsOf(HAND, holdIdx), holdY, HAND)
if (FITTED) report('回归版', xsOf(FITTED, holdIdx), holdY, FITTED)

const verdict = (label: string, xs: number[]) => {
  const a = spearman(holdBase, holdY).r
  const b = spearman(xs, holdY).r
  const between = spearman(holdBase, xs).r
  const z = diffZ(b, a, between, holdIdx.length)
  console.log(
    `\n${label} vs 当前表:Δρ ${(b - a >= 0 ? '+' : '') + (b - a).toFixed(3)}  ` +
      `z ${z.toFixed(2)}(相依检验,两表彼此 ρ = ${between.toFixed(3)})`,
  )
  console.log(
    Math.abs(z) < 2
      ? '  → **分不出高下**,没有可证明的改进,不要落地 ——\n' +
          '    「看起来更有道理」不是证据,那正是这张表当初的来路。'
      : z > 0
        ? '  → 显著更准,可以落地。'
        : '  → 显著**更差**,别改。',
  )
}
verdict('归组版', xsOf(GROUPED, holdIdx))
verdict('手改版', xsOf(HAND, holdIdx))
if (FITTED) verdict('回归版', xsOf(FITTED, holdIdx))

// 手改版是**有泄漏的**,别拿它当证据:那六个数值是照着 1200 张那一轮的归组结果
// 拍出来的,而那 1200 张是这 2416 张的子集 —— 也就是说留出集里有一半的卡
// 参与过「该改哪几个 op、改多少」的决定。它留在这里只是当参照物,
// **能当证据的只有归组版**(选 op、定尺度、定改动量三步全部只用训练集)。
console.log(
  '\n⚠ 「手改版」的六个数值是照着更早一轮归组结果拍的,而那一轮的卡是本轮的子集 ——\n' +
    '  留出集里有一半参与过「改哪几个 op」的决定,**它的 z 偏高,不算干净的证据**。\n' +
    '  干净的那个是「归组版」:选 op、定尺度、定改动量三步全部只用训练集。',
)

// ---- 最终表:同一条规则,用**全部样本**再算一遍 ----
//
// 留出集裁的是**这条规则**行不行,不是这一组具体数值。规则过关之后,
// 拿全部样本重算才是最好的估计(训练集只有一半的卡,估计噪声大一倍)。
// 这是标准做法,而且不构成泄漏:规则本身没有因为留出集的结果被改过。
{
  const final = groupedFrom(ALL)
  console.log(
    `\n---- 最终表(同一条规则,全部 ${measured.length} 张)----\n` +
      `每点卡面价值 = ${final.slope.toFixed(3)} pp(实测身材汇率)。可以照抄进 scripts/pricing.ts:`,
  )
  console.log(final.lines.length ? final.lines.join('\n') : '  (无)')
  const holdFinal = xsOf(final.weights, holdIdx)
  const a = spearman(holdBase, holdY).r
  const b = spearman(holdFinal, holdY).r
  console.log(
    `\n(参考:最终表在留出集上 ρ = ${b.toFixed(3)},当前表 ${a.toFixed(3)} —— ` +
      `但它见过留出集,**这个数字不是证据**,证据是上面那条「归组版」。)`,
  )
}

// ---- 分档看:尺子在哪个费用段最不准 ----
// 全池一个 ρ 会把「低费段很准、高费段全错」和「哪都一般」混成同一个数。
console.log('\n---- 当前表按费用分档(全样本)----')
const ex = excessFor(DEFAULT_WEIGHTS)
const byCost = new Map<number, { x: number[]; y: number[] }>()
for (const m of measured) {
  const b = byCost.get(m.card.cost) ?? { x: [], y: [] }
  b.x.push(ex.get(m.card.id)!)
  b.y.push(m.delta)
  byCost.set(m.card.cost, b)
}
console.log('费用   张数    ρ      z')
for (const k of [...byCost.keys()].sort((a, b) => a - b)) {
  const b = byCost.get(k)!
  if (b.x.length < 20) continue
  const sp = spearman(b.x, b.y)
  console.log(
    `${String(k).padStart(3)} 费 ${String(b.x.length).padStart(5)}  ` +
      `${(sp.r >= 0 ? '+' : '') + sp.r.toFixed(3)}  ${sp.z.toFixed(1).padStart(5)}`,
  )
}

console.log(
  '\n注:单张卡 60 局的实测噪声是 ±9 个百分点,而真实效应只有几个点 —— 信噪比本来就低,\n' +
    'ρ 的天花板远不到 1。这个脚本回答的不是「ρ 够不够高」,是「换一套权重有没有变高」。',
)
