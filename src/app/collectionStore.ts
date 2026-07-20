// 收集与成长:玩家卡牌库存、卡包、战绩、自组卡组。
// localStorage 持久化;Phase 3 联网后同一结构上服务器。
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CardDef, LocalizedText, Rarity } from '../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../content/cards'
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
  wins: number
  losses: number
  customDecks: DeckList[]
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
}

export const useCollection = create<CollectionState>()(
  persist(
    (set, get) => ({
      owned: starterCollection(),
      packs: 2, // 新手礼:两包
      merit: 0,
      packsSinceLegendary: 0,
      wins: 0,
      losses: 0,
      customDecks: [],

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
        const { packs, owned, packsSinceLegendary } = get()
        if (packs <= 0) return null
        const cardIds = rollPack(Math.random, packsSinceLegendary + 1 >= LEGENDARY_PITY)
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
        const gotLegendary = cardIds.some((id) => CARDS_BY_ID[id]?.rarity === 'legendary')
        set((s) => ({
          packs: s.packs - 1,
          owned: newOwned,
          merit: s.merit + meritGained,
          packsSinceLegendary: gotLegendary ? 0 : s.packsSinceLegendary + 1,
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
        return true
      },

      saveDeck(deck) {
        // validateDeck 返回的是内部英文诊断信息,原样双语透传
        const errors: LocalizedText[] = validateDeck(deck, CARDS_BY_ID, HEROES_BY_ID).map((e) => ({
          zh: e,
          en: e,
        }))
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
    }),
    { name: 'qiangu-collection' },
  ),
)
