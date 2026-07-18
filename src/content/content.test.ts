import { describe, expect, it } from 'vitest'
import { CARDS, CARDS_BY_ID } from './cards'
import { PRECON_DECKS, validateDeck } from './decks'
import { GENERATED_CARDS } from './generated/cards.gen'
import { HEROES, HEROES_BY_ID } from './overrides/heroes'
import { SIGNATURE_OVERRIDES } from './overrides/signature'
import { STRATAGEMS } from './overrides/stratagems'

describe('signature overrides', () => {
  it('every override key exists in the generated pool', () => {
    const genIds = new Set(GENERATED_CARDS.map((c) => c.id))
    for (const key of Object.keys(SIGNATURE_OVERRIDES)) {
      expect(genIds.has(key), `override key not in generated pool: ${key}`).toBe(true)
    }
  })

  it('every override with a battlecry or deathrattle has zh text', () => {
    for (const [id, o] of Object.entries(SIGNATURE_OVERRIDES)) {
      if (o.battlecry || o.deathrattle) {
        expect(o.text?.zh, `override ${id} has an effect but no text.zh`).toBeTruthy()
      }
    }
  })

  it('summoned defIds exist in the merged pool', () => {
    for (const card of CARDS) {
      for (const script of [card.battlecry, card.deathrattle, card.spell]) {
        for (const op of script?.ops ?? []) {
          if (op.op === 'summon') {
            expect(CARDS_BY_ID[op.defId], `${card.id} summons unknown defId ${op.defId}`).toBeDefined()
          }
        }
      }
    }
  })
})

describe('stratagems', () => {
  it('has 15 stratagems with unique strat- ids', () => {
    expect(STRATAGEMS.length).toBe(15)
    const ids = new Set(STRATAGEMS.map((s) => s.id))
    expect(ids.size).toBe(STRATAGEMS.length)
    for (const s of STRATAGEMS) expect(s.id, `stratagem id must start with strat-: ${s.id}`).toMatch(/^strat-/)
  })

  it('collectorNo >= 9001 and unique', () => {
    const nos = STRATAGEMS.map((s) => s.collectorNo)
    for (const no of nos) expect(no).toBeGreaterThanOrEqual(9001)
    expect(new Set(nos).size).toBe(nos.length)
  })

  it('no attack/health, and every stratagem has a spell and zh text', () => {
    for (const s of STRATAGEMS) {
      expect(s.type).toBe('stratagem')
      expect(s.attack, `${s.id} must not have attack`).toBeUndefined()
      expect(s.health, `${s.id} must not have health`).toBeUndefined()
      expect(s.spell, `${s.id} must have a spell`).toBeDefined()
      expect(s.spell!.ops.length).toBeGreaterThan(0)
      expect(s.text?.zh, `${s.id} must have text.zh`).toBeTruthy()
    }
  })
})

describe('heroes', () => {
  it('six heroes, one per doctrine, START_HP each', () => {
    expect(HEROES.length).toBe(6)
    const doctrines = new Set(HEROES.map((h) => h.doctrine))
    expect(doctrines.size).toBe(6)
    for (const h of HEROES) expect(h.hp).toBe(30)
  })

  it('every hero id exists in the merged pool (portraits follow roster ids)', () => {
    for (const h of HEROES) {
      expect(CARDS_BY_ID[h.id], `hero id not in pool: ${h.id}`).toBeDefined()
    }
  })
})

describe('precon decks', () => {
  it('one deck per hero', () => {
    expect(PRECON_DECKS.length).toBe(6)
    const heroIds = new Set(PRECON_DECKS.map((d) => d.heroId))
    expect(heroIds.size).toBe(6)
    for (const d of PRECON_DECKS) expect(HEROES_BY_ID[d.heroId], `deck hero missing: ${d.heroId}`).toBeDefined()
  })

  it('all six precons pass validateDeck with zero violations', () => {
    for (const deck of PRECON_DECKS) {
      expect(validateDeck(deck, CARDS_BY_ID, HEROES_BY_ID), `deck ${deck.heroId}`).toEqual([])
    }
  })

  it('each precon carries 2-4 stratagems', () => {
    for (const deck of PRECON_DECKS) {
      const strats = deck.cardIds.filter((id) => CARDS_BY_ID[id]?.type === 'stratagem').length
      expect(strats, `deck ${deck.heroId} stratagem count`).toBeGreaterThanOrEqual(2)
      expect(strats, `deck ${deck.heroId} stratagem count`).toBeLessThanOrEqual(4)
    }
  })
})
