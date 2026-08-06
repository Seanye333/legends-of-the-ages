// 重新分析 sim-body 落盘的数据 —— 不重跑对局。
// 运行:BODY=<sim-body 的 DUMP 文件> npm run fit-body
//
// 分开成两个脚本是因为**跑对局要十七分钟,换个模型只要几毫秒**。
// 2026-08-06 第一版就吃了这个亏:线性模型解释不了数据,而当时唯一的
// 「换个模型看看」的办法是把整轮重跑一遍。
import { readFileSync } from 'node:fs'
import { fitBody, fitBodyBalanced, type BodyRow } from './bodyFit'

const PATH = process.env.BODY ?? ''
if (!PATH) {
  console.error('用法:BODY=<sim-body 的 DUMP 文件> npm run fit-body')
  process.exit(1)
}
const dump: { games: number; baseline: number; rows: BodyRow[] } = JSON.parse(
  readFileSync(PATH, 'utf8'),
)
const rows = dump.rows
const noise = Math.sqrt(2 * (0.25 / dump.games)) * 100

console.log(
  `${rows.length} 张对照卡,${dump.games} 局/张。\n` +
    `每个 Δ 的**测量噪声**是 ±${noise.toFixed(2)}pp —— 下面两个模型的残差标准差\n` +
    `要和它比:残差远大于噪声 = 模型漏掉了真实结构,不是数据不够。\n`,
)

const lin = fitBody(rows)
const bal = fitBodyBalanced(rows)

console.log('---- 模型一:线性(定价表现在用的就是这个)----')
console.log(
  `  Δ = ${lin.perAttack.toFixed(3)}·攻 + ${lin.perHealth.toFixed(3)}·血 + 费用档\n` +
    `  z(攻) = ${lin.zAttack.toFixed(1)}   z(血) = ${lin.zHealth.toFixed(1)}\n` +
    `  残差标准差 ±${lin.residSd.toFixed(2)}pp   (噪声 ±${noise.toFixed(2)})`,
)

console.log('\n---- 模型二:加一项 min(攻,血)(「均衡」)----')
console.log(
  `  Δ = ${bal.perAttack.toFixed(3)}·攻 + ${bal.perHealth.toFixed(3)}·血 + ` +
    `${bal.perBalance.toFixed(3)}·min(攻,血) + 费用档\n` +
    `  z(攻) = ${bal.zAttack.toFixed(1)}   z(血) = ${bal.zHealth.toFixed(1)}   ` +
    `**z(均衡) = ${bal.zBalance.toFixed(1)}**\n` +
    `  残差标准差 ±${bal.residSd.toFixed(2)}pp`,
)

const drop = lin.residSd > 0 ? (1 - bal.residSd / lin.residSd) * 100 : 0
console.log(
  `\n加上均衡项之后残差降了 ${drop.toFixed(0)}%。` +
    (Math.abs(bal.zBalance) > 2
      ? `\n**均衡项显著**(|z| = ${Math.abs(bal.zBalance).toFixed(1)})—— 也就是说身材的价值` +
        `**不是**攻与血的线性组合。\n而 pricing.ts 的 bodyValue 恰恰是线性的` +
        `(攻×1 + 血×0.8),它表达不了这件事,\n因此系统性**高估极端身材**的卡。`
      : `\n均衡项不显著,线性模型够用。`),
)

// 最能说明问题的那一组:同费同总点数、只有劈法不同
console.log('\n---- 同费用、同身材总量,只有劈法不同 ----')
const byKey = new Map<string, BodyRow[]>()
for (const r of rows) {
  const k = `${r.cost}|${r.attack + r.health}`
  byKey.set(k, [...(byKey.get(k) ?? []), r])
}
for (const [k, group] of [...byKey.entries()].sort()) {
  if (group.length < 2) continue
  const [cost, total] = k.split('|')
  const spread = Math.max(...group.map((g) => g.delta)) - Math.min(...group.map((g) => g.delta))
  console.log(
    `${cost} 费 总 ${total.padStart(2)}:  ` +
      group
        .sort((a, b) => b.attack - a.attack)
        .map((g) => `${g.attack}/${g.health} ${(g.delta >= 0 ? '+' : '') + g.delta.toFixed(1)}`)
        .join('   ') +
      `   ← 极差 ${spread.toFixed(1)}pp`,
  )
}
console.log(
  `\n(每个 Δ 的噪声 ±${noise.toFixed(2)}pp,所以极差大于约 ${(3 * noise).toFixed(0)}pp 的那几行是真的。)`,
)
