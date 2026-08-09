// 名局模拟的 worker:算一段对局,回传玩家胜场。sim-history 与 tune-history **共用它**。
//
// 共用是有意的,理由和 campaign.worker 那份一样:两处各留一份 play() 的话,
// 改一处忘了改另一处,表现是「调参搜出来的数落库之后闸门不认」——
// 两边都自洽,只是量的不是同一个游戏,而那种不一致极难查。
//
// 与 campaign.worker 的差别只有一处,但那处是名局的灵魂:
// **必须把 battleModifiers 传进 GameConfig**。名局带开局态势(护甲/额外手牌/敌方随从),
// 少传这一项,模拟出的难度就和实际玩的不是一回事。
import { HISTORY_BATTLES, battleDeck, battleModifiers } from '../../src/content/historyBattles'
import { bossDeck } from '../../src/content/campaign'
import { PRECON_DECKS } from '../../src/content/decks'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_LEVELS, AI_NORMAL } from '../../src/ai/greedy'
import { START_HP } from '../../src/engine/types'
import { serveTasks } from '../parallel'
import type { GameConfig, PlayerIdx, Winner } from '../../src/engine/types'

const BOSS_AI = process.env.BOSS_AI === 'general' ? AI_LEVELS.general : AI_NORMAL

/** 调参用的覆盖值。**都不给时必须与落库值逐位一致** —— 那是闸门与调参对得上的前提。 */
export interface BattleOverride {
  hp?: number
  tier?: number
}

export function playBattle(
  battleIdx: number,
  playerDeckIdx: number,
  seed: number,
  first: PlayerIdx,
  ov: BattleOverride = {},
): Winner {
  const battle = HISTORY_BATTLES[battleIdx]
  const mine = PRECON_DECKS[playerDeckIdx]
  const myHero = HEROES_BY_ID[mine.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [mine.heroId, battle.heroId],
    // tier 没给就走 battleDeck(它自己就是 bossDeck(doctrine, deckTier) 的包装),
    // 给了就按覆盖值取池 —— 两条路在 ov.tier === battle.deckTier 时结果相同。
    deckIds: [
      [...mine.cardIds],
      ov.tier === undefined ? battleDeck(battle) : bossDeck(battle.doctrine, ov.tier),
    ],
    first,
    heroPowers: [myHero?.power, battle.power],
    heroHps: [myHero?.hp ?? START_HP, ov.hp ?? battle.hp],
    modifiers: battleModifiers(battle), // ← 名战的灵魂:开局态势
    objective: battle.objective, // 目标版(守成等);普通场为 undefined
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], actor === 1 ? BOSS_AI : AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command (${r.error}) vs ${battle.foeName.zh}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

export interface HistoryTask {
  battle: number
  from: number
  to: number
  ov?: BattleOverride
}

// 种子只由 (battle, g) 决定 —— 与在哪个线程上、按什么顺序算无关。
// 这是「并行结果与串行逐位一致」的全部前提。**注意种子里不含 ov**:
// 同一格的不同候选跑的是**同一批对局**,候选之间的差里才不会混进「换了一批牌」。
export const battleSeed = (battle: number, g: number) => battle * 7919 + g * 31 + 1

serveTasks<HistoryTask, number>(({ battle, from, to, ov }) => {
  let wins = 0
  for (let g = from; g < to; g++) {
    const w = playBattle(
      battle,
      g % PRECON_DECKS.length,
      battleSeed(battle, g),
      ((g >> 1) % 2) as PlayerIdx,
      ov,
    )
    if (w === 0) wins++
  }
  return wins
})
