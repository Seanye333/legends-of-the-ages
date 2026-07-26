import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { CARDS_BY_ID } from '../content/cards'
import { BOARD_LIMIT } from './types'
import type { GameConfig } from './types'

// 策反(seize):引擎里第一个**改变单位归属**的效果。三条约束各一条断言。
function game(myHand: string[], enemyBoard: string[], myBoard: string[] = []) {
  const cfg: GameConfig = {
    seed: 7,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 10, board: myBoard.map((defId) => ({ defId })), hand: myHand },
        { heroHp: 30, mana: 10, board: enemyBoard.map((defId) => ({ defId })), hand: [] },
      ],
    },
  }
  return createGame(cfg, CARDS_BY_ID)
}

const play = (s: ReturnType<typeof game>, cardIid: number, targetIid?: number) =>
  applyCommand(
    s,
    0,
    {
      type: 'PlayCard',
      iid: cardIid,
      ...(targetIid !== undefined ? { target: { kind: 'general', iid: targetIid } as const } : {}),
    },
    CARDS_BY_ID,
  )

describe('策反 seize', () => {
  it('把敌方武将夺到我方场上,敌方少一个、我方多一个', () => {
    const s = game(['strat-fame-defect'], ['guan-yu'])
    const victim = s.players[1].board[0].iid
    const r = play(s, s.players[0].hand[0].iid, victim)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[1].board).toHaveLength(0)
    expect(r.state.players[0].board.map((u) => u.iid)).toContain(victim)
    expect(r.events.some((e) => e.type === 'GeneralSeized')).toBe(true)
  })

  it('夺来的单位当回合不能动(不附赠冲锋)', () => {
    const s = game(['strat-fame-defect'], ['guan-yu'])
    const victim = s.players[1].board[0].iid
    const r = play(s, s.players[0].hand[0].iid, victim)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const seized = r.state.players[0].board.find((u) => u.iid === victim)!
    expect(seized.exhausted).toBe(true)
  })

  it('我方满场则无事发生 —— 不是把目标杀掉', () => {
    const full = Array(BOARD_LIMIT).fill('token-xiangyong')
    const s = game(['strat-fame-defect'], ['guan-yu'], full)
    const victim = s.players[1].board[0].iid
    const r = play(s, s.players[0].hand[0].iid, victim)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // 目标仍在敌方场上(没被消灭、也没被夺走)
    expect(r.state.players[1].board.map((u) => u.iid)).toContain(victim)
    expect(r.state.players[0].board).toHaveLength(BOARD_LIMIT)
  })
})
