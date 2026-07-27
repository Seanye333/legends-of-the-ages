import type { LocalizedText } from '../engine/types'
import { COLLECTIBLE_CARDS } from './cards'
import { ERA_NAME, ERA_OF, type Era } from './eras'

// 收藏度 —— 给 2,300 张卡一个「收集它们」的理由。
//
// 【为什么现在没有】
// 卡池有两千三百张,而收藏系统只回答一个问题:「这张你有没有」。
// 没有任何东西回答「你收了多少」——于是开包的唯一价值就是「能不能组出更强的牌」,
// 而绝大多数卡永远不会进任何一副牌组。那些卡对玩家来说等于不存在。
//
// 【为什么按时代块而不是按朝代/主义】
// 朝代有 18 个,单个只有 37~161 张,一条进度条要么太快满要么永远不动;
// 主义只有 6 个但每个都上百张,同样太粗。时代块(6 块)是既有的分法,
// 每块二百到六百张,进度条走得动、也走得完 —— 而且它和播种、檄文、音乐用同一张表。
//
// 【奖励发什么】
// 只发功勋,不发卡包 —— 卡包产出会直接冲击「一局一包」的基线(见 ARCHITECTURE 经济一节)。
// 三档:三成、六成、全收。全收那一档给得很重,因为它是真的要花几百包。

export interface EraProgress {
  era: Era
  name: LocalizedText
  owned: number
  total: number
  ratio: number
}

const TOTALS: Record<string, number> = {}
for (const c of COLLECTIBLE_CARDS) {
  const era = ERA_OF[c.dynasty]
  TOTALS[era] = (TOTALS[era] ?? 0) + 1
}

export const ERA_ORDER: Era[] = [
  'pre-qin',
  'qin-han',
  'three-kingdoms',
  'sui-tang',
  'song-yuan',
  'ming-qing',
]

export function eraProgress(owned: Record<string, number>): EraProgress[] {
  const have: Record<string, number> = {}
  for (const c of COLLECTIBLE_CARDS) {
    if ((owned[c.id] ?? 0) > 0) {
      const era = ERA_OF[c.dynasty]
      have[era] = (have[era] ?? 0) + 1
    }
  }
  return ERA_ORDER.map((era) => {
    const total = TOTALS[era] ?? 0
    const n = have[era] ?? 0
    return {
      era,
      name: ERA_NAME[era],
      owned: n,
      total,
      ratio: total > 0 ? n / total : 0,
    }
  })
}

// 三档门槛与奖励。id 形如 `cg-three-kingdoms-60`,存进 claimed 列表。
export const GOAL_TIERS: { ratio: number; merit: number; label: LocalizedText }[] = [
  { ratio: 0.3, merit: 150, label: { zh: '三成', en: '30%' } },
  { ratio: 0.6, merit: 400, label: { zh: '六成', en: '60%' } },
  { ratio: 1, merit: 1500, label: { zh: '全收', en: 'complete' } },
]

export function goalId(era: Era, ratio: number): string {
  return `cg-${era}-${Math.round(ratio * 100)}`
}

export interface ClaimableGoal {
  id: string
  era: Era
  name: LocalizedText
  tierLabel: LocalizedText
  merit: number
}

// 已达成但还没领的。UI 只需要遍历它。
export function claimableGoals(
  owned: Record<string, number>,
  claimed: string[],
): ClaimableGoal[] {
  const out: ClaimableGoal[] = []
  for (const p of eraProgress(owned)) {
    for (const tier of GOAL_TIERS) {
      if (p.ratio + 1e-9 < tier.ratio) continue
      const id = goalId(p.era, tier.ratio)
      if (claimed.includes(id)) continue
      out.push({ id, era: p.era, name: p.name, tierLabel: tier.label, merit: tier.merit })
    }
  }
  return out
}
