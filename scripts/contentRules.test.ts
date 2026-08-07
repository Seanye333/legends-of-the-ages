import { describe, expect, it } from 'vitest'
import type { CardDef } from '../src/engine/types'
import { allOps, allScripts, checkContent, flattenOps, referencedId } from './contentRules'

// 造一张最小可用的卡。规则测试**刻意不碰真卡池** ——
// 真卡池今天恰好没有某个错,不代表这条规则还活着(那正是 perf-budget
// 的 chunk 基线默默失效的方式)。每条规则都得喂一个必然触发它的合成样本。
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
    text: { zh: '文案', en: 'text' },
    ...over,
  }) as CardDef

/** 只跑规则,返回命中的规则名(去重排序)—— 断言写起来才干净。 */
const rules = (cards: CardDef[]): string[] =>
  [...new Set(checkContent({ all: cards, collectible: cards }).map((i) => i.rule))].sort()

/** 一张什么毛病都没有的卡:任何规则都不该报它。 */
const CLEAN = card()

describe('干净的卡不该报任何 error/warn', () => {
  it('基线:合成的干净卡零命中', () => {
    const issues = checkContent({ all: [CLEAN], collectible: [CLEAN] })
    expect(issues.filter((i) => i.level !== 'info')).toEqual([])
  })
})

describe('dangling-ref —— 指向不存在的卡', () => {
  it('summon 一个不存在的 defId 要报', () => {
    // 失败模式是运行时**静默无事发生**:引擎查不到就跳过,
    // 玩家只看到「战吼发动了但什么都没出来」。
    const c = card({ battlecry: { ops: [{ op: 'summon', defId: 'no-such', count: 1 }] } } as never)
    expect(rules([c])).toContain('dangling-ref')
  })

  it('指向真的存在的卡就不报', () => {
    const token = card({ id: 'tok', token: true })
    const c = card({ battlecry: { ops: [{ op: 'summon', defId: 'tok', count: 1 }] } } as never)
    expect(rules([c, token])).not.toContain('dangling-ref')
  })

  it('**埋在伏笔里**的引用也要查得到', () => {
    // delay 把一整段脚本包在 op 里,ops 是树不是列表。
    // 不展开的话,伏笔里的坏引用永远扫不出来 —— 而它的表现是三回合后什么都没发生。
    const c = card({
      battlecry: {
        ops: [
          { op: 'delay', turns: 2, script: { ops: [{ op: 'summon', defId: 'no-such', count: 1 }] } },
        ],
      },
    } as never)
    expect(rules([c])).toContain('dangling-ref')
  })

  it('军令奖励里的引用也要查得到', () => {
    // 奖励也是一段脚本。漏掉它的话「达成军令后什么都没发生」就没人拦得住。
    const c = card({
      type: 'stratagem',
      attack: undefined,
      health: undefined,
      quest: {
        id: 'q', name: { zh: 'q', en: 'q' },
        goal: { kind: 'playStratagem', count: 3 },
        reward: { ops: [{ op: 'summon', defId: 'no-such', count: 1 }] },
      },
    } as never)
    expect(rules([c])).toContain('dangling-ref')
  })

  it('羁绊成员与宿敌对不上也要报', () => {
    const bond = card({ bond: { name: { zh: 'b', en: 'b' }, members: ['ghost'], attack: 1, health: 1 } } as never)
    expect(rules([bond])).toContain('dangling-ref')
    const rival = card({ rival: { name: { zh: 'r', en: 'r' }, foe: 'ghost', attack: 1, health: 1 } } as never)
    expect(rules([rival])).toContain('dangling-ref')
  })
})

describe('type-shape —— 类型与字段对不上', () => {
  it('锦囊带身材要报', () => {
    expect(rules([card({ type: 'stratagem', attack: 2, health: 2 })])).toContain('type-shape')
  })

  it('武将缺攻或血要报', () => {
    expect(rules([card({ attack: undefined })])).toContain('type-shape')
    expect(rules([card({ health: undefined })])).toContain('type-shape')
  })

  it('武将带伏兵要报(伏兵只能是锦囊)', () => {
    const c = card({ secret: { trigger: 'enemyAttack', script: { ops: [] } } } as never)
    expect(rules([c])).toContain('type-shape')
  })

  it('非武将带光环要报 —— 它不会留在场上,光环永远不生效', () => {
    const c = card({
      type: 'stratagem', attack: undefined, health: undefined,
      aura: { scope: 'friendlyOthers', attack: 1, health: 0 },
    } as never)
    expect(rules([c])).toContain('type-shape')
  })

  it('正常的锦囊与武将都不报', () => {
    const strat = card({ type: 'stratagem', attack: undefined, health: undefined })
    expect(rules([strat, CLEAN])).not.toContain('type-shape')
  })
})

