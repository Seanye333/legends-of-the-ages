import { describe, expect, it } from 'vitest'
import { bondsByReadiness, clansByReadiness, suggestDeckForBond, suggestDeckForClan } from './deckSuggest'
import { ALL_BONDS, bondRoster, clanRoster, deckClans } from './relations'
import { CLAN_QUORUM } from '../engine/types'
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

// 家族那条种子路线。它和羁绊共用 fillDeck 的后两步,所以这里只钉住**不同的那部分**:
// 家族没有「凑齐」—— 手上有两个同族就成立,不该报 missing。
describe('以家族为种子的自动组卡', () => {
  it('每个凑得起来的家族都能产出一副通过合法性校验的三十张牌', () => {
    const doctrine = 'royal'
    const hero = Object.values(HEROES_BY_ID).find((h) => h.doctrine === doctrine)!
    const ready = clansByReadiness(doctrine, ALL_OWNED)
    expect(ready.length, '全收藏下应当有一批凑得起来的家族').toBeGreaterThan(20)
    for (const clan of ready.slice(0, 25)) {
      const { cardIds, missing } = suggestDeckForClan(clan.id, doctrine, ALL_OWNED)
      expect(cardIds, clan.id).toHaveLength(DECK_SIZE)
      // 种子是先筛过「拥有 + 主义可用」的,所以不该有缺口
      expect(missing, clan.id).toEqual([])
      const errs = validateDeck(
        { name: { zh: 't', en: 't' }, heroId: hero.id, cardIds },
        CARDS_BY_ID,
        HEROES_BY_ID,
      )
      expect(errs, `${clan.id}: ${errs.join(' / ')}`).toEqual([])
    }
  })

  it('配出来的牌里,那一族真的凑够了人 —— 否则这颗种子等于没种', () => {
    const doctrine = 'royal'
    for (const clan of clansByReadiness(doctrine, ALL_OWNED).slice(0, 15)) {
      const { cardIds } = suggestDeckForClan(clan.id, doctrine, ALL_OWNED)
      const row = deckClans(cardIds).find((c) => c.id === clan.id)
      expect(row, clan.id).toBeDefined()
      expect(row!.have.length, `${clan.id} 只放进了 ${row!.have.length} 人`).toBeGreaterThanOrEqual(CLAN_QUORUM)
    }
  })

  it('只列手上真凑得起来的家族 —— 一个都没有的收藏下应当是空的', () => {
    expect(clansByReadiness('royal', {})).toEqual([])
    // 只拥有某一族的一个人时,那一族也不该出现在「可以按它组卡」里
    const someClan = clanRoster(clansByReadiness('royal', ALL_OWNED)[0].id)
    const onlyOne: Record<string, number> = { [someClan[0]]: 2 }
    expect(clansByReadiness('royal', onlyOne).length).toBe(0)
  })
})
