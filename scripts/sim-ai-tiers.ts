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
import { aiStep, AI_LEVELS, AI_NORMAL, type AiConfig } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 24)
const A = process.env.A ?? 'marshal'
const B = process.env.B ?? 'general'

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

/**
 * 档位名,可选地跟一串权重覆盖:`normal` / `general` / `normal:balance=1`。
 *
 * 【为什么要有这个】
 * 「改评分权重之后 AI 有没有变强」是这个仓库最常问的一类问题(persist 那次就是
 * 这么定的:新尺子对旧尺子 54.6%,864 局,z = 2.7),但此前 A/B 只认档位名 ——
 * 想比「同一档、只差一个权重」就得改脚本。
 *
 * 而 `greedy.ts` 里**不能**放一个读环境变量的开关:它会打包进浏览器,
 * 那里没有 `process`(那次事故让标题页整个打不开,见 AI_NORMAL 上方的注释)。
 * 所以对照必须在**脚本侧**构造 —— 这个解析器就是那句话的落地。
 */
function parseCfg(spec: string): { label: string; cfg: AiConfig } {
  const [name, overrides] = spec.split(':')
  const base: AiConfig =
    name === 'normal' ? AI_NORMAL : AI_LEVELS[name as keyof typeof AI_LEVELS]
  if (!base) {
    console.error(`未知档位 ${name};可选:normal · ${Object.keys(AI_LEVELS).join(' · ')}`)
    process.exit(1)
  }
  if (!overrides) return { label: name, cfg: base }
  const weights: Record<string, number> = { ...(base.weights as Record<string, number>) }
  for (const pair of overrides.split(',')) {
    const [k, v] = pair.split('=')
    if (!k || v === undefined || Number.isNaN(Number(v))) {
      console.error(`权重覆盖写法应为 key=数字,收到「${pair}」`)
      process.exit(1)
    }
    weights[k] = Number(v)
  }
  return { label: spec, cfg: { ...base, weights: weights as AiConfig['weights'] } }
}

const parsedA = parseCfg(A)
const parsedB = parseCfg(B)
const cfgA = parsedA.cfg
const cfgB = parsedB.cfg
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

// 验收线:上一档必须**统计上**显著强于下一档。
//
// 【原来这里是 `if (rate <= 55)`,一个和样本量无关的写死阈值】
// 默认 GAMES=24(144 局)时标准误是 4.2pp —— 56% 会被判成「显著」,
// 而那个 z 只有 1.4,纯噪声。反过来跑 864 局时 54.6% 的 z 是 2.7,
// 是实打实的差距,却被判成「不显著」。同一轮实验里我两次拿到
// 55.3% 和 54.6%(864 局,统计上无法区分),被这条线判成了一正一反 ——
// 而我差点据此得出「冻结那个修复让 AI 变弱了」的错误结论。
// 换成真正的单比例 z 检验,并把 z 与标准误一起打出来,让人能自己判断。
const n = winsA + winsB
const se = Math.sqrt(0.25 / n) * 100
const z = (rate - 50) / se
console.log(`\n  标准误 ${se.toFixed(1)}pp,z = ${z.toFixed(2)}(相对 50%)`)
if (z < 2) {
  console.log(
    `⚠️  ${A} 相对 ${B} 没有显著优势(z < 2)—— 这一档的成本换不回强度。` +
      (n < 500 ? `\n   注:只跑了 ${n} 局,加大 GAMES 才分得清「真的没差」和「样本不够」。` : ''),
  )
} else {
  console.log(`✓ ${A} 显著强于 ${B}(z = ${z.toFixed(2)})`)
}
