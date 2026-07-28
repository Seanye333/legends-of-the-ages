import { describe, expect, it } from 'vitest'
import { decodePuzzle, encodePuzzle, puzzleFromCode, sharedPuzzleConfig } from './puzzleCode'
import { LETHAL_PUZZLES } from './lethalPuzzles'
import { createGame } from '../engine/init'
import { CARDS_BY_ID } from './cards'
import { solveLethal, trivialFaceLethal } from '../ai/lethalSolver'

describe('残局分享码', () => {
  it('往返编码:每一道现成的题都编得出、解得回', () => {
    for (const p of LETHAL_PUZZLES) {
      const code = encodePuzzle(p.heroes, p.scenario)
      const back = decodePuzzle(code)
      expect(back.ok, p.id).toBe(true)
      if (!back.ok) continue
      expect(back.heroes).toEqual(p.heroes)
      expect(back.scenario.activePlayer).toBe(p.scenario.activePlayer)
      expect(back.scenario.players[0].board.map((u) => u.defId)).toEqual(
        p.scenario.players[0].board.map((u) => u.defId),
      )
      expect(back.scenario.players[0].hand).toEqual(p.scenario.players[0].hand)
      expect(back.scenario.players[1].heroHp).toBe(p.scenario.players[1].heroHp)
    }
  })

  it('码是短的 —— 微信/贴吧/截图都要能传', () => {
    for (const p of LETHAL_PUZZLES) {
      expect(encodePuzzle(p.heroes, p.scenario).length, p.id).toBeLessThan(900)
    }
  })

  // UGC 最难的一环从来不是编辑器,是审核 —— 而这里有完备求解器
  it('导入的题当场可验:有解且非平凡', () => {
    const p = LETHAL_PUZZLES[0]
    const back = decodePuzzle(encodePuzzle(p.heroes, p.scenario))
    expect(back.ok).toBe(true)
    if (!back.ok) return
    const state = createGame(sharedPuzzleConfig(back.heroes, back.scenario), CARDS_BY_ID)
    expect(trivialFaceLethal(state, 0)).toBe(false)
    expect(solveLethal(state, 0, CARDS_BY_ID)).not.toBeNull()
  })

  it('坏码不抛异常,给出可分辨的原因', () => {
    expect(decodePuzzle('随便一串')).toEqual({ ok: false, error: 'bad-prefix' })
    expect(decodePuzzle('QGP1.@@@@')).toMatchObject({ ok: false })
    const empty = encodePuzzle(['liu-bei', 'cao-cao'], {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 0, board: [], hand: [] },
        { heroHp: 30, mana: 0, board: [], hand: [] },
      ],
    })
    expect(decodePuzzle(empty)).toEqual({ ok: false, error: 'empty-board' })
  })

  it('不认识的主公被拒', () => {
    const code = encodePuzzle(['nobody', 'cao-cao'], LETHAL_PUZZLES[0].scenario)
    expect(decodePuzzle(code)).toEqual({ ok: false, error: 'unknown-hero' })
  })

  it('包成题之后不带别人的文案 —— 那不该被当成官方题面', () => {
    const p = LETHAL_PUZZLES[0]
    const q = puzzleFromCode(p.heroes, p.scenario)
    expect(q.id).toBe('shared-puzzle')
    expect(q.hint.zh).not.toBe(p.hint.zh)
  })
})
