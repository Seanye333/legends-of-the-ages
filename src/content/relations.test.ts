import { describe, expect, it } from 'vitest'
import {
  ALL_BONDS,
  ALL_RIVALS,
  bondRoster,
  bondsOf,
  deckBonds,
  deckRivals,
  rivalsOf,
} from './relations'
import { CARDS_BY_ID } from './cards'

describe('羁绊 / 宿敌反向索引', () => {
  it('索引覆盖了全部羁绊与宿敌', () => {
    expect(ALL_BONDS.length).toBeGreaterThan(20)
    expect(ALL_RIVALS.length).toBeGreaterThan(20)
  })

  // 这一层存在的理由:卡面只写在锚点身上,成员那边什么都没有。
  it('成员也查得到自己在哪条羁绊里 —— 不只是锚点', () => {
    const taoyuan = ALL_BONDS.find((r) => r.bond.id === 'bond-taoyuan')!
    for (const id of bondRoster(taoyuan)) {
      expect(bondsOf(id).map((r) => r.bond.id), id).toContain('bond-taoyuan')
    }
    // 张飞不是锚点(锚点是刘备),但照样查得到
    expect(bondsOf('zhang-fei').some((r) => r.bond.id === 'bond-taoyuan')).toBe(true)
  })

  it('宿敌两头都查得到', () => {
    expect(rivalsOf('zhuge-liang').map((r) => r.rival.id)).toContain('rival-wuzhangyuan')
    expect(rivalsOf('sima-yi').map((r) => r.rival.id)).toContain('rival-wuzhangyuan')
  })

  it('索引里的每个 id 都是真实的卡', () => {
    for (const ref of ALL_BONDS) {
      for (const id of bondRoster(ref)) expect(CARDS_BY_ID[id], id).toBeDefined()
    }
    for (const ref of ALL_RIVALS) {
      expect(CARDS_BY_ID[ref.anchor.id]).toBeDefined()
      expect(CARDS_BY_ID[ref.rival.foe], ref.rival.id).toBeDefined()
    }
  })
})

describe('构筑器:这副牌能凑成哪几条', () => {
  it('凑齐的 missing 为空,没带的一条都不列', () => {
    const list = deckBonds(['liu-bei', 'guan-yu', 'zhang-fei'])
    const taoyuan = list.find((d) => d.ref.bond.id === 'bond-taoyuan')!
    expect(taoyuan.missing).toEqual([])
    expect(taoyuan.have).toHaveLength(3)
    // 完全没带人的羁绊不该出现
    expect(list.some((d) => d.ref.bond.id === 'bond-yangjia')).toBe(false)
  })

  it('差一个人时,列出的正是那个人 —— 这才是玩家要看的', () => {
    const list = deckBonds(['liu-bei', 'guan-yu'])
    const taoyuan = list.find((d) => d.ref.bond.id === 'bond-taoyuan')!
    expect(taoyuan.missing).toEqual(['zhang-fei'])
  })

  it('凑齐的排在前面', () => {
    const list = deckBonds(['liu-bei', 'guan-yu', 'zhang-fei', 'zhuge-liang'])
    expect(list[0].missing).toHaveLength(0)
  })

  it('带了宿敌的一头就算带了戏', () => {
    expect(deckRivals(['zhuge-liang']).map((r) => r.rival.id)).toContain('rival-wuzhangyuan')
    expect(deckRivals(['sima-yi']).map((r) => r.rival.id)).toContain('rival-wuzhangyuan')
  })
})
