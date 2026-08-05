// 对镜类模拟的 worker,sim-hero-mirror 与 sim-firstplayer 共用。
//
// 两者的对局结构其实是同一个:同一副牌两边都用,只有主公技(或先后手)不同。
// 合成一个 worker 是为了让**座位与先后手的编排只有一份**(simSeating) ——
// 这两个脚本正是因为各自写了一遍编排,才让 sim-hero-mirror 带着
// 「备选主公全程后手」的 bug 跑了很久(见 simSeating.ts)。
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { aiStep, AI_NORMAL, type AiConfig } from '../../src/ai/greedy'
import { CARDS_BY_ID } from '../../src/content/cards'
import { PRECON_DECKS } from '../../src/content/decks'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { START_HP } from '../../src/engine/types'
import { seatingFor } from '../simSeating'
import { serveTasks } from '../parallel'
import type { GameConfig, PlayerIdx, RunModifiers, Winner } from '../../src/engine/types'

export interface MirrorTask {
  /** 用哪套预组的牌 */
  deckIdx: number
  /** 基准主公 id;altId 为空表示两边同一个主公(先手优势 / 仪器自检) */
  baseId: string
  altId?: string
  from: number
  to: number
  /** 给「非被测方」的补偿(先手优势那边用来试算后手补偿) */
  comp?: RunModifiers
  /**
   * 用哪把尺子。**整个 AiConfig 直接传** —— 它全是纯数据
   * (数字、布尔、weights 是数字对象),structuredClone 得动。
   * 传配置而不是档位名,是为了让 sim-hero-mirror 的 `RULER=legacy`
   * (一个临时拼出来的权重覆盖,没有名字)也走同一条路。
   */
  ai?: AiConfig
  /**
   * 记分口径 **兼** 种子/座位方案。两个脚本的公式历史上就不一样,
   * **必须逐字保留** —— 换掉的话此前记在 ROADMAP 与源码注释里的数字全部作废
   * (73.8%、AI 档位扫描、补偿扫描都是拿现在这套种子量的)。
   *   · 'alt'  (sim-hero-mirror) : seatingFor(i) 定座位与先后手,seed = i*131 + 7
   *   · 'first'(sim-firstplayer) : first = i & 1(两边同主公,座位无意义),
   *                                seed = deckIdx*7919 + i*31 + 1
   */
  score: 'alt' | 'first'
}

function play(
  deck: string[],
  heroFor: (seat: PlayerIdx) => string,
  first: PlayerIdx,
  seed: number,
  mods: [RunModifiers | undefined, RunModifiers | undefined],
  ai: AiConfig,
): Winner {
  const cfg: GameConfig = {
    seed,
    heroIds: [heroFor(0), heroFor(1)],
    deckIds: [deck, deck],
    first,
    heroPowers: [HEROES_BY_ID[heroFor(0)]?.power, HEROES_BY_ID[heroFor(1)]?.power],
    // 两个来源脚本原来写法不同(hero-mirror 写死 START_HP,firstplayer 用 hero.hp),
    // 而十二位主公目前**血量全是 30 = START_HP**,所以两种写法今天逐位等价。
    // 统一取主公自己的血量:更忠实,将来真有人给某位主公改血量也不会悄悄失真。
    heroHps: [
      HEROES_BY_ID[heroFor(0)]?.hp ?? START_HP,
      HEROES_BY_ID[heroFor(1)]?.hp ?? START_HP,
    ],
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

serveTasks<MirrorTask, { wins: number; played: number }>((t) => {
  const deck = PRECON_DECKS[t.deckIdx].cardIds as string[]
  const ai = t.ai ?? AI_NORMAL
  let wins = 0
  let played = 0
  for (let i = t.from; i < t.to; i++) {
    if (t.score === 'alt') {
      // sim-hero-mirror:座位与先后手各自独立轮换(simSeating),altSeat 坐备选主公
      const { altSeat, first } = seatingFor(i)
      const seed = i * 131 + 7
      const heroFor = (seat: PlayerIdx) => (seat === altSeat ? t.altId! : t.baseId)
      const w = play(deck, heroFor, first as PlayerIdx, seed, [undefined, undefined], ai)
      if (w === 'draw') continue
      played++
      if (w === altSeat) wins++
    } else {
      // sim-firstplayer:两边同一个主公 —— 座位本身没有意义(双方一模一样),
      // 轮换它只是把可能的座位效应也平均掉,所以这里直接用 i&1 定先手。
      const first = (i & 1) as PlayerIdx
      const seed = t.deckIdx * 7919 + i * 31 + 1
      const second = (1 - first) as PlayerIdx
      const mods: [RunModifiers | undefined, RunModifiers | undefined] = [undefined, undefined]
      if (t.comp && Object.keys(t.comp).length > 0) mods[second] = t.comp
      const w = play(deck, () => t.baseId, first, seed, mods, ai)
      if (w === 'draw') continue
      played++
      if (w === first) wins++
    }
  }
  return { wins, played }
})
