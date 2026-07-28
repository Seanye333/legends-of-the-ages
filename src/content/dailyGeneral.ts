// 每日一将:每天确定性地推一位历史名将 + 其列传,养成「每天打开看看」的习惯,
// 也把「全朝代真名将」这个卖点天天摆到脸前(兼作分享/营销素材)。
//
// 只从**有立绘 + 有列传**的签名卡里选(否则推出来是个白文案 + 首字兜底,砸招牌)。
// 选择走日期的 FNV-1a 哈希,与每日谜题同一套确定性做法 —— 同一天全体玩家看到同一位。
import type { CardDef } from '../engine/types'
import type { CardLore } from './generated/lore.gen'
import { LORE } from './generated/lore.gen'
import type { LocalizedText } from '../engine/types'
import { CARDS_BY_ID, SIGNATURE_IDS } from './cards'
import { ALL_BONDS, ALL_RIVALS, bondRoster, rivalLore, rivalPair } from './relations'

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

// ---------- 今日戰事 ----------
//
// 每日一将推的是**一个人**。而这个游戏真正独有的素材是**关系**:
// 31 条羁绊与 29 对宿敌,每一条背后都有一段真事,而它们只在对局里偶然撞见。
// 「今日战事」每天推一条 —— 同一天全体玩家看到同一条(与每日一将同一套确定性哈希),
// 于是它可以被讨论、被截图、被当成一句可以说出口的话。
//
// 宿敌优先:它带史料,而羁绊只有名字与成员。池子里两者都有,权重由数量自然决定。
export interface DailyStory {
  kind: 'bond' | 'rival'
  title: LocalizedText
  people: string[] // 卡 id
  lore?: LocalizedText // 宿敌才有
}

export function dailyStoryFor(dateStr: string): DailyStory | null {
  const pool: DailyStory[] = [
    ...ALL_RIVALS.map((r) => ({
      kind: 'rival' as const,
      title: r.rival.name,
      people: rivalPair(r),
      lore: rivalLore(r.rival.id),
    })),
    ...ALL_BONDS.map((b) => ({
      kind: 'bond' as const,
      title: b.bond.name,
      people: bondRoster(b),
    })),
  ]
  if (pool.length === 0) return null
  // 与每日一将同一套 FNV-1a,但换个盐 —— 否则两者会同步跳动,看起来像只换了一样东西
  let h = 2166136261
  const salted = `story#${dateStr}`
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return pool[Math.abs(h >>> 0) % pool.length]
}
