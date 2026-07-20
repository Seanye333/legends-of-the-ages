import { describe, expect, it } from 'vitest'
import { CARDS_BY_ID } from './cards'
import { PRECON_DECKS } from './decks'
import { decodeDeck, encodeDeck } from './deckCode'

const heroNo = (heroId: string) => CARDS_BY_ID[heroId].collectorNo

describe('deck code', () => {
  it('round-trips every precon deck exactly', () => {
    for (const deck of PRECON_DECKS) {
      const code = encodeDeck(deck, CARDS_BY_ID, heroNo(deck.heroId))
      const back = decodeDeck(code, CARDS_BY_ID)
      expect(back.heroId).toBe(deck.heroId)
      // 顺序不保证(按 collectorNo 归并),但多重集必须一致
      expect(back.cardIds.slice().sort()).toEqual(deck.cardIds.slice().sort())
    }
  })

  it('stays short enough to paste by hand', () => {
    for (const deck of PRECON_DECKS) {
      const code = encodeDeck(deck, CARDS_BY_ID, heroNo(deck.heroId))
      // 直接编字符串 id 的话会到七八百字符;varint + collectorNo 应远低于此
      expect(code.length).toBeLessThan(120)
    }
  })

  it('is deterministic', () => {
    const deck = PRECON_DECKS[0]
    const a = encodeDeck(deck, CARDS_BY_ID, heroNo(deck.heroId))
    const b = encodeDeck(deck, CARDS_BY_ID, heroNo(deck.heroId))
    expect(a).toBe(b)
  })

  it('rejects malformed codes instead of silently decoding garbage', () => {
    expect(() => decodeDeck('', CARDS_BY_ID)).toThrow()
    expect(() => decodeDeck('nope', CARDS_BY_ID)).toThrow()
    expect(() => decodeDeck('QG1.!!!!', CARDS_BY_ID)).toThrow()
    // 合法 base64 但载荷是垃圾
    expect(() => decodeDeck('QG1.AAAA', CARDS_BY_ID)).toThrow()
  })

  it('rejects a truncated deck', () => {
    const deck = PRECON_DECKS[0]
    const short = { ...deck, cardIds: deck.cardIds.slice(0, 29) }
    const code = encodeDeck(short, CARDS_BY_ID, heroNo(deck.heroId))
    expect(() => decodeDeck(code, CARDS_BY_ID)).toThrow(/bad-size/)
  })
})
