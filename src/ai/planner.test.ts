import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { CARDS_BY_ID } from '../content/cards'
import { planTurn, plannedStep } from './planner'
import { aiStep, AI_LEVELS } from './greedy'
import type { GameConfig, GameState, PlayerIdx } from '../engine/types'

// 规划器要证明的只有一件事:它看得见**贪心结构上看不见的那一类**着法 ——
// 需要先走一步亏分的组合。所以测试都用「一步贪心必然走错」的残局。
function scenario(cfg: Partial<GameConfig['scenario']> & object): GameState {
  const full: GameConfig = {
    seed: 5,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: cfg as NonNullable<GameConfig['scenario']>,
  }
  return createGame(full, CARDS_BY_ID)
}

// 跑完一整个回合(反复问 AI 要下一步,直到它结束回合)
function playTurn(state: GameState, player: PlayerIdx, config: (typeof AI_LEVELS)['marshal']) {
  let cur = state
  let rng = 42
  for (let i = 0; i < 24; i++) {
    const step = aiStep(cur, player, CARDS_BY_ID, rng, config)
    rng = step.rng
    if (step.cmd.type === 'EndTurn') break
    const r = applyCommand(cur, player, step.cmd, CARDS_BY_ID)
    if (!r.ok) break
    cur = r.state
    if (cur.phase === 'ended') break
  }
  return cur
}

describe('整回合规划器', () => {
  // 守护墙后面的斩杀:findLethal 见到守护直接放弃(它只搜攻击),
  // 而这条线要求**先出一张牌**清墙。这正是加规划器的理由。
  it('先出牌清墙再打脸 —— 贪心的斩杀搜索够不到的斩杀', () => {
    const s = scenario({
      activePlayer: 0,
      players: [
        {
          heroHp: 30,
          mana: 3,
          board: [{ defId: 'guan-yu' }], // 攻击力足够带走 4 血的脸
          hand: ['strat-huo-ji'], // 4 点直伤,拿来清墙
        },
        {
          heroHp: 4,
          mana: 0,
          board: [{ defId: 'token-danyang-bing' }], // 1/3 守护,挡在前面
          hand: [],
        },
      ],
    })
    const after = playTurn(s, 0, AI_LEVELS.marshal)
    expect(after.phase).toBe('ended')
    expect(after.winner).toBe(0)
  })

  it('没有更好的线时就直接收手 —— 空线表示结束回合', () => {
    const s = scenario({
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 0, board: [], hand: [] },
        { heroHp: 30, mana: 0, board: [], hand: [] },
      ],
    })
    expect(plannedStep(s, 0, CARDS_BY_ID)).toEqual({ type: 'EndTurn' })
  })

  it('确定性:同一局面规划两次,结果逐字相同', () => {
    const s = scenario({
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 6, board: [{ defId: 'guan-yu' }], hand: ['strat-huo-ji', 'zhang-fei'] },
        { heroHp: 20, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    })
    const a = planTurn(s, 0, CARDS_BY_ID)
    const b = planTurn(s, 0, CARDS_BY_ID)
    expect(a.line).toEqual(b.line)
    expect(a.score).toBe(b.score)
  })

  it('节点预算封得住 —— 超了就用手上最好的那条线', () => {
    const s = scenario({
      activePlayer: 0,
      players: [
        {
          heroHp: 30,
          mana: 10,
          board: [{ defId: 'guan-yu' }, { defId: 'zhang-fei' }],
          hand: ['strat-huo-ji', 'strat-huo-ji', 'zhao-yun', 'ma-chao'],
        },
        { heroHp: 25, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    })
    const tiny = planTurn(s, 0, CARDS_BY_ID, { nodeBudget: 30 })
    expect(tiny.nodes).toBeLessThanOrEqual(30)
    // 预算再小也必须给出**合法**的第一步
    if (tiny.line.length > 0) {
      const r = applyCommand(s, 0, tiny.line[0], CARDS_BY_ID)
      expect(r.ok).toBe(true)
    }
  })

  it('规划器给出的整条线逐步都合法', () => {
    const s = scenario({
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 8, board: [{ defId: 'guan-yu' }], hand: ['strat-huo-ji', 'zhang-fei'] },
        { heroHp: 22, mana: 0, board: [{ defId: 'token-danyang-bing' }], hand: [] },
      ],
    })
    const plan = planTurn(s, 0, CARDS_BY_ID)
    let cur = s
    for (const cmd of plan.line) {
      const r = applyCommand(cur, 0, cmd, CARDS_BY_ID)
      expect(r.ok, JSON.stringify(cmd)).toBe(true)
      if (!r.ok) break
      cur = r.state
    }
  })
})
