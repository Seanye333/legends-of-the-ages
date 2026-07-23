import { describe, expect, it } from 'vitest'
import { DAILY_POOL } from './dailyPuzzles'
import { dailyPuzzleFor, dayKey, puzzleDefById, toLethalPuzzle } from './dailyPuzzle'
import { LETHAL_PUZZLES, puzzleGameConfig } from './lethalPuzzles'
import { CARDS_BY_ID } from './cards'
import { HEROES_BY_ID } from './overrides/heroes'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { solveLethal, trivialFaceLethal } from '../ai/lethalSolver'

// 生成池的内容闸门:与手搓题同一把尺 —— 每题有解、非平凡、解法回放真赢。
// 挖矿脚本已在离线时验过一遍,这里是入库产物的回归防线(重跑挖矿若产出坏题,CI 红)。
describe('每日谜题池自检', () => {
  it('池非空,id 唯一', () => {
    expect(DAILY_POOL.length).toBeGreaterThan(0)
    const ids = DAILY_POOL.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('引用的英雄都存在', () => {
    for (const g of DAILY_POOL) {
      for (const h of g.heroes) expect(HEROES_BY_ID[h], `${g.id}: 英雄 ${h}`).toBeDefined()
    }
  })

  for (const g of DAILY_POOL) {
    it(`${g.id} 有解且非平凡`, () => {
      const p = toLethalPuzzle(g)
      const s = createGame(puzzleGameConfig(p), CARDS_BY_ID)
      expect(s.phase).toBe('main')
      expect(trivialFaceLethal(s, 0), `${g.id} 不该是「直接挥脸即赢」`).toBe(false)
      const res = solveLethal(s, 0, CARDS_BY_ID)
      expect(res, `${g.id} 应有斩杀解`).not.toBeNull()
      let cur = s
      for (const cmd of res!.line) {
        const r = applyCommand(cur, 0, cmd, CARDS_BY_ID)
        expect(r.ok, `${g.id} 解法走不通: ${JSON.stringify(cmd)}`).toBe(true)
        if (r.ok) cur = r.state
      }
      expect(cur.phase).toBe('ended')
      expect(cur.winner).toBe(0)
    })
  }
})

describe('每日选择', () => {
  it('同一日期确定性地选同一题', () => {
    const a = dailyPuzzleFor('2026-07-23')
    const b = dailyPuzzleFor('2026-07-23')
    expect(a?.id).toBe(b?.id)
  })

  it('不同日期通常选不同题(采样若干天有多样性)', () => {
    const days = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']
    const picks = new Set(days.map((d) => dailyPuzzleFor(d)?.id))
    expect(picks.size).toBeGreaterThan(1)
  })

  it('dayKey 输出 YYYY-MM-DD', () => {
    expect(dayKey(new Date(2026, 6, 23))).toBe('2026-07-23')
  })

  it('puzzleDefById 同时认手搓题与生成题', () => {
    expect(puzzleDefById(LETHAL_PUZZLES[0].id)?.id).toBe(LETHAL_PUZZLES[0].id)
    expect(puzzleDefById(DAILY_POOL[0].id)?.id).toBe(DAILY_POOL[0].id)
    expect(puzzleDefById('nope')).toBeUndefined()
  })
})
