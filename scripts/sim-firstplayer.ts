// 先手优势 —— 量「谁先动手」值多少胜率,以及现有的后手补偿够不够。
// 运行:npm run sim-firstplayer(GAMES=每套预组局数,默认 400)
//
// 【为什么需要这道闸门】
// 2026-08-04 修 sim-hero-mirror 时顺手量到一件事:**后手只有 24–29% 胜率**。
// 那次是自我对镜(同一个主公两边、同一副牌、同一个 AI,唯一的不对称只剩谁先手),
// 所以那个数字不含任何卡组或主公技的成分 —— 它就是先手优势本身。
//
// 起手牌其实已经补过了(先手 3 张、后手 4 张,见 engine/init 的 OPENING_HAND),
// 但那一张显然补不回二十多个百分点。
//
// 【它同时是所有对镜类模拟的仪器自检】
// 「两边放同一个东西,结果必须是 50%」是一条免费且极强的自检。
// sim-hero-mirror 从来没做过这一步,于是带着 26% 的中性点跑了很久,
// 把四个备选主公误判成「过弱」,还劝退过两轮设计尝试。
// 这个脚本把那一步固定下来:**任何对称配置偏离 50% 都是仪器问题或真实偏置**。
//
// 【与 sim-balance 的关系】
// sim-balance 里座位与先后手是各自独立轮换的(它自己踩过并修好了这个坑),
// 所以那张矩阵**看不见**先手优势 —— 它被平均掉了。
// 也就是说这条偏置可以一直存在而不触发任何现有闸门,直到有人像这样单独去量。
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL, AI_LEVELS, type AiConfig } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import { judgeFirstPlayer } from './firstPlayerGate'
import type { GameConfig, PlayerIdx, RunModifiers, Winner } from '../src/engine/types'

// 4 的倍数:座位 × 先手四种组合才跑得齐(见 simSeating.ts)
const GAMES = Number(process.env.GAMES ?? 400)

// 【AI=<档位> 换一把尺子来量】默认 AI_NORMAL(与其它闸门同一把基准尺)。
//
// **这一条是必须做的验证,不是可选项。** 先手优势 73.8% 是拿 AI_NORMAL 量的,
// 而贪心 AI 天生高估节奏:它一步一评,看不见「这回合亏一点、下回合赚回来」,
// 于是「先动手」的价值被系统性放大。更要命的是 `smartMulligan` 只在名将档以上才开 ——
// **AI_NORMAL 根本不会调度**,而调度正是后手用那多出来的一张牌翻盘的主要手段。
//
// 也就是说 73.8% 里有多少是游戏、有多少是尺子,不换档位量一遍是分不出来的。
// 如果名将/军神档下它明显收窄,那这就**不是一个该靠改规则去修的问题**,
// 围绕它做补偿反而会把真人玩家的对局搞坏。
//   AI=normal(默认) · recruit · veteran · general · marshal · tiers(全扫)
const AI = process.env.AI ?? 'normal'
const aiFor = (name: string): AiConfig | undefined =>
  name === 'normal' ? AI_NORMAL : (AI_LEVELS as Record<string, AiConfig>)[name]

// 【补偿方案试算】COMP=<方案> 给**后手方**加一份补偿再量一遍;COMP=sweep 全扫。
//
// 不需要动引擎一行:`RunModifiers` 早就有这几个旋钮了(远征宝物在用),
// 而它是 GameConfig 的一部分、按座位给。这正是这个仓库反复用的那条路子 ——
// 主公技、血量、战场环境都走 GameConfig,难度和变体都不必改引擎(见 campaign.ts)。
//
// 注意这里量的是**够不够**,不是**该用哪个**。「后手多两张牌」和「先攻币」
// 就算把胜率拉到同一个数,对卡组构筑的影响也完全不同(多抽牌利好控场,
// 临时法力利好抢节奏)。数字只能排除掉明显不够或明显过头的档,
// 最终选哪种是设计决定。
const COMPENSATIONS: Record<string, RunModifiers> = {
  none: {},
  'hand+1': { bonusHandSize: 1 }, // 起手 3 / 5
  'hand+2': { bonusHandSize: 2 }, // 起手 3 / 6
  'hand+3': { bonusHandSize: 3 }, // 起手 3 / 7
  'cost-1': { handCostDelta: -1 }, // 起手全部手牌便宜 1(近似「先攻币」但更持久)
  'armor+3': { startArmor: 3 },
  'armor+6': { startArmor: 6 },
  'hand+1,armor+3': { bonusHandSize: 1, startArmor: 3 },
}
const COMP = process.env.COMP ?? 'none'

