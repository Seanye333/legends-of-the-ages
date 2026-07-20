// 预组体检:把六套卡组的结构摊平并列,便于「对齐骨架」式调校。
// 对位极化的根因通常不是某张卡强,而是两套牌的骨架不在一个量级 ——
// 曲线、总身材、解场数量、守护/抢攻词条,任何一项差得多都会变成一边倒。
// 运行:node --import tsx scripts/deck-stats.ts
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import type { CardDef } from '../src/engine/types'

const COSTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

// 「解场」= 能直接处理敌方随从的牌(伤害/AOE/摧毁/弹回)
function isRemoval(c: CardDef): boolean {
  const ops = [...(c.spell?.ops ?? []), ...(c.battlecry?.ops ?? []), ...(c.deathrattle?.ops ?? [])]
  return ops.some(
    (o) =>
      o.op === 'aoeDamage' ||
      o.op === 'destroy' ||
      o.op === 'returnToHand' ||
      (o.op === 'damage' &&
        (o.target === 'chosenEnemyGeneral' ||
          o.target === 'chosenAny' ||
          o.target === 'allEnemyGenerals' ||
          o.target === 'randomEnemyGeneral')),
  )
}

interface Row {
  name: string
  avgCost: number
  atk: number
  hp: number
  body: number
  curve: Record<number, number>
  guards: number
  aggro: number // charge + rush
  removal: number
  draw: number
  spells: number
  equips: number
  sig: number
}

const rows: Row[] = PRECON_DECKS.map((d) => {
  const curve: Record<number, number> = {}
  let atk = 0
  let hp = 0
  let guards = 0
  let aggro = 0
  let removal = 0
  let draw = 0
  let spells = 0
  let equips = 0
  let cost = 0
  for (const id of d.cardIds) {
    const c = CARDS_BY_ID[id]
    if (!c) continue
    cost += c.cost
    curve[c.cost] = (curve[c.cost] ?? 0) + 1
    if (c.type === 'general') {
      atk += c.attack ?? 0
      hp += c.health ?? 0
    } else if (c.type === 'stratagem') spells++
    else equips++
    if (c.keywords.includes('guard')) guards++
    if (c.keywords.includes('charge') || c.keywords.includes('rush')) aggro++
    if (isRemoval(c)) removal++
    const ops = [...(c.spell?.ops ?? []), ...(c.battlecry?.ops ?? [])]
    if (ops.some((o) => o.op === 'draw')) draw++
  }
  return {
    name: d.name.zh,
    avgCost: cost / d.cardIds.length,
    atk,
    hp,
    body: atk + hp,
    curve,
    guards,
    aggro,
    removal,
    draw,
    spells,
    equips,
    sig: 0,
  }
})

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
      ` ${r.avgCost.toFixed(2)}  ${num(r.atk, 3)}/${num(r.hp, 3)}  ${num(r.body, 5)}  ` +
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
