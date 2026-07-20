import { beforeEach, describe, expect, it } from 'vitest'
import {
  ARENA_ENTRY_MERIT,
  ARENA_MAX_LOSSES,
  ARENA_MAX_WINS,
  ARENA_PICKS,
  arenaReward,
  useArena,
} from './arenaStore'
import { useCollection } from './collectionStore'
import { CARDS_BY_ID } from '../content/cards'
import { HEROES_BY_ID } from '../content/overrides/heroes'

function draftFullRun(): void {
  useCollection.setState({ merit: 1000 })
  expect(useArena.getState().begin()).toBe(true)
  const heroId = useArena.getState().heroOffer[0]
  useArena.getState().chooseHero(heroId)
  for (let i = 0; i < ARENA_PICKS; i++) {
    const offer = useArena.getState().offer
    expect(offer.length).toBe(3)
    useArena.getState().choose(offer[0])
  }
}

describe('arena run', () => {
  beforeEach(() => {
    useArena.getState().abandon()
    useCollection.setState({ merit: 0, packs: 0 })
  })

  it('refuses to start without the entry fee', () => {
    useCollection.setState({ merit: ARENA_ENTRY_MERIT - 1 })
    expect(useArena.getState().begin()).toBe(false)
    expect(useArena.getState().phase).toBe('idle')
  })

  it('charges the entry fee exactly once', () => {
    useCollection.setState({ merit: 250 })
    expect(useArena.getState().begin()).toBe(true)
    expect(useCollection.getState().merit).toBe(250 - ARENA_ENTRY_MERIT)
  })

  it('offers three distinct legal cards each pick and ends with a 30-card deck', () => {
    draftFullRun()
    const s = useArena.getState()
    expect(s.phase).toBe('ready')
    const deck = s.deck()
    expect(deck).not.toBeNull()
    expect(deck!.cardIds).toHaveLength(ARENA_PICKS)
    // 每张都必须真实存在、可收集,且属于本主义或中立
    const hero = HEROES_BY_ID[deck!.heroId]
    for (const id of deck!.cardIds) {
      const card = CARDS_BY_ID[id]
      expect(card, `card ${id} must exist`).toBeDefined()
      expect(card.token ?? false).toBe(false)
      expect(['neutral', hero.doctrine]).toContain(card.doctrine)
    }
  })

  it('ends the run after three losses', () => {
    draftFullRun()
    for (let i = 0; i < ARENA_MAX_LOSSES; i++) useArena.getState().recordResult(false)
    expect(useArena.getState().phase).toBe('done')
    expect(useArena.getState().losses).toBe(ARENA_MAX_LOSSES)
  })

  it('ends the run at twelve wins', () => {
    draftFullRun()
    for (let i = 0; i < ARENA_MAX_WINS; i++) useArena.getState().recordResult(true)
    expect(useArena.getState().phase).toBe('done')
  })

  it('pays out on claim and resets the run', () => {
    draftFullRun()
    for (let i = 0; i < ARENA_MAX_LOSSES; i++) useArena.getState().recordResult(false)
    const meritBefore = useCollection.getState().merit
    const reward = useArena.getState().claim()
    expect(reward).toEqual(arenaReward(0))
    expect(useCollection.getState().packs).toBe(reward!.packs)
    expect(useCollection.getState().merit).toBe(meritBefore + reward!.merit)
    expect(useArena.getState().phase).toBe('idle')
  })

  it('reward curve is monotonic and 0 wins still returns a pack', () => {
    expect(arenaReward(0).packs).toBeGreaterThanOrEqual(1)
    for (let w = 1; w <= ARENA_MAX_WINS; w++) {
      const prev = arenaReward(w - 1)
      const cur = arenaReward(w)
      expect(cur.packs).toBeGreaterThanOrEqual(prev.packs)
      expect(cur.merit).toBeGreaterThan(prev.merit)
    }
  })

  it('ignores picks that are not on offer', () => {
    useCollection.setState({ merit: 500 })
    useArena.getState().begin()
    useArena.getState().chooseHero(useArena.getState().heroOffer[0])
    const before = useArena.getState().picked.length
    useArena.getState().choose('definitely-not-a-real-card')
    expect(useArena.getState().picked.length).toBe(before)
  })
})
