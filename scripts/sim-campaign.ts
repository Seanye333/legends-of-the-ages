// 关底战难度模拟:六套预组轮流去打八关,输出玩家胜率曲线。
// 运行:npm run sim-campaign(GAMES=每关局数,默认 60)
//
// 与 sim-balance 的区别:那个测的是「六套预组之间是否公平」,
// 这个测的是「难度曲线是否单调递减」——关底战不需要 50%,
// 但第 8 关不该比第 1 关还好打,而这种错误光看数值表是看不出来的。
//
// 同样的警告适用:这测的是贪心 AI 的游戏。真人玩家会比 AI 强,
// 所以这里的胜率是**下限**,实际体感会更容易一些。
import { BOSSES, bossChapter } from '../src/content/campaign'
import { judgeChapter } from './campaignGate'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { loadBaseline, reportDiff, saveBaseline } from './baseline'
import { fileURLToPath } from 'node:url'

// 【为什么默认是 240 而不是 60】
// 这三道闸门比的是「点估计 vs 写死的阈值」,而点估计自带抽样误差。
// 60 局/关时单关标准误 6.5pp,「章内前后半差 ≥8」这一条的差值标准误是 4.5pp ——
// 也就是说**哪怕真实前后半差是 0,z 也只有 1.8,这道闸门永远红不了**;
// 反过来它又会被两三个点的抖动判红(2026-08 就红过一次,原因全是噪声,
// 见 campaign.ts 顶部那段「2 个点的差被当成结论」)。
// 一道既会误报又抓不到真问题的闸门比没有更糟。
// 240 局把差值标准误压到 2.3pp,判定才配得上 ±8pp 的区间。代价是四倍时间。
// 同一类毛病的另外两道闸门早就修过:sim-ai-tiers 换成真 z 检验、
// sim-hero-mirror 把默认局数从 100 提到 400。
// (⚠️ 但 ci.yml 里还钉着 `GAMES: 100` 覆盖 sim-hero-mirror 的 400,
//  那次修复在 CI 上等于没生效 —— 见 ROADMAP「现在真正红的是 sim-hero-mirror」。
//  这里不顺手改:那道闸门当下是**真红**,先决定备选主公怎么办,再谈样本量。)
const GAMES = Number(process.env.GAMES ?? 240)

// 判定用的 z 阈值,与 sim-ai-tiers 同一条线:只有**统计上显著**地越界才算红。
const Z = 2

// 并行线程数。`JOBS=1` 可退回单线程 —— 怀疑并行接错时用它对拍。
const CONC = process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency()

// Boss 侧的 AI 档位。默认 AI_NORMAL —— 它是这套曲线一路调出来的基准尺,
// 换掉就没法和历史数字比了。
//
// `BOSS_AI=general` 可以量**名将档玩家实际面对的 Boss**:
// 名将比 AI_NORMAL 多一层前瞻(foresight),对打实测 64% 胜率。
// 这两个数字**不是一回事**,别混着看 —— campaign.ts 里记的曲线是前者。
// 对局本体在 workers/campaign.worker.ts。
// **这里刻意不留一份副本** —— 两处逐字相同的模拟代码是漂移的温床:
// 改了一处忘了另一处,表现是「并行和串行量的不是同一个游戏」,而两边各自都自洽,
// 极难查。要单线程对拍就用 `JOBS=1`,走的仍然是同一份代码。

console.log(
  `sim-campaign: ${BOSSES.length} 关,${GAMES} 局/关(六套预组轮流上)· ${CONC} 线程并行\n`,
)
const t0 = performance.now()

// 按**关**切分丢给 worker 池。每一局的种子只由 (关, 局号) 决定,局与局之间没有
// 共享状态(引擎是纯函数),所以「谁先算完」不影响任何一局 —— 只要按索引装回去
// 就与串行逐位一致。这一点在接入时实测验过:并行前后 24 关的胜率逐格相同。
// 切到「关 × 局段」而不是整关:关与关的耗时差很多(于謙那关局局打满,張角那关早早结束),
// 按关切的话最后一轮只有几个线程在动。局段更短更齐,尾部空转就短。
const CHUNK = 40
const WORKER = fileURLToPath(new URL('./workers/campaign.worker.ts', import.meta.url))
const jobs: Array<{ boss: number; from: number; to: number }> = []
for (let boss = 0; boss < BOSSES.length; boss++) {
  for (let from = 0; from < GAMES; from += CHUNK) {
    jobs.push({ boss, from, to: Math.min(from + CHUNK, GAMES) })
  }
}
const chunkWins = await parallelMap<{ boss: number; from: number; to: number }, number>(
  WORKER,
  jobs,
  progress(`${jobs.length} 段`),
  CONC,
)

// 按关汇总。加法可交换,但仍然按 jobs 的顺序累加 —— 保序是这一层的纪律,不留例外。
const winsPerBoss = new Array<number>(BOSSES.length).fill(0)
jobs.forEach((j, i) => {
  winsPerBoss[j.boss] += chunkWins[i]
})

