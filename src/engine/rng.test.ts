import { describe, expect, it } from 'vitest'
import { rngInt, rngNext, rngShuffle, seedRng } from './rng'

describe('rng', () => {
  it('same seed produces the same sequence', () => {
    let a = seedRng(12345)
    let b = seedRng(12345)
    for (let i = 0; i < 100; i++) {
      const ra = rngNext(a)
      const rb = rngNext(b)
      expect(ra.value).toBe(rb.value)
      a = ra.next
      b = rb.next
    }
  })

  it('different seeds diverge', () => {
    const a = rngNext(seedRng(1))
    const b = rngNext(seedRng(2))
    expect(a.value).not.toBe(b.value)
  })

  it('rngInt stays within bounds', () => {
    let s = seedRng(999)
    for (let i = 0; i < 1000; i++) {
      const r = rngInt(s, 6)
      expect(r.value).toBeGreaterThanOrEqual(0)
      expect(r.value).toBeLessThan(6)
      s = r.next
    }
  })

  it('rngShuffle is a deterministic permutation and does not mutate input', () => {
    const input = Array.from({ length: 30 }, (_, i) => i)
    const frozen = Object.freeze(input.slice())
    const a = rngShuffle(seedRng(7), frozen)
    const b = rngShuffle(seedRng(7), frozen)
    expect(a.result).toEqual(b.result)
    expect(a.result.slice().sort((x, y) => x - y)).toEqual(input)
    expect(frozen).toEqual(input)
    expect(a.result).not.toEqual(input) // 30 个元素洗牌后原序概率可忽略
  })
})
