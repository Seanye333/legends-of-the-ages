import type { CardDef, CardLibrary } from '../engine/types'
import { GENERATED_CARDS } from './generated/cards.gen'
import { SIGNATURE_OVERRIDES } from './overrides/signature'
import { STRATAGEMS } from './overrides/stratagems'
import { PACK2_CARDS } from './overrides/pack2'
import { PACK3_CARDS, PACK3_OVERRIDES } from './overrides/pack3'
import { PACK4_CARDS, PACK4_OVERRIDES } from './overrides/pack4'

// 全卡池 = (生成默认值 ⊕ 签名卡手工覆盖 ⊕ 第三卡包覆盖) + 手工锦囊 + 第二、三卡包
// 覆盖顺序:后者赢。签名卡与第三卡包刻意不重叠(pack3 只挑签名集之外的花名册)。
export const CARDS: CardDef[] = [
  ...GENERATED_CARDS.map((card) => {
    const sig = SIGNATURE_OVERRIDES[card.id]
    const p3 = PACK3_OVERRIDES[card.id]
    const p4 = PACK4_OVERRIDES[card.id]
    if (!sig && !p3 && !p4) return card
    return { ...card, ...sig, ...p3, ...p4 }
  }),
  ...STRATAGEMS,
  ...PACK2_CARDS,
  ...PACK3_CARDS,
  ...PACK4_CARDS,
]

export const CARDS_BY_ID: CardLibrary = Object.fromEntries(CARDS.map((c) => [c.id, c]))

// 可收集卡池:衍生物(token)只能被召唤,不进卡包、不可构筑、不进图鉴统计
export const COLLECTIBLE_CARDS: CardDef[] = CARDS.filter((c) => !c.token)

export const SIGNATURE_IDS = Object.keys(SIGNATURE_OVERRIDES)
