import { describe, expect, it } from 'vitest'
import { judgeBalance } from './balanceGate'

// 闸门自检:该红时红、不该红时不红。样板见 campaignGate.test.ts。
//
// 这一道最要紧的一条是**「六套互相克制」必须被抓住** ——
// 那种局面下每一套的总胜率都在 50% 附近,只看总分完全正常,
// 而实际体验是「选卡组即定胜负」的猜拳。sim-balance 的注释里写着这条设计意图,
// 这里把它变成断言。

/** 造一个 n×n 的对局矩阵:pct[i][j] = i 打 j 的胜率百分数(对角忽略) */
const mk = (names: string[], pct: number[][], gamesPerPair = 100) => {
  const n = names.length
  const wins = Array.from({ length: n }, () => Array(n).fill(0))
  const games = Array.from({ length: n }, () => Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      games[i][j] = gamesPerPair
      wins[i][j] = Math.round((pct[i][j] / 100) * gamesPerPair)
    }
  }
  return { names, wins, games }
}

const N4 = ['甲', '乙', '丙', '丁']

describe('预组平衡闸门 · 不该红的不许红', () => {
  it('全部 50% 的理想矩阵', () => {
    const pct = [
      [0, 50, 50, 50],
      [50, 0, 50, 50],
      [50, 50, 0, 50],
      [50, 50, 50, 0],
    ]
    expect(judgeBalance(mk(N4, pct)).problems).toEqual([])
  })

  it('带正常起伏的真实矩阵(2026-08-04 实测那一组的形状)', () => {
    // 总胜率 53.0 / 58.2 / 51.4 / 46.4 / 42.6 / 48.4,无对位出 30–70
    const names = ['桃園', '魏武', '克己', '鷹視', '坐斷', '大隱']
    const pct = [
      [0, 49, 58, 42, 65, 51],
      [51, 0, 51, 60, 63, 66],
      [42, 49, 0, 55, 62, 49],
      [58, 40, 45, 0, 50, 39],
      [35, 37, 38, 50, 0, 53],
      [49, 34, 51, 61, 47, 0],
    ]
    expect(judgeBalance(mk(names, pct)).problems).toEqual([])
  })
})

describe('预组平衡闸门 · 该红的必须红', () => {
  it('某一套总胜率过高', () => {
    const pct = [
      [0, 75, 72, 70],
      [25, 0, 50, 50],
      [28, 50, 0, 50],
      [30, 50, 50, 0],
    ]
    const v = judgeBalance(mk(N4, pct))
    expect(v.problems.some((p) => p.includes('总胜率超出'))).toBe(true)
  })

  it('某一套总胜率过低', () => {
    const pct = [
      [0, 25, 28, 30],
      [75, 0, 50, 50],
      [72, 50, 0, 50],
      [70, 50, 50, 0],
    ]
    expect(judgeBalance(mk(N4, pct)).problems.some((p) => p.includes('总胜率超出'))).toBe(true)
  })

  it('**猜拳局面**:每套总分都在 50% 附近,但对位全是碾压', () => {
    // 甲克乙、乙克丙、丙克丁、丁克甲 —— 环形克制
    const pct = [
      [0, 85, 50, 15],
      [15, 0, 85, 50],
      [50, 15, 0, 85],
      [85, 50, 15, 0],
    ]
    const v = judgeBalance(mk(N4, pct))
    // 总胜率全部正好 50%,只看总分完全正常
    for (const o of v.overall) expect(o).toBeCloseTo(50, 0)
    // 但对位必须被抓住 —— 这正是这道闸门存在的理由
    expect(v.problems.some((p) => p.includes('对位极化'))).toBe(true)
    expect(v.worst).toBeDefined()
  })

  it('最极端对位排在最前,给调校方向用', () => {
    const pct = [
      [0, 90, 50, 50],
      [10, 0, 72, 50],
      [50, 28, 0, 50],
      [50, 50, 50, 0],
    ]
    const v = judgeBalance(mk(N4, pct))
    expect(v.worst?.pct).toBe(90)
  })
})

describe('预组平衡闸门 · 阈值配得上样本量', () => {
  // 这一组是为了钉住「不需要改成显著性检验」那个结论(见 balanceGate.ts 文件头)。
  it('总胜率 band 距 50% 有 4.5 个标准误(500 局)', () => {
    const se = Math.sqrt(0.25 / 500) * 100
    expect(10 / se).toBeGreaterThan(4)
  })

  it('对位 band 距 50% 有 4 个标准误(100 局)', () => {
    const se = Math.sqrt(0.25 / 100) * 100
    expect(20 / se).toBeGreaterThanOrEqual(4)
  })
})
