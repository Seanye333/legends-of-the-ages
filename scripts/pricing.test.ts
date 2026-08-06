import { describe, expect, it } from 'vitest'
import type { CardDef, EffectOp } from '../src/engine/types'
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import {
  DEFAULT_WEIGHTS,
  buildCurve,
  cardValue,
  excessValue,
  impliedCost,
  median,
  unusedWeights,
  opValue,
  scriptValue,
} from './pricing'

const SAMPLE_CARDS = COLLECTIBLE_CARDS.filter((c) => !c.token)

// 造一张最小的卡:只填必需字段,别的按需覆盖。
const card = (over: Partial<CardDef> = {}): CardDef =>
  ({
    id: 't',
    name: { zh: '測試', en: 'Test' },
    cost: 3,
    type: 'general',
    doctrine: 'neutral',
    rarity: 'common',
    keywords: [],
    attack: 2,
    health: 3,
    ...over,
  }) as CardDef

describe('opValue', () => {
  it('没定价的 op 记 0 分并留下名字,不返回 undefined', () => {
    // 从前没有 default 分支:未定价的 op 返回 undefined,加起来得到 NaN,
    // 而 NaN 会污染它所在费用档的中位数,再由中位数反推出整张报表 ——
    // 且 NaN 的比较永远是 false,所以既不报错也不长得像个错误。
    const bag = new Set<string>()
    const bogus = { op: 'notARealOp' } as unknown as EffectOp
    expect(opValue(bogus, bag)).toBe(0)
    expect(bag.has('notARealOp')).toBe(true)
  })

  it('未定价的 op 不会让整张卡变成 NaN', () => {
    const bogus = { op: 'notARealOp' } as unknown as EffectOp
    const v = cardValue(card({ battlecry: { ops: [bogus] } } as Partial<CardDef>))
    expect(Number.isNaN(v)).toBe(false)
  })

  it('打脸比打随从便宜 —— 同样点数,目标是主公时折价', () => {
    const face = opValue({ op: 'damage', amount: 3, target: 'enemyHero' } as EffectOp)
    const board = opValue({ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' } as EffectOp)
    expect(face).toBeLessThan(board)
  })

  it('delay 递归给载荷定价,并按约期打折', () => {
    const payload = { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] } as never
    const now = scriptValue(payload)
    const in2 = opValue({ op: 'delay', turns: 2, script: payload } as unknown as EffectOp)
    expect(in2).toBeCloseTo(now * 0.85 ** 2, 6)
    expect(in2).toBeLessThan(now)
  })

  it('delay 里嵌着未定价的 op 时,名字也要收上来', () => {
    // 递归那条路上如果忘了把收集袋传下去,伏笔里的漏网 op 就永远不会被点名。
    const bag = new Set<string>()
    const payload = { ops: [{ op: 'notARealOp' }] } as never
    opValue({ op: 'delay', turns: 1, script: payload } as unknown as EffectOp, bag)
    expect(bag.has('notARealOp')).toBe(true)
  })

  it('给敌方召唤是负分', () => {
    expect(opValue({ op: 'summonForEnemy', count: 2 } as unknown as EffectOp)).toBeLessThan(0)
  })
})

describe('权重表', () => {
  it('改权重要真的传得到卡面价值上', () => {
    // fit-price 的全部前提就是「换一组权重能算出一套不同的价值」。
    // 如果哪一天有人在 opValue 里写死了一个字面量,拟合会安静地不动 ——
    // 相关系数纹丝不变,看起来像「这个 op 改了没用」,而不是「改根本没生效」。
    const c = card({ attack: 0, health: 0, spell: { ops: [{ op: 'returnToHand' }] } } as never)
    const base = cardValue(c)
    const tuned = cardValue(c, undefined, { ...DEFAULT_WEIGHTS, returnToHand: 9.9 })
    expect(base).toBeCloseTo(DEFAULT_WEIGHTS.returnToHand, 6)
    expect(tuned).toBeCloseTo(9.9, 6)
  })

  it('权重穿得过 delay 的递归', () => {
    const payload = { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] } as never
    const op = { op: 'delay', turns: 1, script: payload } as unknown as EffectOp
    const tuned = opValue(op, undefined, { ...DEFAULT_WEIGHTS, damage: 10 })
    expect(tuned).toBeCloseTo(2 * 10 * DEFAULT_WEIGHTS.delayDecay, 6)
  })

  it('每个权重都被 opValue 用到 —— 没有写死的字面量遗留', () => {
    // 这条同时管两件事:
    //   1. opValue 里还写着字面量的话,那个键是死的 —— 拟合会安静地不动,
    //      看起来像「这个 op 改了没用」,而不是「改根本没生效」;
    //   2. 卡池里没有卡在行使某个权重,那它是个没有证据的数字。
    // millSelf 属于第 2 种:卡池里一张自磨的卡都没有(mill 全部 side='enemy')。
    // 留着是为了将来有自磨流时不必重新想一遍,但别把它当成「校准过的数值」。
    // 其余 38 个都真的在用。price-cards 跑完会把这份名单打出来。
    expect(unusedWeights(SAMPLE_CARDS)).toEqual(['millSelf'])
  })

  it('unusedWeights 抓得住新加进表却没人用的权重', () => {
    // 反向验证:造一张只带 returnToHand 的卡当全部卡池,
    // 那么除了 returnToHand,别的权重都该被判成「没有证据」。
    const only = [card({ attack: 0, health: 0, spell: { ops: [{ op: 'returnToHand' }] } } as never)]
    const unused = unusedWeights(only)
    expect(unused).not.toContain('returnToHand')
    expect(unused).toContain('damage')
    expect(unused).toContain('draw')
  })
})

