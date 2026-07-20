// 平衡模拟:六套预组 AI 互搏,输出胜率矩阵。
// 运行:npm run sim-balance(GAMES=每对局数,默认 40)
import { PRECON_DECKS, type DeckList } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'
import { START_HP } from '../src/engine/types'

// 默认 100 局/对(约 30 秒)。40 局的噪声有 ±8 个百分点 —— 同一套牌能读出
// 62% 和 55% 两种结果,拿它当闸门只会制造误报和假绿。要快速试探用 GAMES=40,
// 但**下结论必须用默认值或更高**。局数取 4 的倍数,座位×先手四种组合才跑得齐。
const GAMES_PER_PAIR = Number(process.env.GAMES ?? 100)

// first 必须显式传入,不能从 seed 推。
// 曾经写成 `first: (seed & 1)`,而 seed 的奇偶恰好与座位 swap 同步翻转
// (三个乘数都是奇数 → seed 奇偶 = (i+j+g+1)%2,swap = g%2),
// 结果每个对位里永远是同一套牌先手 —— 整张矩阵都带着先手偏置。
function playGame(a: DeckList, b: DeckList, seed: number, first: PlayerIdx): Winner {
  // 主公技必须进模拟 —— 它每回合都能用,是全局触发频率最高的效果,
  // 不带着一起跑等于在测一个和实际对局不一样的游戏。
  const heroes = [HEROES_BY_ID[a.heroId], HEROES_BY_ID[b.heroId]]
  const cfg: GameConfig = {
    seed,
    heroIds: [a.heroId, b.heroId],
    deckIds: [[...a.cardIds], [...b.cardIds]],
    first,
    heroPowers: [heroes[0]?.power, heroes[1]?.power],
    heroHps: [heroes[0]?.hp ?? START_HP, heroes[1]?.hp ?? START_HP],
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0x0a1a, seed ^ 0x0b2b]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) throw new Error(`game did not terminate: ${a.name.zh} vs ${b.name.zh} seed ${seed}`)
    const actor: PlayerIdx =
      state.phase === 'mulligan'
        ? state.players[0].mulliganDone
          ? 1
          : 0
        : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command (${r.error}): ${JSON.stringify(step.cmd)}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

if (PRECON_DECKS.length < 2) {
  console.log('PRECON_DECKS 不足 2 套,先完成内容设计再跑平衡模拟。')
  process.exit(0)
}

const n = PRECON_DECKS.length
const wins: number[][] = Array.from({ length: n }, () => Array(n).fill(0))
const games: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

console.log(`sim-balance: ${n} decks, ${GAMES_PER_PAIR} games/pair`)
const t0 = performance.now()
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    for (let g = 0; g < GAMES_PER_PAIR; g++) {
      // 座位与先手必须独立翻转,否则某一方会一直吃先手红利。
      // g mod 4 跑满四种组合:(座位 A/B) × (先手 0/1)。
      const swap = g % 2 === 1
      const first = (((g >> 1) % 2) === 1 ? 1 : 0) as PlayerIdx
      const [a, b] = swap ? [PRECON_DECKS[j], PRECON_DECKS[i]] : [PRECON_DECKS[i], PRECON_DECKS[j]]
      const winner = playGame(a, b, i * 7919 + j * 104729 + g * 31 + 1, first)
      games[i][j]++
      games[j][i]++
      if (winner !== 'draw') {
        const winnerIdx = swap ? (winner === 0 ? j : i) : winner === 0 ? i : j
        wins[winnerIdx][winnerIdx === i ? j : i]++
      }
    }
    process.stdout.write('.')
  }
}
console.log(` (${((performance.now() - t0) / 1000).toFixed(1)}s)`)

const names = PRECON_DECKS.map((d) => d.name.zh)
const pad = (s: string, w: number) => s.padEnd(w, '　').slice(0, w)
console.log('\n胜率矩阵(行 vs 列):')
console.log(pad('', 6) + names.map((x) => pad(x, 6)).join(''))
const overall: number[] = []
for (let i = 0; i < n; i++) {
  const row = [pad(names[i], 6)]
  let w = 0
  let g = 0
  for (let j = 0; j < n; j++) {
    if (i === j) {
      row.push(pad('—', 6))
      continue
    }
    const pct = games[i][j] ? (100 * wins[i][j]) / games[i][j] : 0
    row.push(pad(`${pct.toFixed(0)}%`, 6))
    w += wins[i][j]
    g += games[i][j]
  }
  overall[i] = g ? (100 * w) / g : 0
  console.log(row.join('') + `  总:${overall[i].toFixed(1)}%`)
}
// ---------- 验收闸门 ----------
// 两道:总胜率 40-60%,以及**单个对位** 30-70%。
// 只看总胜率是不够的 —— 六套卡组互相克制、各自总分都在 50% 附近,
// 照样能通过检查,但玩家体验是选卡组即定胜负的猜拳,不是对局博弈。
const OVERALL_MIN = 40
const OVERALL_MAX = 60
const MATCHUP_MIN = 30
const MATCHUP_MAX = 70

const overallOutliers = overall
  .map((p, i) => ({ p, name: names[i] }))
  .filter((x) => x.p < OVERALL_MIN || x.p > OVERALL_MAX)

// 每个对位只报一次(i<j),取行方视角
const matchupOutliers: { a: string; b: string; pct: number; n: number }[] = []
for (let i = 0; i < n; i++) {
  for (let j = i + 1; j < n; j++) {
    if (!games[i][j]) continue
    const pct = (100 * wins[i][j]) / games[i][j]
    if (pct < MATCHUP_MIN || pct > MATCHUP_MAX) {
      matchupOutliers.push({ a: names[i], b: names[j], pct, n: games[i][j] })
    }
  }
}
matchupOutliers.sort((x, y) => Math.abs(y.pct - 50) - Math.abs(x.pct - 50))

if (overallOutliers.length) {
  console.log(`\n⚠ 总胜率超出 ${OVERALL_MIN}-${OVERALL_MAX}%(需要调卡):`)
  for (const o of overallOutliers) console.log(`  ${o.name}: ${o.p.toFixed(1)}%`)
}
if (matchupOutliers.length) {
  console.log(`\n⚠ 对位极化,超出 ${MATCHUP_MIN}-${MATCHUP_MAX}%(胜负在选卡组时就定了):`)
  for (const m of matchupOutliers) {
    console.log(`  ${m.a} vs ${m.b}: ${m.pct.toFixed(0)}%  (${m.n} 局)`)
  }
}
if (overallOutliers.length || matchupOutliers.length) {
  const worst = matchupOutliers[0]
  if (worst) {
    console.log(
      `\n最极端对位:${worst.a} vs ${worst.b} = ${worst.pct.toFixed(0)}%。` +
        `\n调校思路:给劣势方补该对位缺的答案(解场/守护/回复),而不是无脑加身材。`,
    )
  }
  process.exitCode = 1
} else {
  console.log(
    `\n✓ 总胜率全部落在 ${OVERALL_MIN}-${OVERALL_MAX}%,且无对位超出 ${MATCHUP_MIN}-${MATCHUP_MAX}%`,
  )
}