const props: number[] = [] // 精确比例,闸门的统计量一律用它(别拿四舍五入的显示值做数学)
for (let b = 0; b < BOSSES.length; b++) {
  const wins = winsPerBoss[b]
  const pct = Math.round((wins / GAMES) * 100)
  props.push(wins / GAMES)
  // 95% 置信半宽。
  //
  // 【它说的不是「重跑会飘」】这个模拟是**确定性的** —— 种子固定,
  // 同一份卡池重跑逐格一致(实测验过两遍)。半宽说的是另一件事:
  // 这 60 局只是「所有可能对局」的一个样本。两个版本之间小于这个幅度的差值,
  // 完全可能只是**抽到的这 60 局不同**,而不是改动真的动了难度曲线。
  // 60 局/关的半宽最大 ±13 —— 「白起 35% → 33%」这种读数落在里面。
  const half = Math.round(196 * Math.sqrt(((wins / GAMES) * (1 - wins / GAMES)) / GAMES))
  const bar = '█'.repeat(Math.max(0, Math.round(pct / 4)))
  console.log(
    `${String(b + 1).padStart(2)}. 第${bossChapter(BOSSES[b])}章 ${BOSSES[b].name.zh.padEnd(4)} ` +
      `hp=${String(BOSSES[b].hp).padStart(2)}  玩家胜率 ${String(pct).padStart(3)}% ±${String(half).padStart(2)}  ${bar}`,
  )
}
console.log(
  `\n(${((performance.now() - t0) / 1000).toFixed(1)}s · 每关 ${GAMES} 局,` +
    `95% 置信半宽最大 ±${Math.round(196 * Math.sqrt(0.25 / GAMES))} 个百分点。` +
    `模拟本身是确定的,这个半宽说的是「这些局只是一个样本」—— ` +
    `两版之间小于它的差值别拿来调参。)`,
)

// 闸门按**章**分段:每章各是一条独立曲线(第二章开章时玩家已成军,
// 不该拿它去比张角那关的友好度)。逐章校验:
//   · 开章要够友好(第一章 ≥55 是新手门面;后续章玩家已有底子,放宽到 ≥35 ——
//     第二章是老兵的「困难本」,开章约 37% 仍明显比第一章末关的曹操(17%)松一倍,
//     读作一个能赢的新起点即可,不必再冲 55%。白起是霸道深池,已压到最软档 + 弱化技能,
//     再往上顶就得给作弊卡了,不值当;35% 是给噪声留的下限)
//   · 收官要够难(每章末关 ≤45)
//   · 章内整体递减(前半均 − 后半均 ≥ 8;用首末段差值而非逐关严格递减,躲开噪声)
// 用「章内前后半差值」而不是全局,避免跨章软重置被平均值糊掉、放过某一章的塌陷曲线。
// ---------- 与上一次跑对比 ----------
// 闸门管「越没越线」,这一段管「动没动」。对这道闸门尤其有用:
// 24 关里某一关挪了 10 个点、但还没越线,是**完全看不出来的** ——
// 而那往往正是「刚才那一改到底影响了什么」的答案。
// 只报超过 2 个标准误的变化(见 baseline.ts)。
const snap = {
  sim: 'sim-campaign',
  games: GAMES,
  values: Object.fromEntries(BOSSES.map((b, i) => [b.name.zh, props[i] * 100])),
  stampedAt: new Date().toISOString().slice(0, 10),
}
for (const line of reportDiff(loadBaseline()['sim-campaign'], snap)) console.log(line)
saveBaseline(snap)

// 判定逻辑在 campaignGate.ts —— 抽出去是为了能不跑模拟就验证它(见那个文件的文件头)。
const chapters = [...new Set(BOSSES.map(bossChapter))].sort((a, b) => a - b)
const problems: string[] = []
const notes: string[] = []
for (const ch of chapters) {
  const chP = BOSSES.map((b, i) => [b, i] as const)
    .filter(([b]) => bossChapter(b) === ch)
    .map(([, i]) => props[i])
  const v = judgeChapter(ch, chP, {
    games: GAMES,
    openFloor: ch === chapters[0] ? 55 : 35,
    z: Z,
  })
  problems.push(...v.problems)
  if (v.note) notes.push(v.note)
}

// 分辨力提示先打:一道「测不动」的闸门绿了也不算数,这一行是它唯一的说明。
for (const n of notes) console.log(`ℹ ${n}`)
if (notes.length > 0) console.log('')

if (problems.length === 0) {
  console.log(
    `✓ 各章难度曲线合理:开章友好、收官有压力、章内递减(判定阈 z>${Z},${GAMES} 局/关)`,
  )
} else {
  console.log(`⚠ 难度曲线需要调整(仅列出统计上显著越界的,z>${Z}):`)
  for (const p of problems) console.log(`  ${p}`)
  process.exit(1)
}
