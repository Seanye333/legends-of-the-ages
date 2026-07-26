import { describe, expect, it } from 'vitest'
import { DECK_SIZE } from '../engine/types'
import { towerDeck, towerFloor } from './tower'
import { CARDS_BY_ID } from './cards'

describe('无尽爬塔', () => {
  it('层数 → 敌人是确定性的', () => {
    expect(towerFloor(7)).toEqual(towerFloor(7))
  })
  it('越往上血越厚、卡组分位越强(tier 越小)', () => {
    expect(towerFloor(10).hp).toBeGreaterThan(towerFloor(1).hp)
    expect(towerFloor(15).deckTier).toBeLessThan(towerFloor(2).deckTier)
  })
  it('每层卡组是 30 张真实可收集卡', () => {
    for (const f of [1, 5, 12, 20, 33]) {
      const deck = towerDeck(towerFloor(f))
      expect(deck, `floor ${f}`).toHaveLength(DECK_SIZE)
      for (const id of deck) {
        expect(CARDS_BY_ID[id], `floor ${f} → ${id}`).toBeDefined()
        expect(CARDS_BY_ID[id].token ?? false).toBe(false)
      }
    }
  })
  it('开局态势里的衍生物真实存在且是 token', () => {
    for (const f of [5, 10, 15, 25, 40]) {
      for (const id of towerFloor(f).enemyModifiers?.startTokens ?? []) {
        expect(CARDS_BY_ID[id], id).toBeDefined()
        expect(CARDS_BY_ID[id].token ?? false, id).toBe(true)
      }
    }
  })
  it('deckTier 不会越界', () => {
    for (const f of [1, 20, 50, 200]) {
      const t = towerFloor(f).deckTier
      expect(t).toBeGreaterThanOrEqual(0)
      expect(t).toBeLessThanOrEqual(1)
    }
  })
})
