import { describe, expect, it } from 'vitest'
import { draftPool, offerCards } from './expeditionDraft'
import { CARDS_BY_ID } from './cards'

describe('远征关间选牌', () => {
  it('池只含该主义 + 中立的可收集卡', () => {
    for (const id of draftPool('royal')) {
      const c = CARDS_BY_ID[id]
      expect(c).toBeDefined()
      expect(c.token ?? false).toBe(false)
      expect(['royal', 'neutral']).toContain(c.doctrine)
    }
  })
  it('抽三张:不重复、都真实、确定性', () => {
    const a = offerCards('royal', 12345)
    const b = offerCards('royal', 12345)
    expect(a.offered).toEqual(b.offered)
    expect(a.offered).toHaveLength(3)
    expect(new Set(a.offered).size).toBe(3)
    for (const id of a.offered) expect(CARDS_BY_ID[id]).toBeDefined()
  })
  it('推进 rngState(下一次抽到的不同)', () => {
    const a = offerCards('royal', 999)
    const b = offerCards('royal', a.next)
    expect(b.offered).not.toEqual(a.offered)
  })
})
