import { describe, expect, it } from 'vitest'
import { judgeChapter, seOf } from './campaignGate'

// 闸门的自检:**该红时红、不该红时不红**。
//
// 这一层此前没人验 —— 要验就得跑十分钟的 sim-campaign,而且只能看到「这一份卡池
// 现在是绿的」,看不出「换一条坏曲线它认不认得出来」。判定逻辑抽成纯函数之后,
// 两个方向都能用几毫秒钉住(ROADMAP「闸门自检推广」)。
//
// 下面的实测数据是 2026-08-04 本机跑出来的原始胜率,原样留着当回归基线。

const pc = (xs: number[]) => xs.map((x) => x / 100)
const problemsOf = (ch: number, xs: number[], games: number, openFloor: number) =>
  judgeChapter(ch, pc(xs), { games, openFloor }).problems

// GAMES=240 实测(三章全绿)
const CH1_240 = [73, 76, 50, 52, 67, 52, 36, 34]
const CH2_240 = [52, 41, 55, 60, 37, 42, 52, 28]
const CH3_240 = [52, 25, 65, 72, 50, 34, 12, 23]
// GAMES=60 实测的第二章 —— **旧闸门在这里误报**「曲线太平:前半 48% vs 后半 46%」,
// 而那 2 个点的差在 60 局下的标准误是 ±4.5pp。ROADMAP 把这次误报当成真问题
// 写进了待办第一条,差点据此去重调关卡数值。
const CH2_60 = [47, 43, 48, 55, 43, 50, 55, 37]

describe('冒险难度闸门 · 不该红的不许红', () => {
  it('240 局实测的三章全绿', () => {
    expect(problemsOf(1, CH1_240, 240, 55)).toEqual([])
    expect(problemsOf(2, CH2_240, 240, 35)).toEqual([])
    expect(problemsOf(3, CH3_240, 240, 35)).toEqual([])
  })

  it('60 局那份数据不再被误判成「曲线太平」', () => {
    expect(problemsOf(2, CH2_60, 60, 35)).toEqual([])
  })

  it('样本撑不起落差判定时要明说,不能拿一个「测不动」的绿冒充「没问题」', () => {
    // 60 局:差值标准误 ~4.5pp,即使真实落差为 0,z 也只有 1.8 —— 永远红不了
    expect(judgeChapter(2, pc(CH2_60), { games: 60, openFloor: 35 }).note).toMatch(/没有分辨力/)
    // 240 局:测得动,不该有提示
    expect(judgeChapter(2, pc(CH2_240), { games: 240, openFloor: 35 }).note).toBeUndefined()
  })
})

describe('冒险难度闸门 · 该红的必须红', () => {
  it('曲线全平', () => {
    expect(problemsOf(2, [50, 50, 50, 50, 50, 50, 50, 50], 240, 35)).toContainEqual(
      expect.stringContaining('曲线太平'),
    )
  })

  it('曲线倒挂:越往后越好打', () => {
    expect(problemsOf(2, [30, 32, 35, 38, 55, 58, 60, 62], 240, 35)).toContainEqual(
      expect.stringContaining('曲线太平'),
    )
  })

  it('开章劝退', () => {
    expect(problemsOf(2, [12, 40, 38, 36, 30, 25, 20, 10], 240, 35)).toContainEqual(
      expect.stringContaining('开章'),
    )
    // 第一章门槛更高(55):40% 在后续章是合格的开章,在第一章不是
    expect(problemsOf(1, [40, 70, 65, 60, 50, 45, 40, 30], 240, 55)).toContainEqual(
      expect.stringContaining('开章'),
    )
    expect(problemsOf(2, [40, 70, 65, 60, 50, 45, 40, 30], 240, 35)).not.toContainEqual(
      expect.stringContaining('开章'),
    )
  })

  it('末关不够关底', () => {
    expect(problemsOf(2, [60, 55, 50, 48, 45, 42, 40, 70], 240, 35)).toContainEqual(
      expect.stringContaining('关底不够关底'),
    )
  })
})

describe('冒险难度闸门 · 统计量本身', () => {
  it('样本量翻四倍,标准误减半', () => {
    const a = seOf(0.5, 60)
    const b = seOf(0.5, 240)
    expect(a / b).toBeCloseTo(2, 1)
  })

  it('0% / 100% 的关卡不会把 z 变成无穷', () => {
    // 朴素 √(p(1−p)/n) 在这里是 0,z 会变成 Infinity,任何一关跑出 0% 都被无条件判红。
    // Agresti–Coull 加 2 成功 2 失败之后边界不再退化。
    expect(seOf(0, 240)).toBeGreaterThan(0)
    expect(seOf(1, 240)).toBeGreaterThan(0)
    const v = judgeChapter(3, pc([100, 80, 60, 40, 30, 20, 10, 0]), { games: 240, openFloor: 35 })
    for (const p of v.problems) expect(p).not.toMatch(/Infinity|NaN/)
    // 这是一条又陡又合规的曲线,不该红
    expect(v.problems).toEqual([])
  })

  it('关数为奇数时前后半也能分(向下取整,中间那关归后半)', () => {
    expect(() => judgeChapter(1, pc([70, 50, 20]), { games: 240, openFloor: 55 })).not.toThrow()
  })
})
