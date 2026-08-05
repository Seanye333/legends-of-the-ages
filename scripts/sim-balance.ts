// 平衡模拟:六套预组 AI 互搏,输出胜率矩阵。
// 运行:npm run sim-balance(GAMES=每对局数,默认 40)
import { PRECON_DECKS } from '../src/content/decks'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { fileURLToPath } from 'node:url'
import type { BalanceTask } from './workers/balance.worker'
import {
  judgeBalance,
  OVERALL_MIN,
  OVERALL_MAX,
  MATCHUP_MIN,
  MATCHUP_MAX,
} from './balanceGate'
import { loadBaseline, reportDiff, saveBaseline } from './baseline'

// 默认 100 局/对(约 30 秒)。40 局的噪声有 ±8 个百分点 —— 同一套牌能读出
// 62% 和 55% 两种结果,拿它当闸门只会制造误报和假绿。要快速试探用 GAMES=40,
// 但**下结论必须用默认值或更高**。局数取 4 的倍数,座位×先手四种组合才跑得齐。
const GAMES_PER_PAIR = Number(process.env.GAMES ?? 100)

// first 必须显式传入,不能从 seed 推。
// 曾经写成 `first: (seed & 1)`,而 seed 的奇偶恰好与座位 swap 同步翻转
// (三个乘数都是奇数 → seed 奇偶 = (i+j+g+1)%2,swap = g%2),
// 结果每个对位里永远是同一套牌先手 —— 整张矩阵都带着先手偏置。
const n = PRECON_DECKS.length
const wins: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
const games: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

console.log(`sim-balance: ${n} decks, ${GAMES_PER_PAIR} games/pair`)
const t0 = performance.now()

