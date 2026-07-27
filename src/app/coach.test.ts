import { describe, expect, it } from 'vitest'
import { scanReplay } from './coach'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { CARDS_BY_ID } from '../content/cards'
import type { GameConfig, GameEvent, GameState } from '../engine/types'
import type { SavedReplay } from './replayStore'

// 军师复盘要答对的只有两件事:
//   1. 「你当时能赢」—— 报得出真存在的斩杀;
//   2. 「你没赢」——   抓住了的那一条不能报,否则每局都会告诉你「你赢了那回合能赢」。
function replayOf(frames: { state: GameState; events: GameEvent[] }[]): SavedReplay {
  return {
    id: 'test',
    date: '2026-01-01T00:00:00.000Z',
    mode: 'local',
    heroIds: ['liu-bei', 'cao-cao'],
    frames,
  }
}

// 造一个「我方回合开始、场上有一条需要出牌才成立的斩杀」的帧
function lethalFrame(): GameState {
  const cfg: GameConfig = {
    seed: 9,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 3, board: [{ defId: 'guan-yu' }], hand: ['strat-huo-ji'] },
        { heroHp: 4, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    },
  }
  return createGame(cfg, CARDS_BY_ID)
}

const turnStart = (state: GameState): GameEvent[] => [
  { type: 'TurnStarted', player: 0, turn: state.turn, mana: 3 },
]

describe('军师复盘', () => {
  it('报出「本可斩杀却没斩」的回合', () => {
    const s = lethalFrame()
    const found = scanReplay(
      replayOf([
        { state: s, events: turnStart(s) },
        { state: s, events: [{ type: 'TurnEnded', player: 0, turn: s.turn }] },
      ]),
    )
    expect(found).toHaveLength(1)
    expect(found[0].steps).toBeGreaterThan(0)
  })

  it('抓住了的斩杀不报 —— 那一回合赢了', () => {
    const s = lethalFrame()
    const found = scanReplay(
      replayOf([
        { state: s, events: turnStart(s) },
        { state: s, events: [{ type: 'GameEnded', winner: 0 }] },
      ]),
    )
    expect(found).toHaveLength(0)
  })

  it('平凡斩杀不报 —— 全体打脸就能赢不需要军师提醒', () => {
    const cfg: GameConfig = {
      seed: 3,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 0, board: [{ defId: 'guan-yu' }], hand: [] },
          { heroHp: 2, mana: 0, board: [], hand: [] }, // 没有守护,直接砸脸就赢
        ],
      },
    }
    const s = createGame(cfg, CARDS_BY_ID)
    const found = scanReplay(
      replayOf([
        { state: s, events: turnStart(s) },
        { state: s, events: [{ type: 'TurnEnded', player: 0, turn: s.turn }] },
      ]),
    )
    expect(found).toHaveLength(0)
  })

  it('没有斩杀的一局,一条都不报', () => {
    const cfg: GameConfig = {
      seed: 3,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 0, board: [], hand: [] },
          { heroHp: 30, mana: 0, board: [], hand: [] },
        ],
      },
    }
    const s = createGame(cfg, CARDS_BY_ID)
    expect(
      scanReplay(replayOf([{ state: s, events: turnStart(s) }])),
    ).toHaveLength(0)
  })

  it('报出来的线是真的能赢 —— 逐步重放一遍', () => {
    const s = lethalFrame()
    const found = scanReplay(
      replayOf([
        { state: s, events: turnStart(s) },
        { state: s, events: [{ type: 'TurnEnded', player: 0, turn: s.turn }] },
      ]),
    )
    let cur = s
    for (const cmd of found[0].line) {
      const r = applyCommand(cur, 0, cmd, CARDS_BY_ID)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      cur = r.state
    }
    expect(cur.phase).toBe('ended')
    expect(cur.winner).toBe(0)
  })
})
