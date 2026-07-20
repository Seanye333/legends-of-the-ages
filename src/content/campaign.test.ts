import { describe, expect, it } from 'vitest'
import { DECK_SIZE } from '../engine/types'
import { BOSSES, bossDeck } from './campaign'
import { CARDS_BY_ID } from './cards'
import { createGame } from '../engine/init'
import { HEROES_BY_ID } from './overrides/heroes'
import { PRECON_DECKS } from './decks'

describe('campaign bosses', () => {
  it('every boss hero id exists in the roster (otherwise portrait and name degrade)', () => {
    for (const b of BOSSES) {
      expect(CARDS_BY_ID[b.heroId], `${b.id} → ${b.heroId}`).toBeDefined()
    }
  })

  it('boss ids and power ids are unique', () => {
    const ids = BOSSES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    const powers = BOSSES.map((b) => b.power.id)
    expect(new Set(powers).size).toBe(powers.length)
  })

  it('every boss deck is exactly 30 real, collectible cards', () => {
    for (const b of BOSSES) {
      const deck = bossDeck(b.doctrine, b.deckTier)
      expect(deck, b.id).toHaveLength(DECK_SIZE)
      for (const id of deck) {
        const card = CARDS_BY_ID[id]
        expect(card, `${b.id} → ${id}`).toBeDefined()
        expect(card.token ?? false, `${b.id} 用了衍生物 ${id}`).toBe(false)
        expect(['neutral', b.doctrine]).toContain(card.doctrine)
      }
    }
  })

  it('boss decks respect copy limits', () => {
    for (const b of BOSSES) {
      const counts = new Map<string, number>()
      for (const id of bossDeck(b.doctrine, b.deckTier)) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      for (const [id, n] of counts) {
        const limit = CARDS_BY_ID[id].rarity === 'legendary' ? 1 : 2
        expect(n, `${b.id} 的 ${id} 有 ${n} 张`).toBeLessThanOrEqual(limit)
      }
    }
  })

  it('bossDeck is deterministic — same boss always gets the same deck', () => {
    for (const b of BOSSES) {
      expect(bossDeck(b.doctrine, b.deckTier)).toEqual(bossDeck(b.doctrine, b.deckTier))
    }
  })

  it('deckTier actually changes the deck (it is the difficulty dial)', () => {
    // 第一版用「跳过前 N 张」当旋钮,卡池太密导致几乎没效果 —— 这条守着不再退化
    const strong = bossDeck('royal', 0)
    const weak = bossDeck('royal', 0.75)
    const overlap = strong.filter((id) => weak.includes(id)).length
    expect(overlap).toBeLessThan(DECK_SIZE * 0.6)
  })

  it('hp and reward both rise across the eight stages', () => {
    for (let i = 1; i < BOSSES.length; i++) {
      expect(BOSSES[i].hp, `第 ${i + 1} 关血量应不低于前一关`).toBeGreaterThanOrEqual(
        BOSSES[i - 1].hp,
      )
      expect(BOSSES[i].rewardMerit).toBeGreaterThan(BOSSES[i - 1].rewardMerit)
    }
  })

  it('a boss match is actually constructible by the engine', () => {
    const mine = PRECON_DECKS[0]
    const boss = BOSSES[BOSSES.length - 1]
    const state = createGame(
      {
        seed: 1,
        heroIds: [mine.heroId, boss.heroId],
        deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
        first: 0,
        heroPowers: [HEROES_BY_ID[mine.heroId].power, boss.power],
        heroHps: [30, boss.hp],
      },
      CARDS_BY_ID,
    )
    // 不对称配置真的落到了状态上
    expect(state.players[1].heroHp).toBe(boss.hp)
    expect(state.players[1].heroPower?.id).toBe(boss.power.id)
    expect(state.players[0].heroHp).toBe(30)
  })
})
