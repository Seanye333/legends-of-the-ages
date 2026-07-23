// 每日谜题:从挖矿池(dailyPuzzles.ts)里按日期确定性地选一题,并把生成题包装成
// 与手搓题同构的 LethalPuzzle(补合成的标题/情境/提示),这样 UI 与结算面板零改动复用。
import type { LethalPuzzle } from './lethalPuzzles'
import { LETHAL_PUZZLES_BY_ID } from './lethalPuzzles'
import { DAILY_POOL, type GeneratedPuzzle } from './dailyPuzzles'
import { HEROES_BY_ID } from './overrides/heroes'

// 生成题 → LethalPuzzle:标题取我方主公名,提示/情境走通用文案(挖出来的题没有人写的旁白)
export function toLethalPuzzle(g: GeneratedPuzzle): LethalPuzzle {
  const hero = HEROES_BY_ID[g.heroes[0]]
  const heroZh = hero?.name.zh ?? g.heroes[0]
  const heroEn = hero?.name.en ?? g.heroes[0]
  return {
    id: g.id,
    title: { zh: `${heroZh} · 杀机`, en: `${heroEn}'s Opening` },
    situation: {
      zh: '取自真实对局的残局 —— 这一回合就能了结。',
      en: 'A position lifted from a real game — it ends this turn.',
    },
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

// 日期 → 池中一题(确定性,FNV-1a 哈希取模)。池空则返回 null。
export function dailyPuzzleFor(dateStr: string): LethalPuzzle | null {
  if (DAILY_POOL.length === 0) return null
  let h = 2166136261
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const idx = Math.abs(h >>> 0) % DAILY_POOL.length
  return toLethalPuzzle(DAILY_POOL[idx])
}

// MatchScreen 用:按 id 找题面(手搓题 + 生成题都能找到,供结算面板取标题/提示)
export function puzzleDefById(id: string): LethalPuzzle | undefined {
  const authored = LETHAL_PUZZLES_BY_ID[id]
  if (authored) return authored
  const gen = DAILY_POOL.find((g) => g.id === id)
  return gen ? toLethalPuzzle(gen) : undefined
}
