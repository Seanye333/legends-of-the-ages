// 预组体检:把六套卡组的结构摊平并列,便于「对齐骨架」式调校。
// 对位极化的根因通常不是某张卡强,而是两套牌的骨架不在一个量级 ——
// 曲线、总身材、解场数量、守护/抢攻词条,任何一项差得多都会变成一边倒。
// 运行:node --import tsx scripts/deck-stats.ts
//
// 指标定义在 `src/content/deckHealth.ts`,与构筑器里的体检面板**共用同一份**:
// 两边算出来的数必须是同一个数,否则「构筑器说解场够」和「这里说解场少」
// 会同时成立。
import { PRECON_DECKS } from '../src/content/decks'
import { deckHealth } from '../src/content/deckHealth'
import { judgeSkeleton, POWER_AXES, AXIS_LABEL, MAX_TOPS, BODY_DEV_PCT } from './skeletonGate'

const COSTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const rows = PRECON_DECKS.map((d) => ({ name: d.name.zh, ...deckHealth(d.cardIds) }))

const pad = (s: string, w: number) => s.padEnd(w, '　').slice(0, w)
const num = (n: number, w = 4) => String(n).padStart(w)

console.log('预组体检(骨架对齐用):\n')
console.log(
  pad('卡组', 6) +
    ' 均费  攻/血    总身材  守护  抢攻  解场  抽牌  锦囊  装备',
)
for (const r of rows) {
  console.log(
    pad(r.name, 6) +
      ` ${r.avgCost.toFixed(2)}  ${num(r.attack, 3)}/${num(r.health, 3)}  ${num(r.body, 5)}  ` +
      `${num(r.guards, 3)}  ${num(r.aggro, 4)}  ${num(r.removal, 4)}  ${num(r.draw, 4)}  ${num(r.spells, 4)}  ${num(r.equips, 4)}`,
  )
}

console.log('\n费用曲线:')
console.log(pad('卡组', 6) + COSTS.map((c) => num(c, 4)).join(''))
for (const r of rows) {
  console.log(pad(r.name, 6) + COSTS.map((c) => num(r.curve[c] ?? 0, 4)).join(''))
}

// ---------- 判定 ----------
// 判定逻辑在 skeletonGate.ts —— 抽出去是为了能不看这张表就验证它,
// 那边钉着两个方向,其中最要紧的一条是「每项都在限内、但一套牌把好处占全了」
// 必须被抓住(那正是 2026-08-08 那次失衡的形状)。
const decks = rows.map((r) => ({ name: r.name, health: r }))
const verdict = judgeSkeleton(decks)

console.log(`\n各项之首(★ = 独占;并列不算占住):`)
for (const axis of POWER_AXES) {
  const vals = rows.map((r) => r[axis])
  const mx = Math.max(...vals)
  console.log(
    `  ${pad(AXIS_LABEL[axis], 4)}` +
      rows.map((r, i) => `${r.name}=${vals[i]}${vals[i] === mx ? '★' : ' '}`).join('  '),
  )
}
const held = verdict.tops.filter((t) => t.axes.length > 0)
console.log(
  `  独占计数(上限 ${MAX_TOPS}):` +
    (held.map((t) => `${t.name}×${t.axes.length}`).join('  ') || '(无)'),
)
console.log(`\n总身材中位数 ${verdict.medianBody},容差 ±${BODY_DEV_PCT}%`)

if (verdict.problems.length) {
  console.log('\n⚠ 骨架失衡:')
  for (const p of verdict.problems) console.log(`  ${p}`)
  process.exitCode = 1
} else {
  console.log('\n✓ 无卡组独占超过上限,总身材均在容差内')
}
