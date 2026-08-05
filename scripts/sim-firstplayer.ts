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
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import { judgeFirstPlayer } from './firstPlayerGate'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

// 4 的倍数:座位 × 先手四种组合才跑得齐(见 simSeating.ts)
const GAMES = Number(process.env.GAMES ?? 400)

// 同一套预组自己打自己 —— 双方卡组、主公、AI 全同,唯一的不对称是先后手。
// 返回「先手方是否获胜」。
function playMirror(deckIdx: number, seed: number, first: PlayerIdx): Winner {
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
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal (${r.error})`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

console.log(`sim-firstplayer: ${PRECON_DECKS.length} 套预组自我对镜,每套 ${GAMES} 局\n`)
console.log('每一格量的都是同一套牌打自己 —— 唯一的不对称是谁先手,理论值 50%。\n')
const t0 = performance.now()

const rates: number[] = []
for (let d = 0; d < PRECON_DECKS.length; d++) {
  let firstWins = 0
  let played = 0
  for (let g = 0; g < GAMES; g++) {
    // 先手方轮流坐两个座位 —— 座位本身不该有影响,轮换它可以把座位效应也平均掉
    const first = (g & 1) as PlayerIdx
    const w = playMirror(d, d * 7919 + g * 31 + 1, first)
    if (w === 'draw') continue
    played++
    if (w === first) firstWins++
  }
  const rate = (firstWins / Math.max(1, played)) * 100
  rates.push(rate)
  const se = Math.sqrt(0.25 / Math.max(1, played)) * 100
  const bar = '█'.repeat(Math.max(0, Math.round(rate / 4)))
  console.log(
    `  ${PRECON_DECKS[d].name.zh.padEnd(6, '　')} 先手胜率 ${rate.toFixed(1)}% ±${se.toFixed(1)}  ${bar}`,
  )
}

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
