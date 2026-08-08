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

// ---------- 以「部族」为种子(兵种 / 降将)----------
//
// 【它和上面两条的区别:种子**不是名单,是判据**】
// 羁绊要点名的那几个人,家族要同一族的人 —— 两者都是先有一份 id 名单。
// 兵种与降将不是:它们是**卡面上的一个标签**,符合的人有一两百个。
// 所以这里的种子不是「谁必须进」,而是「优先把符合的塞满」,
// 然后照样交给 fillDeck 的曲线那一步收口 —— 一副全是骑兵、曲线却塌了的牌
// 打不赢任何人,而新玩家不会知道是曲线的问题,只会觉得「骑兵流不行」。
//
// 【为什么优先给身材好的】
// 部族这一档没有「凑齐」的概念,所以种子多放几张少放几张都合法。
// 那就该按牌本身的好坏排 —— cardScore 与曲线那一步用的是同一把尺子,
// 不然会出现「种子塞了一堆废骑兵,曲线那步再去挑好牌」的怪事。
//
// 上限 TRIBE_SEED_CAP:留够位置给曲线。种子铺满 30 张的话后面两步等于没跑,
// 而那正是「一副能打的牌」和「一堆同类卡」的分界。
const TRIBE_SEED_CAP = 18

function tribeSeed(
  match: (c: CardDef) => boolean,
  doctrine: Doctrine,
  owned: Record<string, number>,
): string[] {
  return COLLECTIBLE_CARDS.filter(
    (c) => playable(c, doctrine) && (owned[c.id] ?? 0) > 0 && match(c),
  )
    .sort((a, b) => cardScore(b) - cardScore(a) || a.id.localeCompare(b.id))
    .slice(0, TRIBE_SEED_CAP)
    .map((c) => c.id)
}

/** 以兵种为种子。骑兵/步兵/弓/水军/器械/军师 —— 卡面上现成的标签。 */
export function suggestDeckForTroop(
  troop: NonNullable<CardDef['troop']>,
  doctrine: Doctrine,
  owned: Record<string, number>,
): SuggestResult {
  return fillDeck(tribeSeed((c) => c.troop === troop, doctrine, owned), doctrine, owned)
}

/**
 * 以降将为种子。
 *
 * 这一条比兵种更值得摆出来:降将横跨六个主义、从三国到清初,
 * 唯一的共同点是那个人换过阵营(见 overrides/defectors.ts)——
 * 也就是说**任何主公都组得起来**,而兵种/羁绊都有主义的门槛。
 */
export function suggestDeckForDefectors(
  doctrine: Doctrine,
  owned: Record<string, number>,
): SuggestResult {
  return fillDeck(tribeSeed((c) => c.defector === true, doctrine, owned), doctrine, owned)
}

/** 给 UI 排序用:手上这个主义下每个兵种各有几张,多的排前面。 */
export function troopsByReadiness(
  doctrine: Doctrine,
  owned: Record<string, number>,
): { troop: NonNullable<CardDef['troop']>; have: number }[] {
  const tally = new Map<NonNullable<CardDef['troop']>, number>()
  for (const c of COLLECTIBLE_CARDS) {
    if (!c.troop || (owned[c.id] ?? 0) === 0 || !playable(c, doctrine)) continue
    tally.set(c.troop, (tally.get(c.troop) ?? 0) + 1)
  }
  return [...tally.entries()]
    .map(([troop, have]) => ({ troop, have }))
    // 少于这个数就不必摆出来 —— 三张同兵种撑不起一副牌,列出来只是让人白点一次
    .filter((x) => x.have >= 6)
    .sort((a, b) => b.have - a.have || a.troop.localeCompare(b.troop))
}

/** 手上有几张降将(同一主义下)。少于 6 张不摆出来,理由同上。 */
export function defectorReadiness(doctrine: Doctrine, owned: Record<string, number>): number {
  return COLLECTIBLE_CARDS.filter(
    (c) => c.defector && (owned[c.id] ?? 0) > 0 && playable(c, doctrine),
  ).length
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
