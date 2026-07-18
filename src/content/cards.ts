import type { CardDef, CardLibrary } from '../engine/types'
import { GENERATED_CARDS } from './generated/cards.gen'
import { SIGNATURE_OVERRIDES } from './overrides/signature'

// 全卡池 = 生成默认值 ⊕ 签名卡手工覆盖
export const CARDS: CardDef[] = GENERATED_CARDS.map((card) => {
  const override = SIGNATURE_OVERRIDES[card.id]
  return override ? { ...card, ...override } : card
})

export const CARDS_BY_ID: CardLibrary = Object.fromEntries(CARDS.map((c) => [c.id, c]))

export const SIGNATURE_IDS = Object.keys(SIGNATURE_OVERRIDES)
