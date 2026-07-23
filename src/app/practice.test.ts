// @vitest-environment jsdom
// 演武场:自由练习不落任何账 —— 认输结束后功勋/军令都不动。
import { beforeEach, describe, expect, it } from 'vitest'
import { useMatch } from './matchStore'
import { useCollection } from './collectionStore'
import { useQuests } from './questStore'
import { PRECON_DECKS } from '../content/decks'

describe('演武场(practice)', () => {
  beforeEach(() => {
    localStorage.clear()
    useMatch.getState().reset()
    useCollection.setState({ merit: 0 })
  })

  it('自由对练不计战绩:认输后功勋不变、军令进度不动', () => {
    const [a, b] = PRECON_DECKS
    useMatch.getState().startMatch({
      heroIds: [a.heroId, b.heroId],
      deckIds: [a.cardIds.slice(), b.cardIds.slice()],
      practice: true,
      difficultyOverride: 'recruit',
    })
    expect(useMatch.getState().practice).toBe(true)

    const meritBefore = useCollection.getState().merit
    const questBefore = useQuests.getState().quests.reduce((n, q) => n + q.progress, 0)

    // 过调度 → 认输
    const s = useMatch.getState().state!
    useMatch.getState().send({ type: 'Mulligan', keepIids: s.players[0].hand.map((c) => c.iid) })
    useMatch.getState().send({ type: 'Concede' })

    expect(useMatch.getState().state!.phase).toBe('ended')
    // 认输是败局:普通局会给安慰功勋并推军令,练习一律不记
    expect(useCollection.getState().merit).toBe(meritBefore)
    const questAfter = useQuests.getState().quests.reduce((n, q) => n + q.progress, 0)
    expect(questAfter).toBe(questBefore)
  })

  it('reset 清掉 practice 标记', () => {
    const [a, b] = PRECON_DECKS
    useMatch.getState().startMatch({
      heroIds: [a.heroId, b.heroId],
      deckIds: [a.cardIds.slice(), b.cardIds.slice()],
      practice: true,
    })
    useMatch.getState().reset()
    expect(useMatch.getState().practice).toBe(false)
  })
})
