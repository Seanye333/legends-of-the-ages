import type { BondDef, CardDef, LocalizedText, RivalDef } from '../engine/types'
import { CLAN_QUORUM } from '../engine/types'
import { CARDS, CARDS_BY_ID } from './cards'
import { RIVAL_LORE } from './overrides/rivals'

// 羁绊与宿敌的**反向索引**。
//
// 卡面上只挂着「锚点 → 成员」这一个方向:刘备身上写着桃园结义,而关羽、张飞
// 身上什么都没有。于是图鉴里点开关羽,看不出他属于任何羁绊 ——
// 机制存在,但只有背下来的人找得到。
//
// 这一层把它翻过来:给定一张卡,列出他参与的所有关系(不管他是锚点还是成员)。
// 构筑器与图鉴都读它。放内容层而不是引擎层 —— 引擎只需要「凑齐了没有」,
// 不需要知道谁认识谁。

export interface BondRef {
  anchor: CardDef
  bond: BondDef
}
export interface RivalRef {
  anchor: CardDef
  rival: RivalDef
}

export const ALL_BONDS: BondRef[] = CARDS.filter((c) => c.bond).map((c) => ({
  anchor: c,
  bond: c.bond!,
}))

export const ALL_RIVALS: RivalRef[] = CARDS.filter((c) => c.rival).map((c) => ({
  anchor: c,
  rival: c.rival!,
}))

// 一条羁绊需要同时在场的全部人 = 锚点 + members
export function bondRoster(ref: BondRef): string[] {
  return [ref.anchor.id, ...ref.bond.members]
}

// 一条宿敌牵涉的两个人
export function rivalPair(ref: RivalRef): [string, string] {
  return [ref.anchor.id, ref.rival.foe]
}

const BONDS_BY_CARD = new Map<string, BondRef[]>()
for (const ref of ALL_BONDS) {
  for (const id of bondRoster(ref)) {
    const list = BONDS_BY_CARD.get(id) ?? []
    list.push(ref)
    BONDS_BY_CARD.set(id, list)
  }
}

const RIVALS_BY_CARD = new Map<string, RivalRef[]>()
for (const ref of ALL_RIVALS) {
  for (const id of rivalPair(ref)) {
    const list = RIVALS_BY_CARD.get(id) ?? []
    list.push(ref)
    RIVALS_BY_CARD.set(id, list)
  }
}

export function bondsOf(cardId: string): BondRef[] {
  return BONDS_BY_CARD.get(cardId) ?? []
}

export function rivalsOf(cardId: string): RivalRef[] {
  return RIVALS_BY_CARD.get(cardId) ?? []
}

export function rivalLore(rivalId: string): LocalizedText | undefined {
  return RIVAL_LORE[rivalId]
}

export function cardName(id: string): LocalizedText {
  return CARDS_BY_ID[id]?.name ?? { zh: id, en: id }
}

// 家族名册。卡面只写得下「曹氏(27 人)」,谁是那 27 个得能查得到 ——
// 否则玩家没法判断自己手里那两张到底算不算一家(同姓不等于同族)。
const CLAN_ROSTER = new Map<string, string[]>()
for (const c of CARDS) {
  if (!c.clan) continue
  const list = CLAN_ROSTER.get(c.clan.id)
  if (list) list.push(c.id)
  else CLAN_ROSTER.set(c.clan.id, [c.id])
}

export function clanRoster(clanId: string): string[] {
  return CLAN_ROSTER.get(clanId) ?? []
}

// ---------- 构筑器:这副牌能凑成哪几条 ----------

export interface DeckBond {
  ref: BondRef
  have: string[] // 卡组里已有的成员
  missing: string[] // 还缺的成员
}

// 只列出「至少已经带了一个人」的羁绊 —— 全卡池 31 条一次性铺出来没有意义,
// 玩家要看的是**离凑齐还差谁**。完整的排在前面,缺得少的排在前面。
export function deckBonds(cardIds: string[]): DeckBond[] {
  const inDeck = new Set(cardIds)
  const out: DeckBond[] = []
  for (const ref of ALL_BONDS) {
    const roster = bondRoster(ref)
    const have = roster.filter((id) => inDeck.has(id))
    if (have.length === 0) continue
    out.push({ ref, have, missing: roster.filter((id) => !inDeck.has(id)) })
  }
  return out.sort((a, b) => a.missing.length - b.missing.length || b.have.length - a.have.length)
}

// 这副牌里的家族。和羁绊的区别在于**没有「凑齐」这回事**:
// 家族只要两个不同的人同时在场就成立,所以要报的不是「还差谁」,
// 而是「你带了几个、够不够两个」。带一个的也要列 —— 那正是提示玩家
// 「再加一个同族就有增益了」的时刻,而这是构筑器唯一该说话的地方。
export interface DeckClan {
  id: string
  name: LocalizedText
  have: string[] // 卡组里这一族的成员(按不同的人算,不算份数)
  size: number // 全卡池里这一族有多少人
}

export function deckClans(cardIds: string[]): DeckClan[] {
  const byClan = new Map<string, DeckClan>()
  for (const id of new Set(cardIds)) {
    const clan = CARDS_BY_ID[id]?.clan
    if (!clan) continue
    const row = byClan.get(clan.id)
    if (row) row.have.push(id)
    else byClan.set(clan.id, { id: clan.id, name: clan.name, have: [id], size: clan.size })
  }
  // 成得了的排前面,同样成得了的人多的排前面
  return [...byClan.values()].sort(
    (a, b) => Number(b.have.length >= CLAN_QUORUM) - Number(a.have.length >= CLAN_QUORUM) || b.have.length - a.have.length,
  )
}

// 这副牌里带着的宿敌 —— 不需要凑齐(对手带不带不由你),只是提示「你带了戏」。
export function deckRivals(cardIds: string[]): RivalRef[] {
  const inDeck = new Set(cardIds)
  return ALL_RIVALS.filter((ref) => rivalPair(ref).some((id) => inDeck.has(id)))
}
