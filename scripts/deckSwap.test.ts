import { describe, expect, it } from 'vitest'
import { applyKit, swapInto } from './deckSwap'

// 换牌逻辑的闸门。它决定**整把尺子量的是什么** —— 换掉谁、换几张、能不能换,
// 直接决定 Δ 的含义。抽出来之前这段逻辑一行测试都没有。

const COSTS: Record<string, number> = { a1: 1, b3: 3, c3: 3, d5: 5, e9: 9, test4: 4, kit2: 2, kit6: 6 }
const costOf = (id: string) => COSTS[id] ?? 99
const opts = (copies = 2, protect?: Set<string>) => ({ copies, costOf, protect })

describe('swapInto', () => {
  it('换掉**费用最接近**的那张', () => {
    // 待测 4 费:b3/c3 差 1,d5 差 1,a1 差 3,e9 差 5 —— 同差按字典序,b3 先
    const out = swapInto(['a1', 'b3', 'b3', 'd5', 'e9'], 'test4', opts(2))
    expect(out).toEqual(['a1', 'test4', 'test4', 'd5', 'e9'])
  })

  it('一张不够就接着换下一个受害者', () => {
    const out = swapInto(['a1', 'b3', 'd5', 'e9'], 'test4', opts(2))
    // b3 只有一张,继续找同差的 d5
    expect(out).toEqual(['a1', 'test4', 'test4', 'e9'])
  })

  it('换不满就返回 null —— **不返回换了一半的牌**', () => {
    // 只有一张可换(自己不算),要 2 张
    expect(swapInto(['test4', 'b3'], 'test4', opts(2))).toBeNull()
  })

  it('不会把自己换掉', () => {
    const out = swapInto(['test4', 'b3', 'c3'], 'test4', opts(2))
    expect(out).toEqual(['test4', 'test4', 'test4'])
  })

  it('受保护的卡不许被换掉 —— 否则待测卡会挤掉使自己生效的东西', () => {
    const out = swapInto(['kit2', 'kit2', 'b3', 'c3'], 'test4', opts(2, new Set(['kit2'])))
    expect(out).toEqual(['kit2', 'kit2', 'test4', 'test4'])
  })

  it('受保护的卡占满牌组时换不进去,返回 null', () => {
    expect(swapInto(['kit2', 'kit2'], 'test4', opts(2, new Set(['kit2'])))).toBeNull()
  })

  it('同一副牌同一张卡永远换掉同一个人(可复现)', () => {
    const deck = ['a1', 'b3', 'c3', 'd5', 'e9', 'b3']
    expect(swapInto(deck, 'test4', opts(2))).toEqual(swapInto(deck, 'test4', opts(2)))
  })

  it('不改动传进来的那副牌', () => {
    const deck = ['a1', 'b3', 'c3']
    const copy = [...deck]
    swapInto(deck, 'test4', opts(1))
    expect(deck).toEqual(copy)
  })
})

describe('applyKit', () => {
  it('把 KIT 全部换进去,并把它们标成受保护', () => {
    const r = applyKit(['a1', 'b3', 'c3', 'd5', 'e9', 'a1'], ['kit2'], opts(2))
    expect(r).not.toBeNull()
    expect(r!.deck.filter((x) => x === 'kit2')).toHaveLength(2)
    expect(r!.protect.has('kit2')).toBe(true)
  })

  it('**后换的不许挤掉先换的**', () => {
    const r = applyKit(['a1', 'a1', 'b3', 'c3', 'd5', 'e9'], ['kit2', 'kit6'], opts(2))
    expect(r).not.toBeNull()
    // 两张 KIT 各两份都还在
    expect(r!.deck.filter((x) => x === 'kit2')).toHaveLength(2)
    expect(r!.deck.filter((x) => x === 'kit6')).toHaveLength(2)
  })

  it('塞不下就返回 null,而不是给一副残缺的牌', () => {
    expect(applyKit(['a1', 'b3'], ['kit2', 'kit6'], opts(2))).toBeNull()
  })

  it('KIT 之后再换待测卡,KIT 一张都不会少', () => {
    const r = applyKit(['a1', 'a1', 'b3', 'c3', 'd5', 'e9'], ['kit2'], opts(2))!
    const out = swapInto(r.deck, 'test4', { copies: 2, costOf, protect: r.protect })
    expect(out).not.toBeNull()
    expect(out!.filter((x) => x === 'kit2')).toHaveLength(2)
    expect(out!.filter((x) => x === 'test4')).toHaveLength(2)
  })
})
