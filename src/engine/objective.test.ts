import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { checkGameEnd } from './reducer'
import { CARDS_BY_ID } from '../content/cards'
import { PRECON_DECKS } from '../content/decks'
import type { BattleObjective, GameConfig, GameEvent } from './types'

// 名局特殊目标「守成」的判定逻辑。直接测 checkGameEnd(纯函数),
// 端到端由 sim-history 覆盖(真跑 aiStep,睢阳靠守成取胜)。
function freshGame(objective?: BattleObjective) {
  const cfg: GameConfig = {
    seed: 1,
    heroIds: [PRECON_DECKS[0].heroId, PRECON_DECKS[1].heroId],
    deckIds: [PRECON_DECKS[0].cardIds.slice(), PRECON_DECKS[1].cardIds.slice()],
    first: 0,
    objective,
  }
  return createGame(cfg, CARDS_BY_ID)
}

describe('名局目标:守成 (survive)', () => {
  it('目标写进了 GameState', () => {
    const s = freshGame({ kind: 'survive', turns: 6 })
    expect(s.objective).toEqual({ kind: 'survive', turns: 6 })
  })

  it('玩家撑过约定回合、在自己回合开始时判胜', () => {
    const s = freshGame({ kind: 'survive', turns: 6 })
    s.turn = 7
    s.activePlayer = 0
    const ev: GameEvent[] = []
    checkGameEnd(s, ev)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe(0)
    expect(ev.some((e) => e.type === 'GameEnded')).toBe(true)
  })

  it('只在玩家(座位0)回合判胜 —— 敌方回合不提前结束', () => {
    const s = freshGame({ kind: 'survive', turns: 6 })
    s.turn = 7
    s.activePlayer = 1
    checkGameEnd(s, [])
    expect(s.phase).not.toBe('ended')
  })

  it('回合数没到不判胜', () => {
    const s = freshGame({ kind: 'survive', turns: 6 })
    s.turn = 5
    s.activePlayer = 0
    checkGameEnd(s, [])
    expect(s.phase).not.toBe('ended')
  })

  it('撑不住:主公归零优先判负,守成救不了', () => {
    const s = freshGame({ kind: 'survive', turns: 6 })
    s.turn = 7
    s.activePlayer = 0
    s.players[0].heroHp = 0
    checkGameEnd(s, [])
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe(1)
  })

  it('无目标时完全不受影响(普通「主公归零」判定)', () => {
    const s = freshGame(undefined)
    s.turn = 99
    s.activePlayer = 0
    checkGameEnd(s, [])
    expect(s.phase).not.toBe('ended')
    expect(s.winner).toBeUndefined()
  })
})

// 斩将 / 护送:目标单位由开局态势放上场,createGame 解析出 iid,靠 GeneralDied 事件判死。
function gameWithTarget(kind: 'assassinate' | 'protect', side: 0 | 1, tokenId: string) {
  const cfg: GameConfig = {
    seed: 1,
    heroIds: [PRECON_DECKS[0].heroId, PRECON_DECKS[1].heroId],
    deckIds: [PRECON_DECKS[0].cardIds.slice(), PRECON_DECKS[1].cardIds.slice()],
    first: 0,
    modifiers: side === 0 ? [{ startTokens: [tokenId] }, undefined] : [undefined, { startTokens: [tokenId] }],
    objective: { kind, targetSide: side, targetDefId: tokenId, targetName: { zh: '目标', en: 'Target' } },
  }
  return createGame(cfg, CARDS_BY_ID)
}

function targetIidOf(s: ReturnType<typeof gameWithTarget>): number | undefined {
  return s.objective && 'targetIid' in s.objective ? s.objective.targetIid : undefined
}

describe('名局目标:斩将 / 护送', () => {
  it('createGame 把 targetIid 解析到开局那张具名 token', () => {
    const s = gameWithTarget('protect', 0, 'token-you-zhu')
    const unit = s.players[0].board.find((u) => u.defId === 'token-you-zhu')
    expect(unit).toBeDefined()
    expect(targetIidOf(s)).toBe(unit!.iid)
  })

  it('斩将:目标 GeneralDied → 玩家胜', () => {
    const s = gameWithTarget('assassinate', 1, 'token-yan-liang')
    const iid = targetIidOf(s)
    expect(iid).toBeDefined()
    const ev: GameEvent[] = [{ type: 'GeneralDied', player: 1, iid: iid!, defId: 'token-yan-liang' }]
    checkGameEnd(s, ev)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe(0)
  })

  it('护送:目标 GeneralDied → 玩家负', () => {
    const s = gameWithTarget('protect', 0, 'token-you-zhu')
    const iid = targetIidOf(s)
    const ev: GameEvent[] = [{ type: 'GeneralDied', player: 0, iid: iid!, defId: 'token-you-zhu' }]
    checkGameEnd(s, ev)
    expect(s.phase).toBe('ended')
    expect(s.winner).toBe(1)
  })

  it('非目标单位死亡不触发', () => {
    const s = gameWithTarget('assassinate', 1, 'token-yan-liang')
    const ev: GameEvent[] = [{ type: 'GeneralDied', player: 1, iid: 999999, defId: 'token-tie-qi' }]
    checkGameEnd(s, ev)
    expect(s.phase).not.toBe('ended')
  })
})
