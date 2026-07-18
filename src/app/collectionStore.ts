// 收集与成长:玩家卡牌库存、卡包、战绩、自组卡组。
// localStorage 持久化;Phase 3 联网后同一结构上服务器。
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardDef, Rarity } from '../engine/types'
import { CARDS, CARDS_BY_ID } from '../content/cards'
import { PRECON_DECKS, validateDeck, type DeckList } from '../content/decks'
import { HEROES_BY_ID } from '../content/overrides/heroes'

export const PACK_SIZE = 5
const MAX_COPIES = 2
const MAX_COPIES_LEGENDARY = 1

// 开包稀有度权重(至少一张稀有以上由重roll保底)
const RARITY_WEIGHTS: [Rarity, number][] = [
  ['common', 700],
  ['rare', 220],
  ['epic', 62],
  ['legendary', 18],
]

const byRarity: Record<Rarity, CardDef[]> = {
  common: CARDS.filter((c) => c.rarity === 'common'),
  rare: CARDS.filter((c) => c.rarity === 'rare'),
  epic: CARDS.filter((c) => c.rarity === 'epic'),
  legendary: CARDS.filter((c) => c.rarity === 'legendary'),
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

export function rollPack(rand: () => number = Math.random): string[] {
  const cards: string[] = []
  for (let i = 0; i < PACK_SIZE; i++) {
    // 保底:第五张至少稀有
    const rarity = rollRarity(rand, i === PACK_SIZE - 1 && cards.every((id) => CARDS_BY_ID[id].rarity === 'common'))
    const pool = byRarity[rarity]
    cards.push(pool[Math.floor(rand() * pool.length)].id)
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
}

interface CollectionState {
  owned: Record<string, number>
  packs: number
  wins: number
  losses: number
  customDecks: DeckList[]
  // 对局结束时调用一次;胜利得一包
  recordResult(win: boolean): void
  openPack(): PackResult | null
  saveDeck(deck: DeckList): string[] // 返回校验错误;空数组=成功
  deleteDeck(name: string): void
  ownedCount(cardId: string): number
}

export const useCollection = create<CollectionState>()(
  persist(
    (set, get) => ({
      owned: starterCollection(),
      packs: 2, // 新手礼:两包
      wins: 0,
      losses: 0,
      customDecks: [],

      recordResult(win) {
        set((s) => ({
          wins: s.wins + (win ? 1 : 0),
          losses: s.losses + (win ? 0 : 1),
          packs: s.packs + (win ? 1 : 0),
        }))
      },

      openPack() {
        const { packs, owned } = get()
        if (packs <= 0) return null
        const cardIds = rollPack()
        const newOwned = { ...owned }
        const newCardIds: string[] = []
        for (const id of cardIds) {
          const have = newOwned[id] ?? 0
          if (have < copyLimit(id)) {
            newOwned[id] = have + 1
            newCardIds.push(id)
          }
          // 超上限的重复卡暂不转化(功勋兑换 Phase 2.5)
        }
        set({ packs: packs - 1, owned: newOwned })
        return { cardIds, newCardIds }
      },

      saveDeck(deck) {
        const errors = validateDeck(deck, CARDS_BY_ID, HEROES_BY_ID)
        // 额外校验:必须实际拥有这些卡
        const counts: Record<string, number> = {}
        for (const id of deck.cardIds) counts[id] = (counts[id] ?? 0) + 1
        for (const [id, n] of Object.entries(counts)) {
          if ((get().owned[id] ?? 0) < n) {
            errors.push(`未拥有足够的「${CARDS_BY_ID[id]?.name.zh ?? id}」(需 ${n})`)
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
    }),
    { name: 'qiangu-collection' },
  ),
)