describe('discover-not-last —— 发现必须是脚本最后一个 op', () => {
  it('发现后面还有 op 要报', () => {
    // 引擎见挂起即 break,后面的 op 永远不会跑 —— 写在中间等于静默丢失。
    const c = card({
      battlecry: { ops: [{ op: 'discover', pool: 'myStratagem' }, { op: 'draw', count: 1 }] },
    } as never)
    expect(rules([c])).toContain('discover-not-last')
  })

  it('发现在最后就不报', () => {
    const c = card({
      battlecry: { ops: [{ op: 'draw', count: 1 }, { op: 'discover', pool: 'myStratagem' }] },
    } as never)
    expect(rules([c])).not.toContain('discover-not-last')
  })
})

describe('军令状三条', () => {
  const quest = (over: Record<string, unknown>) =>
    card({
      type: 'stratagem', attack: undefined, health: undefined,
      quest: {
        id: 'q', name: { zh: 'q', en: 'q' },
        goal: { kind: 'playStratagem', count: 3 },
        reward: { ops: [{ op: 'draw', count: 1 }] },
        ...over,
      },
    } as never)

  it('奖励要玩家指定目标 → quest-reward-target', () => {
    // 达成的那一刻玩家正在做别的事,没法再弹一次目标选择,
    // 于是会静默退化成随机 —— 卡面写着「消灭一个敌将」,实际打的是随机一个。
    const c = quest({ reward: { ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }] } })
    expect(rules([c])).toContain('quest-reward-target')
  })

  it('目标数 ≤ 0 → quest-goal(打出即达成)', () => {
    expect(rules([quest({ goal: { kind: 'playStratagem', count: 0 } })])).toContain('quest-goal')
  })

  it('军令状挂在武将上 → type-shape', () => {
    const c = card({
      quest: {
        id: 'q', name: { zh: 'q', en: 'q' },
        goal: { kind: 'playStratagem', count: 3 },
        reward: { ops: [{ op: 'draw', count: 1 }] },
      },
    } as never)
    expect(rules([c])).toContain('type-shape')
  })

  it('正常的军令锦囊三条都不报', () => {
    const r = rules([quest({})])
    expect(r).not.toContain('quest-reward-target')
    expect(r).not.toContain('quest-goal')
    expect(r).not.toContain('type-shape')
  })
})

describe('exclusive —— 抉择与连击/战吼互斥', () => {
  const chooseCard = (over: Partial<CardDef>) =>
    card({
      choose: {
        modes: [
          { label: { zh: 'a', en: 'a' }, script: { ops: [{ op: 'draw', count: 1 }] } },
          { label: { zh: 'b', en: 'b' }, script: { ops: [{ op: 'draw', count: 2 }] } },
        ],
      },
      ...over,
    } as never)

  it('抉择 + 连击要报(reducer 的优先级依赖这条)', () => {
    expect(rules([chooseCard({ combo: { ops: [{ op: 'draw', count: 1 }] } } as never)])).toContain('exclusive')
  })

  it('抉择卡还留着 battlecry 要报 —— 那是死代码', () => {
    // 姜維 就是这么出的事:pack5 换成抉择时清了 battlecry,却漏了 keywords。
    expect(rules([chooseCard({ battlecry: { ops: [{ op: 'draw', count: 1 }] } } as never)])).toContain('exclusive')
  })

  it('干净的抉择卡不报', () => {
    expect(rules([chooseCard({})])).not.toContain('exclusive')
  })
})

describe('range —— 数值越界', () => {
  it('费用越界、攻为负、血小于 1 都是 error', () => {
    expect(rules([card({ cost: 11 })])).toContain('range')
    expect(rules([card({ cost: -1 })])).toContain('range')
    expect(rules([card({ attack: -1 })])).toContain('range')
    expect(rules([card({ health: 0 })])).toContain('range')
  })

  it('过载过高是 warn 不是 error', () => {
    const issues = checkContent({ all: [card({ overload: 6 })], collectible: [card({ overload: 6 })] })
    const r = issues.filter((i) => i.rule === 'range')
    expect(r.length).toBeGreaterThan(0)
    expect(r.every((i) => i.level === 'warn')).toBe(true)
  })

  it('边界值不报:0 费与 10 费都是合法的', () => {
    expect(rules([card({ cost: 0 })])).not.toContain('range')
    expect(rules([card({ cost: 10 })])).not.toContain('range')
  })
})

