// 身材的价格 —— 「一点攻击 / 一点生命换多少胜率」。
// 运行:npm run sim-body(COSTS=2,4,6 · GAMES=800 · COPIES=2)
//
// 【为什么需要它】
// 2026-08-06 全池实测证明 `price-cards` 的点数表可以被校准(归组版过了留出集,
// z = 2.95),但数值**落不了地** —— 因为那次只量得到效果,量不到身材:
// 归组是按 op 分的,白板卡没有 op。而 `price-cards` 的费用曲线恰恰是由
// 以身材为主的中位卡决定的。于是效果整体涨三倍、曲线不动,
// 每张带效果的牌都显得超模(偏离 2 费以上的从 8.3% 涨到 23.8%)。
//
// 这个脚本补上那一块:直接量出「一点身材值多少个百分点胜率」,
// 于是效果与身材第一次落在同一把尺上。
//
// 【为什么要造卡】
// 卡池里问不出来:身材总点数是**费用的函数**(`statBudget`,攻+血 ≈ 2×费+1),
// 同一费用档里几乎所有白板卡总点数都一样 —— 那一列没有方差,回归不出斜率。
// 所以主动打破费用与身材的绑定,在同一档上造一批总点数不同的白板卡。
// 合成卡**只注入 worker 的卡库**(`createGame` 接受 lib 参数),
// 不进卡池、不进快照、不改任何内容文件 —— 零平衡风险。
//
// 【方法与 sim-cards 完全一致】
// 同样是替换法:把预组里费用最接近的普通牌换成探针,和未替换的同一套牌比胜率。
// 种子编排、对手轮转、先后手轮换在两个 worker 里逐字相同,所以 Δ 直接可比。
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import { defaultProbes, budgetOf } from './bodyProbes'
import { fitBody } from './bodyFit'
import type { BodyTask } from './workers/body.worker'

const GAMES = Number(process.env.GAMES ?? 800)
const COPIES = Number(process.env.COPIES ?? 2)
const COSTS = (process.env.COSTS ?? '2,4,6').split(',').map(Number).filter((n) => n > 0)
// 中立卡固定用桃園仁德当基准 —— 与 sim-cards 同一套,历史数字可比
const BASE_IDX = 0

/** 把 COPIES 张费用最接近的普通牌换成探针(与 sim-cards 的 swapIn 同一套逻辑)。 */
function swapIn(probeId: string, cost: number): string[] | null {
  const deck = [...PRECON_DECKS[BASE_IDX].cardIds]
  const counts = new Map<string, number>()
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1)
  const victims = [...counts.keys()].sort(
    (a, b) =>
      Math.abs((CARDS_BY_ID[a]?.cost ?? 99) - cost) - Math.abs((CARDS_BY_ID[b]?.cost ?? 99) - cost) ||
      a.localeCompare(b),
  )
  let need = COPIES
  for (const victim of victims) {
    while (need > 0) {
      const i = deck.indexOf(victim)
      if (i < 0) break
      deck[i] = probeId
      need--
    }
    if (need === 0) break
  }
  return need === 0 ? deck : null
}

const probes = defaultProbes(COSTS)
console.log(
  `sim-body: ${probes.length} 张对照卡(费用 ${COSTS.join('/')},每档预算 ` +
    `${COSTS.map((c) => `${c}费=${budgetOf(c)}`).join(' · ')}),` +
    `每张换入 ${COPIES} 份,${GAMES} 局/张。\n` +
    `基准「${PRECON_DECKS[BASE_IDX].name.zh}」,方法与 sim-cards 完全一致。\n`,
)
for (const p of probes) {
  console.log(`  ${p.cost} 费  ${p.attack}/${p.health}  (总 ${p.attack + p.health})`)
}
console.log('')

const t0 = performance.now()
const WORKER = fileURLToPath(new URL('./workers/body.worker.ts', import.meta.url))
const buildable = probes
  .map((p) => ({ p, deck: swapIn(p.card.id, p.cost) }))
  .filter((x): x is { p: (typeof probes)[0]; deck: string[] } => x.deck !== null)

// 基准排在第 0 位,和探针走同一条路径 —— 不制造「基准串行、待测并行」这种不对称
const jobs: BodyTask[] = [
  { deck: [...PRECON_DECKS[BASE_IDX].cardIds], baseIdx: BASE_IDX, games: GAMES },
  ...buildable.map((b) => ({
    deck: b.deck,
    baseIdx: BASE_IDX,
    games: GAMES,
    probe: b.p.card,
  })),
]
const out = await parallelMap<BodyTask, { wins: number; played: number }>(
  WORKER,
  jobs,
  progress(`${jobs.length} 副牌`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)
const pct = (r: { wins: number; played: number }) => (100 * r.wins) / Math.max(1, r.played)
const baseline = pct(out[0])
console.log(`\n基准胜率 ${PRECON_DECKS[BASE_IDX].name.zh}: ${baseline.toFixed(1)}%\n`)

const rows = buildable.map((b, i) => ({
  cost: b.p.cost,
  attack: b.p.attack,
  health: b.p.health,
  rate: pct(out[1 + i]),
  delta: pct(out[1 + i]) - baseline,
}))

console.log('费用  攻/血   总   胜率     Δ')
for (const r of [...rows].sort((a, b) => a.cost - b.cost || a.attack + a.health - (b.attack + b.health))) {
  const sign = r.delta >= 0 ? '+' : ''
  console.log(
    `${String(r.cost).padStart(3)}   ${String(r.attack).padStart(2)}/${String(r.health).padEnd(2)}  ` +
      `${String(r.attack + r.health).padStart(3)}  ${r.rate.toFixed(1)}%  ${(sign + r.delta.toFixed(1)).padStart(6)}`,
  )
}

const se = Math.sqrt(2 * (0.25 / GAMES)) * 100
console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s;每个 Δ 的标准误 ±${se.toFixed(1)}pp)`)

// ---------- 拟合 ----------
const fit = fitBody(rows)
console.log(
  `\n---- 一点身材值多少胜率(${rows.length} 张对照卡,费用档做固定效应)----\n` +
    `  1 点攻击 = ${fit.perAttack.toFixed(3)} pp   (标准误 ±${fit.seAttack.toFixed(3)}, z=${fit.zAttack.toFixed(1)})\n` +
    `  1 点生命 = ${fit.perHealth.toFixed(3)} pp   (标准误 ±${fit.seHealth.toFixed(3)}, z=${fit.zHealth.toFixed(1)})`,
)
if (fit.perAttack > 0 && fit.perHealth > 0) {
  console.log(
    `\n  实测比价:1 点生命 ≈ ${(fit.perHealth / fit.perAttack).toFixed(2)} 点攻击\n` +
      `  定价表现在写的是 **0.8**(pricing.ts 的 bodyValue,与 ai/greedy 的 unitValue 同源)。`,
  )
}
console.log(
  `\n拿它接定价表:price-cards 的「点」以 1 攻 = 1 点为单位,所以\n` +
    `**1 点 = ${fit.perAttack.toFixed(3)} pp**。而 fit-price 量到的「一点卡面价值 ≈ 1.0pp」\n` +
    `是拿当前那张(效果偏低的)表算出来的混合值 —— 两个数对不上,差的就是效果那一块。`,
)

if (process.env.DUMP) {
  writeFileSync(process.env.DUMP, JSON.stringify({ games: GAMES, copies: COPIES, baseline, rows, fit }, null, 1))
  console.log(`\n已写出 → ${process.env.DUMP}`)
}
