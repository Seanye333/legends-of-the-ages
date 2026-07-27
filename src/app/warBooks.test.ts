// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useTower } from './towerStore'
import { combineBooks, offerBooks, shouldOfferBook, WAR_BOOKS } from '../content/warBooks'
import { CARDS_BY_ID } from '../content/cards'

beforeEach(() => {
  localStorage.clear()
  useTower.setState({ floor: 1, best: 0, active: false, books: [], offered: null, rngState: 0x5eed })
})

describe('兵书内容', () => {
  it('id 唯一,startTokens 都是真实衍生物', () => {
    const ids = WAR_BOOKS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const b of WAR_BOOKS) {
      for (const id of b.modifiers.startTokens ?? []) {
        const c = CARDS_BY_ID[id]
        expect(c, `${b.id} → ${id}`).toBeDefined()
        expect(c.token ?? false, `${b.id} 引用的 ${id} 不是衍生物`).toBe(true)
      }
    }
  })

  it('三选一不会给已经拿过的', () => {
    const owned = WAR_BOOKS.slice(0, 5).map((b) => b.id)
    const { ids } = offerBooks(1234, owned)
    for (const id of ids) expect(owned).not.toContain(id)
  })

  it('候选是确定性的 —— 同一个种子给同一组', () => {
    expect(offerBooks(99, []).ids).toEqual(offerBooks(99, []).ids)
  })

  it('合成:同类修正相加,衍生物拼起来', () => {
    const { bonusHp, modifiers } = combineBooks(['wb-simafa', 'wb-huangshi', 'wb-wuzi', 'wb-liji'])
    expect(modifiers.startArmor).toBe(5)
    expect(bonusHp).toBe(5)
    expect(modifiers.startTokens).toEqual(['token-tie-qi', 'token-jin-jun'])
  })

  it('每三层一次', () => {
    expect(shouldOfferBook(3)).toBe(true)
    expect(shouldOfferBook(6)).toBe(true)
    expect(shouldOfferBook(4)).toBe(false)
    expect(shouldOfferBook(0)).toBe(false)
  })
})

describe('爬塔里的兵书', () => {
  it('通到第三层给三选一,选完接着爬', () => {
    const s = useTower.getState()
    useTower.setState({ floor: 3 })
    s.begin()
    useTower.getState().settle(true)
    const offered = useTower.getState().offered!
    expect(offered).toHaveLength(3)
    useTower.getState().pickBook(offered[0])
    expect(useTower.getState().books).toEqual([offered[0]])
    expect(useTower.getState().offered).toBeNull()
  })

  // 摔下来清空是爬塔的规矩 —— 兵书跟层数一起归零,否则第二趟起手就带十本
  it('摔下来层数与兵书一起归零,最高层保留', () => {
    useTower.setState({ floor: 6, best: 5, books: ['wb-sunzi'] })
    useTower.getState().begin()
    useTower.getState().settle(false)
    expect(useTower.getState().floor).toBe(1)
    expect(useTower.getState().books).toEqual([])
    expect(useTower.getState().best).toBe(5)
  })

  it('不在三的倍数层不给书', () => {
    useTower.setState({ floor: 4 })
    useTower.getState().begin()
    useTower.getState().settle(true)
    expect(useTower.getState().offered).toBeNull()
  })
})
