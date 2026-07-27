import { describe, expect, it } from 'vitest'
import { LETHAL_PUZZLES, LETHAL_PUZZLES_BY_ID, puzzleGameConfig } from './lethalPuzzles'
import { CARDS_BY_ID } from './cards'
import { LESSONS } from './lessons'
import { CODEX } from '../ui/codex'
import { HEROES_BY_ID } from './overrides/heroes'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { solveLethal, trivialFaceLethal } from '../ai/lethalSolver'

// 内容闸门:谜题正确性完全靠这里守。CI 里它是「上架题都可解且非平凡」的断言。
describe('斩杀谜题内容自检', () => {
  it('至少 10 道,三档难度都有', () => {
    expect(LETHAL_PUZZLES.length).toBeGreaterThanOrEqual(10)
    for (const d of [1, 2, 3] as const) {
      expect(LETHAL_PUZZLES.some((p) => p.difficulty === d)).toBe(true)
    }
  })

  it('id 唯一', () => {
    const ids = LETHAL_PUZZLES.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(Object.keys(LETHAL_PUZZLES_BY_ID).length).toBe(ids.length)
  })

  it('引用的英雄都存在', () => {
    for (const p of LETHAL_PUZZLES) {
      for (const h of p.heroes) expect(HEROES_BY_ID[h], `${p.id}: 英雄 ${h}`).toBeDefined()
    }
  })

  // 每题:能构造(不含未知卡/超限)→ phase 从 main → 非平凡 → 有解 → 解法回放真赢
  for (const p of LETHAL_PUZZLES) {
    it(`${p.id}「${p.title.zh}」有解且非平凡`, () => {
      const s = createGame(puzzleGameConfig(p), CARDS_BY_ID) // 未知 defId / 超限会在此抛错
      expect(s.phase).toBe('main')
      const me = p.scenario.activePlayer

      // 非平凡:不能只把现成场面砸脸就赢
      expect(trivialFaceLethal(s, me), `${p.id} 不该是「直接挥脸即赢」的假谜题`).toBe(false)

      // 有解
      const res = solveLethal(s, me, CARDS_BY_ID)
      expect(res, `${p.id} 应存在斩杀解`).not.toBeNull()

      // 解法回放:真的把对手打死
      let cur = s
      for (const cmd of res!.line) {
        const r = applyCommand(cur, me, cmd, CARDS_BY_ID)
        expect(r.ok, `${p.id} 解法命令走不通: ${JSON.stringify(cmd)}`).toBe(true)
        if (r.ok) cur = r.state
      }
      expect(cur.phase).toBe('ended')
      expect(cur.winner).toBe(me)
    })
  }
})

// ---- 講堂實練 ----
//
// 实练和谜题共用一条管线,所以也共用同一道闸门:必须有解、且不能是「全体打脸就赢」。
// 多一条它自己的:每一课必须挂在讲堂真实存在的词条上,否则那一课永远没人点得到。
describe('讲堂实练', () => {
  it('每一课都有解,且不是平凡打脸', () => {
    for (const lesson of LESSONS) {
      const s = createGame(puzzleGameConfig(lesson), CARDS_BY_ID)
      expect(trivialFaceLethal(s, 0), `${lesson.id} 是平凡解`).toBe(false)
      const res = solveLethal(s, 0, CARDS_BY_ID)
      expect(res, `${lesson.id} 无解`).not.toBeNull()
    }
  })

  it('挂的词条真实存在 —— 否则那一课永远没人点得到', () => {
    const ids = new Set(CODEX.flatMap((s) => s.entries.map((e) => e.id)))
    for (const lesson of LESSONS) {
      expect(ids.has(lesson.mechanic), `${lesson.id} → ${lesson.mechanic}`).toBe(true)
    }
  })

  it('id 唯一,且不与手搓谜题撞车', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('lesson-')).toBe(true)
  })
})
