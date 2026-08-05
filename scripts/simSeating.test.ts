import { describe, expect, it } from 'vitest'
import { seatingFor } from './simSeating'

// 钉住一条不变量:**座位与先后手必须相互独立**。
//
// 这不是理论洁癖 —— sim-hero-mirror 曾经把它们绑死(first = seed&1,
// 而 seed 的奇偶与座位同步翻转),结果被测的备选主公 400 局全程后手。
// 这游戏的先手优势有 20 多个百分点,于是那道闸门的中性点变成了约 26%,
// 而它还在按 40–60% 判定:六个备选主公里四个被判「过弱」,
// 唯一「合格」的那个(朱熹)修正后其实是 74%,真正过强的就是它。
// 靠这把尺子还劝退过两轮设计尝试(见 overrides/heroes.ts 呂蒙 那一段)。
//
// 同一个 bug 在 sim-balance 里发生过一次、修过一次,教训写在了那个文件里,
// 没有传到隔壁。所以这次把它钉成可执行的断言,而不是又一条注释。
describe('对镜模拟的座位编排', () => {
  it('座位与先后手各自均衡', () => {
    const N = 4000
    let altSeat1 = 0
    let first1 = 0
    for (let i = 0; i < N; i++) {
      const s = seatingFor(i)
      altSeat1 += s.altSeat
      first1 += s.first
    }
    expect(altSeat1).toBe(N / 2)
    expect(first1).toBe(N / 2)
  })

  it('**四种组合等量出现** —— 这一条才是当年漏掉的', () => {
    // 只看边际分布是看不出问题的:出 bug 的那版里 altSeat 和 first 各自都是
    // 一半一半,完美均衡 —— 但联合分布只有两格有值(first 恒 = 1-altSeat)。
    const N = 4000
    const combo = new Map<string, number>()
    for (let i = 0; i < N; i++) {
      const s = seatingFor(i)
      const k = `${s.altSeat}${s.first}`
      combo.set(k, (combo.get(k) ?? 0) + 1)
    }
    expect([...combo.keys()].sort()).toEqual(['00', '01', '10', '11'])
    for (const k of ['00', '01', '10', '11']) expect(combo.get(k)).toBe(N / 4)
  })

  it('被测方先手与后手的局数相同', () => {
    // 「备选主公坐过几次先手」= altSeat === first 的次数,必须是一半
    const N = 4000
    let altFirst = 0
    for (let i = 0; i < N; i++) {
      const s = seatingFor(i)
      if (s.altSeat === s.first) altFirst++
    }
    expect(altFirst).toBe(N / 2)
  })

  it('绑死先后手的那个写法会被这套断言抓住(反向验证)', () => {
    // 复现当年的 bug:first 从 seed 推,而 seed 与 i 同奇偶
    const broken = (i: number) => {
      const seed = i * 131 + 7
      return { altSeat: (i & 1) as 0 | 1, first: (seed & 1) as 0 | 1 }
    }
    const N = 4000
    let altFirst = 0
    const combo = new Set<string>()
    for (let i = 0; i < N; i++) {
      const s = broken(i)
      combo.add(`${s.altSeat}${s.first}`)
      if (s.altSeat === s.first) altFirst++
    }
    // 被测方一局先手都没坐过,而联合分布只覆盖了两格
    expect(altFirst).toBe(0)
    expect([...combo].sort()).toEqual(['01', '10'])
  })

  it('局数取 4 的倍数才跑得齐一个完整周期', () => {
    const cycle = [0, 1, 2, 3].map((i) => {
      const s = seatingFor(i)
      return `${s.altSeat}${s.first}`
    })
    expect([...cycle].sort()).toEqual(['00', '01', '10', '11'])
  })
})
