import { describe, expect, it } from 'vitest'
import { judgeSkeleton, MAX_TOPS, BODY_DEV_PCT } from './skeletonGate'
import type { SkeletonDeck } from './skeletonGate'
import { PRECON_DECKS } from '../src/content/decks'
import { deckHealth } from '../src/content/deckHealth'
import type { DeckHealth } from '../src/content/deckHealth'

// 闸门自检:该红时红、不该红时不红(铁律 11)。样板见 balanceGate.test.ts。
//
// 这一道最要紧的一条是**「每项都在限内、但一套牌把好处占全了」必须被抓住** ——
// 那正是 2026-08-08 那次失衡的形状,当时所有单项检查都放行了。

/** 只给四项打分,其余字段填成不影响判定的常数 */
const mk = (name: string, body: number, attack: number, aggro: number, removal: number): SkeletonDeck => ({
  name,
  health: {
    cards: 30,
    avgCost: 4.2,
    attack,
    health: body - attack,
    body,
    curve: {},
    guards: 12,
    aggro,
    removal,
    draw: 2,
    spells: 4,
    equips: 4,
  } satisfies DeckHealth,
})

describe('骨架闸门 · 不该红的不许红', () => {
  it('四项完全并列的六套牌', () => {
    const decks = Array.from({ length: 6 }, (_, i) => mk(`第${i}套`, 203, 92, 1, 6))
    expect(judgeSkeleton(decks).problems).toEqual([])
  })

  it('各占一项之首 —— 这是正常的构筑取舍', () => {
    const decks = [
      mk('身材', 210, 90, 1, 6),
      mk('高攻', 203, 99, 1, 6),
      mk('抢攻', 203, 90, 3, 6),
      mk('解场', 203, 90, 1, 10),
      mk('平庸甲', 200, 88, 1, 5),
      mk('平庸乙', 199, 87, 1, 5),
    ]
    expect(judgeSkeleton(decks).problems).toEqual([])
  })

  it(`独占 ${MAX_TOPS} 项仍然放行`, () => {
    const decks = [
      mk('占两项', 210, 99, 1, 6),
      mk('乙', 203, 90, 3, 6),
      mk('丙', 203, 90, 1, 10),
      mk('丁', 200, 88, 1, 5),
      mk('戊', 199, 87, 1, 5),
      mk('己', 198, 86, 1, 5),
    ]
    expect(judgeSkeleton(decks).problems).toEqual([])
  })

  it('并列第一不算占住 —— 优势不独有就不构成叠加', () => {
    // 甲乙两套四项完全相同且都是最大值,任何一项都没有严格最高者
    const decks = [
      mk('甲', 210, 99, 3, 10),
      mk('乙', 210, 99, 3, 10),
      mk('丙', 200, 88, 1, 5),
      mk('丁', 199, 87, 1, 5),
      mk('戊', 198, 86, 1, 5),
      mk('己', 197, 85, 1, 5),
    ]
    expect(judgeSkeleton(decks).problems).toEqual([])
  })
})

describe('骨架闸门 · 该红的必须红', () => {
  it('一套牌独占三项之首 —— 即使每项都在容差内', () => {
    // 这一条按 2026-08-08 的真实数字造:魏武当时 216/99/2,
    // 身材相对中位数 203 只高 6.4%,**没超** 8% 的容差。
    const decks = [
      mk('魏武', 216, 99, 2, 6),
      mk('桃園', 203, 92, 1, 6),
      mk('克己', 203, 86, 1, 7),
      mk('鷹視', 197, 92, 1, 10),
      mk('坐斷', 206, 92, 1, 5),
      mk('大隱', 194, 90, 1, 9),
    ]
    const v = judgeSkeleton(decks)
    // 先确认它确实**没有**触发身材那条 —— 否则这个用例证明不了任何东西
    expect(v.problems.some((p) => p.includes('总身材偏离'))).toBe(false)
    expect(v.problems.some((p) => p.includes('骨架占优过多') && p.includes('魏武'))).toBe(true)
    expect(v.tops.find((t) => t.name === '魏武')?.axes).toEqual(['body', 'attack', 'aggro'])
  })

  it('独占四项之首', () => {
    const decks = [
      mk('全占', 210, 99, 3, 10),
      ...Array.from({ length: 5 }, (_, i) => mk(`陪跑${i}`, 200, 88, 1, 5)),
    ]
    expect(judgeSkeleton(decks).problems.some((p) => p.includes('4 项'))).toBe(true)
  })

  it(`总身材偏离中位数超过 ${BODY_DEV_PCT}%`, () => {
    const decks = [
      mk('虚胖', 240, 90, 1, 6),
      ...Array.from({ length: 5 }, (_, i) => mk(`常规${i}`, 203, 92, 1, 6)),
    ]
    expect(judgeSkeleton(decks).problems.some((p) => p.includes('总身材偏离'))).toBe(true)
  })

  it('偏低那一侧也要红 —— 判据是绝对值', () => {
    const decks = [
      mk('骨瘦', 180, 90, 1, 6),
      ...Array.from({ length: 5 }, (_, i) => mk(`常规${i}`, 203, 92, 1, 6)),
    ]
    expect(judgeSkeleton(decks).problems.some((p) => p.includes('骨瘦'))).toBe(true)
  })
})

describe('现役六套预组', () => {
  it('通过骨架闸门', () => {
    const v = judgeSkeleton(PRECON_DECKS.map((d) => ({ name: d.name.zh, health: deckHealth(d.cardIds) })))
    expect(v.problems).toEqual([])
  })
})
