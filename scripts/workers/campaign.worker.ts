// sim-campaign 的 worker:算**一关**的全部对局,回传胜场数。
//
// 切分粒度取「关」而不是「局」:24 关 × 240 局,一个任务够跑几秒,
// 消息往返的开销可以忽略;切到「局」的话消息数会是任务数的 240 倍。
//
// 这里的 play() 与 sim-campaign 主文件里那份**必须逐字一致** ——
// 它就是从那里搬过来的。改一处忘了改另一处,表现是「并行和串行结果对不上」,
// 而那种不一致极难查(两边都自洽,只是量的不是同一个游戏)。
// 所以主文件不再保留副本,它自己也走这个 worker(见 sim-campaign.ts 的说明)。
import { BOSSES, bossDeck, bossPersonality, bossField } from '../../src/content/campaign'
import { PRECON_DECKS } from '../../src/content/decks'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_LEVELS, AI_NORMAL } from '../../src/ai/greedy'
import { START_HP } from '../../src/engine/types'
import { serveTasks } from '../parallel'
import type { GameConfig, PlayerIdx, Winner } from '../../src/engine/types'

// worker 默认拿到主线程 process.env 的副本,所以 BOSS_AI 这类开关照常生效
const BOSS_AI = process.env.BOSS_AI === 'general' ? AI_LEVELS.general : AI_NORMAL

function play(bossIdx: number, playerDeckIdx: number, seed: number, first: PlayerIdx): Winner {
  const boss = BOSSES[bossIdx]
  const mine = PRECON_DECKS[playerDeckIdx]
  const myHero = HEROES_BY_ID[mine.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [mine.heroId, boss.heroId],
    deckIds: [[...mine.cardIds], bossDeck(boss.doctrine, boss.deckTier)],
    first,
    heroPowers: [myHero?.power, boss.power],
    heroHps: [myHero?.hp ?? START_HP, boss.hp],
    field: bossField(boss.id),
  }
  let state = createGame(cfg, CARDS_BY_ID)
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  while (state.phase !== 'ended') {
    if (++guard > 5000) return 'draw'
    const actor: PlayerIdx =
      state.phase === 'mulligan' ? (state.players[0].mulliganDone ? 1 : 0) : state.activePlayer
    const bossCfg = { ...BOSS_AI, weights: bossPersonality(boss.id) }
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], actor === 1 ? bossCfg : AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) throw new Error(`AI illegal command (${r.error}) vs ${boss.name.zh}`)
    state = r.state
  }
  return state.winner ?? 'draw'
}

// 任务是 [from, to) 这一段局号,而不是整整一关。
//
// 【为什么要切到比「一关」更细】
// 第一版按关切(24 个任务),10 个 worker 只快了 2 倍 —— 关与关的耗时差很多
// (于謙那关 12% 胜率、局局打满,張角那关 73% 早早结束),24 个不等长的任务
// 分三轮跑,最后一轮只有 4 个线程在动,其余在等。
// 切成局段之后任务数是它的四倍且长度接近,尾部空转就短得多。
serveTasks<{ boss: number; from: number; to: number }, number>(({ boss, from, to }) => {
  let wins = 0
  for (let g = from; g < to; g++) {
    // 种子只由 (boss, g) 决定 —— 与在哪个线程上、按什么顺序算无关。
    // 这是「并行结果与串行逐位一致」的全部前提。
    const w = play(boss, g % PRECON_DECKS.length, boss * 7919 + g * 31 + 1, ((g >> 1) % 2) as PlayerIdx)
    if (w === 0) wins++
  }
  return wins
})
