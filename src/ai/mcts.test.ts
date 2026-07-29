import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { CARDS_BY_ID } from '../content/cards'
import { PRECON_DECKS } from '../content/decks'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { planTurnMcts } from './mcts'
import { stopScore, DEFAULT_WEIGHTS } from './greedy'
import type { GameConfig, GameState, PlayerIdx } from '../engine/types'
import { START_HP } from '../engine/types'

function opened(seed: number): GameState {
  const d = PRECON_DECKS[0]
  const hero = HEROES_BY_ID[d.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [d.heroId, d.heroId],
    deckIds: [[...d.cardIds], [...d.cardIds]],
    first: 0,
    heroPowers: [hero?.power, hero?.power],
    heroHps: [hero?.hp ?? START_HP, hero?.hp ?? START_HP],
  }
  let s = createGame(cfg, CARDS_BY_ID)
  for (const p of [0, 1] as PlayerIdx[]) {
    const r = applyCommand(s, p, { type: 'Mulligan', keepIids: s.players[p].hand.map((c) => c.iid) }, CARDS_BY_ID)
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  // 走几个回合,攒出一个有手牌、有场面、分支够宽的局面
  for (let i = 0; i < 6; i++) {
    const r = applyCommand(s, s.activePlayer, { type: 'EndTurn' }, CARDS_BY_ID)
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

describe('MCTS', () => {
  it('确定性:同一个局面跑两次,连每一次 rollout 走的路都一样', () => {
    const s = opened(7)
    const a = planTurnMcts(s, s.activePlayer, CARDS_BY_ID, { iterations: 200 })
    const b = planTurnMcts(s, s.activePlayer, CARDS_BY_ID, { iterations: 200 })
    expect(a.line).toEqual(b.line)
    expect(a.score).toBe(b.score)
    expect(a.nodes).toBe(b.nodes)
  })

  it('不碰对局的 rng —— 「AI 想了想」不该改变发牌结果', () => {
    const s = opened(11)
    const before = s.rng
    planTurnMcts(s, s.activePlayer, CARDS_BY_ID, { iterations: 200 })
    expect(s.rng).toBe(before)
  })

  it('给出的线是合法的,且照走一遍确实到达它报告的分数', () => {
    const s = opened(3)
    const player = s.activePlayer
    const plan = planTurnMcts(s, player, CARDS_BY_ID, { iterations: 400 })
    let cur = s
    for (const cmd of plan.line) {
      const r = applyCommand(cur, player, cmd, CARDS_BY_ID)
      expect(r.ok, `命令被拒:${JSON.stringify(cmd)}`).toBe(true)
      if (!r.ok) return
      cur = r.state
    }
    expect(stopScore(cur, player, CARDS_BY_ID)).toBeCloseTo(plan.score, 6)
  })

  it('不会比「直接收手」更差 —— 空线永远是候选之一', () => {
    const s = opened(5)
    const player = s.activePlayer
    const plan = planTurnMcts(s, player, CARDS_BY_ID, { iterations: 300 })
    expect(plan.score).toBeGreaterThanOrEqual(stopScore(s, player, CARDS_BY_ID))
  })

  it('预算越多不会变差(单调性:更多迭代只会见到更多局面)', () => {
    const s = opened(9)
    const player = s.activePlayer
    const small = planTurnMcts(s, player, CARDS_BY_ID, { iterations: 60 })
    const big = planTurnMcts(s, player, CARDS_BY_ID, { iterations: 900 })
    // 不断言严格变好(随机搜索允许平手),但不能倒退
    expect(big.score).toBeGreaterThanOrEqual(small.score - 1e-9)
  })
})

describe('浮费权重', () => {
  it('归并后的默认值与抽出来之前逐字相同 —— 历史数字继续可比', () => {
    expect(DEFAULT_WEIGHTS.mana).toBe(0.18)
  })

  it('stopScore = evaluate − (0.05 + 剩余法力 × mana)', () => {
    const s = opened(4)
    const player = s.activePlayer
    const mana = s.players[player].mana.current
    const withZero = stopScore(s, player, CARDS_BY_ID, false, { mana: 0 })
    const withDefault = stopScore(s, player, CARDS_BY_ID)
    expect(withZero - withDefault).toBeCloseTo(mana * DEFAULT_WEIGHTS.mana, 6)
  })
})
