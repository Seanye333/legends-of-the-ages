// AI 档位对打:量「上面那一档到底强多少」。
// 运行:npm run sim-ai-tiers(GAMES=每个对位局数,默认 24;A/B=档位名)
//
// 为什么必须量:加一档 AI 很容易变成「更慢但不更强」。整回合规划器比贪心贵一个
// 量级,如果换不来胜率,那就是纯粹的电量浪费 —— 这个脚本就是那道验收线。
//
// 与 sim-balance / sim-campaign 的关系:那两个量的是**内容**(卡组是否公平、
// 关卡曲线是否递减),用的都是 AI_NORMAL 当基准尺。这个量的是**AI 本身**,
// 双方卡组相同、轮流先后手,差异只来自决策。
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_LEVELS, type AiConfig } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 24)
const A = (process.env.A ?? 'marshal') as keyof typeof AI_LEVELS
const B = (process.env.B ?? 'general') as keyof typeof AI_LEVELS

function play(
  deckIdx: number,
  seed: number,
  first: PlayerIdx,
  cfgA: AiConfig,
  cfgB: AiConfig,
): Winner {
  // 双方同一套牌、同一个主公 —— 差异只来自决策
  const d = PRECON_DECKS[deckIdx]
  const hero = HEROES_BY_ID[d.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [d.heroId, d.heroId],
    deckIds: [[...d.cardIds], [...d.cardIds]],
    first,
    heroPowers: [hero?.power, hero?.power],
    heroHps: [hero?.hp ?? START_HP, hero?.hp ?? START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], actor === 0 ? cfgA : cfgB)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command: ${r.error}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

const cfgA = AI_LEVELS[A]
const cfgB = AI_LEVELS[B]
console.log(`sim-ai-tiers: ${A} vs ${B},${GAMES} 局/卡组,共 ${GAMES * PRECON_DECKS.length} 局\n`)
const t0 = performance.now()

let winsA = 0
let winsB = 0
let draws = 0
for (let d = 0; d < PRECON_DECKS.length; d++) {
  let localA = 0
  for (let g = 0; g < GAMES; g++) {
    // 轮流先手:先手优势不能算进档位差
    const w = play(d, 1000 + d * 977 + g, (g % 2) as PlayerIdx, cfgA, cfgB)
    if (w === 0) {
      winsA++
      localA++
    } else if (w === 1) winsB++
    else draws++
  }
  console.log(`  ${PRECON_DECKS[d].name.zh}: ${A} ${((100 * localA) / GAMES).toFixed(0)}%`)
}

const total = winsA + winsB + draws
const rate = (100 * winsA) / Math.max(1, winsA + winsB)
console.log(
  `\n${A} 总胜率 ${rate.toFixed(1)}%(${winsA}胜 ${winsB}负 ${draws}平,${total} 局,${(
    (performance.now() - t0) /
    1000
  ).toFixed(1)}s)`,
)

// 验收线:上一档必须显著强于下一档。50% 附近说明白加了一档。
if (rate <= 55) {
  console.log(`\n⚠️  ${A} 相对 ${B} 没有显著优势 —— 这一档的成本换不回强度。`)
} else {
  console.log(`\n✓ ${A} 显著强于 ${B}`)
}