describe('cardValue', () => {
  it('装备打 0.85 折,傳承不打折', () => {
    // 第一版把非武将一律记 0 分,于是七件装备整整齐齐排在「疑似过弱」榜首。
    const plain = card({ type: 'equipment', attack: 3, health: 0, keywords: [] })
    const heir = card({ type: 'equipment', attack: 3, health: 0, keywords: [], heirloom: true })
    expect(cardValue(plain)).toBeCloseTo(3 * 0.85, 6)
    expect(cardValue(heir)).toBeCloseTo(3, 6)
  })

  it('抉择取最值钱的那一路,不是加起来', () => {
    const c = card({
      attack: 0,
      health: 0,
      choose: {
        modes: [
          { name: { zh: 'a', en: 'a' }, script: { ops: [{ op: 'damage', amount: 1, target: 'chosenEnemyGeneral' }] } },
          { name: { zh: 'b', en: 'b' }, script: { ops: [{ op: 'damage', amount: 5, target: 'chosenEnemyGeneral' }] } },
        ],
      },
    } as unknown as Partial<CardDef>)
    // 拿 DEFAULT_WEIGHTS.damage 算,不写死数值 —— 这条测的是「抉择取最大值」,
    // 不是「伤害每点值 1.5」。写死的话每次校准定价表都会假红一次。
    expect(cardValue(c)).toBeCloseTo(5 * DEFAULT_WEIGHTS.damage, 6)
  })

  it('过载与军需是减分', () => {
    const base = cardValue(card())
    expect(cardValue(card({ overload: 2 }))).toBeLessThan(base)
    expect(cardValue(card({ supplyCost: 2 }))).toBeLessThan(base)
  })

  it('条件效果打折', () => {
    const uncond = card({ attack: 0, health: 0, spell: { ops: [{ op: 'draw', count: 2 }] } } as never)
    const cond = card({
      attack: 0,
      health: 0,
      spell: { ops: [{ op: 'draw', count: 2 }], condition: { kind: 'boardCount', min: 2 } },
    } as never)
    expect(cardValue(cond)).toBeCloseTo(cardValue(uncond) * 0.75, 6)
  })
})

describe('median', () => {
  it('偶数个取中间两个的平均,空数组给 0', () => {
    expect(median([3, 1, 4, 2])).toBe(2.5)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([])).toBe(0)
  })
})

describe('buildCurve', () => {
  it('压平回摆 —— 曲线必须单调不减', () => {
    // 高费档卡少,中位数会出现「9 费比 10 费还高」。不压的话最近邻反查会把
    // 一大票 6 费卡判成 10 费,榜单整页都是 +4(第一版就是这么输出的)。
    const { curve } = buildCurve([
      { cost: 1, value: 2 },
      { cost: 2, value: 9 },
      { cost: 3, value: 4 }, // 回摆
      { cost: 4, value: 12 },
    ])
    expect(curve.get(2)).toBe(9)
    expect(curve.get(3)).toBe(9) // 被前缀最大值顶上去
    expect(curve.get(4)).toBe(12)
    const vals = [1, 2, 3, 4].map((k) => curve.get(k)!)
    expect(vals).toEqual([...vals].sort((a, b) => a - b))
  })
})

describe('impliedCost / excessValue', () => {
  const curve = buildCurve([
    { cost: 1, value: 2 },
    { cost: 2, value: 4 },
    { cost: 3, value: 6 },
    { cost: 4, value: 8 },
  ])

  it('线性插值,不是最近邻', () => {
    // 最近邻会把 5 和 5.9 都吸到同一档,读不出差别。
    expect(impliedCost(curve, 5)).toBe(3)
    expect(impliedCost(curve, 4.2)).toBe(2)
    expect(impliedCost(curve, 5.9)).toBe(3)
  })

  it('超出两端时夹到端点,不外插', () => {
    expect(impliedCost(curve, -100)).toBe(1)
    expect(impliedCost(curve, 1000)).toBe(4)
  })

  it('excessValue 保留取整会丢掉的那部分信息', () => {
    // 两张卡都被判成「3 费」,但一张高出档位 0.1,另一张高出 1.9 ——
    // 拿 implied − cost 去做拟合,这两张是同一个数字,而卡池里绝大多数卡都落在这个区间。
    expect(impliedCost(curve, 6.1)).toBe(impliedCost(curve, 6.9))
    expect(excessValue(curve, 3, 6.1)).toBeCloseTo(0.1, 6)
    expect(excessValue(curve, 3, 6.9)).toBeCloseTo(0.9, 6)
  })

  it('费用不在曲线上时退到最高档,不返回 NaN', () => {
    expect(Number.isNaN(excessValue(curve, 99, 10))).toBe(false)
  })
})
