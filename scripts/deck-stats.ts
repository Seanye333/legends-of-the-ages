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

// 离群提示:任何一项与中位数差得离谱,基本就是那套牌被碾压/碾压别人的原因
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const medBody = median(rows.map((r) => r.body))
console.log(`\n总身材中位数 ${medBody};偏离超过 8% 的卡组:`)
let flagged = 0
for (const r of rows) {
  const dev = (100 * (r.body - medBody)) / medBody
  if (Math.abs(dev) > 8) {
    console.log(`  ${r.name}: ${r.body}(${dev > 0 ? '+' : ''}${dev.toFixed(0)}%)`)
    flagged++
  }
}
if (flagged === 0) console.log('  (无)')
