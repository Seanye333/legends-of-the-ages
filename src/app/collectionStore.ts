// 收集与成长:玩家卡牌库存、卡包、战绩、自组卡组。
// localStorage 持久化;Phase 3 联网后同一结构上服务器。
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardDef, LocalizedText, Rarity } from '../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../content/cards'
import { claimableGoals } from '../content/collectionGoals'
import { PRECON_DECKS, validateDeckDetailed, type DeckList } from '../content/decks'
import { deckViolationText } from '../content/deckErrorText'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { useAchievements } from './achievementStore'

export const PACK_SIZE = 5
const MAX_COPIES = 2
const MAX_COPIES_LEGENDARY = 1

// 收藏里程碑:把「拥有多少不同卡 / 多少不同传说」同步进功名簿(MAX 统计,只增不减)。
// 在每次真正增卡处调用(开包 / 合成)—— 分解只会减,而 MAX 语义天然保留历史峰值。
function syncCollectionStats(owned: Record<string, number>): void {
  const ids = Object.keys(owned)
  let legendaries = 0
  for (const id of ids) {
    if (CARDS_BY_ID[id]?.rarity === 'legendary') legendaries++
  }
  const ach = useAchievements.getState()
  ach.bump('collectionSize', ids.length)
  ach.bump('legendariesOwned', legendaries)
}

// 开包稀有度权重(至少一张稀有以上由重roll保底)
const RARITY_WEIGHTS: [Rarity, number][] = [
  ['common', 700],
  ['rare', 220],
  ['epic', 62],
  ['legendary', 18],
]

// ---------- 功勋(分解/合成货币) ----------
//
// 从前超上限的重复卡直接蒸发,开包界面还会贴心地告诉你「这张不是新的」——
// 收集到中期以后开包就变成纯粹的做无用功。功勋把这条路补上:
// 重复卡自动折算成功勋,功勋可以定向合成任何一张卡。
//
// 比例参照炉石(分解:合成 ≈ 1:4),但整体压缩过 —— 本作一局一包,
// 用炉石原数值合一张传说要六十多包,对单机为主的节奏太长。
export const DISENCHANT_VALUE: Record<Rarity, number> = {
  common: 10,
  rare: 30,
  epic: 90,
  legendary: 250,
}

export const CRAFT_COST: Record<Rarity, number> = {
  common: 40,
  rare: 100,
  epic: 300,
  legendary: 800,
}

// 传说保底:连续 N 包不出传说,下一包必出。没有这个,运气差的玩家
// 会在「概率上没问题」的情况下体验到几十包不见传说。
const LEGENDARY_PITY = 20

export function disenchantValue(cardId: string): number {
  const r = CARDS_BY_ID[cardId]?.rarity
  return r ? DISENCHANT_VALUE[r] : 0
}

export function craftCost(cardId: string): number {
  const r = CARDS_BY_ID[cardId]?.rarity
  return r ? CRAFT_COST[r] : Infinity
}

// 衍生物(token)不可开出、不可合成
const byRarity: Record<Rarity, CardDef[]> = {
  common: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'common'),
  rare: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'rare'),
  epic: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'epic'),
  legendary: COLLECTIBLE_CARDS.filter((c) => c.rarity === 'legendary'),
}

function rollRarity(rand: () => number, minRare: boolean): Rarity {
  const pool = minRare ? RARITY_WEIGHTS.filter(([r]) => r !== 'common') : RARITY_WEIGHTS
  const total = pool.reduce((n, [, w]) => n + w, 0)
  let roll = rand() * total
  for (const [rarity, weight] of pool) {
    roll -= weight
    if (roll <= 0) return rarity
  }
  return 'common'
}

// forceLegendary:保底触发时,把其中一张顶成传说
export function rollPack(rand: () => number = Math.random, forceLegendary = false): string[] {
  const cards: string[] = []
  for (let i = 0; i < PACK_SIZE; i++) {
    // 保底:第五张至少稀有
    const rarity = rollRarity(rand, i === PACK_SIZE - 1 && cards.every((id) => CARDS_BY_ID[id].rarity === 'common'))
    const pool = byRarity[rarity]
    cards.push(pool[Math.floor(rand() * pool.length)].id)
  }
  if (forceLegendary && !cards.some((id) => CARDS_BY_ID[id].rarity === 'legendary')) {
    const pool = byRarity.legendary
    cards[PACK_SIZE - 1] = pool[Math.floor(rand() * pool.length)].id
  }
  return cards
}

