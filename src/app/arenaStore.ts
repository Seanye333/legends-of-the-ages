import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardDef, Rarity } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import { COLLECTIBLE_CARDS } from '../content/cards'
import { HEROES } from '../content/overrides/heroes'
import type { DeckList } from '../content/decks'
import { useCollection } from './collectionStore'
import { useAchievements } from './achievementStore'

// 竞技场「校场点将」。
//
// 这是全作第三种玩法(此前只有「随便打一局」和「联机天梯」),也是唯一一种
// **不依赖收藏**的模式 —— 三选一现抽三十张,新号和老号站同一条起跑线。
// 它同时是刚刚变丰富的卡池的第一个真正消费者:2,211 张生成卡有 66% 带机制之后,
// 随机三选一才有得选;在那之前抽到的三张大概率是三张同样的白板。
//
// 规则:选主公(三选一)→ 抽 30 张(每次三选一)→ 一直打到 3 败或 12 胜。
// 报名费 100 功勋,奖励随胜场增长 —— 功勋此前只有「合成」一个出口。

export const ARENA_PICKS = DECK_SIZE
export const ARENA_MAX_WINS = 12
export const ARENA_MAX_LOSSES = 3
export const ARENA_ENTRY_MERIT = 100

// 抽卡时的稀有度权重。比开包厚道得多 —— 竞技场卡组要能打,
// 全是白板的三十张打不动任何一套预组。
const OFFER_WEIGHTS: [Rarity, number][] = [
  ['common', 540],
  ['rare', 320],
  ['epic', 110],
  ['legendary', 30],
]

export type ArenaPhase = 'idle' | 'hero' | 'draft' | 'ready' | 'done'

export interface ArenaRun {
  phase: ArenaPhase
  heroOffer: string[] // 三个主公 id
  heroId: string | null
  offer: string[] // 当前三选一
  picked: string[]
  wins: number
  losses: number
}

const EMPTY: ArenaRun = {
  phase: 'idle',
  heroOffer: [],
  heroId: null,
  offer: [],
  picked: [],
  wins: 0,
  losses: 0,
}

function pickDistinct<T>(list: T[], n: number): T[] {
  const out: T[] = []
  const seen = new Set<number>()
  let guard = 0
  while (out.length < n && guard++ < 200 && seen.size < list.length) {
    const i = Math.floor(Math.random() * list.length)
    if (seen.has(i)) continue
    seen.add(i)
    out.push(list[i])
  }
  return out
}

function rollRarity(): Rarity {
  const total = OFFER_WEIGHTS.reduce((n, [, w]) => n + w, 0)
  let roll = Math.random() * total
  for (const [rarity, weight] of OFFER_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return 'common'
}

// 一次三选一。三张同稀有度(与炉石一致),且不重复。
// 池子限定「本主义 + 中立」,不看玩家收藏 —— 这正是竞技场的意义。
function rollOffer(heroId: string): string[] {
  const hero = HEROES.find((h) => h.id === heroId)
  if (!hero) return []
  const rarity = rollRarity()
  const pool = COLLECTIBLE_CARDS.filter(
    (c: CardDef) =>
      c.rarity === rarity && (c.doctrine === hero.doctrine || c.doctrine === 'neutral'),
  )
  if (pool.length < 3) {
    // 该主义该稀有度不够三张时放宽到全稀有度,免得抽不出来
    const wide = COLLECTIBLE_CARDS.filter(
      (c) => c.doctrine === hero.doctrine || c.doctrine === 'neutral',
    )
    return pickDistinct(wide, 3).map((c) => c.id)
  }
  return pickDistinct(pool, 3).map((c) => c.id)
}

// 奖励:保底一包,每两胜多一包,满 12 胜额外给功勋。
// 报名费 100 功勋,所以 0 胜也不至于血本无归(一包 ≈ 25 功勋的期望)。
export function arenaReward(wins: number): { packs: number; merit: number } {
  return {
    packs: 1 + Math.floor(wins / 2),
    merit: wins * 20 + (wins >= ARENA_MAX_WINS ? 200 : 0),
  }
}

interface ArenaState extends ArenaRun {
  begin(): boolean // 扣报名费并开局;功勋不够返回 false
  chooseHero(heroId: string): void
  choose(cardId: string): void
  deck(): DeckList | null
  recordResult(win: boolean): void
  claim(): { packs: number; merit: number } | null
  abandon(): void
}

export const useArena = create<ArenaState>()(
  persist(
    (set, get) => ({
      ...EMPTY,

      begin() {
        const merit = useCollection.getState().merit
        if (merit < ARENA_ENTRY_MERIT) return false
        useCollection.setState({ merit: merit - ARENA_ENTRY_MERIT })
        set({
          ...EMPTY,
          phase: 'hero',
          heroOffer: pickDistinct(HEROES, 3).map((h) => h.id),
        })
        return true
      },

      chooseHero(heroId) {
        if (get().phase !== 'hero') return
        set({ heroId, phase: 'draft', offer: rollOffer(heroId), picked: [] })
      },

      choose(cardId) {
        const s = get()
        if (s.phase !== 'draft' || !s.heroId) return
        if (!s.offer.includes(cardId)) return
        const picked = [...s.picked, cardId]
        if (picked.length >= ARENA_PICKS) {
          set({ picked, offer: [], phase: 'ready' })
          return
        }
        set({ picked, offer: rollOffer(s.heroId) })
      },

      // 竞技场卡组不过 validateDeck 的份数与主义限制 —— 抽到什么就是什么。
      // 引擎只要求恰好 30 张且 id 存在,这两条这里天然满足。
      deck() {
        const s = get()
        if (!s.heroId || s.picked.length !== ARENA_PICKS) return null
        return {
          heroId: s.heroId,
          name: { zh: '校场点将', en: 'Arena Run' },
          cardIds: s.picked.slice(),
        }
      },

      recordResult(win) {
        const s = get()
        if (s.phase !== 'ready') return
        const wins = s.wins + (win ? 1 : 0)
        const losses = s.losses + (win ? 0 : 1)
        const over = wins >= ARENA_MAX_WINS || losses >= ARENA_MAX_LOSSES
        // arenaBestWins 是「取最大」型统计,重复上报同一轮不会累加
        useAchievements.getState().bump('arenaBestWins', wins)
        set({ wins, losses, phase: over ? 'done' : 'ready' })
      },

      claim() {
        const s = get()
        if (s.phase !== 'done') return null
        const reward = arenaReward(s.wins)
        useCollection.getState().grantPacks(reward.packs)
        useCollection.setState({ merit: useCollection.getState().merit + reward.merit })
        set({ ...EMPTY })
        return reward
      },

      abandon() {
        set({ ...EMPTY })
      },
    }),
    { name: 'qiangu-arena' },
  ),
)

