import { describe, expect, it } from 'vitest'
import { fitBody, type BodyRow } from './bodyFit'
import { budgetOf, defaultProbes, probesForCost, vanilla } from './bodyProbes'

describe('探针设计', () => {
  it('同一档里总点数要跨得开 —— 否则斜率没有方差可用', () => {
    // 这正是「不能拿卡池现成的白板卡量」的原因:卡池里同费卡总点数几乎都一样。
    const totals = new Set(probesForCost(4).map((p) => p.attack + p.health))
    expect(totals.size).toBeGreaterThanOrEqual(3)
  })

  it('同一个总点数下劈法也要跨得开 —— 否则攻和血共线,回归解不动', () => {
    const B = budgetOf(4)
    const atB = probesForCost(4).filter((p) => p.attack + p.health === B)
    const attacks = atB.map((p) => p.attack)
    expect(Math.max(...attacks) - Math.min(...attacks)).toBeGreaterThan(2)
  })

  it('攻和血都不小于 1', () => {
    // 0 攻的白板在贪心 AI 眼里是另一种东西(它永远不会去换),不是「少一点身材」
    for (const p of defaultProbes()) {
      expect(p.attack).toBeGreaterThanOrEqual(1)
      expect(p.health).toBeGreaterThanOrEqual(1)
    }
  })

  it('探针是纯白板 —— 一点效果都不能带', () => {
    // 带效果的话量到的是「效果 + 身材」的合力,而这次要的恰恰是把身材单独拎出来
    for (const p of defaultProbes()) {
      const anyC = p.card as unknown as Record<string, unknown>
      for (const k of ['battlecry', 'spell', 'deathrattle', 'aura', 'bond', 'endOfTurn', 'choose']) {
        expect(anyC[k]).toBeUndefined()
      }
      expect(p.card.keywords).toEqual([])
    }
  })

  it('id 不重复,也不会和卡池撞', () => {
    const ids = defaultProbes().map((p) => p.card.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.startsWith('probe-')).toBe(true)
  })

  it('中立主义 —— 进哪套预组都合法', () => {
    for (const p of defaultProbes()) expect(p.card.doctrine).toBe('neutral')
  })

  it('vanilla 造出来的卡带得动费用与身材', () => {
    const c = vanilla(3, 4, 2)
    expect(c.cost).toBe(3)
    expect(c.attack).toBe(4)
    expect(c.health).toBe(2)
  })
})

describe('fitBody', () => {
  /** 造一批无噪声的观测:Δ = ka·攻 + kh·血 + 每档一个常数 */
  const synth = (ka: number, kh: number, offset: Record<number, number> = {}): BodyRow[] =>
    defaultProbes().map((p) => ({
      cost: p.cost,
      attack: p.attack,
      health: p.health,
      delta: ka * p.attack + kh * p.health + (offset[p.cost] ?? 0),
    }))

  it('无噪声时还原真系数', () => {
    const f = fitBody(synth(1.2, 0.9))
    expect(f.perAttack).toBeCloseTo(1.2, 6)
    expect(f.perHealth).toBeCloseTo(0.9, 6)
  })

  it('费用档的常数项被吸收掉 —— 换牌对象的差别不该算进身材头上', () => {
    // 每档加一个很大的偏移。不做组内去心的话,回归会把它当成「高费更强」学进斜率。
    const f = fitBody(synth(1.2, 0.9, { 2: -30, 4: 0, 6: +30 }))
    expect(f.perAttack).toBeCloseTo(1.2, 6)
    expect(f.perHealth).toBeCloseTo(0.9, 6)
  })

  it('攻和血共线时返回 0,不返回一对互相抵消的巨大系数', () => {
    // 只撒均衡劈法 → 两列完全共线。这时候「解出来了」比「解不动」危险得多。
    const rows: BodyRow[] = [2, 4, 6].flatMap((cost) =>
      [3, 4, 5].map((t) => ({ cost, attack: t, health: t, delta: t * 2 })),
    )
    const f = fitBody(rows)
    expect(f.perAttack).toBe(0)
    expect(f.perHealth).toBe(0)
    expect(Number.isNaN(f.perAttack)).toBe(false)
  })

  it('样本太少时不假装有结论', () => {
    expect(fitBody([{ cost: 2, attack: 1, health: 1, delta: 0 }]).seAttack).toBe(Infinity)
  })

  it('噪声让标准误变大,但估计仍然围着真值', () => {
    // 确定性「噪声」:按下标取值,免得用 Math.random
    const base = synth(1.2, 0.9)
    const noisy = base.map((r, i) => ({ ...r, delta: r.delta + ((i % 5) - 2) * 1.5 }))
    const clean = fitBody(base)
    const dirty = fitBody(noisy)
    expect(dirty.seAttack).toBeGreaterThan(clean.seAttack)
    expect(Math.abs(dirty.perAttack - 1.2)).toBeLessThan(0.8)
  })

  it('残差标准差报出来 —— 和理论噪声比一比就知道模型漏了什么', () => {
    const f = fitBody(synth(1.2, 0.9))
    expect(f.residSd).toBeCloseTo(0, 6)
  })
})
