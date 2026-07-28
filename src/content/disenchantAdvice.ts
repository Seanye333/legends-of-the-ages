import type { CardDef } from '../engine/types'
import type { DeckList as Deck } from './decks'
import { COLLECTIBLE_CARDS } from './cards'
import { PRECON_DECKS } from './decks'

// 分解建议 —— 「这些卡你一年没用过」。
//
// 【为什么需要】
// 功勋的入口只有三个:重复卡自动折算、败局安慰、成就与首通。
// 想定向合成一张传说要攒很久,而玩家的收藏里通常躺着几百张
// **从来没进过任何一副牌组**的卡 —— 它们既不会被用到,也不会被想起来分解。
// 建议要做的就是把这批卡指出来,并且**只指出真正安全的那些**。
//
// 【安全的定义(三条,缺一不可)】
//   1. 不在任何**已存的自组卡组**里 —— 拆了会让那副牌失效;
//   2. 不在任何**预组**里 —— 预组是开箱即玩的保底,拆穿了新手就没牌打了;
//   3. 不是**签名卡/传说** —— 那是收藏价值,拆了要后悔(合回来要四倍功勋)。
// 三条都过才进建议。宁可少建议,也不能建议一次就让人损失一副牌。

export interface DisenchantAdvice {
  card: CardDef
  copies: number // 建议分解几张(全部)
}

function usedIds(customDecks: Deck[]): Set<string> {
  const used = new Set<string>()
  for (const d of [...PRECON_DECKS, ...customDecks]) {
    for (const id of d.cardIds) used.add(id)
  }
  return used
}

export function disenchantAdvice(
  owned: Record<string, number>,
  customDecks: Deck[],
  limit = 30,
): DisenchantAdvice[] {
  const used = usedIds(customDecks)
  const out: DisenchantAdvice[] = []
  for (const c of COLLECTIBLE_CARDS) {
    const n = owned[c.id] ?? 0
    if (n <= 0) continue
    if (used.has(c.id)) continue
    // 传说不建议 —— 收藏价值,而且合回来要四倍功勋
    if (c.rarity === 'legendary' || c.rarity === 'epic') continue
    out.push({ card: c, copies: n })
  }
  // 先按份数(拆得多、回得多),再按费用 —— 高费白板最没人要
  return out
    .sort((a, b) => b.copies - a.copies || b.card.cost - a.card.cost || a.card.id.localeCompare(b.card.id))
    .slice(0, limit)
}

// 这批卡一共能换多少功勋(UI 用来说「共可换 N 功勋」)
export function adviceTotal(
  advice: DisenchantAdvice[],
  valueOf: (cardId: string) => number,
): number {
  return advice.reduce((n, a) => n + valueOf(a.card.id) * a.copies, 0)
}
