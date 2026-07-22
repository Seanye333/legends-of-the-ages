import type { CardDef, CardLibrary } from '../engine/types'
import { GENERATED_CARDS } from './generated/cards.gen'
import { SIGNATURE_OVERRIDES } from './overrides/signature'
import { STRATAGEMS } from './overrides/stratagems'
import { PACK2_CARDS } from './overrides/pack2'
import { PACK3_CARDS, PACK3_OVERRIDES } from './overrides/pack3'
import { PACK4_CARDS, PACK4_OVERRIDES } from './overrides/pack4'
import { PACK5_CARDS, PACK5_OVERRIDES } from './overrides/pack5'
import {
  PACK6_TOKENS,
  PACK6_DYNASTY_CARDS,
  PACK6_DYNASTY_OVERRIDES,
} from './overrides/pack6-dynasty'
import { PACK6_DOCTRINE_CARDS, PACK6_DOCTRINE_OVERRIDES } from './overrides/pack6-doctrine'
import { PACK6_LEGEND_OVERRIDES } from './overrides/pack6-legends'

// 全卡池 = (生成默认值 ⊕ 各卡包覆盖) + 手工锦囊 + 第二~六卡包
// 覆盖顺序:后者赢。各覆盖表刻意不与签名集重叠(只挑签名之外的花名册)。
export const CARDS: CardDef[] = [
  ...GENERATED_CARDS.map((card) => {
    const sig = SIGNATURE_OVERRIDES[card.id]
    const p3 = PACK3_OVERRIDES[card.id]
    const p4 = PACK4_OVERRIDES[card.id]
    const p5 = PACK5_OVERRIDES[card.id]
    const p6d = PACK6_DYNASTY_OVERRIDES[card.id]
    const p6c = PACK6_DOCTRINE_OVERRIDES[card.id]
    const p6l = PACK6_LEGEND_OVERRIDES[card.id]
    if (!sig && !p3 && !p4 && !p5 && !p6d && !p6c && !p6l) return card
    return { ...card, ...sig, ...p3, ...p4, ...p5, ...p6d, ...p6c, ...p6l }
  }),
  ...STRATAGEMS,
  ...PACK2_CARDS,
  ...PACK3_CARDS,
  ...PACK4_CARDS,
  ...PACK5_CARDS,
  ...PACK6_TOKENS,
  ...PACK6_DYNASTY_CARDS,
  ...PACK6_DOCTRINE_CARDS,
]

export const CARDS_BY_ID: CardLibrary = Object.fromEntries(CARDS.map((c) => [c.id, c]))

// 可收集卡池:衍生物(token)只能被召唤,不进卡包、不可构筑、不进图鉴统计
export const COLLECTIBLE_CARDS: CardDef[] = CARDS.filter((c) => !c.token)

export const SIGNATURE_IDS = Object.keys(SIGNATURE_OVERRIDES)

// 卡池里**重名**的卡(中文名相同的两张及以上)。
//
// 这不是 bug 清单,而是一个必须承认的事实:花名册里既有真正的同名异人
// (蜀漢馬忠 / 東吳馬忠;東漢賈逵 / 曹魏賈逵;蜀漢李密 / 隋末李密),
// 也有导入期两批花名册重叠留下的同一个人(杜預、嵇康、阮籍 等在三国册里记作「群」、
// 在两晋册里记作「晋」)。
//
// **不做自动合并。** 分辨这两类需要逐个的史料判断,而合并的代价是不可逆的:
// 卡 id 一旦从卡池消失,玩家收藏里的那张就静默蒸发了。
// 所以这里只做一件事 —— 把重名的卡在界面上标出朝代,让「賈逵 · 魏」和
// 「賈逵 · 西漢」各自成立。真正该合并的那些,等有人愿意逐条过一遍史料再说。
//
// content.test.ts 钉住了当前数量,防止它悄悄变多。
export const AMBIGUOUS_NAMES: ReadonlySet<string> = (() => {
  const seen = new Map<string, number>()
  for (const c of COLLECTIBLE_CARDS) seen.set(c.name.zh, (seen.get(c.name.zh) ?? 0) + 1)
  return new Set([...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name))
})()

// 该不该在卡名旁边标朝代
export function needsDynastyTag(card: CardDef): boolean {
  return AMBIGUOUS_NAMES.has(card.name.zh)
}
