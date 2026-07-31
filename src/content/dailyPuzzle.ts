// 每日谜题:从挖矿池(dailyPuzzles.ts)里按日期确定性地选一题,并把生成题包装成
// 与手搓题同构的 LethalPuzzle(补合成的标题/情境/提示),这样 UI 与结算面板零改动复用。
import type { LethalPuzzle } from './lethalPuzzles'
import { LESSONS_BY_ID } from './lessons'
import { LETHAL_PUZZLES_BY_ID } from './lethalPuzzles'
import { DAILY_POOL, type GeneratedPuzzle } from './dailyPuzzles'
import { HEROES_BY_ID } from './overrides/heroes'
import { CARDS_BY_ID } from './cards'
import type { LocalizedText } from '../engine/types'

// 把残局读成一句话。三个数字里挑**最扎眼的那一个**说 ——
// 一句话里塞满「你 3 张手牌、5 费、对面 2 个守护、你 1 个单位」谁也不会读。
function describePosition(g: GeneratedPuzzle): LocalizedText {
  const me = g.scenario.players[g.scenario.activePlayer]
  const foe = g.scenario.players[g.scenario.activePlayer === 0 ? 1 : 0]
  const foeHp = foe.heroHp + (foe.armor ?? 0)
  const guards = foe.board.filter((u) => CARDS_BY_ID[u.defId]?.keywords.includes('guard')).length
  if (guards >= 2) {
    return {
      zh: `對面两道守护墙,敌主帅还剩 ${foeHp} —— 先拆墙,还是绕过去?`,
      en: `Two Guards in the way and ${foeHp} left on the enemy hero — break through, or go around?`,
    }
  }
  if (guards === 1) {
    return {
      zh: `一堵守护挡在前面,敌主帅剩 ${foeHp}。`,
      en: `One Guard stands between you and ${foeHp} health.`,
    }
  }
  if (me.board.length === 0) {
    return {
      zh: `你场上空无一人,手里 ${me.hand.length} 张、${me.mana} 费 —— 全在这一手里。`,
      en: `An empty board, ${me.hand.length} cards and ${me.mana} mana — it is all in your hand.`,
    }
  }
  if (me.hand.length >= 6) {
    return {
      zh: `手里 ${me.hand.length} 张牌只有 ${me.mana} 费,敌主帅剩 ${foeHp} —— 挑得出那几张吗?`,
      en: `${me.hand.length} cards, ${me.mana} mana, ${foeHp} on the enemy hero — which ones?`,
    }
  }
  return {
    zh: `你场上 ${me.board.length} 员、手里 ${me.hand.length} 张,敌主帅剩 ${foeHp}。`,
    en: `${me.board.length} on the field, ${me.hand.length} in hand, ${foeHp} on the enemy hero.`,
  }
}

// 生成题 → LethalPuzzle:标题取我方主公名,提示走通用文案(挖出来的题没有人写的旁白)
export function toLethalPuzzle(g: GeneratedPuzzle): LethalPuzzle {
  const hero = HEROES_BY_ID[g.heroes[0]]
  const heroZh = hero?.name.zh ?? g.heroes[0]
  const heroEn = hero?.name.en ?? g.heroes[0]
  return {
    id: g.id,
    title: { zh: `${heroZh} · 杀机`, en: `${heroEn}'s Opening` },
    // 局面**从残局本身读出来**,而不是所有挖矿题共用一句。
    //
    // 每日三题上线后三条描述一字不差(「取自真实对局的残局 —— 这一回合就能了结」),
    // 连着三条看着像 bug,而且它什么都没告诉玩家:三道题的难点根本不一样,
    // 有的是「对面站着一堵墙」,有的是「你手里七张牌但只有四费」。
    // 这几个数字残局里现成就有,不读白不读。
    situation: describePosition(g),
    hint: {
      zh: '一回合之内存在必杀线,出牌、主公技、攻击次序都要算到。',
      en: 'A lethal exists this turn — weigh cards, hero power, and attack order.',
    },
    difficulty: g.difficulty,
    heroes: g.heroes,
    scenario: g.scenario,
  }
}

// 日期工具搬去了 dayKey.ts —— 那里不 import 任何内容数据。
// 这里 re-export 只为了不破坏既有引用;**新代码请直接从 dayKey 引**,
// 从这里引会把 60 道残局(57KB)一起拖进你的 chunk。
export { dayKey, daysBetween } from './dayKey'

function hash32(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}

// 日期 → 池中一题(确定性,FNV-1a 哈希取模)。池空则返回 null。
export function dailyPuzzleFor(dateStr: string): LethalPuzzle | null {
  if (DAILY_POOL.length === 0) return null
  return toLethalPuzzle(DAILY_POOL[hash32(dateStr) % DAILY_POOL.length])
}

