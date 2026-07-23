// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useDeckStats, winRate } from './deckStatsStore'
import { useMatch } from './matchStore'
import { PRECON_DECKS, deckKey } from '../content/decks'

describe('deckKey', () => {
  it('与卡牌顺序无关(排序后哈希)', () => {
    expect(deckKey('liu-bei', ['a', 'b', 'c'])).toBe(deckKey('liu-bei', ['c', 'a', 'b']))
  })
  it('主公不同 / 卡表不同 → 不同 key', () => {
    expect(deckKey('liu-bei', ['a', 'b'])).not.toBe(deckKey('cao-cao', ['a', 'b']))
    expect(deckKey('liu-bei', ['a', 'b'])).not.toBe(deckKey('liu-bei', ['a', 'c']))
  })
})

describe('deckStatsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useDeckStats.setState({ records: {} })
  })

  it('分别累计胜/负/和,winRate 正确', () => {
    const s = useDeckStats.getState()
    s.record('k', 'win')
    s.record('k', 'win')
    s.record('k', 'win')
    s.record('k', 'loss')
    const r = useDeckStats.getState().records['k']
    expect(r).toEqual({ wins: 3, losses: 1, draws: 0 })
    expect(winRate(r)).toBe(75)
  })

  it('forDeck 按内容哈希查,无对局返回空且 winRate 为 null', () => {
    expect(useDeckStats.getState().forDeck('liu-bei', ['x'])).toEqual({ wins: 0, losses: 0, draws: 0 })
    expect(winRate({ wins: 0, losses: 0, draws: 0 })).toBeNull()
  })
})

describe('卡组胜率 · matchStore 接入', () => {
  beforeEach(() => {
    localStorage.clear()
    useMatch.getState().reset()
    useDeckStats.setState({ records: {} })
  })

  function playToConcede(deckKeyArg?: string) {
    const [a, b] = PRECON_DECKS
    useMatch.getState().startMatch({
      heroIds: [a.heroId, b.heroId],
      deckIds: [a.cardIds.slice(), b.cardIds.slice()],
      deckKey: deckKeyArg,
    })
    const s = useMatch.getState().state!
    useMatch.getState().send({ type: 'Mulligan', keepIids: s.players[0].hand.map((c) => c.iid) })
    useMatch.getState().send({ type: 'Concede' })
  }

  it('随便打(带 deckKey)认输 → 记一场负', () => {
    const k = deckKey(PRECON_DECKS[0].heroId, PRECON_DECKS[0].cardIds)
    playToConcede(k)
    expect(useMatch.getState().state!.phase).toBe('ended')
    expect(useDeckStats.getState().records[k]).toEqual({ wins: 0, losses: 1, draws: 0 })
  })

  it('没带 deckKey(如竞技场/演武)→ 不记任何卡组战绩', () => {
    playToConcede(undefined)
    expect(Object.keys(useDeckStats.getState().records)).toHaveLength(0)
  })
})