export function copyLimit(cardId: string): number {
  return CARDS_BY_ID[cardId]?.rarity === 'legendary' ? MAX_COPIES_LEGENDARY : MAX_COPIES
}

// 初始收藏 = 六套预组的并集(保证预组开箱即玩)
function starterCollection(): Record<string, number> {
  const owned: Record<string, number> = {}
  for (const deck of PRECON_DECKS) {
    const counts: Record<string, number> = {}
    for (const id of deck.cardIds) counts[id] = (counts[id] ?? 0) + 1
    for (const [id, n] of Object.entries(counts)) {
      owned[id] = Math.max(owned[id] ?? 0, n)
    }
  }
  return owned
}

export interface PackResult {
  cardIds: string[]
  newCardIds: string[] // 超出持有上限前的新增(用于 UI 高亮 NEW)
  meritGained: number // 超上限重复卡折算的功勋
}

// 输一局的安慰功勋。输了颗粒无收对新手太劝退,而给卡包又会让胜利失去意义 ——
// 功勋是「慢一点但一定到得了」的那条路。
const MERIT_PER_LOSS = 15
const MERIT_PER_DRAW = 8

interface CollectionState {
  owned: Record<string, number>
  packs: number
  merit: number
  packsSinceLegendary: number
  // 累计开过多少包 —— 只为「第一包必出传说」那条规则存在。
  // 用累计数而不是布尔量,是因为将来若要做「前 N 包定向」不必再加字段。
  packsEverOpened: number
  wins: number
  losses: number
  customDecks: DeckList[]
  // 收藏度奖励已领取的档位 id(见 content/collectionGoals.ts)。
  // 可选式默认 [] —— 老存档没有这个键,persist 的浅合并会保留初始值。
  collectionClaimed: string[]
  // 对局结束时调用一次;胜利得一包,失败得安慰功勋
  recordResult(win: boolean): void
  recordDraw(): void
  grantPacks(n: number): void // 任务奖励等外部发包
  openPack(): PackResult | null
  disenchant(cardId: string): boolean // 分解一张多余的卡
  craft(cardId: string): boolean // 用功勋合成一张卡
  saveDeck(deck: DeckList): LocalizedText[] // 返回校验错误;空数组=成功
  deleteDeck(name: string): void
  ownedCount(cardId: string): number
  // 领取一档收藏度奖励。重复领取返回 0。
  claimCollectionGoal(id: string): number
}

