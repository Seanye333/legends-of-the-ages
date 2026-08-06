// 备选主公技的平衡校验。
//
// sim-balance 只测预组(用六位基准主公),测不到备选主公技。这个脚本补那个洞:
// 对每个主义,拿它的预组打一场**镜像**——一边基准主公、一边备选主公,同一副牌、
// 座位与先后手轮满。备选主公技如果和基准差不多强,镜像胜率应在 ~50%。
//
// 备选主公技全部借用另一条轴上已验证过的招(见 heroes.ts),所以这里是回归防线:
// 确认「换个主义用」没有意外地过强/过弱。闸门:每个备选主公 40–60%。
//
// ⚠️ **这道闸门量的不是主公技,是「主公技 × 预组」的组合。**(2026-08 实测)
// 郭嘉「遺計」和呂蒙「白衣渡江」的脚本**逐字相同**(造成 1 点伤害),
// 在各自预组里量出来是 40.0% 和 32.3%。为了排除「是不是对照组不同」,
// 把孫權的基准从 0/4 守护削成 1/1(和司馬懿同级)再测 —— 呂蒙 28.7%,
// 相对 32.3% 差不到 1.5 个标准误,**没有变化**。
// 也就是说那 8 个点的差来自**预组**,不来自主公技,也不来自对照组。
//
// 后果很实在:**靠改主公技把某一对拉进 40-60% 是做不到的** ——
// 你在补一个不在主公技里的偏移量。2026-08 试过一轮,把呂蒙换成主题上
// 正确的「+2/+0 与潜行」,32.3% → 22.0%,更差。详见 heroes.ts 那一段。
// 要真正修,得动预组构成或分别给每个主义定各自的基准线,而不是继续调技能。
//
// 这一条记在这里,是因为一个 32% 看上去太像「这技能弱」了。
import { AI_NORMAL, type AiConfig } from '../src/ai/greedy'

// 尺子可切换:RULER=legacy 退回 2026-08 之前的纯单帧估值。
// 【为什么留着这个开关】这个脚本量的是主公技强弱,而主公技里有一整类是**防守向**的
// (回血、护甲、潜行、冻结)。旧尺子对这一类的估值近乎为零(铁律 8),
// 也就是说它量到的是尺子的缺陷,不是设计的强弱。
// 两把尺子的数字都记在下面,一个 31% 到底是「这技能弱」还是「这尺子瞎」,
// 对比着看才判得出来 —— 这一轮正是靠对比才发现莊周根本没弱(38% → 50%)。
const RULER: AiConfig =
  process.env.RULER === 'legacy' ? { ...AI_NORMAL, weights: { persist: 0 } } : AI_NORMAL
import { PRECON_DECKS } from '../src/content/decks'
import { HEROES, ALT_HEROES } from '../src/content/overrides/heroes'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { loadBaseline, reportDiff, saveBaseline } from './baseline'
import { fileURLToPath } from 'node:url'
import type { MirrorTask } from './workers/mirror.worker'

// 【为什么从 100 提到 400】
// 100 局的标准误是 5pp,而判定区间是 40–60 —— 也就是说一个真正 50% 的主公技
// 有相当概率被判成出界,而 45% 和 55% 这两个数字**根本分不开**。
// 用这样的数字去调设计,调的是噪声:2026-08 就差点据此改了三个主公技,
// 而重跑一遍其中两个的排序就换了。
// 400 局把标准误压到 2.5pp,判定才配得上 ±10pp 的区间。代价是四倍时间。
const GAMES = Number(process.env.GAMES ?? 400)

console.log(`sim-hero-mirror: 每个备选主公 ${GAMES} 局镜像(同预组,基准 vs 备选)\n`)

// 对局本体在 workers/mirror.worker.ts,与 sim-firstplayer 共用 ——
// 两者的对局结构本来就是同一个,而**各自写一遍座位编排正是这个脚本
// 当年把先后手和座位绑死的土壤**(见 simSeating.ts)。现在只有一份。
// 种子与座位公式逐字保留:换掉的话 heroes.ts 里记的那组数字就对不上了。
const CHUNK = 20
const WORKER = fileURLToPath(new URL('./workers/mirror.worker.ts', import.meta.url))

interface Row {
  alt: (typeof ALT_HEROES)[number]
  baseName: string
  deckIdx: number
}
const rows: Row[] = []
for (const alt of ALT_HEROES) {
  const base = HEROES.find((h) => h.doctrine === alt.doctrine)!
  const deckIdx = PRECON_DECKS.findIndex((d) => d.heroId === base.id)
  if (deckIdx < 0) {
    console.log(`  ${alt.name.zh}: 找不到 ${base.name.zh} 的预组,跳过`)
    continue
  }
  rows.push({ alt, baseName: base.name.zh, deckIdx })
}

const jobs: MirrorTask[] = []
for (const r of rows) {
  for (let from = 0; from < GAMES; from += CHUNK) {
    jobs.push({
      deckIdx: r.deckIdx,
      baseId: PRECON_DECKS[r.deckIdx].heroId,
      altId: r.alt.id,
      from,
      to: Math.min(from + CHUNK, GAMES),
      ai: RULER,
      score: 'alt',
    })
  }
}
const parts = await parallelMap<MirrorTask, { wins: number; played: number }>(
  WORKER,
  jobs,
  progress(`${jobs.length} 段`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)

const agg = rows.map(() => ({ wins: 0, played: 0 }))
jobs.forEach((j, i) => {
  const k = rows.findIndex((r) => r.deckIdx === j.deckIdx && r.alt.id === j.altId)
  agg[k].wins += parts[i].wins
  agg[k].played += parts[i].played
})

let bad = 0
rows.forEach((r, k) => {
  const { wins, played } = agg[k]
  const rate = played > 0 ? (wins / played) * 100 : 50
  const se = played > 0 ? Math.sqrt(0.25 / played) * 100 : 0
  const ok = rate >= 40 && rate <= 60
  if (!ok) bad++
  console.log(
    `  ${r.alt.name.zh}(${r.alt.power.name.zh}) vs 基准 ${r.baseName}: 备选胜率 ${rate.toFixed(1)}% ±${se.toFixed(1)}  ${ok ? '✓' : '⚠ 超出 40–60'}`,
  )
})

// 与上一次跑对比:闸门管「越没越线」,这一段管「动没动」。
// 这道闸门尤其需要 —— 它的历史数字被一把歪尺子污染过一整轮(见 simSeating.ts),
// 而当时**没有任何东西**会告诉你「这一跑和上一跑不一样了」。
const snap = {
  sim: 'sim-hero-mirror',
  games: GAMES,
  values: Object.fromEntries(
    rows.map((r, k) => [
      r.alt.name.zh,
      agg[k].played > 0 ? (agg[k].wins / agg[k].played) * 100 : 50,
    ]),
  ),
  stampedAt: new Date().toISOString().slice(0, 10),
}
for (const line of reportDiff(loadBaseline()['sim-hero-mirror'], snap)) console.log(line)
saveBaseline(snap)

console.log('')
if (bad === 0) {
  console.log('✓ 所有备选主公技镜像胜率落在 40–60%')
} else {
  console.log(`⚠ ${bad} 个备选主公技超出 40–60%,需要调整`)
  process.exit(1)
}