// 每日**三题**。
//
// 【为什么从一题改成三题】
// 一天一题的问题是它只有两个状态:没做 / 做完了。做完之后这一屏当天就死了,
// 而每日内容的价值恰恰在于「今天还有事可做」。三题给了中间状态。
//
// 【为什么不是易/中/难】
// 挖矿池里 24 道**全部是 difficulty 2** —— 池子本身没有难度梯度。
// 硬编一个「初/中/难」的标签是在假装有一条我们保证不了的曲线。
// 这里只做一件能保证的事:按**残局的复杂度**(要考虑的东西有多少)排序,
// 于是三题确实是由简到繁的,但名字叫「三阵」而不是「三个难度」。
//
// 【为什么奖励是平均的】
// 同上 —— 三题同档,按难度差别给钱就是在给一个不存在的梯度定价。
// 三题合计仍是原来一题的 30 功勋,**这次改动对功勋经济零净影响**。
export { DAILY_SLOTS } from './dayKey'
import { DAILY_SLOTS } from './dayKey'

// 复杂度代理:手牌 + 场面(双方)。要考虑的东西越多,解起来越费劲。
// 这是个代理不是真难度 —— 但它是确定性的、不需要人工标注的,
// 而且和「这一题看起来吓不吓人」高度相关。
function complexityOf(p: LethalPuzzle): number {
  const [me, foe] = p.scenario.players
  return me.hand.length + me.board.length * 2 + foe.board.length * 2
}

// 「YYYY-MM-DD」→ 儒略日式的天数序号。
// 不用 Date:这一层要对同一个字符串**永远**给同一个数,而 Date 会受时区影响。
// 算法是标准的 days-from-civil(Howard Hinnant),3 月为年首以避开闰日特判。
function dayNumber(dateStr: string): number {
  const [ys, ms, ds] = dateStr.split('-')
  const y0 = Number(ys)
  const m = Number(ms)
  const d = Number(ds)
  if (!Number.isFinite(y0) || !Number.isFinite(m) || !Number.isFinite(d)) return 0
  const y = y0 - (m <= 2 ? 1 : 0)
  const era = Math.floor(y / 400)
  const yoe = y - era * 400
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

export function dailyPuzzleSetFor(dateStr: string): LethalPuzzle[] {
  if (DAILY_POOL.length === 0) return []
  const n = Math.min(DAILY_SLOTS, DAILY_POOL.length)

  // 【为什么不是每天独立抽】
  // 从前每天各自哈希取三道,只保证**同一天内**不重复 —— 跨天完全不管,
  // 于是第二周就开始重复见过的题。而「连续 7 天解每日谜题」是唯一一条
  // 连续性成就,重复题让它变成走过场。
  //
  // 改成按**周期轮转**:把整个池子按当前轮次做一次确定性洗牌,
  // 一天取三道往后走,走完一轮才回头。60 道池 = 20 天不重复,
  // 而且每一轮的顺序不同(种子里带轮次号),不会年复一年是同一张表。
  // 一条**固定**的全局顺序,每天往后取 n 道、走到头绕回来。
  //
  // 试过「每轮重新洗牌」,退回来了:轮次边界上仍然会出现
  // 「上一轮倒数第二天的题,下一轮第二天又来了」—— 隔 4 天重现,
  // 体感上和不防重复没区别。固定顺序反而更好:重复间隔**恒为**
  // 池子大小 ÷ 每天题数(现在 60÷3 = 20 天),没有边界特例。
  // 顺序本身洗过一次(种子固定),所以不是按挖矿顺序排的。
  const order = DAILY_POOL.map((_, i) => i)
  let seed = hash32('qiangu-daily-order')
  for (let i = order.length - 1; i > 0; i--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[order[i], order[j]] = [order[j], order[i]]
  }

  const day = dayNumber(dateStr)
  const len = order.length
  const start = (((day * n) % len) + len) % len
  const picked = Array.from({ length: n }, (_, k) => order[(start + k) % len])
  return picked
    .map((i) => toLethalPuzzle(DAILY_POOL[i]))
    .sort((a, b) => complexityOf(a) - complexityOf(b))
}

// 三阵的名字。刻意不叫「简单/普通/困难」—— 见上面为什么。
export const SLOT_NAME = [
  { zh: '初陣', en: 'First Position' },
  { zh: '中陣', en: 'Second Position' },
  { zh: '決陣', en: 'Third Position' },
] as const

// MatchScreen 用:按 id 找题面(手搓题 + 生成题都能找到,供结算面板取标题/提示)
export function puzzleDefById(id: string): LethalPuzzle | undefined {
  const authored = LETHAL_PUZZLES_BY_ID[id]
  if (authored) return authored
  // 讲堂实练也走谜题通道(残局 + 结束回合即判负 + 不记战绩),所以在这里认一下
  const lesson = LESSONS_BY_ID[id]
  if (lesson) return lesson
  const gen = DAILY_POOL.find((g) => g.id === id)
  return gen ? toLethalPuzzle(gen) : undefined
}
