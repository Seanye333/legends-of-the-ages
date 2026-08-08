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

// ---------- 档案进度:按**史料字段**收,不按时代收 ----------
//
// 【为什么要第二条轴】
// 时代那条轴回答的是「这一块你收了多少」,而它对每一张卡是**等价**的 ——
// 一张有名言、有绝命诗、有兵器的卡,和一张只有名字的白板,在那条进度条上一样重。
// 可这个游戏最不可替代的东西恰恰就是那些字段。
// 换句话说:时代进度奖励**开包量**,档案进度奖励**你收到了谁**。
//
// 【为什么它必须收一个参数,而不是自己 import lore】
// `lore.gen.ts` 是 144KB,而它是**懒加载**的(见 loreLazy 的说明:
// 曾经被静态 import 进 CardInspect,于是每个首次打开游戏的人都在下载两千条传记)。
// 这个模块被收藏屏与讲堂屏静态 import —— 自己去 import lore 等于把那 144KB
// 拖回首屏,`npm run perf-budget` 会当场红。
// 所以判定层只是个纯函数,数据由调用方 `loadLore()` 之后喂进来。
export type LoreField = 'quote' | 'line' | 'poem' | 'arms'

export interface LoreProgress {
  field: LoreField
  name: LocalizedText
  owned: number
  total: number
  ratio: number
}

export const LORE_FIELD_NAME: Record<LoreField, LocalizedText> = {
  quote: { zh: '名言', en: 'Sayings' },
  line: { zh: '出戰台詞', en: 'Battle Cries' },
  poem: { zh: '絕命詩', en: 'Death Poems' },
  arms: { zh: '兵器坐騎', en: 'Arms & Mounts' },
}

export const LORE_FIELD_ORDER: LoreField[] = ['quote', 'line', 'arms', 'poem']

/**
 * 每种史料字段:全池有多少张带它、你收了几张。
 *
 * `lore` 是 `loadLore()` 的结果。**只数可收集卡** —— 衍生物身上也可能挂着
 * 一条台词,但玩家永远收不到它,把它算进分母就是一条永远走不满的进度条。
 */
export function loreProgress(
  lore: Record<string, Partial<Record<LoreField, unknown>>>,
  owned: Record<string, number>,
): LoreProgress[] {
  const total: Record<string, number> = {}
  const have: Record<string, number> = {}
  for (const c of COLLECTIBLE_CARDS) {
    const l = lore[c.id]
    if (!l) continue
    for (const f of LORE_FIELD_ORDER) {
      if (!l[f]) continue
      total[f] = (total[f] ?? 0) + 1
      if ((owned[c.id] ?? 0) > 0) have[f] = (have[f] ?? 0) + 1
    }
  }
  return LORE_FIELD_ORDER.map((field) => {
    const n = total[field] ?? 0
    const k = have[field] ?? 0
    return { field, name: LORE_FIELD_NAME[field], owned: k, total: n, ratio: n > 0 ? k / n : 0 }
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
