// 名局的**轻量索引** —— 只有 id、奖励数、以及有没有逆位/分歧点。
//
// 【它为什么单独存在】
// `historyBattles.ts` 是 35.4KB 的定义文件(牌组、修正、态势文案、令牌、
// 每一场的分歧点叙述)。而 `historyStore` 从里面只取三样东西:
//   · 这个 id 存不存在      · 通关发多少功勋/卡包      · 有没有逆位、有没有分歧点
// 重的那部分它一个字段都没碰。
//
// 但 store 是**首屏就要加载的**(标题页要显示「名局重现 5/18」这个角标),
// 于是 35.4KB 的定义跟着 store 一起进了首屏主包 —— 而主包正贴着 190KB 的上限。
// 见 ROADMAP 第 51 条:五个模式的 store 都是这个毛病,这里先开一刀。
//
// 【为什么不怕它和真数据走样】
// 这份表是手写的,而手写的表会烂 —— 所以 `historyIndex.test.ts` 逐场逐字段
// 双向钉住它和 `historyBattles.ts`:多一场、少一场、奖励改了、
// 新加了逆位而这里没跟上,四种情况都是红的。
// 换句话说它不是「另一份数据」,是**同一份数据的投影,并且有闸门保证投影是对的**。
//
// 【为什么不反过来,让 historyBattles 引这份索引】
// 那样确实零重复,但奖励数就得从战役定义里搬出来 ——
// 「这一仗打赢给多少」是读那份定义时最该看见的东西之一,不该跑到另一个文件里去。
// 宁可多一道闸门,不动数据的可读性。

export interface HistoryIndexEntry {
  /** 首通发的功勋 */
  merit: number
  /** 首通发的卡包 */
  packs: number
  /** 逆位挑战的功勋;没有这一项 = 这一场没有逆位 */
  reverse?: number
  /** 史实分歧点的功勋;没有这一项 = 这一场没有分歧点 */
  diverge?: number
}

export const HISTORY_INDEX: Record<string, HistoryIndexEntry> = {
  'hb-lize': { merit: 160, packs: 1 },
  'hb-changping': { merit: 200, packs: 1, reverse: 380, diverge: 380 },
  'hb-fanwu': { merit: 220, packs: 1 },
  'hb-handan': { merit: 240, packs: 1 },
  'hb-gaixia': { merit: 260, packs: 1, reverse: 360, diverge: 440 },
  'hb-kunyang': { merit: 260, packs: 1 },
  'hb-guandu': { merit: 280, packs: 1, reverse: 320, diverge: 400 },
  'hb-baima': { merit: 300, packs: 2, reverse: 300 },
  'hb-chibi': { merit: 320, packs: 2, reverse: 340, diverge: 420 },
  'hb-changban': { merit: 300, packs: 2, reverse: 340 },
  'hb-suiyang': { merit: 340, packs: 2, reverse: 360, diverge: 400 },
  'hb-huangtiandang': { merit: 360, packs: 2 },
  'hb-poyang': { merit: 420, packs: 2, reverse: 380 },
  'hb-taizhou': { merit: 460, packs: 2 },
  'hb-maling': { merit: 180, packs: 1 },
  'hb-xiangfan': { merit: 320, packs: 2 },
  'hb-yiling': { merit: 340, packs: 2 },
  'hb-feishui': { merit: 380, packs: 2 },
}

/** 名局总场数 —— 标题页那个「5/18」的分母。 */
export const HISTORY_BATTLE_COUNT = Object.keys(HISTORY_INDEX).length
