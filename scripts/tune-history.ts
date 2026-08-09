// 名局难度调参:对指定的几场网格搜 `deckTier` × `hp`,让玩家胜率落进 35–68% 的带里。
// 运行:`ONLY=hb-chibi,hb-gaixia npm run tune-history`(它只打印建议值,**不改代码**)
//
// 【为什么是网格搜,不是二分】
// `deckTier` 对强度**非单调**,这是量出来的,不是猜的 —— 冒险第三章调 于謙 那次,
// 同一个 Boss 的曲线是 `0:20% · 0.15:69% · 0.3:35% · 0.45:25% · 0.6:69% · 0.75:51% · 0.9:39%`。
// 二分在这种曲线上必然跑偏。原因也清楚:tier 不是一个「强度旋钮」,
// 它是**取池的分位**,挪一档换掉的是一批具体的牌,而那批牌之间未必有强弱序。
//
// 【为什么同时搜 hp】
// tier 只有七档,而且换的是整批牌,粒度粗;hp 单调、连续,适合做微调。
// 但 hp 是**弱旋钮**:玩家场面已经碾压时加血只会把对局拉长。
// 所以先用 tier 把大方向找对,再用 hp 收尾 —— 网格里两者一起搜,读表时按这个顺序看。
//
// 【搜的局数和确认的局数不是一回事】
// 搜索用 GAMES(默认 96,单格标准误 ±5.1pp)只求排序对;
// 选出来的那一档**必须用 `GAMES=240 npm run sim-history` 复核**再落库。
// 名局这道闸门在 60 局下会认错人:实测 60 局说「番吾 77% 出带、台州 65% 在带内」,
// 240 局是「番吾 68% 在带内、台州 78% 出带」—— 两场都反了。
import { HISTORY_BATTLES } from '../src/content/historyBattles'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { fileURLToPath } from 'node:url'
import type { HistoryTask } from './workers/history.worker'

const GAMES = Number(process.env.GAMES ?? 96)
const TARGET = Number(process.env.TARGET ?? 55)
const LOW = 35
const HIGH = 68

const TIERS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9]
const HP_STEPS = (process.env.HP_STEPS ?? '0,8,16').split(',').map(Number)

// 第二根轴默认是 hp;给了 `EARMOR=4,8,12` 就换成**敌方开局护甲**(绝对值,不是增量)。
//
// 【为什么是「换」而不是「加」】
// 三维网格会把局数乘成 7×3×3=63 格/场,而这一轴多数时候用不上。
// 更要紧的是它换的东西不同:tier 和 hp 是调参量,**开局态势是设计量** ——
// 它写在 `situation` 里、玩家在关卡说明中读得到,改它等于改这一关是什么样子。
// 所以让它必须被显式点名,而不是顺手跟着网格一起动。
const EARMOR = (process.env.EARMOR ?? '').split(',').map((s) => s.trim()).filter(Boolean).map(Number)
const AXIS2: 'hp' | 'earmor' = EARMOR.length ? 'earmor' : 'hp'
const AXIS2_VALS = AXIS2 === 'earmor' ? EARMOR : HP_STEPS

