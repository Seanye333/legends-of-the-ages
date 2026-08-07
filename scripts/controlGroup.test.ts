// controlGroup 的自检 —— 每条判据两个方向各验一遍。
//
// 这一份守的是**零点**。对照组被污染(混进一张有效果的卡)的表现是
// 零点悄悄偏移:不报错、不红,只是后面每一张卡的判决都跟着偏 ——
// 而那正是「一把会误报的尺子比没有尺子更危险」的原型。
import { describe, expect, it } from 'vitest'
import { band, isVanilla, pickControls, withinBand } from './controlGroup'
import type { CardDef } from '../src/engine/types'

function card(o: Partial<CardDef> = {}): CardDef {
  return {
    id: o.id ?? 'x',
    collectorNo: o.collectorNo ?? 1,
    name: { zh: 'x', en: 'x' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    attack: 2,
    health: 3,
    keywords: [],
    ...o,
  } as CardDef
}

describe('isVanilla', () => {
  it('纯身材的武将 —— 算', () => {
    expect(isVanilla(card())).toBe(true)
  })

  it('带关键词 —— 不算', () => {
    expect(isVanilla(card({ keywords: ['guard'] }))).toBe(false)
  })

  it('带战吼 —— 不算', () => {
    expect(isVanilla(card({ battlecry: { ops: [{ op: 'draw', count: 1 }] } }))).toBe(false)
  })

  it('带亡语 —— 不算', () => {
    expect(isVanilla(card({ deathrattle: { ops: [{ op: 'draw', count: 1 }] } }))).toBe(false)
  })

  it('带光环 —— 不算', () => {
    expect(isVanilla(card({ aura: { attack: 1, health: 0 } as CardDef['aura'] }))).toBe(false)
  })

  it('带激怒 —— 不算', () => {
    expect(isVanilla(card({ enrage: 2 }))).toBe(false)
  })

  it('带过载 —— 不算(它是负效果,同样会挪动零点)', () => {
    expect(isVanilla(card({ overload: 1 }))).toBe(false)
  })

  it('带军需 —— 不算', () => {
    expect(isVanilla(card({ supplyCost: 2 }))).toBe(false)
  })

  it('过载/军需写成 0 —— 算(0 和没写是一回事)', () => {
    expect(isVanilla(card({ overload: 0, supplyCost: 0 }))).toBe(true)
  })

  it('锦囊不算 —— 对照组要的是身材,锦囊没有身材', () => {
    expect(isVanilla(card({ type: 'stratagem', attack: undefined, health: undefined }))).toBe(false)
  })

  it('衍生物不算 —— 它进不了卡组', () => {
    expect(isVanilla(card({ token: true }))).toBe(false)
  })
})

describe('pickControls', () => {
  const pool = [
    card({ id: 'a2', cost: 2, collectorNo: 10 }),
    card({ id: 'b2', cost: 2, collectorNo: 20 }),
    card({ id: 'c2', cost: 2, collectorNo: 30 }),
    card({ id: 'a3', cost: 3, collectorNo: 5 }),
    card({ id: 'skip', cost: 3, collectorNo: 1, keywords: ['guard'] }),
    card({ id: 'notneutral', cost: 4, collectorNo: 1, doctrine: 'royal' }),
  ]

  it('每个费用档挑一张', () => {
    expect(pickControls(pool, [2, 3]).map((c) => c.id)).toEqual(['b2', 'a3'])
  })

  it('**确定性** —— 两次挑到同一批', () => {
    expect(pickControls(pool, [2, 3])).toEqual(pickControls(pool, [2, 3]))
  })

  it('顺序打乱也挑到同一批(按 collectorNo 排,不看入参顺序)', () => {
    const shuffled = [...pool].reverse()
    expect(pickControls(shuffled, [2, 3]).map((c) => c.id)).toEqual(['b2', 'a3'])
  })

  it('跳过非白板', () => {
    expect(pickControls(pool, [3]).map((c) => c.id)).toEqual(['a3'])
  })

  it('只挑中立 —— 别的主义会换到自己的预组,那就不是同一把尺子了', () => {
    expect(pickControls(pool, [4])).toEqual([])
  })

  it('某个费用档一张都没有就跳过,不报错', () => {
    expect(pickControls(pool, [9])).toEqual([])
  })
})

describe('band', () => {
  it('给出跨度与中位', () => {
    expect(band([6.5, 3.5, -1.0, -1.2, -4.8])).toEqual({ lo: -4.8, hi: 6.5, median: -1, n: 5 })
  })

  it('偶数个取中间两个的均值', () => {
    expect(band([0, 2, 4, 6]).median).toBe(3)
  })

  it('空的时候不炸', () => {
    expect(band([])).toEqual({ lo: 0, hi: 0, median: 0, n: 0 })
  })
})

describe('withinBand', () => {
  const b = band([6.5, 3.5, -1.0, -1.2, -4.8])

  it('落在跨度里 —— 和普通卡没区别', () => {
    expect(withinBand(0, b)).toBe(true)
    expect(withinBand(6.5, b)).toBe(true)
    expect(withinBand(-4.8, b)).toBe(true)
  })

  it('超出跨度 —— 真的更强/更弱', () => {
    expect(withinBand(13.5, b)).toBe(false)
    expect(withinBand(-9, b)).toBe(false)
  })

  it('没有对照组时**一律返回 false** —— 不假装知道零点在哪', () => {
    expect(withinBand(0, band([]))).toBe(false)
  })
})
