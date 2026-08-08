import { describe, expect, it } from 'vitest'
import { formationBeneficiaries } from './resolve'
import { BOARD_LIMIT } from './types'
import type { CardDef, CardInstance, CardLibrary, FormationDef, FormationShape } from './types'

// 八阵的**位置判定**。纯函数,喂合成数据,不碰真卡池。
//
// 【为什么这份测试值得写全 —— 阵形的失效是静默的】
// 判定跑在 `refreshAuras` 里,每次场面变动整轮重算。判错的后果不是崩,
// 是「某个位置的人本该 +3/+0 而他没有」—— 玩家只会以为自己记错了规则。
//
// 每一种都钉三件事:**门槛之下什么都不给**、**门槛之上给的正好是那几格**、
// **锚点位置改变结果**(不改变的话这条阵形就跟摆位无关,那它就不是阵形)。
// 最后一条尤其重要:补的四种里 `goose` / `square` 是唯二真的读锚点位置的,
// 写错成「不读锚点」照样能过前两类断言。

const DEF = (shape: FormationShape): FormationDef => ({
  id: `f-${shape}`,
  name: { zh: '阵', en: 'F' },
  shape,
  attack: 1,
  health: 0,
})

const card = (id: string, troop?: CardDef['troop']): CardDef => ({
  id,
  collectorNo: 95000,
  name: { zh: '甲', en: 'A' },
  type: 'general',
  doctrine: 'neutral',
  dynasty: 'qun',
  rarity: 'common',
  archetype: 'warrior',
  cost: 1,
  attack: 1,
  health: 1,
  keywords: [],
  troop,
})

const LIB: CardLibrary = {
  u: card('u'),
  cav: card('cav', 'cavalry'),
}

// 只需要 defId —— 判定函数不看别的字段
const board = (n: number, defId = 'u'): CardInstance[] =>
  Array.from({ length: n }, (_, i) => ({ iid: i, defId }) as CardInstance)

const who = (n: number, shape: FormationShape, anchor = 0, defId = 'u') =>
  formationBeneficiaries(board(n, defId), anchor, DEF(shape), LIB)

describe('八阵 · 原有四种', () => {
  it('锋矢:≥3 人给最左', () => {
    expect(who(2, 'wedge')).toEqual([])
    expect(who(3, 'wedge')).toEqual([0])
    expect(who(5, 'wedge')).toEqual([0])
  })

  it('鹤翼:≥4 人给两翼', () => {
    expect(who(3, 'crane')).toEqual([])
    expect(who(4, 'crane')).toEqual([0, 3])
  })

  it('鱼鳞:同兵种 ≥3 才成阵', () => {
    expect(who(3, 'scale', 0, 'u')).toEqual([]) // 白板没有兵种
    expect(who(3, 'scale', 0, 'cav')).toEqual([0, 1, 2])
  })

  it('长蛇:满员才给,而且给全体', () => {
    expect(who(BOARD_LIMIT - 1, 'serpent')).toEqual([])
    expect(who(BOARD_LIMIT, 'serpent')).toHaveLength(BOARD_LIMIT)
  })
})

describe('八阵 · 补齐的四种', () => {
  it('偃月:≥3 人给正中,偶数人取靠左的那个中(必须定死,否则回放分叉)', () => {
    expect(who(2, 'crescent')).toEqual([])
    expect(who(3, 'crescent')).toEqual([1])
    expect(who(4, 'crescent')).toEqual([1]) // (4-1)/2 = 1.5 → 1
    expect(who(5, 'crescent')).toEqual([2])
    expect(who(6, 'crescent')).toEqual([2])
  })

  it('偃月**不读锚点** —— 中军就是中军,谁举旗都一样', () => {
    expect(who(5, 'crescent', 0)).toEqual(who(5, 'crescent', 4))
  })

  it('方圆:≥3 人给锚点与左右紧邻', () => {
    expect(who(2, 'square', 1)).toEqual([])
    expect(who(3, 'square', 1)).toEqual([0, 1, 2])
    expect(who(5, 'square', 2)).toEqual([1, 2, 3])
  })

  it('**方圆在边上只有两个人吃** —— 形状本身的性质,不特判', () => {
    expect(who(5, 'square', 0)).toEqual([0, 1])
    expect(who(5, 'square', 4)).toEqual([3, 4])
  })

  it('雁行:≥3 人给锚点右侧的全部', () => {
    expect(who(2, 'goose', 0)).toEqual([])
    expect(who(4, 'goose', 0)).toEqual([1, 2, 3])
    expect(who(4, 'goose', 2)).toEqual([3])
  })

  it('**雁行摆在最右就一个人都吃不到** —— 摆位真的有讲究', () => {
    expect(who(4, 'goose', 3)).toEqual([])
  })

  it('衡轭:≥3 人给中军,n≥4 时正好是鹤翼的补集', () => {
    expect(who(2, 'yoke')).toEqual([])
    expect(who(3, 'yoke')).toEqual([1])
    expect(who(5, 'yoke')).toEqual([1, 2, 3])
    // 补集关系(n≥4 时):两者并起来是全场,交集为空
    const n = 5
    const a = who(n, 'crane')
    const b = who(n, 'yoke')
    expect([...a, ...b].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4])
    expect(a.filter((i) => b.includes(i))).toEqual([])
  })

  it('四种都不会给出越界或重复的下标(判定直接喂给附魔层,越界会静默丢增益)', () => {
    for (const shape of ['crescent', 'square', 'goose', 'yoke'] as const) {
      for (let n = 1; n <= BOARD_LIMIT; n++) {
        for (let anchor = 0; anchor < n; anchor++) {
          const out = who(n, shape, anchor)
          expect(new Set(out).size, `${shape} n=${n} anchor=${anchor} 有重复`).toBe(out.length)
          for (const i of out) {
            expect(i, `${shape} n=${n} anchor=${anchor} 越界`).toBeGreaterThanOrEqual(0)
            expect(i).toBeLessThan(n)
          }
        }
      }
    }
  })
})
