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

// 本地日期 YYYY-MM-DD(应用层允许非确定性;测试传入固定值)
export function dayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 两个 YYYY-MM-DD 相差几天(用 UTC 解析避开时区/夏令时)。b 晚于 a 为正。
export function daysBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00Z`)
  const pb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(pa) || Number.isNaN(pb)) return NaN
  return Math.round((pb - pa) / 86_400_000)
}

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
export const DAILY_SLOTS = 3

// 复杂度代理:手牌 + 场面(双方)。要考虑的东西越多,解起来越费劲。
// 这是个代理不是真难度 —— 但它是确定性的、不需要人工标注的,
// 而且和「这一题看起来吓不吓人」高度相关。
function complexityOf(p: LethalPuzzle): number {
  const [me, foe] = p.scenario.players
  return me.hand.length + me.board.length * 2 + foe.board.length * 2
}

export function dailyPuzzleSetFor(dateStr: string): LethalPuzzle[] {
  if (DAILY_POOL.length === 0) return []
  const n = Math.min(DAILY_SLOTS, DAILY_POOL.length)
  const picked: number[] = []
  // 线性探测取 n 个**互不相同**的下标:同一天出现两道一样的题会让
  // 「三题」看起来像个 bug,而池子只有 24 道,撞车概率并不低。
  for (let k = 0; picked.length < n; k++) {
    const idx = hash32(`${dateStr}#${k}`) % DAILY_POOL.length
    let probe = idx
    while (picked.includes(probe)) probe = (probe + 1) % DAILY_POOL.length
    picked.push(probe)
  }
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
