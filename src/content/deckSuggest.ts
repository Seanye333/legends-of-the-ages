import type { CardDef, Doctrine, LocalizedText } from '../engine/types'
import { CLAN_QUORUM, DECK_SIZE } from '../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'
import { ALL_BONDS, bondRoster, clanRoster, type BondRef } from './relations'
import { deckHealth } from './deckHealth'

// 以羁绊为种子的自动组卡。
//
// 【为什么需要】
// 构筑器现在会告诉你「桃園結義 缺 關羽」,但它只会**指出**,不会**帮忙** ——
// 而从零搭一副合法的三十张牌,对新玩家是整个游戏里最陡的一道坎:
// 要凑够张数、守住主义、守住份数上限,还得配出一条能打的曲线。
// 羁绊恰好是最好的种子:它自带一个叙事目标(重组一段历史),
// 而剩下的二十七张只是把这个目标撑起来的骨架。
//
// 【填充策略:先叙事,再曲线,最后补齐】
//   1. 羁绊成员优先(这是这副牌的理由);
//   2. 按**费用曲线**填 —— 目标形状抄六套预组的实测值(见 deckHealth 的说明),
//      而不是「有什么放什么」:后者产出的牌组曲线奇形怪状,新手打两把就弃坑;
//   3. 同费用档内优先带效果/关键词的卡,再优先身材好的;
//   4. 还差就放宽 —— 宁可给一副能打的牌,也不要报「凑不出来」。
//
// 【只用你拥有的卡】
// 建议出来的牌必须**立刻能存能打**。给一副含未拥有卡的「理想卡组」毫无用处 ——
// 玩家点保存会直接被合法性校验挡回来。

// 目标曲线:每个费用档要几张。抄六套预组的实测分布(1-6 费为主,曲线略前倾)。
const CURVE: [number, number][] = [
  [1, 2],
  [2, 5],
  [3, 6],
  [4, 5],
  [5, 6],
  [6, 4],
  [7, 2],
]

function playable(card: CardDef, doctrine: Doctrine): boolean {
  if (card.token) return false
  return card.doctrine === 'neutral' || card.doctrine === doctrine
}

// 同档内的取舍:带效果 > 带关键词 > 身材大。刻意不看稀有度 ——
// 稀有度是掉率标签,不是强度标签(费用曲线重做之后身材由费用唯一决定)。
function cardScore(c: CardDef): number {
  let v = 0
  if (c.battlecry || c.spell || c.deathrattle || c.aura || c.choose) v += 3
  if (c.onAttack || c.onSpellCast || c.endOfTurn || c.startOfTurn) v += 2
  v += c.keywords.length * 1.5
  v += ((c.attack ?? 0) + (c.health ?? 0)) * 0.1
  return v
}

export interface SuggestResult {
  cardIds: string[]
  // 羁绊成员里**没能放进去**的(你没有那张卡)。UI 要照实说,不能假装凑齐了。
  missing: string[]
}

export function suggestDeckForBond(
  ref: BondRef,
  doctrine: Doctrine,
  owned: Record<string, number>,
): SuggestResult {
  return fillDeck(bondRoster(ref), doctrine, owned)
}

