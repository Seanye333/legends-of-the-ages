// 平衡模拟:六套预组 AI 互搏,输出胜率矩阵。
// 运行:npm run sim-balance(GAMES=每对局数,默认 40)
import { PRECON_DECKS, type DeckList } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import type { GameConfig, PlayerIdx, Winner } from '../src/engine/types'

const GAMES_PER_PAIR = Number(process.env.GAMES ?? 40)

function playGame(a: DeckList, b: DeckList, seed: number): Winner {
  const cfg: GameConfig = {
    seed,
    heroIds: [a.heroId, b.heroId],
    deckIds: [[...a.cardIds], [...b.cardIds]],
    first: (seed & 1) as PlayerIdx,
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
      // 交替先后手:座位互换一半
      const swap = g % 2 === 1
      const [a, b] = swap ? [PRECON_DECKS[j], PRECON_DECKS[i]] : [PRECON_DECKS[i], PRECON_DECKS[j]]
      const winner = playGame(a, b, i * 7919 + j * 104729 + g * 31 + 1)
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
const outliers = overall
  .map((p, i) => ({ p, name: names[i] }))
  .filter((x) => x.p < 40 || x.p > 60)
if (outliers.length) {
  console.log('\n⚠ 超出 40-60% 区间(需要调卡):')
  for (const o of outliers) console.log(`  ${o.name}: ${o.p.toFixed(1)}%`)
  process.exitCode = 1
} else {
  console.log('\n✓ 所有预组胜率在 40-60% 区间内')
}
