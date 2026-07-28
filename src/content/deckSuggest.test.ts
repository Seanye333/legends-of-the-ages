import { describe, expect, it } from 'vitest'
import { bondsByReadiness, suggestDeckForBond } from './deckSuggest'
import { ALL_BONDS, bondRoster } from './relations'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'
import { validateDeck } from './decks'
import { HEROES_BY_ID } from './overrides/heroes'
import { DECK_SIZE } from '../engine/types'

// 全收藏:每张两份(传说一份也够,校验按稀有度看上限)
const ALL_OWNED: Record<string, number> = Object.fromEntries(
  COLLECTIBLE_CARDS.map((c) => [c.id, 2]),
)

describe('以羁绊为种子的自动组卡', () => {
  // 这是整个功能的价值所在:建议出来的牌必须**立刻能存能打**
  it('每一条羁绊都能产出一副通过合法性校验的三十张牌', () => {
    for (const ref of ALL_BONDS) {
      const doctrine = ref.anchor.doctrine === 'neutral' ? 'royal' : ref.anchor.doctrine
      const hero = Object.values(HEROES_BY_ID).find((h) => h.doctrine === doctrine)
      if (!hero) continue
      const { cardIds } = suggestDeckForBond(ref, doctrine, ALL_OWNED)
      expect(cardIds, ref.bond.id).toHaveLength(DECK_SIZE)
      const errs = validateDeck(
        { name: { zh: 't', en: 't' }, heroId: hero.id, cardIds },
        CARDS_BY_ID,
        HEROES_BY_ID,
      )
      expect(errs, `${ref.bond.id}: ${errs.join(' / ')}`).toEqual([])
    }
  })

  it('羁绊成员真的被放进去了(主义允许的那些)', () => {
    const taoyuan = ALL_BONDS.find((r) => r.bond.id === 'bond-taoyuan')!
    const { cardIds, missing } = suggestDeckForBond(taoyuan, 'royal', ALL_OWNED)
    for (const id of bondRoster(taoyuan)) {
      if (missing.includes(id)) continue
      expect(cardIds, id).toContain(id)
    }
  })

  // 给一副含未拥有卡的「理想卡组」毫无用处 —— 点保存会被校验挡回来
  it('只用你拥有的卡;没有的成员照实报缺', () => {
    const taoyuan = ALL_BONDS.find((r) => r.bond.id === 'bond-taoyuan')!
    const owned = { ...ALL_OWNED }
    delete owned['guan-yu']
    const { cardIds, missing } = suggestDeckForBond(taoyuan, 'royal', owned)
    expect(missing).toContain('guan-yu')
    expect(cardIds).not.toContain('guan-yu')
  })

  it('收藏不够时也给得出牌,只是张数可能不满', () => {
    const taoyuan = ALL_BONDS.find((r) => r.bond.id === 'bond-taoyuan')!
    const thin = { 'liu-bei': 1, 'guan-yu': 1, 'zhang-fei': 1 }
    const { cardIds } = suggestDeckForBond(taoyuan, 'royal', thin)
    expect(cardIds.length).toBeGreaterThan(0)
    expect(cardIds.length).toBeLessThanOrEqual(DECK_SIZE)
  })

  it('确定性:同样的收藏永远给同一副牌', () => {
    const ref = ALL_BONDS[0]
    const a = suggestDeckForBond(ref, 'royal', ALL_OWNED)
    const b = suggestDeckForBond(ref, 'royal', ALL_OWNED)
    expect(a.cardIds).toEqual(b.cardIds)
  })

  it('凑得最齐的羁绊排在最前', () => {
    const list = bondsByReadiness('shu' as never, ALL_OWNED)
    void list
    const royal = bondsByReadiness('royal', ALL_OWNED)
    for (let i = 1; i < royal.length; i++) {
      expect(royal[i - 1].have).toBeGreaterThanOrEqual(royal[i].have)
    }
  })
})
