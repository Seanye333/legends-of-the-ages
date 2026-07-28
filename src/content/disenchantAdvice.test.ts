import { describe, expect, it } from 'vitest'
import { disenchantAdvice } from './disenchantAdvice'
import { PRECON_DECKS } from './decks'
import { COLLECTIBLE_CARDS } from './cards'

const ALL: Record<string, number> = Object.fromEntries(COLLECTIBLE_CARDS.map((c) => [c.id, 2]))

describe('分解建议', () => {
  // 宁可少建议,也不能建议一次就让人损失一副牌
  it('预组里用到的卡一张都不建议', () => {
    const inPrecon = new Set(PRECON_DECKS.flatMap((d) => d.cardIds))
    for (const a of disenchantAdvice(ALL, [], 200)) {
      expect(inPrecon.has(a.card.id), a.card.id).toBe(false)
    }
  })

  it('自组卡组里用到的也不建议', () => {
    const mine = PRECON_DECKS[0]
    const custom = [{ ...mine, name: { zh: '我的', en: 'Mine' } }]
    const advice = disenchantAdvice(ALL, custom, 200)
    for (const id of mine.cardIds) {
      expect(advice.some((a) => a.card.id === id), id).toBe(false)
    }
  })

  it('传说与史诗不建议 —— 收藏价值,合回来要四倍功勋', () => {
    for (const a of disenchantAdvice(ALL, [], 200)) {
      expect(['common', 'rare']).toContain(a.card.rarity)
    }
  })

  it('没有的卡不建议', () => {
    expect(disenchantAdvice({}, [])).toEqual([])
  })

  it('份数多的排前面', () => {
    const owned = { ...ALL }
    const list = disenchantAdvice(owned, [], 20)
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].copies).toBeGreaterThanOrEqual(list[i].copies)
    }
  })
})
