import { describe, expect, it } from 'vitest'
import { scanBadTrades, scanReplay } from './coach'
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

// ---------------------------------------------------------------- 亏本交换

describe('亏本交换', () => {
  // 造一个「拿大哥去撞墙」的两帧:攻击前 / 攻击后。
  // 复盘只看这两帧之间局面分掉了多少,所以帧里必须是**真的**打过一次。
  function tradeFrames(attackerDefId: string, defenderDefId: string, attackerDamage = 0) {
    const cfg: GameConfig = {
      seed: 5,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 5, board: [{ defId: attackerDefId, damage: attackerDamage }], hand: [] },
          { heroHp: 30, mana: 5, board: [{ defId: defenderDefId }], hand: [] },
        ],
      },
    }
    const before = createGame(cfg, CARDS_BY_ID)
    before.players[0].board[0].exhausted = false
    const r = applyCommand(
      before,
      0,
      {
        type: 'Attack',
        attackerIid: before.players[0].board[0].iid,
        target: { kind: 'general', iid: before.players[1].board[0].iid },
      },
      CARDS_BY_ID,
    )
    if (!r.ok) throw new Error(r.error)
    return replayOf([
      { state: before, events: turnStart(before) },
      { state: r.state, events: r.events },
    ])
  }

  it('把大哥白送进守护里 —— 报出来,并说清楚是白送', () => {
    // 带伤的关羽(6/6,已挨 5 刀)去撞 5/10 的守护:砍不死对方,自己交代在那儿
    const rep = tradeFrames('guan-yu', 'token-di-zhu-jiang', 5)
    const found = scanBadTrades(rep)
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].attackerDefId).toBe('guan-yu')
    expect(found[0].attackerDied).toBe(true)
    expect(found[0].killedDefIds).toEqual([])
    expect(found[0].loss).toBeGreaterThan(0)
  })

  it('赚的交换一条都不报', () => {
    // 反过来:大身材吃掉一个小兵,局面是赚的
    const rep = tradeFrames('guan-yu', 'token-xiangyong')
    expect(scanBadTrades(rep)).toHaveLength(0)
  })

  it('小兵去啃守护不报 —— 那常常是对的打法,报出来只会稀释真正的建议', () => {
    // 2 费铁骑撞 5/10 守护:同样是「白送」,但它是消耗品,清路是它的本职
    const rep = tradeFrames('token-tie-qi', 'token-di-zhu-jiang')
    expect(scanBadTrades(rep)).toHaveLength(0)
  })

  it('赢下对局的那一刀不算亏(evaluate 在 ended 时是 ±1e9,差值没有意义)', () => {
    const cfg: GameConfig = {
      seed: 5,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 5, board: [{ defId: 'guan-yu' }], hand: [] },
          { heroHp: 2, mana: 5, board: [], hand: [] },
        ],
      },
    }
    const before = createGame(cfg, CARDS_BY_ID)
    before.players[0].board[0].exhausted = false
    const r = applyCommand(
      before,
      0,
      { type: 'Attack', attackerIid: before.players[0].board[0].iid, target: { kind: 'hero', player: 1 } },
      CARDS_BY_ID,
    )
    if (!r.ok) throw new Error(r.error)
    expect(r.state.phase).toBe('ended')
    expect(scanBadTrades(replayOf([
      { state: before, events: turnStart(before) },
      { state: r.state, events: r.events },
    ]))).toHaveLength(0)
  })
})