// 同一套预组自己打自己 —— 双方卡组、主公、AI 全同,唯一的不对称是先后手
// (以及 comp:给后手方的补偿)。返回「先手方是否获胜」。
function playMirror(
  deckIdx: number,
  seed: number,
  first: PlayerIdx,
  comp: RunModifiers,
  ai: AiConfig = AI_NORMAL,
): Winner {
  const d = PRECON_DECKS[deckIdx]
  const hero = HEROES_BY_ID[d.heroId]
  const second = (1 - first) as PlayerIdx
  const mods: [RunModifiers | undefined, RunModifiers | undefined] = [undefined, undefined]
  if (Object.keys(comp).length > 0) mods[second] = comp
  const cfg: GameConfig = {
    seed,
    heroIds: [d.heroId, d.heroId],
    deckIds: [[...d.cardIds], [...d.cardIds]],
    first,
    heroPowers: [hero?.power, hero?.power],
    heroHps: [hero?.hp ?? START_HP, hero?.hp ?? START_HP],
    modifiers: mods,
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
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], ai)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal (${r.error})`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

// 跑一整轮(六套预组),返回每套的先手胜率百分数
function runAll(comp: RunModifiers, verbose: boolean, ai: AiConfig = AI_NORMAL): number[] {
  const out: number[] = []
  for (let d = 0; d < PRECON_DECKS.length; d++) {
    let firstWins = 0
    let played = 0
    for (let g = 0; g < GAMES; g++) {
      // 先手方轮流坐两个座位 —— 座位本身不该有影响,轮换它可以把座位效应也平均掉
      const first = (g & 1) as PlayerIdx
      const w = playMirror(d, d * 7919 + g * 31 + 1, first, comp, ai)
      if (w === 'draw') continue
      played++
      if (w === first) firstWins++
    }
    const rate = (firstWins / Math.max(1, played)) * 100
    out.push(rate)
    if (verbose) {
      const se = Math.sqrt(0.25 / Math.max(1, played)) * 100
      const bar = '█'.repeat(Math.max(0, Math.round(rate / 4)))
      console.log(
        `  ${PRECON_DECKS[d].name.zh.padEnd(6, '　')} 先手胜率 ${rate.toFixed(1)}% ±${se.toFixed(1)}  ${bar}`,
      )
    }
  }
  return out
}

// ---- AI 档位全扫:73.8% 里有多少是游戏、有多少是尺子 ----
if (AI === 'tiers') {
  const TIERS = ['recruit', 'veteran', 'normal', 'general', 'marshal']
  console.log(
    `sim-firstplayer(换尺子): ${TIERS.length} 个 AI 档位 × ${PRECON_DECKS.length} 套预组 × ${GAMES} 局\n`,
  )
  console.log(
    '每一格都是同一套牌打自己,双方同档。理论值 50% —— 偏离多少就是那把尺子看到的先手优势。\n' +
      '**如果档位越高偏离越小,说明 73.8% 有相当一部分是贪心 AI 高估节奏造成的,\n' +
      '  而不是游戏规则的问题** —— 那样的话围绕它改规则反而会把真人对局搞坏。\n',
  )
  const t = performance.now()
  const seT = Math.sqrt(0.25 / (GAMES * PRECON_DECKS.length)) * 100
  console.log('档位        先手胜率   相对 50% 的偏离')
  for (const name of TIERS) {
    const cfg = aiFor(name)
    if (!cfg) {
      console.log(`${name.padEnd(11)} (未知档位,跳过)`)
      continue
    }
    const rs = runAll({}, false, cfg)
    const avg = rs.reduce((a, b) => a + b, 0) / rs.length
    console.log(
      `${name.padEnd(11)} ${avg.toFixed(1)}% ±${seT.toFixed(1)}   ${avg >= 50 ? '+' : ''}${(avg - 50).toFixed(1)}`,
    )
  }
  console.log(`\n(${((performance.now() - t) / 1000).toFixed(1)}s)`)
  console.log(
    `\n注:新兵/宿将带失误率(0.35 / 0.12),它们的数字掺着「谁先犯错」;\n` +
      `名将起才零失误,而且**只有名将以上才开 smartMulligan** ——\n` +
      `调度正是后手用多出来的那一张牌翻盘的主要手段,不会调度的尺子天然更吃先手。`,
  )
  process.exit(0)
}

// ---- 补偿方案全扫 ----
if (COMP === 'sweep') {
  console.log(
    `sim-firstplayer(补偿试算): ${Object.keys(COMPENSATIONS).length} 个方案 × ` +
      `${PRECON_DECKS.length} 套预组 × ${GAMES} 局\n`,
  )
  console.log('每一格都是同一套牌打自己,补偿给**后手方**。目标:把先手胜率压回 50–55%。\n')
  const t = performance.now()
  const seSweep = Math.sqrt(0.25 / (GAMES * PRECON_DECKS.length)) * 100
  console.log(`方案              先手胜率   评价`)
  for (const [name, comp] of Object.entries(COMPENSATIONS)) {
    const rs = runAll(comp, false)
    const avg = rs.reduce((a, b) => a + b, 0) / rs.length
    const verdict =
      avg > 55 ? '仍然不够' : avg < 45 ? '补过头了(后手反而占优)' : '✓ 落在 45–55'
    console.log(`${name.padEnd(16)} ${avg.toFixed(1)}% ±${seSweep.toFixed(1)}   ${verdict}`)
  }
  console.log(`\n(${((performance.now() - t) / 1000).toFixed(1)}s)`)
  console.log(
    `\n数字只能排除掉明显不够或明显过头的档。**最终选哪种是设计决定** ——\n` +
      `「后手多两张牌」和「先攻币」就算把胜率拉到同一个数,对卡组构筑的影响也完全不同\n` +
      `(多抽牌利好控场,临时法力利好抢节奏),而且补偿方案会改变所有卡的相对价值,\n` +
      `落地时 sim-balance 的矩阵要整个重跑(见 campaign.ts 里兵种相克那一段的通则)。`,
  )
  process.exit(0)
}

const comp = COMPENSATIONS[COMP]
if (!comp) {
  console.log(`未知的 COMP=${COMP};可选:${Object.keys(COMPENSATIONS).join(' · ')} · sweep`)
  process.exit(1)
}
const aiCfg = aiFor(AI)
if (!aiCfg) {
  console.log(`未知的 AI=${AI};可选:normal · ${Object.keys(AI_LEVELS).join(' · ')} · tiers`)
  process.exit(1)
}
console.log(`sim-firstplayer: ${PRECON_DECKS.length} 套预组自我对镜,每套 ${GAMES} 局`)
if (AI !== 'normal') console.log(`尺子:AI=${AI}(默认是 normal,即其它闸门用的基准尺)`)
if (COMP !== 'none') console.log(`后手方补偿:${COMP}`)
console.log('\n每一格量的都是同一套牌打自己 —— 唯一的不对称是谁先手,理论值 50%。\n')
const t0 = performance.now()

const rates = runAll(comp, true, aiCfg)

const overall = rates.reduce((a, b) => a + b, 0) / rates.length
const n = GAMES * PRECON_DECKS.length
const seAll = Math.sqrt(0.25 / n) * 100
console.log(
  `\n合计先手胜率 ${overall.toFixed(1)}% ±${seAll.toFixed(1)}(${n} 局,` +
    `${((performance.now() - t0) / 1000).toFixed(1)}s)`,
)
console.log(
  `当前后手补偿:起手牌 先手 3 张 / 后手 4 张(engine/init 的 OPENING_HAND)。`,
)

const v = judgeFirstPlayer(rates, GAMES)
for (const line of v.report) console.log(line)
if (v.problems.length > 0) {
  console.log('\n⚠ 先手优势超出可接受范围:')
  for (const p of v.problems) console.log(`  ${p}`)
  process.exit(1)
}
console.log('\n✓ 先手优势在可接受范围内')
