// 单卡强度模拟 —— 量「这张牌进卡组之后,胜率动了多少」。
//
// 【为什么需要它】
// sim-balance 测的是**六套预组之间是否公平**,sim-campaign 测的是**关卡曲线**。
// 两个都不回答一个很基本的问题:**某一张具体的牌是强是弱**。
// 卡池有 2,261 张,其中 80% 带效果、定价靠一套点数公式 ——
// 那套公式从来没有被实测校准过,只被「六套预组打起来还算公平」间接背书。
//
// 【方法:替换法】
// 拿一套基准预组,把其中 N 张最普通的牌换成待测卡,与其余预组对打,
// 和**未替换的同一套牌**比胜率。差值就是这张牌的边际价值。
//   · 双方都用 AI_NORMAL(与另外两个 sim 同一把尺);
//   · 轮流先后手;
//   · 被换掉的是**费用最接近**的那张 —— 否则量到的是曲线变化,不是这张牌。
//
// 【怎么读结果】
// 一张牌的合理区间大约是 **±4 个百分点**:低于 −4 说明它比同费的普通牌还差
// (定价虚高),高于 +4 说明它单卡超模。注意噪声:60 局的标准差约 ±6 个点,
// 所以**单张卡的单次测量不能下结论** —— 要么加样本量,要么看一批卡的分布。
//
// 运行:
//   npm run sim-cards                       # 抽样 12 张
//   CARDS=guan-yu,zhang-fei npm run sim-cards
//   COST=5 SAMPLE=20 GAMES=80 npm run sim-cards
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { CardDef, GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 60)
const SAMPLE = Number(process.env.SAMPLE ?? 12)
const COPIES = Number(process.env.COPIES ?? 2)
const COST_FILTER = process.env.COST ? Number(process.env.COST) : null
const ONLY = (process.env.CARDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

// 基准:桃園仁德(曲线最标准的一套)。待测卡的主义必须与它兼容,
// 否则换进去是非法卡组 —— 所以只测王道与中立。
const BASE = PRECON_DECKS[0]
const BASE_HERO = HEROES_BY_ID[BASE.heroId]

function play(deck: string[], oppIdx: number, seed: number, first: PlayerIdx): Winner {
  const opp = PRECON_DECKS[oppIdx]
  const oppHero = HEROES_BY_ID[opp.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [BASE.heroId, opp.heroId],
    deckIds: [[...deck], [...opp.cardIds]],
    first,
    heroPowers: [BASE_HERO?.power, oppHero?.power],
    heroHps: [BASE_HERO?.hp ?? START_HP, oppHero?.hp ?? START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command: ${r.error}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

function winRate(deck: string[]): number {
  let wins = 0
  let played = 0
  for (let g = 0; g < GAMES; g++) {
    // 轮流打其余五套预组,轮流先后手
    const oppIdx = 1 + (g % (PRECON_DECKS.length - 1))
    const w = play(deck, oppIdx, 7919 * (g + 1), (g % 2) as PlayerIdx)
    if (w !== 'draw') played++
    if (w === 0) wins++
  }
  return (100 * wins) / Math.max(1, played)
}

// 把 COPIES 张**费用最接近**的普通牌换成待测卡。
// 换费用最接近的那张很重要 —— 否则量到的是曲线变化,不是这张牌本身。
function swapIn(card: CardDef): string[] | null {
  const deck = [...BASE.cardIds]
  const counts = new Map<string, number>()
  for (const id of deck) counts.set(id, (counts.get(id) ?? 0) + 1)
  // 候选被换者:与待测卡同费差最小、且不是待测卡本身
  const victims = [...counts.keys()]
    .filter((id) => id !== card.id)
    .sort(
      (a, b) =>
        Math.abs((CARDS_BY_ID[a]?.cost ?? 99) - card.cost) -
          Math.abs((CARDS_BY_ID[b]?.cost ?? 99) - card.cost) || a.localeCompare(b),
    )
  let need = COPIES
  for (const victim of victims) {
    while (need > 0) {
      const i = deck.indexOf(victim)
      if (i < 0) break
      deck[i] = card.id
      need--
    }
    if (need === 0) break
  }
  return need === 0 ? deck : null
}

const pool = COLLECTIBLE_CARDS.filter(
  (c) => !c.token && (c.doctrine === 'neutral' || c.doctrine === BASE_HERO?.doctrine),
)

let targets: CardDef[]
if (ONLY.length > 0) {
  targets = ONLY.map((id) => CARDS_BY_ID[id]).filter(Boolean)
} else {
  const filtered = COST_FILTER === null ? pool : pool.filter((c) => c.cost === COST_FILTER)
  // 确定性抽样:按 collectorNo 等距取,而不是 Math.random —— 两次跑要能对比
  const stride = Math.max(1, Math.floor(filtered.length / SAMPLE))
  targets = filtered.filter((_, i) => i % stride === 0).slice(0, SAMPLE)
}

console.log(
  `sim-cards: 基准「${BASE.name.zh}」,每张换入 ${COPIES} 份,${GAMES} 局/张,共 ${targets.length} 张\n`,
)
const t0 = performance.now()
const baseline = winRate([...BASE.cardIds])
console.log(`基准胜率 ${baseline.toFixed(1)}%\n`)

const rows: { card: CardDef; rate: number; delta: number }[] = []
for (const card of targets) {
  const deck = swapIn(card)
  if (!deck) {
    console.log(`  ${card.name.zh} —— 换不进去(基准里没有足够的可换牌)`)
    continue
  }
  const rate = winRate(deck)
  rows.push({ card, rate, delta: rate - baseline })
}

rows.sort((a, b) => b.delta - a.delta)
console.log('卡名            费用  胜率    Δ')
for (const r of rows) {
  const sign = r.delta >= 0 ? '+' : ''
  console.log(
    `${r.card.name.zh.padEnd(12, '　')} ${String(r.card.cost).padStart(3)}  ` +
      `${r.rate.toFixed(1)}%  ${sign}${r.delta.toFixed(1)}`,
  )
}

console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)
console.log(
  `噪声提醒:${GAMES} 局的标准差约 ±${(50 / Math.sqrt(GAMES)).toFixed(1)} 个点 —— ` +
    '单张卡的单次测量不能下结论,要么加样本量,要么看一批卡的分布。',
)
const outliers = rows.filter((r) => Math.abs(r.delta) > 4)
if (outliers.length > 0) {
  console.log(`\n偏离超过 ±4 个点的 ${outliers.length} 张(**加样本量复测再动手**):`)
  for (const r of outliers) {
    console.log(`  ${r.card.name.zh} (${r.card.id}) ${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}`)
  }
}
