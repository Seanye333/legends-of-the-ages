import { describe, expect, it } from 'vitest'
import { VANILLA_FLAVOR } from './vanilla-flavor'
import { FLAVOR_OVERRIDES } from './flavor'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../cards'

// 白板卡的风味句。
//
// 【这一条闸门守的是「卡面上还有没有空白」,不是「这张表有没有内容」】
// 判据必须是**从卡池那边数**:表里写满一百条、而合并层没接上,
// 那张表照样是死的 —— 而这个仓库已经吃过一次(FLAVOR_OVERRIDES 走 spread
// 时「补一句风味」等于「删掉规则说明」,四张卡的关键词从卡面上蒸发)。
describe('白板风味句', () => {
  it('**全池没有一张卡面是空白的** —— 这才是这条要守的东西', () => {
    const blank = COLLECTIBLE_CARDS.filter((c) => !c.text?.zh?.trim())
    expect(blank.map((c) => `${c.name.zh}(${c.id})`)).toEqual([])
  })

  it('英文那一半也不许空 —— 英文界面上那就是一张真的白卡', () => {
    const blank = COLLECTIBLE_CARDS.filter((c) => !c.text?.en?.trim())
    expect(blank.map((c) => c.id)).toEqual([])
  })

  it('表里的每一条都指向真实存在的可收集卡', () => {
    for (const id of Object.keys(VANILLA_FLAVOR)) {
      expect(CARDS_BY_ID[id], `${id} 不在卡池里`).toBeDefined()
      expect(CARDS_BY_ID[id].token ?? false, `${id} 是衍生物`).toBe(false)
    }
  })

  it('**表里的每一条都真的出现在了卡面上** —— 合并层没接上的话表是死的', () => {
    for (const [id, t] of Object.entries(VANILLA_FLAVOR)) {
      expect(CARDS_BY_ID[id].text?.zh ?? '', id).toContain(t.zh)
    }
  })

  it('和人工挑的那份没有交集 —— 一张卡两句风味会被追加两遍', () => {
    const both = Object.keys(VANILLA_FLAVOR).filter((id) => FLAVOR_OVERRIDES[id])
    expect(both).toEqual([])
  })

  it('中英都不是空串,而且中文那句真的是中文', () => {
    for (const [id, t] of Object.entries(VANILLA_FLAVOR)) {
      expect(t.zh.length, id).toBeGreaterThan(4)
      expect(t.en.length, id).toBeGreaterThan(8)
      expect(/[一-鿿]/.test(t.zh), `${id} 的中文没有汉字`).toBe(true)
    }
  })
})
