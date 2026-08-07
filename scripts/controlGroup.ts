// 单卡强度的**对照组** —— 纯函数,配 controlGroup.test.ts。
//
// 【为什么需要一个对照组,而不是一个拍出来的区间】
// `sim-cards` 的 Δ 是「把这张牌换进预组之后胜率动了多少」。
// 它的注释一直写着「合理区间大约是 ±4 个百分点」—— 那个 ±4 是**估的**,
// 从来没有任何东西支撑它。而它错了就会导致两类相反的错误:
//   · 区间估窄了 → 一堆正常卡被判成超模,照着改就是把卡池削平;
//   · 区间估宽了 → 真的超模卡混过去。
//
// 真正的答案只能量:拿一批**白板武将**(没有关键词、没有任何脚本、
// 没有光环羁绊宿敌阵形)换进同一套预组,它们的 Δ 分布就是这把尺子的零点。
// 2026-08-07 第一次量出来是 `−4.8 ~ +6.5,中位 −1.0`,而不是 ±4。
//
// 【为什么要做成一条命令,而不是量一次记在文档里】
// 因为**任何全局规则改动都可能把这条线挪走**,而挪没挪**只能量,不能推**。
// 同一天落地的后手补偿(起手手牌 −1 费 + 3 点护甲)就把十一张已经调平的卡
// 整体推了一遍,其中 姜維 从 +7.8 弹回 +13.5 —— 零点跟着动是完全合理的猜测。
// 一个「改完规则重新量一次零点」的动作,必须便宜到没有理由跳过 ——
// 所以是 `CONTROL=1 npm run sim-cards`,不是一段要重写的临时脚本。
//
// 【补偿落地之后重量的结果:零点几乎没动】
//   补偿前  −4.8 ~ +6.5,中位 −1.0
//   补偿后  −3.2 ~ +6.7,中位 −1.3
// **那个合理的猜测是错的**,而这正是量一次的价值:补偿把**单张卡**推了一大截,
// 却没有推动尺子的零点 —— 也就是说那一轮复验是拿一把仍然有效的尺子判的。
// 要是不量,只能在「零点动了所以复验结论不算数」和「大概没动吧」之间瞎选一个。
import type { CardDef } from '../src/engine/types'

/**
 * 白板武将:身材之外**什么都没有**。
 *
 * 逐个字段列出来而不是写「没有任何可选字段」,是因为漏掉一个就会把
 * 一张有效果的卡混进对照组,而对照组被污染的表现是**零点悄悄偏移** ——
 * 不报错,只是后面每一张卡的判决都跟着偏。
 */
export function isVanilla(c: CardDef): boolean {
  return (
    c.type === 'general' &&
    !c.token &&
    c.keywords.length === 0 &&
    !c.battlecry &&
    !c.deathrattle &&
    !c.spell &&
    !c.endOfTurn &&
    !c.startOfTurn &&
    !c.onDamaged &&
    !c.onAttack &&
    !c.onSpellCast &&
    !c.combo &&
    !c.choose &&
    !c.secret &&
    !c.quest &&
    !c.aura &&
    !c.bond &&
    !c.rival &&
    !c.formation &&
    !c.enrage &&
    !c.spellDamage &&
    !c.handGrowth &&
    (c.overload ?? 0) === 0 &&
    (c.supplyCost ?? 0) === 0
  )
}

/**
 * 每个费用档挑一张白板,**确定性地挑**(按 collectorNo 排序取中位那张)——
 * 两次跑必须挑到同一批,否则零点本身就带着抽样噪声,没法跨版本比。
 *
 * 只挑中立:别的主义会各自换到自己的预组当基准,而对照组要的是**同一把尺子**。
 */
export function pickControls(cards: CardDef[], costs: number[]): CardDef[] {
  const out: CardDef[] = []
  for (const cost of costs) {
    const list = cards
      .filter((c) => c.doctrine === 'neutral' && c.cost === cost && isVanilla(c))
      .sort((a, b) => a.collectorNo - b.collectorNo)
    if (list.length > 0) out.push(list[Math.floor(list.length / 2)])
  }
  return out
}

export interface Band {
  lo: number
  hi: number
  median: number
  n: number
}

/**
 * 对照组的实际跨度 —— 这就是「正常卡长什么样」。
 * 判一张卡超不超模,拿它和这个跨度比,而不是和一个拍出来的 ±4 比。
 */
export function band(deltas: number[]): Band {
  if (deltas.length === 0) return { lo: 0, hi: 0, median: 0, n: 0 }
  const s = [...deltas].sort((a, b) => a - b)
  const mid = s.length >> 1
  return {
    lo: s[0],
    hi: s[s.length - 1],
    median: s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2,
    n: s.length,
  }
}

/** 这个 Δ 落在对照组跨度之内吗 —— 落在里面就是「和普通卡没区别」。 */
export function withinBand(delta: number, b: Band): boolean {
  return b.n > 0 && delta >= b.lo && delta <= b.hi
}
