// sim-body 的 worker:和 cards.worker 一样跑一副牌,只多做一件事 ——
// 把**探针卡注入卡库**。
//
// `createGame(cfg, lib)` 接受卡库作为参数,所以合成卡不必进 `src/content/`:
// 这里 `{...CARDS_BY_ID, [probe.id]: probe}` 就够了。卡池、快照、闸门一律不动。
//
// 种子编排与 cards.worker 逐字相同(`7919 * (g + 1)`、`g % 2` 轮先后手、
// 对手按 g 轮转),所以两个脚本的 Δ 直接可比。
import { PRECON_DECKS } from '../../src/content/decks'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_NORMAL } from '../../src/ai/greedy'
import { START_HP } from '../../src/engine/types'
import { serveTasks } from '../parallel'
import type { CardDef, CardLibrary, GameConfig, PlayerIdx, Winner } from '../../src/engine/types'

function play(
  lib: CardLibrary,
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
  let state = createGame(cfg, lib)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const step = aiStep(state, actor, lib, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, lib)
    if (!r.ok) throw new Error(`AI illegal command: ${r.error}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

export interface BodyTask {
  deck: string[]
  baseIdx: number
  games: number
  /** 要注入卡库的探针卡;基准那一跑不带探针(undefined) */
  probe?: CardDef
}

serveTasks<BodyTask, { wins: number; played: number }>(({ deck, baseIdx, games, probe }) => {
  const lib: CardLibrary = probe ? { ...CARDS_BY_ID, [probe.id]: probe } : CARDS_BY_ID
  const others: number[] = []
  for (let k = 0; k < PRECON_DECKS.length; k++) if (k !== baseIdx) others.push(k)

  let wins = 0
  let played = 0
  for (let g = 0; g < games; g++) {
    const oppIdx = others[g % others.length]
    const w = play(lib, deck, baseIdx, oppIdx, 7919 * (g + 1), (g % 2) as PlayerIdx)
    if (w !== 'draw') played++
    if (w === 0) wins++
  }
  return { wins, played }
})
