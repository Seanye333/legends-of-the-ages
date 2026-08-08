import { describe, expect, it } from 'vitest'
import { CARD_ALIAS, faceAlias } from './aliases'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../cards'

// 绰号表。它是从 lore 抽出来贴死的常量(理由见 aliases.ts:CardFace 每帧都在渲染,
// import 那份 144KB 会把首屏顶爆),而**抽出来贴死的表在这个仓库有一种烂法**:
// 源数据换了一批 id,表里的键全都对不上,于是一个绰号都不显示 —— 而且不报错。
describe('卡面绰号', () => {
  it('**每一条的 id 都真的在卡池里** —— 对不上号的表等于没有表', () => {
    for (const id of Object.keys(CARD_ALIAS)) {
      expect(CARDS_BY_ID[id], `${id} 不在卡池里`).toBeDefined()
      expect(CARDS_BY_ID[id].token ?? false, `${id} 是衍生物`).toBe(false)
    }
  })

  it('有规模 —— 表空了不能静默通过', () => {
    expect(Object.keys(CARD_ALIAS).length).toBeGreaterThanOrEqual(30)
  })

  it('中英都非空(英文按设计回落到中文)', () => {
    for (const [id, a] of Object.entries(CARD_ALIAS)) {
      expect(a.zh.length, id).toBeGreaterThan(1)
      expect(a.en.length, id).toBeGreaterThan(1)
    }
  })

  it('**上卡面的一律不超过 FACE_MAX** —— 卡面是三行小布局,长了会顶乱版面', () => {
    for (const id of Object.keys(CARD_ALIAS)) {
      const shown = faceAlias(id)
      if (!shown) continue
      expect(shown.zh.length, `${id} 的「${shown.zh}」太长了`).toBeLessThanOrEqual(5)
    }
  })

  it('长的那几个**只是不上卡面,不是被删了** —— 它们在图鉴详情里照样看得到', () => {
    const long = Object.entries(CARD_ALIAS).filter(([, a]) => a.zh.length > 5)
    expect(long.length, '长绰号一个都没有?那这条判断就没在守什么').toBeGreaterThan(0)
    for (const [id] of long) {
      expect(faceAlias(id), `${id} 不该上卡面`).toBeUndefined()
      expect(CARD_ALIAS[id], `${id} 不该从表里消失`).toBeDefined()
    }
  })

  it('没有绰号的卡返回 undefined,不是空串 —— 空串会在卡面上占一行空白', () => {
    const plain = COLLECTIBLE_CARDS.find((c) => !CARD_ALIAS[c.id])!
    expect(faceAlias(plain.id)).toBeUndefined()
  })
})
