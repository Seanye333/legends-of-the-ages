import { describe, expect, it } from 'vitest'
import type { CardDef, EffectOp, EffectScript } from '../engine/types'
import { isNoOp, stripNoOps } from './noOp'
import { CARDS, CARDS_BY_ID } from './cards'

// 造一张最小可用的卡。合成样本而不是真卡池 —— 真卡池今天恰好没有某个形状,
// 不代表这段代码还活着。最后一组才拿真数据验「剥干净了」。
const card = (over: Partial<CardDef> = {}): CardDef =>
  ({
    id: 'x',
    collectorNo: 1,
    name: { zh: '測試', en: 'Test' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    attack: 2,
    health: 3,
    keywords: [],
    ...over,
  }) as CardDef

const SUPPLY = { op: 'gainSupply', amount: 1 } as unknown as EffectOp
const DRAW0 = { op: 'draw', count: 0 } as unknown as EffectOp
const DRAW1 = { op: 'draw', count: 1 } as unknown as EffectOp

/** `isNoOp` 只声明了 `{op: string}`,直接喂字面量会撞上多余属性检查。 */
const noOp = (o: Record<string, unknown>) => isNoOp(o as { op: string })

describe('isNoOp', () => {
  it('量为 0 的一步算空操作', () => {
    expect(noOp({ op: 'draw', count: 0 })).toBe(true)
    expect(noOp({ op: 'damage', amount: 0 })).toBe(true)
  })

  it('量不为 0 的不算', () => {
    expect(noOp({ op: 'draw', count: 1 })).toBe(false)
  })

  it('不带量的 op 一概不算 —— 别把「没有 amount 字段」读成「amount 是 0」', () => {
    expect(noOp({ op: 'setField' })).toBe(false)
    expect(noOp({ op: 'draw' })).toBe(false)
  })

  it('增益要两项都为 0 才算废 —— +1/+0 是有意义的', () => {
    expect(noOp({ op: 'buffStats', attack: 0, health: 0 })).toBe(true)
    expect(noOp({ op: 'buffStats', attack: 1, health: 0 })).toBe(false)
  })
})

describe('stripNoOps', () => {
  it('剥掉夹在实事中间的那半步', () => {
    const out = stripNoOps(card({ battlecry: { ops: [SUPPLY, DRAW0] } }))
    expect(out.battlecry?.ops).toEqual([SUPPLY])
  })

  it('没有可剥的就**原样返回同一个对象**', () => {
    // 引用相等而不只是值相等:全池两千多张卡每张都白复制一遍是没必要的开销,
    // 而且复制会打断别处按引用做的判断。
    const c = card({ battlecry: { ops: [SUPPLY, DRAW1] } })
    expect(stripNoOps(c)).toBe(c)
  })

  it('整段都是空操作时**不动它** —— 那是卡面在说谎,该让 lint 报', () => {
    const c = card({ battlecry: { ops: [DRAW0] }, text: { zh: '戰吼:抽一張牌。', en: 'x' } })
    expect(stripNoOps(c)).toBe(c)
  })

  it('伏兵、军令状奖励、抉择的每个模式都要覆盖到', () => {
    const out = stripNoOps(
      card({
        secret: { trigger: 'onAttack', script: { ops: [SUPPLY, DRAW0] } },
        quest: { goal: { kind: 'spells', count: 3 }, reward: { ops: [SUPPLY, DRAW0] } },
        choose: {
          modes: [
            { name: { zh: '甲', en: 'a' }, script: { ops: [SUPPLY, DRAW0] } },
            { name: { zh: '乙', en: 'b' }, script: { ops: [DRAW1] } },
          ],
        },
      } as unknown as Partial<CardDef>),
    )
    expect(out.secret?.script.ops).toEqual([SUPPLY])
    expect(out.quest?.reward.ops).toEqual([SUPPLY])
    expect(out.choose?.modes[0].script.ops).toEqual([SUPPLY])
    // 没动过的那个模式必须还是原来那个对象
    expect(out.choose?.modes[1].script.ops).toEqual([DRAW1])
  })

  it('伏笔里的空操作也剥,而剥空了的伏笔整条丢掉', () => {
    const delayed = (ops: EffectOp[]) =>
      ({ op: 'delay', turns: 2, script: { ops } }) as unknown as EffectOp
    const kept = stripNoOps(card({ battlecry: { ops: [delayed([SUPPLY, DRAW0])] } }))
    expect((kept.battlecry?.ops[0] as { script: EffectScript }).script.ops).toEqual([SUPPLY])

    // 到期什么都不做的伏笔,连「等两回合」这个提示都不该给 ——
    // 但这张卡剥完就空了,于是按上面那条规矩整段留着不动。
    const empty = card({ battlecry: { ops: [delayed([DRAW0])] } })
    expect(stripNoOps(empty)).toBe(empty)
    // 还剩别的实事时,空伏笔才真的被丢掉
    const mixed = stripNoOps(card({ battlecry: { ops: [SUPPLY, delayed([DRAW0])] } }))
    expect(mixed.battlecry?.ops).toEqual([SUPPLY])
  })
})

// 一张卡上所有脚本(含伏笔那一层)。测试里自带一份 ——
// contentRules 的 allScripts 在 scripts/ 下,而这一层单测不引 scripts/。
function everyOp(c: CardDef): EffectOp[] {
  const scripts: Array<EffectScript | undefined> = [
    c.battlecry, c.deathrattle, c.spell, c.endOfTurn, c.startOfTurn,
    c.onDamaged, c.onAttack, c.onSpellCast, c.combo,
    c.secret?.script, c.quest?.reward,
    ...(c.choose?.modes.map((m) => m.script) ?? []),
  ]
  const flat = (ops: EffectOp[]): EffectOp[] =>
    ops.flatMap((o) => (o.op === 'delay' ? [o, ...flat(o.script.ops)] : [o]))
  return scripts.flatMap((s) => (s ? flat(s.ops) : []))
}

describe('全池', () => {
  // 素材源头的生成器留下的六张。改那个要姊妹仓库,所以剥在合并层。
  const DIRTY_SIX = ['wang-yun', 'sun-kuang', 'zhang-ying', 'tao-ying', 'liu-fan', 'hist-yang-fugong']

  it('那六张的 draw 0 没了,而屯糧还在 —— 剥的是噪声,不是效果', () => {
    for (const id of DIRTY_SIX) {
      const c = CARDS_BY_ID[id]
      expect(c, `${id} 不在卡池里了 —— 这条测试该改,不是该删`).toBeDefined()
      const ops = everyOp(c)
      expect(ops.some((o) => o.op === 'draw'), `${id} 还带着 draw`).toBe(false)
      expect(ops.some((o) => o.op === 'gainSupply'), `${id} 的屯糧被剥掉了`).toBe(true)
    }
  })

  // 唯一一张**故意**什么都不做的牌:「謠言」是洗进对手牌库的废牌,
  // 整张卡的意义就是占一张手牌位,卡面写的也是「空無一物」。
  // 引擎要求锦囊必须有 spell/secret/combo/choose/quest 之一,
  // 于是它用 `draw 0` 当那段合法但无事发生的脚本。
  // 它是手写的,本来就不走剥离层;写在这里是为了让「例外」是**明写的**,
  // 而不是靠某条规则恰好扫不到它。
  const DELIBERATE = new Set(['token-liu-yan'])

  it('合并完的全池只剩那一张故意的空操作', () => {
    // 这条比 lint-content 的 no-op 规则强两处:
    //   · 那条只扫**可收集**卡,衍生物一张都看不见(token-liu-yan 就是这么漏的)
    //   · 手写卡包**不走**剥离层,所以新卡里写出一个量为 0 的 op,红的是这里
    const dirty = CARDS.filter((c) => !DELIBERATE.has(c.id)).flatMap((c) =>
      everyOp(c).filter(isNoOp).map((o) => `${c.id}: ${o.op}`),
    )
    expect(dirty).toEqual([])
  })
})
