// @vitest-environment jsdom
// 谜题在 matchStore 里的完整闭环:开局(残局)→ 走一条真解 → 判胜发奖;结束回合 → 判负。
// e2e 只覆盖失败路径的 UI,这里补上「胜利检测 + 首解发奖」这条 send() 分支。
import { beforeEach, describe, expect, it } from 'vitest'
import { useMatch } from './matchStore'
import { useLethal } from './lethalStore'
import { useCollection } from './collectionStore'
import { LETHAL_PUZZLES } from '../content/lethalPuzzles'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { CARDS_BY_ID } from '../content/cards'
import { solveLethal } from '../ai/lethalSolver'

function startPuzzle(id: string) {
  const p = LETHAL_PUZZLES.find((x) => x.id === id)!
  useMatch.getState().startMatch({
    heroIds: p.heroes,
    deckIds: [[], []],
    heroPowersOverride: [HEROES_BY_ID[p.heroes[0]]?.power, HEROES_BY_ID[p.heroes[1]]?.power],
    scenario: p.scenario,
    puzzle: true,
    puzzleId: p.id,
  })
}

describe('斩杀谜题 · matchStore 闭环', () => {
  beforeEach(() => {
    localStorage.clear()
    useLethal.setState({ solved: [], completedRewardGiven: false })
    useCollection.setState({ merit: 0 })
    useMatch.getState().reset()
  })

  it('开局即「你的回合」,不经调度', () => {
    startPuzzle('lp-windfury')
    const s = useMatch.getState().state!
    expect(s.phase).toBe('main')
    expect(s.activePlayer).toBe(0)
    expect(useMatch.getState().puzzle).toBe(true)
    expect(useMatch.getState().puzzleResult).toBeNull()
  })

  it('走一条真解 → 判胜 + 首解发功勋 + 记进度', () => {
    startPuzzle('lp-windfury')
    const meritBefore = useCollection.getState().merit
    // 用求解器拿一条必杀线,逐条喂给 store 的 send
    const res = solveLethal(useMatch.getState().state!, 0, CARDS_BY_ID)
    expect(res).not.toBeNull()
    for (const cmd of res!.line) useMatch.getState().send(cmd)

    expect(useMatch.getState().puzzleResult).toBe('won')
    expect(useMatch.getState().puzzleReward?.firstSolve).toBe(true)
    expect(useLethal.getState().isSolved('lp-windfury')).toBe(true)
    expect(useCollection.getState().merit).toBeGreaterThan(meritBefore)
  })

  it('结束回合而未斩杀 → 判负,不发奖、不记进度', () => {
    startPuzzle('lp-windfury')
    useMatch.getState().send({ type: 'EndTurn' })
    expect(useMatch.getState().puzzleResult).toBe('lost')
    expect(useLethal.getState().solvedCount()).toBe(0)
  })

  it('已解题重打 → 判胜但不再发功勋(幂等)', () => {
    startPuzzle('lp-windfury')
    for (const cmd of solveLethal(useMatch.getState().state!, 0, CARDS_BY_ID)!.line) {
      useMatch.getState().send(cmd)
    }
    const meritAfterFirst = useCollection.getState().merit
    // 再打一遍同题
    startPuzzle('lp-windfury')
    for (const cmd of solveLethal(useMatch.getState().state!, 0, CARDS_BY_ID)!.line) {
      useMatch.getState().send(cmd)
    }
    expect(useMatch.getState().puzzleResult).toBe('won')
    expect(useMatch.getState().puzzleReward?.firstSolve).toBe(false)
    expect(useCollection.getState().merit).toBe(meritAfterFirst)
  })
})