// 组卡的共同骨架:先放种子(羁绊成员 / 同族),再按曲线填,最后放宽补齐。
// 抽出来是因为家族那条路线**只有种子不同**,后面两步一模一样 ——
// 复制一份的话,以后调曲线只会调到其中一条上(那正是「两套事实」的开头)。
function fillDeck(seedIds: string[], doctrine: Doctrine, owned: Record<string, number>): SuggestResult {
  const have = (id: string) => owned[id] ?? 0
  const limitOf = (id: string) => (CARDS_BY_ID[id]?.rarity === 'legendary' ? 1 : 2)
  const picked: string[] = []
  const used = new Map<string, number>()

  const take = (id: string): boolean => {
    if (picked.length >= DECK_SIZE) return false
    const card = CARDS_BY_ID[id]
    if (!card || !playable(card, doctrine)) return false
    const n = used.get(id) ?? 0
    if (n >= Math.min(limitOf(id), have(id))) return false
    used.set(id, n + 1)
    picked.push(id)
    return true
  }

  // 1) 种子优先 —— 这是这副牌的理由
  const missing: string[] = []
  for (const id of seedIds) {
    if (!take(id)) missing.push(id)
  }

  // 2) 按曲线填
  const pool = COLLECTIBLE_CARDS.filter((c) => playable(c, doctrine) && have(c.id) > 0).sort(
    (a, b) => cardScore(b) - cardScore(a) || a.id.localeCompare(b.id),
  )
  for (const [cost, want] of CURVE) {
    let taken = picked.filter((id) => (CARDS_BY_ID[id]?.cost ?? -1) === cost).length
    for (const c of pool) {
      if (taken >= want || picked.length >= DECK_SIZE) break
      if (c.cost !== cost) continue
      if (take(c.id)) taken++
    }
  }

  // 3) 还差就放宽:宁可给一副能打的牌,也不要报「凑不出来」
  for (const c of pool) {
    if (picked.length >= DECK_SIZE) break
    take(c.id)
  }

  return { cardIds: picked, missing }
}

// ---------- 以家族为种子 ----------
//
// 和羁绊那条路线的区别只有一处,但很关键:**羁绊要凑齐,家族只要凑够两个**。
// 所以「按家族组卡」不报 missing —— 手上有两个同族的人,这副牌就已经成立了,
// 再报「你还缺另外二十五个曹」纯属添乱。多余的族人当作优先填充位。
export function suggestDeckForClan(
  clanId: string,
  doctrine: Doctrine,
  owned: Record<string, number>,
): SuggestResult {
  const roster = clanRoster(clanId).filter(
    (id) => (owned[id] ?? 0) > 0 && playable(CARDS_BY_ID[id] ?? ({} as CardDef), doctrine),
  )
  return fillDeck(roster, doctrine, owned)
}

// 给 UI 排序用:**已经凑得起来**(手上有 ≥CLAN_QUORUM 个不同族人)的家族,
// 人多的排前面。全池 156 个族一次铺出来没有意义 —— 玩家能用的只有手上有的那几族。
export function clansByReadiness(
  doctrine: Doctrine,
  owned: Record<string, number>,
): { id: string; name: LocalizedText; have: number; size: number }[] {
  const seen = new Map<string, { id: string; name: LocalizedText; have: number; size: number }>()
  for (const c of COLLECTIBLE_CARDS) {
    if (!c.clan || (owned[c.id] ?? 0) === 0 || !playable(c, doctrine)) continue
    const row = seen.get(c.clan.id)
    if (row) row.have++
    else seen.set(c.clan.id, { id: c.clan.id, name: c.clan.name, have: 1, size: c.clan.size })
  }
  return [...seen.values()]
    .filter((x) => x.have >= CLAN_QUORUM)
    .sort((a, b) => b.have - a.have || a.id.localeCompare(b.id))
}

// 给 UI 排序用:能凑得**最齐**的羁绊排在前面。
export function bondsByReadiness(
  doctrine: Doctrine,
  owned: Record<string, number>,
): { ref: BondRef; have: number; total: number }[] {
  return ALL_BONDS.map((ref) => {
    const roster = bondRoster(ref)
    const usable = roster.filter(
      (id) => (owned[id] ?? 0) > 0 && playable(CARDS_BY_ID[id] ?? ({} as CardDef), doctrine),
    )
    return { ref, have: usable.length, total: roster.length }
  })
    .filter((x) => x.have > 0)
    .sort((a, b) => b.have - a.have || a.total - b.total)
}

// 体检:建议出来的牌也要过一遍,UI 可以直接显示
export { deckHealth }
