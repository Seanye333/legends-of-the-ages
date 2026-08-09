// 历史名战难度模拟:六套预组轮流去打每一场名战,输出玩家胜率。
// 运行:npm run sim-history(GAMES=每场局数,默认 60)
//
// 对局本体在 workers/history.worker.ts,这里不留副本 —— 那份 worker 与
// tune-history 共用,两处各留一份 play() 的话,改一处忘了改另一处的表现是
// 「调参搜出来的数落库之后闸门不认」,而两边都自洽,极难查。
//
// 与 sim-campaign 的关键差别:名战**带开局态势**(RunModifiers),必须把
// battleModifiers 传进 GameConfig —— 少传这一项,模拟出的难度就和实际玩的不是一回事。
// (这一条现在钉在 worker 里,和取池、目标一起。)
//
// 闸门也不同:名战是**可自由挑选的设定局**,不是线性阶梯,所以不校验「单调递减」,
// 只校验每一场都落在「打得过、但要认真打」的带里(贪心 AI 基准尺 35%–68%)。
// 同样的警告:这测的是贪心 AI 的游戏,真人更强,故这里的胜率是**下限**。
//
// ⚠️ **默认局数是 240,不是 60。改小之前先算一遍这道闸门配不配得上样本量。**
//
// 判据照抄 balanceGate 文件头那一套 —— 看**带的半宽与标准误的比值**,不看阈值本身:
//
//   · 带 35–68%,半宽 16.5pp
//   · GAMES=60  → 单场标准误 6.5pp → 比值 **2.5**
//   · GAMES=240 → 单场标准误 3.2pp → 比值 **5.2**
//
// balanceGate 那两道的比值是 4.5(总胜率)与 4.0(单个对位),它把 4.0 当下限。
// 60 局的 2.5 远在下限之下,而这里有 17 场各判一次,**至少有一场误红几乎是必然的**。
//
// 这不是推算,是 2026-08-09 实测到的:同一份卡池与牌表,60 局说
// 「番吾 77% 出带、台州 65% 在带内」,240 局说「番吾 68% 在带内、台州 78% 出带」——
// 两场都反了。60 局跑一遍 32 秒、240 局 123 秒,而一道会随机翻红的闸门比没有更糟。
//
// 想快速试探可以 `GAMES=60`,但**下结论必须用默认值**,调参更是。
//
// **护送(protect)目标只观察、不闸门**:贪心 AI 不懂「守住 VIP」,不会为保它而清场,
// 于是敌方总能把它秒了 → sim 恒为 0%,这是假阴性(真人会主动清威胁)。斩将(assassinate)
// 反而能测:目标带守护逼 AI 必须啃穿它,斩将自然发生。所以只把 protect 排除在闸门外。
import { HISTORY_BATTLES } from '../src/content/historyBattles'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { fileURLToPath } from 'node:url'
import type { HistoryTask } from './workers/history.worker'

const GAMES = Number(process.env.GAMES ?? 240)

// 「打得过、但要认真打」的带:低于 LOW 太劝退,高于 HIGH 太送。
const LOW = 35
const HIGH = 68

console.log(`sim-history: ${HISTORY_BATTLES.length} 场,${GAMES} 局/场(六套预组轮流上)\n`)
const t0 = performance.now()

// 切成「场 × 局段」而不是整整一场:名局之间耗时差得多(93% 那场早早结束,
// 43% 那场局局打满),按场切的话最后一轮只剩一两个线程在动。
// 同样的教训在 sim-campaign 上先踩过,它的 worker 头上写着经过。
const CHUNK = 20
const WORKER = fileURLToPath(new URL('./workers/history.worker.ts', import.meta.url))
const jobs: HistoryTask[] = []
for (let b = 0; b < HISTORY_BATTLES.length; b++) {
  for (let from = 0; from < GAMES; from += CHUNK) {
    jobs.push({ battle: b, from, to: Math.min(from + CHUNK, GAMES) })
  }
}
const parts = await parallelMap<HistoryTask, number>(
  WORKER,
  jobs,
  progress(`${jobs.length} 段`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)
const won = new Array<number>(HISTORY_BATTLES.length).fill(0)
jobs.forEach((job, k) => {
  won[job.battle] += parts[k]
})

const rates = won.map((w) => Math.round((w / GAMES) * 100))
for (let b = 0; b < HISTORY_BATTLES.length; b++) {
  const pct = rates[b]
  const observeOnly = HISTORY_BATTLES[b].objective?.kind === 'protect'
  const bar = '█'.repeat(Math.max(0, Math.round(pct / 4)))
  const flag = observeOnly ? ' (护送·仅观察)' : pct < LOW ? ' ← 太难' : pct > HIGH ? ' ← 太送' : ''
  console.log(
    `${String(b + 1).padStart(2)}. ${HISTORY_BATTLES[b].name.zh.padEnd(6)} ` +
      `hp=${String(HISTORY_BATTLES[b].hp).padStart(2)} tier=${HISTORY_BATTLES[b].deckTier.toFixed(2)}  ` +
      `玩家胜率 ${String(pct).padStart(3)}%  ${bar}${flag}`,
  )
}
const se = 100 * Math.sqrt(0.25 / GAMES)
console.log(
  `\n(${((performance.now() - t0) / 1000).toFixed(1)}s · 每场 ${GAMES} 局,` +
    `单场标准误最大 ±${se.toFixed(1)} 个百分点 —— 离 ${LOW}/${HIGH} 不到两个标准误的读数别拿来调参)`,
)

const problems: string[] = []
for (let b = 0; b < HISTORY_BATTLES.length; b++) {
  if (HISTORY_BATTLES[b].objective?.kind === 'protect') continue // 护送不闸门,见顶部注释
  if (rates[b] < LOW) problems.push(`${HISTORY_BATTLES[b].name.zh}:${rates[b]}% 太难(应 ≥${LOW}%)`)
  if (rates[b] > HIGH) problems.push(`${HISTORY_BATTLES[b].name.zh}:${rates[b]}% 太送(应 ≤${HIGH}%)`)
}
if (problems.length === 0) {
  console.log(`✓ 每场都落在 ${LOW}–${HIGH}% 的「打得过但要认真打」带里(护送场仅观察)`)
} else {
  console.log('⚠ 难度需要调整:')
  for (const p of problems) console.log(`  ${p}`)
  console.log('  (调参:ONLY=<场次 id> npm run tune-history)')
  process.exit(1)
}