// 对局本体在 workers/balance.worker.ts。切成「对位 × 局段」:
// 15 个对位单独当任务太少太不齐(同样的教训在 sim-campaign 上先踩过),
// 切到局段之后任务数够多、长度接近。
// 座位与先手的独立翻转逻辑原样搬过去了 —— 那是这个脚本自己踩过并修好的坑。
const CHUNK = 20
const WORKER = fileURLToPath(new URL('./workers/balance.worker.ts', import.meta.url))
const jobs: BalanceTask[] = []
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    for (let from = 0; from < GAMES_PER_PAIR; from += CHUNK) {
      jobs.push({ i, j, from, to: Math.min(from + CHUNK, GAMES_PER_PAIR) })
    }
  }
}
const parts = await parallelMap<BalanceTask, { winsI: number; winsJ: number; played: number }>(
  WORKER,
  jobs,
  progress(`${jobs.length} 段`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)
jobs.forEach((job, k) => {
  const p = parts[k]
  games[job.i][job.j] += p.played
  games[job.j][job.i] += p.played
  wins[job.i][job.j] += p.winsI
  wins[job.j][job.i] += p.winsJ
})
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)}s)`)

const names = PRECON_DECKS.map((d) => d.name.zh)
const pad = (s: string, w: number) => s.padEnd(w, '　').slice(0, w)
console.log('\n胜率矩阵(行 vs 列):')
console.log(pad('', 6) + names.map((x) => pad(x, 6)).join(''))
const overall: number[] = []
const ci: number[] = []
for (let i = 0; i < n; i++) {
  const row = [pad(names[i], 6)]
  let w = 0
  let g = 0
  for (let j = 0; j < n; j++) {
    if (i === j) {
      row.push(pad('—', 6))
      continue
    }
    const pct = games[i][j] ? (100 * wins[i][j]) / games[i][j] : 0
    row.push(pad(`${pct.toFixed(0)}%`, 6))
    w += wins[i][j]
    g += games[i][j]
  }
  overall[i] = g ? (100 * w) / g : 0
  // 总胜率的 95% 置信半宽。**必须印出来** —— 这个矩阵天天被拿来判断
  // 「刚才那一改是不是把某套牌顶上去了」。
  //
  // 模拟是确定性的(种子固定,同一份卡池重跑逐格一致),所以半宽说的不是
  // 「重跑会飘」,而是「这 500 局只是所有可能对局的一个样本」——
  // 半宽约 ±4.4:56.0% 和 51.6% 之间的差,可能只是抽到的对局不同。
  // 单格更糟:100 局的半宽约 ±9.8,42% 与 58% 几乎分不开。
  // 不印的话,读的人(包括我)会把抽样差异当成信号去追。
  ci[i] = g ? 196 * Math.sqrt(((overall[i] / 100) * (1 - overall[i] / 100)) / g) : 0
  console.log(row.join('') + `  总:${overall[i].toFixed(1)}% ±${ci[i].toFixed(1)}`)
}
console.log(
  `\n(每格 ${GAMES_PER_PAIR} 局,单格 95% 置信半宽约 ±${(196 * Math.sqrt(0.25 / GAMES_PER_PAIR)).toFixed(1)} 个百分点;` +
    `总胜率那一列是 ${GAMES_PER_PAIR * (n - 1)} 局)`,
)
// ---------- 验收闸门 ----------
// 两道:总胜率 40-60%,以及**单个对位** 30-70%。
// 只看总胜率是不够的 —— 六套卡组互相克制、各自总分都在 50% 附近,
// 照样能通过检查,但玩家体验是选卡组即定胜负的猜拳,不是对局博弈。
// ---------- 与上一次跑对比 ----------
// 闸门管「越没越线」,这一段管「动没动」—— 两件不同的事:
// 一个改动完全可以没越线,却把整条曲线挪了 5 个点,而那往往才是你想知道的。
// 只报超过 2 个标准误的变化(见 baseline.ts)。
const snap = {
  sim: 'sim-balance',
  games: GAMES_PER_PAIR * (n - 1),
  values: Object.fromEntries(names.map((nm, i) => [nm, overall[i]])),
  stampedAt: new Date().toISOString().slice(0, 10),
}
for (const line of reportDiff(loadBaseline()['sim-balance'], snap)) console.log(line)
saveBaseline(snap)

// 判定逻辑在 balanceGate.ts —— 抽出去是为了能不跑模拟就验证它。
// 那边有一组自检钉着两个方向,其中最要紧的一条是「六套环形克制、
// 各自总分都是 50%」必须被对位检查抓住(那正是这道闸门存在的理由)。
// 顺便:那个文件的文件头算清了「阈值配不配得上样本量」——**配得上,不要改成 z 检验**。
const verdict = judgeBalance({ names, wins, games })
const overallOutliers = verdict.problems.filter((p) => p.startsWith('总胜率超出'))
const matchupOutliers = verdict.problems.filter((p) => p.startsWith('对位极化'))

if (overallOutliers.length) {
  console.log(`\n⚠ 总胜率超出 ${OVERALL_MIN}-${OVERALL_MAX}%(需要调卡):`)
  for (const p of overallOutliers) console.log(`  ${p.replace('总胜率超出 40-60%:', '')}`)
}
if (matchupOutliers.length) {
  console.log(`\n⚠ 对位极化,超出 ${MATCHUP_MIN}-${MATCHUP_MAX}%(胜负在选卡组时就定了):`)
  for (const p of matchupOutliers) console.log(`  ${p.replace('对位极化,超出 30-70%:', '')}`)
}
if (verdict.problems.length > 0) {
  const worst = verdict.worst
  if (worst) {
    console.log(
      `\n最极端对位:${worst.a} vs ${worst.b} = ${worst.pct.toFixed(0)}%。` +
        `\n调校思路:给劣势方补该对位缺的答案(解场/守护/回复),而不是无脑加身材。`,
    )
  }
  process.exitCode = 1
} else {
  console.log(
    `\n✓ 总胜率全部落在 ${OVERALL_MIN}-${OVERALL_MAX}%,且无对位超出 ${MATCHUP_MIN}-${MATCHUP_MAX}%`,
  )
}
