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

// ---------- 怎么读这份清单 ----------
//
// 【原来这里是 `Math.abs(delta) > 4`,一个和样本量、和比较次数都无关的阈值】
// 2026-08-04 用 SAMPLE=400 扫了一遍,它报「偏离超过 ±4 的 235 张」。
// 算一下就知道那是什么:60 局时**差值**的标准误约 9 个点(两次测量各 ±6.5,相加开方),
// 纯噪声下 |Δ|>4 的概率就有五成多 —— 400 张里报 235 张,和随机数几乎无法区分。
// 一份「六成的卡都上榜」的异常清单,读的人只会从头到尾挑自己本来就想改的那几张。
//
// 还有第二层,比噪声更容易被忽略:**这是 400 次比较**。
// 哪怕每张卡都严格按 z>2 判定,400 次里也会有约 18 张纯属偶然上榜。
// 所以这里按族错误率(Bonferroni)给一条更高的线:z > ~3.5 时,
// 400 次比较里出现一个假阳性的概率才降到 5% 左右。
//
// 结论是这个脚本**只配当筛子,不配当判决**:它的用途是从两千多张里
// 挑出几张值得用大样本复测的,而不是产出一份「该改这些卡」的清单。
// 所以下面分两档报,并且把该跑的复测命令直接打出来。
const seDelta = Math.sqrt(2 * (0.25 / GAMES)) * 100 // 两次独立测量之差的标准误
const zOf = (d: number) => Math.abs(d) / seDelta
const bonferroniZ = rows.length > 1 ? Math.sqrt(2) * erfInv(1 - 0.05 / rows.length) : 2

console.log(
  `\n噪声:每次测量 ±${(50 / Math.sqrt(GAMES)).toFixed(1)} 个点,` +
    `而榜上的 Δ 是**两次测量之差**,标准误 ±${seDelta.toFixed(1)}。\n` +
    `本次比较了 ${rows.length} 张 —— 按族错误率校正后,` +
    `要 |Δ| > ${(bonferroniZ * seDelta).toFixed(1)} 才算真的越界(z > ${bonferroniZ.toFixed(1)})。`,
)

const strong = rows.filter((r) => zOf(r.delta) > bonferroniZ)
const weak = rows.filter((r) => zOf(r.delta) <= bonferroniZ && Math.abs(r.delta) > 4)

if (strong.length > 0) {
  console.log(`\n✗ 越过校正线的 ${strong.length} 张(**这几张单独拎出来也站得住**):`)
  for (const r of strong) {
    console.log(
      `  ${r.card.name.zh} (${r.card.id}) ${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}` +
        `  z=${zOf(r.delta).toFixed(1)}`,
    )
  }
}
if (weak.length > 0) {
  console.log(
    `\n另有 ${weak.length} 张 |Δ|>4 但没越过校正线 —— ` +
      `纯随机下就会有约 ${Math.round(rows.length * 0.54)} 张落在这里,**别照着这一档改卡**。`,
  )
}

// 【但「没越过校正线」不等于「里面没东西」】
//
// 校正线回答的是「这一张单独拎出来能不能宣布异常」,而**排序本身仍然有信号**。
// 2026-08-04 实测:400 张 / 60 局那一跑一张都没越过线(线在 |Δ|>35),
// 可把榜首六张拿去 600 局复测,正的三张全是真的:
//   姜維 +28.3 → +29.2 · 簡雍 +16.7 → +17.0 · 蘇飛 +20.0 → +14.0
// 负的三张则整齐地塌回去(-16.7 → -5.7 / -16.7 → -5.8 / -18.3 → -7.7)——
// 典型的均值回归:它们是**因为极端才被选中**的,噪声把它们吹大了。
//
// 所以这个脚本的正确用法是**两段式**:小样本扫全池排个序,再把榜首拿去大样本复测。
// 无论有没有越线,都把复测命令打出来 —— 让「宣布不了」不至于被读成「没东西」。
const CANDIDATES = 6
const top = [...rows]
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  .slice(0, CANDIDATES)
if (top.length > 0) {
  console.log(
    `\n下一步:榜单**排序有信号,单张判决没有**。把榜首 ${top.length} 张拿去大样本复测 ——\n` +
      `  CARDS=${top.map((r) => r.card.id).join(',')} GAMES=600 npm run sim-cards\n` +
      `复测后仍然大的才当真;塌回去的那些是均值回归,本来就不存在。`,
  )
}

// 逆误差函数:只为算 Bonferroni 的 z 阈值。Acklam 有理逼近,精度远超这里的需要。
function erfInv(x: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const p = (x + 1) / 2
  const pLow = 0.02425
  let q: number
  let r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) / Math.SQRT2
  }
  if (p <= 1 - pLow) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1) / Math.SQRT2
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) / Math.SQRT2
}
