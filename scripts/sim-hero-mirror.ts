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
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL, type AiConfig } from '../src/ai/greedy'
import { seatingFor } from './simSeating'

// 尺子可切换:RULER=legacy 退回 2026-08 之前的纯单帧估值。
// 【为什么留着这个开关】这个脚本量的是主公技强弱,而主公技里有一整类是**防守向**的
// (回血、护甲、潜行、冻结)。旧尺子对这一类的估值近乎为零(铁律 8),
// 也就是说它量到的是尺子的缺陷,不是设计的强弱。
// 两把尺子的数字都记在下面,一个 31% 到底是「这技能弱」还是「这尺子瞎」,
// 对比着看才判得出来 —— 这一轮正是靠对比才发现莊周根本没弱(38% → 50%)。
const RULER: AiConfig =
  process.env.RULER === 'legacy' ? { ...AI_NORMAL, weights: { persist: 0 } } : AI_NORMAL
import { CARDS_BY_ID } from '../src/content/cards'
import { PRECON_DECKS } from '../src/content/decks'
import { HEROES, ALT_HEROES, HEROES_BY_ID } from '../src/content/overrides/heroes'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'
import { START_HP } from '../src/engine/types'

// 【为什么从 100 提到 400】
// 100 局的标准误是 5pp,而判定区间是 40–60 —— 也就是说一个真正 50% 的主公技
// 有相当概率被判成出界,而 45% 和 55% 这两个数字**根本分不开**。
// 用这样的数字去调设计,调的是噪声:2026-08 就差点据此改了三个主公技,
// 而重跑一遍其中两个的排序就换了。
// 400 局把标准误压到 2.5pp,判定才配得上 ±10pp 的区间。代价是四倍时间。
const GAMES = Number(process.env.GAMES ?? 400)

// 一场:altSeat 用备选主公,另一边用基准主公,同一副 deck。
//
// **first 必须显式传入,不能从 seed 推** —— 这里踩过一次(详见 simSeating.ts):
// 原来写的是 `first: (seed & 1)`,而 seed = i*131+7 的奇偶与 altSeat 同步翻转,
// 于是 first 恒等于 1-altSeat,**备选主公 400 局全程后手**。
// 这游戏的先手优势有 20 多个百分点(自我对镜实测后手只有 24–29%),
// 所以这道闸门当年的中性点是约 26% 而不是 50%,底下那些数字全部作废。
function play(
  deck: string[],
  baseId: string,
  altId: string,
  altSeat: PlayerIdx,
  seed: number,
  first: PlayerIdx,
): Winner {
  const heroFor = (seat: PlayerIdx) => (seat === altSeat ? altId : baseId)
  const cfg: GameConfig = {
    seed,
    heroIds: [heroFor(0), heroFor(1)],
    deckIds: [deck, deck],
    first,
    heroPowers: [HEROES_BY_ID[heroFor(0)].power, HEROES_BY_ID[heroFor(1)].power],
    heroHps: [START_HP, START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0x51, seed ^ 0x8f]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 6000) return 'draw'
    const actor: PlayerIdx = state.pendingChoice
      ? state.pendingChoice.player
      : state.phase === 'mulligan'
        ? state.players[0].mulliganDone
          ? 1
          : 0
        : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], RULER)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal (${r.error})`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

console.log(`sim-hero-mirror: 每个备选主公 ${GAMES} 局镜像(同预组,基准 vs 备选)\n`)
let bad = 0
for (const alt of ALT_HEROES) {
  const base = HEROES.find((h) => h.doctrine === alt.doctrine)!
  const deck = PRECON_DECKS.find((d) => d.heroId === base.id)?.cardIds
  if (!deck) {
    console.log(`  ${alt.name.zh}: 找不到 ${base.name.zh} 的预组,跳过`)
    continue
  }
  let altWins = 0
  let played = 0
  for (let i = 0; i < GAMES; i++) {
    // 座位与先后手**各自独立**轮换,四种组合等量(GAMES 取 4 的倍数才跑得齐)
    const { altSeat, first } = seatingFor(i)
    const w = play(deck, base.id, alt.id, altSeat as PlayerIdx, i * 131 + 7, first as PlayerIdx)
    if (w === 'draw') continue
    played++
    if (w === altSeat) altWins++
  }
  const rate = played > 0 ? (altWins / played) * 100 : 50
  const se = played > 0 ? Math.sqrt(0.25 / played) * 100 : 0
  const ok = rate >= 40 && rate <= 60
  if (!ok) bad++
  console.log(
    `  ${alt.name.zh}(${alt.power.name.zh}) vs 基准 ${base.name.zh}: 备选胜率 ${rate.toFixed(1)}% ±${se.toFixed(1)}  ${ok ? '✓' : '⚠ 超出 40–60'}`,
  )
}

console.log('')
if (bad === 0) {
  console.log('✓ 所有备选主公技镜像胜率落在 40–60%')
} else {
  console.log(`⚠ ${bad} 个备选主公技超出 40–60%,需要调整`)
  process.exit(1)
}