describe('i18n / silent-effect —— 文案', () => {
  it('缺英文卡名、有中文无英文文案都报 i18n', () => {
    expect(rules([card({ name: { zh: '甲', en: '' } })])).toContain('i18n')
    expect(rules([card({ text: { zh: '有', en: '' } })])).toContain('i18n')
  })

  it('有效果却没有卡面文案 → silent-effect', () => {
    // 玩家看不见它会做什么。这一条和 overrideConflict 那三条是同一个家族。
    const c = card({ text: undefined, battlecry: { ops: [{ op: 'draw', count: 1 }] } } as never)
    expect(rules([c])).toContain('silent-effect')
  })

  it('没有效果的白板不写文案也不报', () => {
    expect(rules([card({ text: undefined })])).not.toContain('silent-effect')
  })
})

describe('text-mismatch —— 军需/阵形没写在卡面上', () => {
  it('军需没写要报', () => {
    expect(rules([card({ supplyCost: 2, text: { zh: '沒提', en: 'x' } })])).toContain('text-mismatch')
  })

  it('写了就不报', () => {
    expect(rules([card({ supplyCost: 2, text: { zh: '軍需 2。', en: 'x' } })])).not.toContain('text-mismatch')
  })

  it('阵形名没写在卡面上要报', () => {
    const c = card({
      formation: { name: { zh: '鋒矢', en: 'Wedge' }, attack: 1, health: 1 },
      text: { zh: '沒提', en: 'x' },
    } as never)
    expect(rules([c])).toContain('text-mismatch')
  })
})

describe('no-op —— 量为 0 的一步', () => {
  it('draw 0 要报', () => {
    expect(rules([card({ battlecry: { ops: [{ op: 'draw', count: 0 }] } } as never)])).toContain('no-op')
  })

  it('draw 1 不报', () => {
    expect(rules([card({ battlecry: { ops: [{ op: 'draw', count: 1 }] } } as never)])).not.toContain('no-op')
  })
})

describe('thin-mechanic —— 机制覆盖度', () => {
  it('只有一两张卡在用的 op 会被点名', () => {
    const c = card({ battlecry: { ops: [{ op: 'banish', target: 'chosenEnemyGeneral' }] } } as never)
    expect(rules([c])).toContain('thin-mechanic')
  })

  it('三张以上就不再点名', () => {
    const mk = (i: number) =>
      card({ id: `c${i}`, battlecry: { ops: [{ op: 'banish', target: 'chosenEnemyGeneral' }] } } as never)
    const issues = checkContent({ all: [mk(1), mk(2), mk(3)], collectible: [mk(1), mk(2), mk(3)] })
    expect(issues.filter((i) => i.rule === 'thin-mechanic' && i.msg.includes('banish'))).toEqual([])
  })
})

describe('辅助函数', () => {
  it('flattenOps 展开伏笔的嵌套', () => {
    const ops = [
      { op: 'draw', count: 1 },
      { op: 'delay', turns: 1, script: { ops: [{ op: 'damage', amount: 2, target: 'enemyHero' }] } },
    ] as never
    expect(flattenOps(ops).map((o) => o.op)).toEqual(['draw', 'delay', 'damage'])
  })

  it('allScripts 收齐所有触发时机,含抉择每一路与军令奖励', () => {
    const c = card({
      battlecry: { ops: [] }, deathrattle: { ops: [] },
      choose: {
        modes: [
          { label: { zh: 'a', en: 'a' }, script: { ops: [] } },
          { label: { zh: 'b', en: 'b' }, script: { ops: [] } },
        ],
      },
    } as never)
    expect(allScripts(c)).toHaveLength(4)
  })

  it('referencedId 认得三种引用', () => {
    expect(referencedId({ op: 'summon', defId: 'a', count: 1 } as never)).toBe('a')
    expect(referencedId({ op: 'transform', target: 'x', into: 'b' } as never)).toBe('b')
    expect(referencedId({ op: 'addToHand', defId: 'c', count: 1 } as never)).toBe('c')
    expect(referencedId({ op: 'draw', count: 1 } as never)).toBeUndefined()
  })

  it('allOps 把伏笔里的 op 也算进来', () => {
    const c = card({
      battlecry: {
        ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'draw', count: 1 }] } }],
      },
    } as never)
    expect(allOps(c).map((o) => o.op)).toContain('draw')
  })
})
