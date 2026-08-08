// 后手补偿与模式修饰符的**叠加语义** —— 一道很短但不空的闸门。
//
// 【先说一条我写完又删掉的测试,免得下一个人再写一遍】
// 最初写的是「遍历 24 个乱斗,断言后手在补偿的两条轴上不吃亏」。
// 那 24 条断言**永远不可能红**:乱斗的修饰符是双方同吃的,
// 于是两座位之差恒等于 `SECOND_PLAYER_COMP` 本身,和乱斗写了什么无关。
// 一条永远不会红的测试守不住任何东西 —— 它只会让人以为这里有防线。
//
// 真正值得钉的是**叠加的方式**,不是某个模式的取值:
// 补偿必须是**加在修饰符之上的常量差**。写成 `mod ?? COMP`(替代)
// 或者按座位号而不是先后手判定,都会让某些模式里的先手优势悄悄回到 73.8%,
// 而乱斗与远征**都没有平衡闸门**,不会有任何东西报警。
import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/init'
import { SECOND_PLAYER_COMP } from '../engine/types'
import { effectiveCost } from '../engine/resolve'
import type { CardDef, CardLibrary, GameConfig, RunModifiers } from '../engine/types'

const LIB: CardLibrary = Object.fromEntries(
  Array.from({ length: 30 }, (_, i): [string, CardDef] => [
    `c${i}`,
    {
      id: `c${i}`,
      collectorNo: i + 1,
      name: { zh: 'c', en: 'c' },
      type: 'general',
      doctrine: 'neutral',
      dynasty: 'qun',
      rarity: 'common',
      archetype: 'warrior',
      cost: 5,
      attack: 2,
      health: 2,
      keywords: [],
    },
  ]),
)
const deck = Array.from({ length: 30 }, (_, i) => `c${i}`)

function game(mod: RunModifiers | undefined, first: 0 | 1) {
  const cfg: GameConfig = {
    seed: 7,
    heroIds: ['h', 'h'],
    deckIds: [deck, deck],
    first,
    // 模式修饰符**双方同吃**(乱斗就是这么给的)
    modifiers: [mod, mod],
  }
  const s = createGame(cfg, LIB)
  const costOf = (side: 0 | 1) => effectiveCost(s.players[side].hand[0], LIB)
  return {
    firstCost: costOf(first),
    secondCost: costOf(first === 0 ? 1 : 0),
    firstArmor: s.players[first].armor,
    secondArmor: s.players[first === 0 ? 1 : 0].armor,
  }
}

describe('后手补偿是加在模式修饰符之上的常量差', () => {
  // 这三组取值刻意包含**方向相反**的那一个(兵微將寡 handCostDelta:+1),
  // 它正是最容易把补偿抵消掉的形状。
  const MODS: Array<[string, RunModifiers | undefined]> = [
    ['无修饰符', undefined],
    ['手牌 −2(纵横捭阖)', { handCostDelta: -2 }],
    ['手牌 +1(兵微將寡)', { handCostDelta: 1 }],
    ['护甲 +10', { startArmor: 10 }],
  ]

  for (const [name, mod] of MODS) {
    for (const first of [0, 1] as const) {
      it(`${name} · 先手是座位 ${first}:两座位之差恒为补偿本身`, () => {
        const g = game(mod, first)
        expect(g.firstCost - g.secondCost).toBe(-SECOND_PLAYER_COMP.handCostDelta)
        expect(g.secondArmor - g.firstArmor).toBe(SECOND_PLAYER_COMP.startArmor)
      })
    }
  }

  it('**跟先后手走,不跟座位号走** —— 这一条错了先手优势会原样回来', () => {
    const a = game(undefined, 0)
    const b = game(undefined, 1)
    // 换谁先手,占便宜的那一侧要跟着换;两次的差值必须完全一样
    expect(a.secondArmor - a.firstArmor).toBe(b.secondArmor - b.firstArmor)
    expect(a.firstCost - a.secondCost).toBe(b.firstCost - b.secondCost)
  })

  it('修饰符是**叠加**不是替代 —— 写成 `mod ?? COMP` 就会红', () => {
    const plain = game(undefined, 0)
    const armored = game({ startArmor: 10 }, 0)
    // 替代语义下后手会恒等于 10;叠加语义下是 10 + 补偿
    expect(armored.secondArmor).toBe(10 + SECOND_PLAYER_COMP.startArmor)
    expect(armored.secondArmor - plain.secondArmor).toBe(10)
  })

  it('补偿的方向自检 —— 尺子先验一遍', () => {
    expect(SECOND_PLAYER_COMP.handCostDelta).toBeLessThan(0)
    expect(SECOND_PLAYER_COMP.startArmor).toBeGreaterThan(0)
  })
})
