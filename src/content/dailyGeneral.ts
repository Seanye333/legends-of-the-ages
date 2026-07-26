// 每日一将:每天确定性地推一位历史名将 + 其列传,养成「每天打开看看」的习惯,
// 也把「全朝代真名将」这个卖点天天摆到脸前(兼作分享/营销素材)。
//
// 只从**有立绘 + 有列传**的签名卡里选(否则推出来是个白文案 + 首字兜底,砸招牌)。
// 选择走日期的 FNV-1a 哈希,与每日谜题同一套确定性做法 —— 同一天全体玩家看到同一位。
import type { CardDef } from '../engine/types'
import type { CardLore } from './generated/lore.gen'
import { LORE } from './generated/lore.gen'
import { CARDS_BY_ID, SIGNATURE_IDS } from './cards'

// 有列传的签名卡池。签名卡随包带立绘,LORE 覆盖签名卡;两者都齐才入池。
export const DAILY_GENERAL_POOL: string[] = SIGNATURE_IDS.filter(
  (id) => CARDS_BY_ID[id] && LORE[id]?.bio?.zh,
)

// 日期(YYYY-MM-DD)→ 一位名将 id(确定性,FNV-1a 取模)。池空返回 null。
export function dailyGeneralIdFor(dateStr: string): string | null {
  if (DAILY_GENERAL_POOL.length === 0) return null
  let h = 2166136261
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return DAILY_GENERAL_POOL[Math.abs(h >>> 0) % DAILY_GENERAL_POOL.length]
}

export interface DailyGeneral {
  card: CardDef
  lore: CardLore
}

// 日期 → 当日名将(卡 + 列传)。UI 传入本地日期(dayKey);缺任一则 null。
export function dailyGeneralFor(dateStr: string): DailyGeneral | null {
  const id = dailyGeneralIdFor(dateStr)
  if (!id) return null
  const card = CARDS_BY_ID[id]
  const lore = LORE[id]
  if (!card || !lore) return null
  return { card, lore }
}