export const useCollection = create<CollectionState>()(
  persist(
    (set, get) => ({
      owned: starterCollection(),
      packs: 2, // 新手礼:两包
      merit: 0,
      packsSinceLegendary: 0,
      packsEverOpened: 0,
      wins: 0,
      losses: 0,
      customDecks: [],
      collectionClaimed: [],

      recordResult(win) {
        set((s) => ({
          wins: s.wins + (win ? 1 : 0),
          losses: s.losses + (win ? 0 : 1),
          packs: s.packs + (win ? 1 : 0),
          merit: s.merit + (win ? 0 : MERIT_PER_LOSS),
        }))
      },

      recordDraw() {
        set((s) => ({ merit: s.merit + MERIT_PER_DRAW }))
      },

      grantPacks(n) {
        if (n <= 0) return
        set((s) => ({ packs: s.packs + n }))
      },

      openPack() {
        const { packs, owned, packsSinceLegendary, packsEverOpened } = get()
        if (packs <= 0) return null
        // 第一包必出传说。
        //
        // 【为什么不是「前三包给一套能用的卡」】
        // 原本想做的是那个,查了才发现**没必要**:初始收藏已经是六套预组的并集
        // (starterCollection),新玩家一进来就有六套完整能打的卡组。
        // 「三包全是散件、拼不出一套牌」这个问题在这个项目里根本不存在。
        //
        // 【那什么才是真问题】
        // 第一包的作用不是给战力,是给**印象**。从 1,400 张普通卡里随机五张,
        // 开出来的多半是五个没听过的名字 —— 而这游戏最大的卖点是「名将」。
        // 第一包塞一张传说,开出来的是关羽、李白这个量级的名字,
        // 玩家立刻知道自己在收集什么。往后照旧走 20 包保底。
        const firstEver = packsEverOpened === 0
        const cardIds = rollPack(
          Math.random,
          firstEver || packsSinceLegendary + 1 >= LEGENDARY_PITY,
        )
        const newOwned = { ...owned }
        const newCardIds: string[] = []
        let meritGained = 0
        for (const id of cardIds) {
          const have = newOwned[id] ?? 0
          if (have < copyLimit(id)) {
            newOwned[id] = have + 1
            newCardIds.push(id)
          } else {
            // 超上限的重复卡折算成功勋,不再凭空蒸发
            meritGained += disenchantValue(id)
          }
        }
        useAchievements.getState().bump('packsOpened')
        syncCollectionStats(newOwned)
        const gotLegendary = cardIds.some((id) => CARDS_BY_ID[id]?.rarity === 'legendary')
        set((s) => ({
          packs: s.packs - 1,
          owned: newOwned,
          merit: s.merit + meritGained,
          packsSinceLegendary: gotLegendary ? 0 : s.packsSinceLegendary + 1,
          packsEverOpened: s.packsEverOpened + 1,
        }))
        return { cardIds, newCardIds, meritGained }
      },

      // 分解:只能分解「多出来的」那张,不会把卡组拆散
      disenchant(cardId) {
        const have = get().owned[cardId] ?? 0
        if (have <= 0) return false
        const value = disenchantValue(cardId)
        set((s) => {
          const owned = { ...s.owned }
          if (have <= 1) delete owned[cardId]
          else owned[cardId] = have - 1
          return { owned, merit: s.merit + value }
        })
        return true
      },

      craft(cardId) {
        const card = CARDS_BY_ID[cardId]
        if (!card || card.token) return false
        const have = get().owned[cardId] ?? 0
        if (have >= copyLimit(cardId)) return false
        const cost = craftCost(cardId)
        if (get().merit < cost) return false
        set((s) => ({
          merit: s.merit - cost,
          owned: { ...s.owned, [cardId]: (s.owned[cardId] ?? 0) + 1 },
        }))
        useAchievements.getState().bump('cardsCrafted')
        syncCollectionStats(get().owned)
        return true
      },

      saveDeck(deck) {
        const errors: LocalizedText[] = validateDeckDetailed(
          deck,
          CARDS_BY_ID,
          HEROES_BY_ID,
        ).map(deckViolationText)
        // 额外校验:必须实际拥有这些卡
        const counts: Record<string, number> = {}
        for (const id of deck.cardIds) counts[id] = (counts[id] ?? 0) + 1
        for (const [id, n] of Object.entries(counts)) {
          if ((get().owned[id] ?? 0) < n) {
            const card = CARDS_BY_ID[id]
            errors.push({
              zh: `未拥有足够的「${card?.name.zh ?? id}」(需 ${n})`,
              en: `Not enough copies of ${card?.name.en ?? id} (need ${n})`,
            })
          }
        }
        if (errors.length > 0) return errors
        set((s) => ({
          customDecks: [...s.customDecks.filter((d) => d.name.zh !== deck.name.zh), deck],
        }))
        return []
      },

      deleteDeck(nameZh) {
        set((s) => ({ customDecks: s.customDecks.filter((d) => d.name.zh !== nameZh) }))
      },

      ownedCount(cardId) {
        return get().owned[cardId] ?? 0
      },

      claimCollectionGoal(id) {
        const { owned, collectionClaimed } = get()
        const goal = claimableGoals(owned, collectionClaimed).find((g) => g.id === id)
        if (!goal) return 0
        set({
          collectionClaimed: [...collectionClaimed, id],
          merit: get().merit + goal.merit,
        })
        return goal.merit
      },
    }),
    { name: 'qiangu-collection' },
  ),
)
