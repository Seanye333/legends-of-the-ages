// sim-cards 的 worker:给一副牌,跑完它的全部对局,回传胜场。
//
// 切分粒度取「一副牌」:每张待测卡就是一个任务,而每个任务的局数完全相同
// (同样的对手轮转、同样的种子序列),所以任务天然等长 —— 不需要再往下切。
// 这是三个并行接入点里最容易切的一个:sim-campaign 要按局段切、
// sim-firstplayer 要调 CHUNK,都是因为任务不等长。
//
// **种子只由 g 决定,与是哪张卡无关** —— 这不是巧合而是设计:
// 每张卡都在同一批对局上被测,基准与待测之间是**配对比较**,
// 抽样噪声在两边同向抵消掉一部分。并行不改变这一点(g 的取值范围没变)。
import { PRECON_DECKS } from '../../src/content/decks'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../../src/ai/greedy'
import { START_HP } from '../../src/engine/types'
import { serveTasks } from '../parallel'
import type { GameConfig, PlayerIdx, Winner } from '../../src/engine/types'

function play(
  deck: string[],
  baseIdx: number,
  oppIdx: number,
  seed: number,
  first: PlayerIdx,
): Winner {
  const base = PRECON_DECKS[baseIdx]
  const baseHero = HEROES_BY_ID[base.heroId]
  const opp = PRECON_DECKS[oppIdx]
  const oppHero = HEROES_BY_ID[opp.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [base.heroId, opp.heroId],
    deckIds: [[...deck], [...opp.cardIds]],
    first,
    heroPowers: [baseHero?.power, oppHero?.power],
    heroHps: [baseHero?.hp ?? START_HP, oppHero?.hp ?? START_HP],
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

export interface CardTask {
  deck: string[]
  /** 拿哪套预组当基准(待测卡的主义必须与它兼容,否则是非法卡组) */
  baseIdx: number
  games: number
}

serveTasks<CardTask, { wins: number; played: number }>(({ deck, baseIdx, games }) => {
  // 对手是**除基准之外**的其余五套,按 g 轮转。
  // baseIdx=0 时 others = [1,2,3,4,5],`others[g % 5]` 与老代码的
  // `1 + (g % 5)` 逐字等价 —— 王道/中立卡的历史数字因此原样成立。
  const others: number[] = []
  for (let k = 0; k < PRECON_DECKS.length; k++) if (k !== baseIdx) others.push(k)

  let wins = 0
  let played = 0
  for (let g = 0; g < games; g++) {
    const oppIdx = others[g % others.length]
    const w = play(deck, baseIdx, oppIdx, 7919 * (g + 1), (g % 2) as PlayerIdx)
    if (w !== 'draw') played++
    if (w === 0) wins++
  }
  return { wins, played }
})
