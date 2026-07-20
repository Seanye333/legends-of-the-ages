import type { LocalizedText } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import type { DeckViolation } from './decks'
import { CARDS_BY_ID } from './cards'
import { DOCTRINE_NAME } from './names'

// 构筑违规 → 双语人话。
// 从前是 `validateDeck(...).map(e => ({ zh: e, en: e }))` —— 英文诊断信息当双语透传,
// 中文玩家看到的是 `deck must have exactly 30 cards, got 27`。
export function deckViolationText(v: DeckViolation): LocalizedText {
  const name = (id: string) => CARDS_BY_ID[id]?.name ?? { zh: id, en: id }
  switch (v.code) {
    case 'unknown-hero':
      return { zh: '主公不存在', en: 'Unknown hero' }
    case 'bad-size':
      return v.size < DECK_SIZE
        ? {
            zh: `还差 ${DECK_SIZE - v.size} 张(需恰好 ${DECK_SIZE} 张)`,
            en: `${DECK_SIZE - v.size} more cards needed (exactly ${DECK_SIZE})`,
          }
        : {
            zh: `多了 ${v.size - DECK_SIZE} 张(需恰好 ${DECK_SIZE} 张)`,
            en: `${v.size - DECK_SIZE} cards too many (exactly ${DECK_SIZE})`,
          }
    case 'unknown-card':
      return { zh: `卡牌不存在:${v.cardId}`, en: `Unknown card: ${v.cardId}` }
    case 'not-collectible':
      return {
        zh: `「${name(v.cardId).zh}」是衍生物,不能进卡组`,
        en: `${name(v.cardId).en} is a token and cannot be added`,
      }
    case 'too-many-copies':
      return v.limit === 1
        ? {
            zh: `传说「${name(v.cardId).zh}」最多 1 张(现有 ${v.count} 张)`,
            en: `Legendary ${name(v.cardId).en}: max 1 copy (you have ${v.count})`,
          }
        : {
            zh: `「${name(v.cardId).zh}」最多 2 张(现有 ${v.count} 张)`,
            en: `${name(v.cardId).en}: max 2 copies (you have ${v.count})`,
          }
    case 'wrong-doctrine': {
      const cardD = DOCTRINE_NAME[v.doctrine as keyof typeof DOCTRINE_NAME]
      const heroD = DOCTRINE_NAME[v.heroDoctrine as keyof typeof DOCTRINE_NAME]
      return {
        zh: `「${name(v.cardId).zh}」属${cardD?.zh ?? v.doctrine},与主公的${heroD?.zh ?? v.heroDoctrine}不符`,
        en: `${name(v.cardId).en} is ${cardD?.en ?? v.doctrine}, but your hero is ${heroD?.en ?? v.heroDoctrine}`,
      }
    }
  }
}
