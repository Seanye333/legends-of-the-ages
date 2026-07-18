import { describe, expect, it } from 'vitest'
import { rollPack, copyLimit, PACK_SIZE, useCollection } from './collectionStore'
import { CARDS_BY_ID } from '../content/cards'
import { PRECON_DECKS } from '../content/decks'
import { rngNext, seedRng } from '../engine/rng'

function seededRand(seed: number): () => number {
  let s = seedRng(seed)
  return () => {
    const r = rngNext(s)
    s = r.next
    return r.value
  }
}

describe('rollPack', () => {
  it('returns PACK_SIZE existing card ids', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const pack = rollPack(seededRand(seed))
      expect(pack).toHaveLength(PACK_SIZE)
      for (const id of pack) expect(CARDS_BY_ID[id]).toBeDefined()
    }
  })

  it('guarantees at least one rare-or-better per pack', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const pack = rollPack(seededRand(seed))
      expect(pack.some((id) => CARDS_BY_ID[id].rarity !== 'common')).toBe(true)
    }
  })

  it('rarity distribution is sane over many packs', () => {
    const counts = { common: 0, rare: 0, epic: 0, legendary: 0 }
    const rand = seededRand(42)
    for (let i = 0; i < 2000; i++) {
      for (const id of rollPack(rand)) counts[CARDS_BY_ID[id].rarity]++
    }
    const total = 2000 * PACK_SIZE
    expect(counts.common / total).toBeGreaterThan(0.5)
    expect(counts.legendary / total).toBeGreaterThan(0.005)
    expect(counts.legendary / total).toBeLessThan(0.06)
    expect(counts.rare).toBeGreaterThan(counts.epic)
    expect(counts.epic).toBeGreaterThan(counts.legendary)
  })
})

describe('collection store', () => {
  it('starter collection makes every precon playable', () => {
    const owned = useCollection.getState().owned
    for (const deck of PRECON_DECKS) {
      const counts: Record<string, number> = {}
      for (const id of deck.cardIds) counts[id] = (counts[id] ?? 0) + 1
      for (const [id, n] of Object.entries(counts)) {
        expect(owned[id] ?? 0, `${deck.name.zh} 缺 ${id}`).toBeGreaterThanOrEqual(n)
      }
    }
  })

  it('win grants a pack; opening respects copy limits', () => {
    const s0 = useCollection.getState()
    const packsBefore = s0.packs
    s0.recordResult(true)
    expect(useCollection.getState().packs).toBe(packsBefore + 1)
    expect(useCollection.getState().wins).toBe(s0.wins + 1)

    const result = useCollection.getState().openPack()
    expect(result).not.toBeNull()
    expect(useCollection.getState().packs).toBe(packsBefore)
    const owned = useCollection.getState().owned
    for (const [id, n] of Object.entries(owned)) {
      expect(n, `${id} 超过持有上限`).toBeLessThanOrEqual(copyLimit(id))
    }
  })

  it('saveDeck rejects unowned cards and invalid decks', () => {
    const store = useCollection.getState()
    const errors = store.saveDeck({
      heroId: 'liu-bei',
      name: { zh: '测试组', en: 'Test' },
      cardIds: Array.from({ length: 30 }, () => 'hist-yue-fei'), // 30 张同卡必然违规
    })
    expect(errors.length).toBeGreaterThan(0)
  })
})
