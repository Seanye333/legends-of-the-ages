import type { Doctrine } from '../engine/types'
import { COLLECTIBLE_CARDS } from './cards'

// 远征关间选牌:每通一关、选完宝物后,再从三张里挑一张加进卡组。
//
// 这是远征此前最大的缺口 —— 卡组开局定死、一趟打下来毫无变化,
// 而「牌组在一趟里长出来」正是 roguelike 的核心黏性。
//
// 池 = 该主义 + 中立的可收集卡(与 bossDeck 同一口径),**不看玩家收藏** ——
// 远征和竞技场一样是「现给的牌」,这样没有收藏的新玩家也玩得下去。
// 抽取走 run 的 rngState(LCG),整趟可复现。

export function draftPool(doctrine: Doctrine | undefined): string[] {
  return COLLECTIBLE_CARDS.filter(
    (c) => !doctrine || c.doctrine === doctrine || c.doctrine === 'neutral',
  )
    .sort((a, b) => a.collectorNo - b.collectorNo)
    .map((c) => c.id)
}

// 从 rngState 确定性地抽 3 张不重复的候选
export function offerCards(
  doctrine: Doctrine | undefined,
  rngState: number,
  count = 3,
): { offered: string[]; next: number } {
  const pool = draftPool(doctrine)
  let s = rngState >>> 0
  const picks: string[] = []
  let guard = 0
  while (picks.length < count && pool.length > picks.length && guard++ < 200) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    const id = pool[Math.floor((s / 0x100000000) * pool.length)]
    if (id && !picks.includes(id)) picks.push(id)
  }
  return { offered: picks, next: s }
}
