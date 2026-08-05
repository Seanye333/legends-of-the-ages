// sim-balance 的 worker:算一个对位的一段对局,回传双方胜场。
//
// 座位与先后手**必须各自独立翻转**(g%2 定座位、(g>>1)%2 定先手,四局一周期)——
// 这个脚本自己踩过那个坑并修好了,它的文件头还留着警告。
// 搬到 worker 里时逐字照抄,别顺手「简化」。
import { PRECON_DECKS } from '../../src/content/decks'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../../src/ai/greedy'
import { START_HP } from '../../src/engine/types'
import { serveTasks } from '../parallel'
import type { DeckList } from '../../src/content/decks'
import type { GameConfig, PlayerIdx, Winner } from '../../src/engine/types'

function playGame(a: DeckList, b: DeckList, seed: number, first: PlayerIdx): Winner {
  // 主公技必须进模拟 —— 它每回合都能用,是全局触发频率最高的效果
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

export interface BalanceTask {
  i: number
  j: number
  from: number
  to: number
}

serveTasks<BalanceTask, { winsI: number; winsJ: number; played: number }>(
  ({ i, j, from, to }) => {
    let winsI = 0
    let winsJ = 0
    let played = 0
    for (let g = from; g < to; g++) {
      const swap = g % 2 === 1
      const first = (((g >> 1) % 2) === 1 ? 1 : 0) as PlayerIdx
      const [a, b] = swap ? [PRECON_DECKS[j], PRECON_DECKS[i]] : [PRECON_DECKS[i], PRECON_DECKS[j]]
      const winner = playGame(a, b, i * 7919 + j * 104729 + g * 31 + 1, first)
      played++
      if (winner !== 'draw') {
        const winnerIdx = swap ? (winner === 0 ? j : i) : winner === 0 ? i : j
        if (winnerIdx === i) winsI++
        else winsJ++
      }
    }
    return { winsI, winsJ, played }
  },
)