const ONLY = (process.env.ONLY ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const picked = HISTORY_BATTLES.map((b, i) => ({ b, i })).filter(
  ({ b }) => (ONLY.length ? ONLY.includes(b.id) : true) && b.objective?.kind !== 'protect',
)
if (!picked.length) {
  console.error(`没有匹配的场次。可用 id:${HISTORY_BATTLES.map((b) => b.id).join(', ')}`)
  process.exit(1)
}

const WORKER = fileURLToPath(new URL('./workers/history.worker.ts', import.meta.url))
const CHUNK = 24

// 一个候选 = (场次, tier, 第二根轴上的一格)。任务切到局段,理由同 sim-history。
interface Cand {
  battle: number
  tier: number
  /** 第二根轴的取值:hp 轴上是**增量**,earmor 轴上是**绝对值** */
  v2: number
  hp: number
  eArmor?: number
}
const cands: Cand[] = []
for (const { b, i } of picked) {
  for (const tier of TIERS) {
    for (const v2 of AXIS2_VALS) {
      cands.push(
        AXIS2 === 'earmor'
          ? { battle: i, tier, v2, hp: b.hp, eArmor: v2 }
          : { battle: i, tier, v2, hp: b.hp + v2 },
      )
    }
  }
}

const jobs: HistoryTask[] = []
const jobCand: number[] = []
cands.forEach((c, ci) => {
  for (let from = 0; from < GAMES; from += CHUNK) {
    jobs.push({
      battle: c.battle,
      from,
      to: Math.min(from + CHUNK, GAMES),
      ov: { hp: c.hp, tier: c.tier, eArmor: c.eArmor },
    })
    jobCand.push(ci)
  }
})

console.log(
  `tune-history: ${picked.length} 场 × ${TIERS.length} 档 tier × ${AXIS2_VALS.length} 档 ` +
    `${AXIS2 === 'earmor' ? '敌方开局护甲' : 'hp'} × ${GAMES} 局 = ${cands.length * GAMES} 局\n`,
)
const t0 = performance.now()
const parts = await parallelMap<HistoryTask, number>(
  WORKER,
  jobs,
  progress(`${jobs.length} 段`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)
const won = new Array<number>(cands.length).fill(0)
parts.forEach((w, k) => {
  won[jobCand[k]] += w
})
const pct = won.map((w) => (100 * w) / GAMES)
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)}s)\n`)

const pad = (s: string, w: number) => s.padEnd(w, '　').slice(0, w)
for (const { b, i } of picked) {
  console.log(`=== ${b.name.zh}(现:hp=${b.hp} tier=${b.deckTier.toFixed(2)}) ===`)
  const at = (t: number, v2: number) =>
    cands.findIndex((c) => c.battle === i && c.tier === t && c.v2 === v2)
  const rowLabel = (v2: number) =>
    AXIS2 === 'earmor' ? `甲=${String(v2).padStart(3)}` : `hp=${String(b.hp + v2).padStart(3)}`

  console.log('        ' + TIERS.map((t) => String(t.toFixed(2)).padStart(7)).join(''))
  for (const v2 of AXIS2_VALS) {
    const row = TIERS.map((t) => {
      const v = pct[at(t, v2)]
      const mark = v > HIGH ? '!' : v < LOW ? '?' : ' '
      return `${v.toFixed(0)}%${mark}`.padStart(7)
    })
    console.log(`${rowLabel(v2)}  ` + row.join(''))
  }
  // 空旋钮检测。第二根轴对某些场次是**可证明的**零效果 —— 譬如 `objective.kind === 'survive'`:
  // 玩家靠撑满 N 回合取胜,敌方主帅血量根本不进胜负判定。
  // 睢陽之戰(survive 14)的三行 hp 曾经逐格完全相同,那不是巧合。
  // 这里不按 objective 硬编码,而是**看数据有没有方差** —— 判据更一般,也不会过度宣称。
  const rowsSame =
    AXIS2_VALS.length > 1 &&
    AXIS2_VALS.every((v2) => TIERS.every((t) => pct[at(t, v2)] === pct[at(t, AXIS2_VALS[0])]))
  if (rowsSame) {
    console.log(
      `  ⓘ ${AXIS2 === 'earmor' ? '敌方开局护甲' : 'hp'} 这一轴逐格零方差 —— ` +
        `对这一场它不是弱旋钮,是**空旋钮**,别再在它上面撒网格。` +
        (b.objective ? `(目标类型 ${b.objective.kind};survive 类不看敌方主帅血量)` : ''),
    )
  }

  // 建议:带内且离 TARGET 最近的一格。带内一格都没有时退而求其次报最接近的,
  // 并**明说它出带** —— 「搜不到」本身就是结论(该换的可能是开局态势,不是这两个旋钮)。
  const mine = cands.map((c, ci) => ({ c, ci })).filter(({ c }) => c.battle === i)
  const inBand = mine.filter(({ ci }) => pct[ci] >= LOW && pct[ci] <= HIGH)
  const pool = inBand.length ? inBand : mine
  const best = pool.reduce((a, x) => (Math.abs(pct[x.ci] - TARGET) < Math.abs(pct[a.ci] - TARGET) ? x : a))
  console.log(
    `  → 建议 hp=${best.c.hp} tier=${best.c.tier.toFixed(2)}` +
      (best.c.eArmor === undefined ? '' : ` 敌方开局护甲=${best.c.eArmor}`) +
      `(${pct[best.ci].toFixed(0)}%)` +
      (inBand.length
        ? ''
        : AXIS2 === 'earmor'
          ? '  ⚠ 连开局态势都搜不出带内的一格 —— 这一关的难度不在这三个旋钮上'
          : '  ⚠ 整张网格没有一格落进带里 —— 试 `EARMOR=…` 换第二根轴(那是设计量,想清楚再动)') +
      `\n  ${pad('', 0)}标准误 ±${(100 * Math.sqrt(0.25 / GAMES)).toFixed(1)}pp,落库前用 GAMES=240 npm run sim-history 复核\n`,
  )
}
