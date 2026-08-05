import { describe, expect, it } from 'vitest'
import { diffAgainst, reportDiff, type Snapshot } from './baseline'

// 这一层存在的全部理由是「别再把噪声当成结论」,所以它自己必须先分得清噪声。
// 这个仓库已经两次栽在这上面(sim-campaign 的 2 个点、sim-hero-mirror 的坏尺子)。

const snap = (values: Record<string, number>, games = 400): Snapshot => ({
  sim: 'test',
  games,
  values,
})

describe('平衡基线对比', () => {
  it('第一次记录时不报任何变化', () => {
    expect(diffAgainst(undefined, snap({ a: 50 }))).toEqual([])
    expect(reportDiff(undefined, snap({ a: 50 })).join('')).toMatch(/第一次记录/)
  })

  it('小于噪声的差值不算变化', () => {
    // 400 局:单次标准误 2.5pp,差值标准误 ~3.5pp。2 个点远在噪声里。
    expect(diffAgainst(snap({ a: 50 }), snap({ a: 52 }))).toEqual([])
  })

  it('真的动了就要报出来', () => {
    const c = diffAgainst(snap({ a: 50 }), snap({ a: 65 }))
    expect(c).toHaveLength(1)
    expect(c[0].delta).toBe(15)
    expect(c[0].z).toBeGreaterThan(2)
  })

  it('样本越小,越难判定「真的动了」', () => {
    // 同样 8 个点的差:400 局时显著,40 局时不显著
    expect(diffAgainst(snap({ a: 50 }, 400), snap({ a: 58 }, 400))).toHaveLength(1)
    expect(diffAgainst(snap({ a: 50 }, 40), snap({ a: 58 }, 40))).toEqual([])
  })

  it('按变化幅度排序,最该看的排最前', () => {
    const c = diffAgainst(snap({ a: 50, b: 50 }), snap({ a: 60, b: 75 }))
    expect(c.map((x) => x.name)).toEqual(['b', 'a'])
  })

  it('新增或消失的项不炸', () => {
    expect(() => diffAgainst(snap({ a: 50 }), snap({ b: 50 }))).not.toThrow()
    expect(diffAgainst(snap({ a: 50 }), snap({ b: 50 }))).toEqual([])
  })

  it('没有超噪声变化时明确说出来,而不是沉默', () => {
    // 沉默会被读成「没跑」;这个仓库最贵的一类 bug 就是静默失效
    expect(reportDiff(snap({ a: 50 }), snap({ a: 51 })).join('')).toMatch(/没有超过噪声的变化/)
  })
})
