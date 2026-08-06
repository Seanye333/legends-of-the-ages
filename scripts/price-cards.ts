// 自动定价 —— 用一把统一的尺子量整个卡池,报告偏离最大的那些卡。
// 运行:npm run price-cards(TOP=列出前几张,默认 20)
//
// 【它不是「正确的费用」】
// 一张卡的真实强度取决于它和别的卡怎么配合,而那件事只有 sim-balance / sim-cards
// 那种真打得出来。这个脚本量的是**卡面本身值多少** —— 身材加上写在卡面上的效果。
//
// 那它有什么用?它是**唯一能扫全池**的工具。sim-cards 一次只测得动几十张
// (60 局/张,31 秒),而卡池有两千多张;真正的漏网之鱼往往不是「强了 5%」,
// 而是「这张 2 费的怎么写着 5 费的效果」——那种偏差在纸面上就看得见,
// 根本不需要打一局。
//
// 【尺子从哪来】
// 不拍脑袋:用**卡池自己的中位数**回归出来。
//   1. 先算每张卡的「原始价值」= 身材当量 + 效果当量;
//   2. 按费用分组,取每组价值的中位数,得到一条「这个费用档正常长什么样」的曲线;
//   3. 一张卡的定价偏差 = 它落在哪一档 vs 它标着几费。
// 于是曲线随卡池演化自动更新,不需要有人去维护一张手写的价目表。
//
// 但**第 1 步的那张点数表本身**曾经完全没有外部参照(它的注释说「取自同类卡的
// 实际定价」= 从现状反推现状)。校准它的是 scripts/fit-price.ts,拿实测胜率当真值。
// 模型本体在 scripts/pricing.ts,这里只管排版。
//
// 【为什么不做成闸门】
// 偏差大不等于错。传奇本来就该超模,build-around 的卡面价值本来就低
// (它的价值在配合里)。把它做成 CI 红线只会逼着大家去糊弄这把尺子。
// 它是一张**给人看的**清单。
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import type { CardDef } from '../src/engine/types'
import { buildCurve, cardValue, impliedCost } from './pricing'

const TOP = Number(process.env.TOP ?? 20)

// 定价表没覆盖到的 op,跑完在末尾点名(见 pricing.ts 里 opValue 的 default 分支)
const UNPRICED = new Set<string>()

const cards = COLLECTIBLE_CARDS.filter((c) => !c.token)
const valueOf = new Map(cards.map((c) => [c.id, cardValue(c, UNPRICED)]))
const curve = buildCurve(cards.map((c) => ({ cost: c.cost, value: valueOf.get(c.id)! })))

console.log('费用曲线(每档的中位卡面价值):')
for (const k of curve.costs) {
  const n = curve.byCost.get(k)!.length
  console.log(
    `  ${String(k).padStart(2)} 费  中位 ${curve.curve.get(k)!.toFixed(1).padStart(6)}  (${n} 张)`,
  )
}

interface Row {
  card: CardDef
  value: number
  implied: number
  delta: number
}
const rows: Row[] = cards.map((c) => {
  const value = valueOf.get(c.id)!
  const implied = impliedCost(curve, value)
  return { card: c, value, implied, delta: implied - c.cost }
})

const pad = (s: string, n: number) => {
  // 中文字宽按 2 算,否则列对不齐
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
  return s + ' '.repeat(Math.max(0, n - w))
}

const show = (title: string, list: Row[]) => {
  console.log(`\n${title}`)
  for (const r of list.slice(0, TOP)) {
    console.log(
      `  ${pad(r.card.name.zh, 16)} ${String(r.card.cost).padStart(2)} 费  ` +
        `卡面价值 ${r.value.toFixed(1).padStart(6)}  ≈ ${r.implied} 费  ` +
        `(${r.delta > 0 ? '+' : ''}${r.delta})  ${r.card.rarity}`,
    )
  }
}

show(
  `疑似超模(卡面价值高于标价)—— 前 ${TOP}:`,
  rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta || b.value - a.value),
)
show(
  `疑似过弱(卡面价值低于标价)—— 前 ${TOP}:`,
  rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta || a.value - b.value),
)

const off = rows.filter((r) => Math.abs(r.delta) >= 2).length
console.log(
  `\n全池 ${cards.length} 张,偏离 2 费及以上的 ${off} 张(${((off / cards.length) * 100).toFixed(1)}%)。`,
)
console.log(
  '这不是错误清单:传奇本来就该超模,build-around 的卡面价值本来就低(它的价值在配合里)。\n' +
    '拿它当**线索**,真正的判断仍然要跑 sim-cards / sim-balance。',
)

if (UNPRICED.size > 0) {
  console.log(
    `\n⚠ 有 ${UNPRICED.size} 个 op 还没进定价表,这一轮按 0 分计 —— ` +
      `带这些 op 的卡会被系统性低估(看起来「过弱」):\n  ${[...UNPRICED].sort().join(' · ')}\n` +
      `  补进 scripts/pricing.ts 的 opValue 即可。`,
  )
}
