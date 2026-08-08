import { describe, expect, it } from 'vitest'
import { loreProgress } from './collectionGoals'
import { CARDS, COLLECTIBLE_CARDS } from './cards'

// ---------- 档案进度 ----------
//
// 判定层是纯函数、数据由调用方喂进来 —— 这是**故意的**:
// lore.gen 是 144KB 懒加载的,这个模块被收藏屏静态 import,
// 自己去 import 它等于把那 144KB 拖回首屏(perf-budget 会红)。
// 所以这里也用合成数据喂,顺便证明它真的不依赖真列传。
describe('档案进度', () => {
  const twoIds = COLLECTIBLE_CARDS.slice(0, 2).map((c) => c.id)
  const LORE = {
    [twoIds[0]]: { quote: { zh: 'q', en: 'q' }, arms: { zh: 'a', en: 'a' } },
    [twoIds[1]]: { quote: { zh: 'q', en: 'q' } },
  }

  it('分母只数带那个字段的卡,分子只数你拥有的', () => {
    const rows = loreProgress(LORE, { [twoIds[0]]: 1 })
    const quote = rows.find((r) => r.field === 'quote')!
    expect(quote.total).toBe(2)
    expect(quote.owned).toBe(1)
    expect(quote.ratio).toBeCloseTo(0.5)
    const arms = rows.find((r) => r.field === 'arms')!
    expect(arms.total).toBe(1)
    expect(arms.owned).toBe(1)
  })

  it('一个字段全池都没有时 ratio 是 0,不是 NaN —— 进度条会因此画成 NaN%', () => {
    const rows = loreProgress(LORE, {})
    const poem = rows.find((r) => r.field === 'poem')!
    expect(poem.total).toBe(0)
    expect(poem.ratio).toBe(0)
  })

  it('**不可收集的卡不进分母** —— 否则那是一条永远走不满的进度条', () => {
    const token = CARDS.find((c) => c.token)
    expect(token, '卡池里没有衍生物?').toBeTruthy()
    const rows = loreProgress({ [token!.id]: { line: { zh: 'l', en: 'l' } } }, {})
    expect(rows.find((r) => r.field === 'line')!.total).toBe(0)
  })

  it('四种字段都列出来,顺序固定 —— UI 不该因为今天谁多谁少而换行序', () => {
    expect(loreProgress({}, {}).map((r) => r.field)).toEqual(['quote', 'line', 'arms', 'poem'])
  })
})
