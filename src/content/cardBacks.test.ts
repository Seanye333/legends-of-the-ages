import { describe, expect, it } from 'vitest'
import { CARD_BACKS, backCss, isBackUnlocked } from './cardBacks'

const ZERO = { rankIndex: 0, campaignCleared: 0, gauntletBest: 0, collectionSize: 0 }
const ALL = { rankIndex: 9, campaignCleared: 24, gauntletBest: 24, collectionSize: 2000 }

describe('卡背', () => {
  it('id 唯一,而且每张都有 css', () => {
    const ids = CARD_BACKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of CARD_BACKS) expect(b.css.length).toBeGreaterThan(0)
  })

  // 新玩家必须有一张能用的 —— 否则敌方手牌会画成空白
  it('零进度时恰好解锁一张(初始卡背)', () => {
    const open = CARD_BACKS.filter((b) => isBackUnlocked(b, ZERO))
    expect(open).toHaveLength(1)
    expect(open[0].id).toBe('back-default')
  })

  it('满进度时全部解锁', () => {
    for (const b of CARD_BACKS) expect(isBackUnlocked(b, ALL), b.id).toBe(true)
  })

  it('每种解锁条件都至少有一张在用 —— 否则那个条件是死代码', () => {
    const kinds = new Set(CARD_BACKS.map((b) => b.unlock.kind))
    for (const k of ['default', 'rank', 'campaign', 'gauntlet', 'collection']) {
      expect(kinds.has(k as never), k).toBe(true)
    }
  })

  it('未知 id 回落到初始卡背,不返回空串', () => {
    expect(backCss('nope')).toBe(CARD_BACKS[0].css)
    expect(backCss(undefined)).toBe(CARD_BACKS[0].css)
  })
})
