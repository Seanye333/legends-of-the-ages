// 身材对照卡 —— 「一点攻击 / 一点生命值多少胜率」的探针设计。
//
// 【为什么要造卡,不能用现成的卡池】
// 卡池里的白板卡不能回答这个问题:身材总点数是**费用的函数**
// (`statBudget(cost)`,攻+血 ≈ 2×费+1,见铁律 3)。同一费用档里几乎所有白板卡
// 的总点数都一样,只是攻血劈法不同 —— 也就是说「总点数」这一列**没有方差**,
// 回归不出斜率。跨费用档去比又立刻被费用本身混杂。
//
// 所以必须**主动打破费用与身材的绑定**:同一个费用档上造一批总点数不同的白板卡。
// 这些卡只注入 worker 的卡库(`createGame` 接受 lib 参数),不进卡池、
// 不进快照、不改任何内容文件 —— 零平衡风险。
//
// 【这个数字有什么用】
// `price-cards` 的点数表 2026-08-06 第一次被实测校准过,但**落不了地**:
// 归组只量得到效果,量不到身材,而费用曲线是由以身材为主的中位卡定的。
// 于是效果整体涨三倍、曲线不动,每张带效果的牌都显得超模(偏离从 8.3% 涨到 23.8%)。
// 拿到「一点身材值多少胜率」就能把效果和身材放到同一把尺上。
import type { CardDef } from '../src/engine/types'

export interface Probe {
  card: CardDef
  cost: number
  attack: number
  health: number
}

/** `statBudget` 的复刻:攻+血 ≈ 2×费+1。这里只用来决定探针围绕哪个中心撒。 */
export const budgetOf = (cost: number): number => 2 * cost + 1

/**
 * 造一张纯白板武将 —— 没有关键词、没有效果、中立主义(进哪套预组都合法)。
 *
 * **必须是纯白板**:探针上但凡带一点效果,量到的就是「效果 + 身材」的合力,
 * 而这次要的恰恰是把身材单独拎出来。
 */
export function vanilla(cost: number, attack: number, health: number): CardDef {
  return {
    id: `probe-c${cost}-a${attack}-h${health}`,
    collectorNo: 900000 + cost * 1000 + attack * 50 + health,
    name: { zh: `對照 ${cost}費 ${attack}/${health}`, en: `Probe ${cost}c ${attack}/${health}` },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost,
    attack,
    health,
    keywords: [],
  }
}

/**
 * 一个费用档上的探针组。
 *
 * 设计要点:
 *   · **总点数**要跨开(预算 ±2),否则斜率没有方差可用;
 *   · 同一个总点数下**劈法**也要跨开(偏攻 / 均衡 / 偏血),
 *     这样攻和血的系数才分得开 —— 只撒均衡点的话两列完全共线,回归解不动;
 *   · 攻和血都不小于 1(0 攻的白板在贪心 AI 眼里是另一种东西,不是「少一点身材」)。
 */
export function probesForCost(cost: number): Probe[] {
  const B = budgetOf(cost)
  const out: Probe[] = []
  for (const total of [B - 2, B, B + 2]) {
    if (total < 2) continue
    // 偏攻 / 均衡 / 偏血
    const splits = [
      [total - 1, 1],
      [Math.ceil(total / 2), Math.floor(total / 2)],
      [1, total - 1],
    ]
    for (const [a, h] of splits) {
      if (a < 1 || h < 1) continue
      // 同一档里劈法可能撞车(总点数小的时候),去重
      if (out.some((p) => p.attack === a && p.health === h)) continue
      out.push({ card: vanilla(cost, a, h), cost, attack: a, health: h })
    }
  }
  return out
}

/**
 * 默认在 2 / 4 / 6 费三档上撒。
 *
 * 三档而不是一档:斜率有可能随费用变化(高费局面上一点身材的边际价值未必相同),
 * 一档量出来的数字没法说是「通用的」。三档一致才敢当常数用。
 */
export function defaultProbes(costs: number[] = [2, 4, 6]): Probe[] {
  return costs.flatMap((c) => probesForCost(c))
}
