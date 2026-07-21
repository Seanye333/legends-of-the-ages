import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../../engine/types'
import { formatEvent } from './eventText'
import { extractFloats } from './floats'

// 架构铁律 7:新增 GameEvent 变体后必须同步 eventText(战报文案)与
// floats/useEventAnimations(动效),否则事件会在 UI 里**静默丢失**。
//
// 这条铁律此前只写在文档里,没有任何自动化保障 —— 而它的失败模式恰恰是
// 「不报错、不崩溃、只是什么都没发生」,人工根本发现不了。
//
// 这个文件从 types.ts 源码里抠出所有事件名,再逐个喂进 UI 层,
// 断言每一个都能产出**中英双语**的战报行。漏一个就红。

const ENGINE_TYPES = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'engine',
  'types.ts',
)

// 从 `export type GameEvent = ...` 那一段里抠出所有 `type: 'Xxx'`
function declaredEventTypes(): string[] {
  const src = readFileSync(ENGINE_TYPES, 'utf8')
  const start = src.indexOf('export type GameEvent')
  expect(start, 'types.ts 里找不到 GameEvent 定义').toBeGreaterThan(-1)
  // 下一个顶层 `export` 之前的内容就是这个联合类型的全部
  const rest = src.slice(start + 'export type GameEvent'.length)
  const end = rest.indexOf('\nexport ')
  const body = end >= 0 ? rest.slice(0, end) : rest
  const names = [...body.matchAll(/type:\s*'([A-Za-z]+)'/g)].map((m) => m[1])
  return [...new Set(names)]
}

// 每种事件一个最小样本。加了新事件却没在这里补样本 → 下面第一条测试就红。
const SAMPLES: GameEvent[] = [
  { type: 'MulliganDone', player: 0, replacedCount: 2 },
  { type: 'TurnStarted', player: 0, turn: 3, mana: 3 },
  { type: 'TurnEnded', player: 0, turn: 3 },
  { type: 'CardDrawn', player: 0, iid: 1, defId: 'guan-yu' },
  { type: 'CardBurned', player: 0, defId: 'guan-yu' },
  { type: 'FatigueDamage', player: 0, amount: 2 },
  { type: 'HeroDamaged', player: 1, amount: 4, hpAfter: 26 },
  { type: 'HeroHealed', player: 0, amount: 3, hpAfter: 30 },
  { type: 'CardPlayed', player: 0, iid: 1, defId: 'guan-yu', cost: 7 },
  { type: 'GeneralSummoned', player: 0, iid: 2, defId: 'guan-yu', position: 0, attack: 7, health: 7 },
  { type: 'EffectTriggered', player: 0, sourceIid: 2, sourceDefId: 'guan-yu', kind: 'battlecry' },
  { type: 'GeneralDamaged', player: 1, iid: 3, amount: 2, healthAfter: 4 },
  { type: 'GeneralHealed', player: 0, iid: 2, amount: 2, healthAfter: 7 },
  { type: 'GeneralBuffed', player: 0, iid: 2, attack: 1, health: 1 },
  { type: 'KeywordGranted', player: 0, iid: 2, keyword: 'guard' },
  { type: 'GeneralDied', player: 1, iid: 3, defId: 'guan-yu' },
  {
    type: 'AttackResolved',
    attacker: 0,
    attackerIid: 2,
    target: { kind: 'hero', player: 1 },
    damageToTarget: 7,
    damageToAttacker: 0,
  },
  {
    type: 'DuelFought',
    challenger: 0,
    challengerIid: 2,
    defenderIid: 3,
    firstStrikeIid: 2,
    challengerDied: false,
    defenderDied: true,
  },
  { type: 'EquipmentAttached', player: 0, targetIid: 2, defId: 'eq-teng-jia' },
  { type: 'ArmorGained', player: 0, amount: 3, armorAfter: 3 },
  { type: 'GeneralReturned', player: 1, iid: 3, defId: 'guan-yu' },
  { type: 'CardDiscarded', player: 1, iid: 4, defId: 'guan-yu' },
  { type: 'DivineShieldPopped', player: 1, iid: 3 },
  { type: 'GeneralSilenced', player: 1, iid: 3 },
  { type: 'GeneralFrozen', player: 1, iid: 3 },
  { type: 'GeneralUnfrozen', player: 1, iid: 3 },
  { type: 'StealthBroken', player: 0, iid: 2 },
  { type: 'ManaGained', player: 0, amount: 1, temporary: true },
  { type: 'HeroPowerUsed', player: 0, heroId: 'liu-bei', powerId: 'hp-rende', cost: 2 },
  // ---- 第四卡包 ----
  { type: 'SecretPlayed', player: 0, iid: 7, defId: 'secret-qing-jun-ru-weng' },
  { type: 'SecretRevealed', player: 0, iid: 7, defId: 'secret-qing-jun-ru-weng' },
  { type: 'ComboTriggered', player: 0, iid: 8, defId: 'strat-huo-ji' },
  { type: 'ManaOverloaded', player: 0, amount: 2 },
  { type: 'ManaLocked', player: 0, amount: 2 },
  { type: 'GameEnded', winner: 0 },
]

const CTX = {
  name: (iid: number) => ({ zh: `将${iid}`, en: `General ${iid}` }),
  defName: (defId: string) => ({ zh: defId, en: defId }),
  heroName: (p: 0 | 1) => ({ zh: p === 0 ? '刘备' : '曹操', en: p === 0 ? 'Liu Bei' : 'Cao Cao' }),
}

describe('架构铁律 7:每个 GameEvent 都要能在 UI 里落地', () => {
  it('样本集覆盖 types.ts 里声明的全部事件(加了事件忘了补 UI 就会红)', () => {
    const declared = declaredEventTypes().sort()
    const sampled = [...new Set(SAMPLES.map((e) => e.type))].sort()
    expect(sampled).toEqual(declared)
  })

  it('每个事件都产出非空的中英双语战报行', () => {
    for (const ev of SAMPLES) {
      const line = formatEvent(ev, CTX)
      expect(line.zh.trim(), `${ev.type} 缺中文战报`).not.toBe('')
      expect(line.en.trim(), `${ev.type} 缺英文战报`).not.toBe('')
      // 战报不该把内部 type 名直接吐给玩家
      expect(line.zh, `${ev.type} 的中文战报疑似占位`).not.toContain(ev.type)
    }
  })

  it('EffectTriggered 的每种 kind 都有译名(新增触发器最容易漏这里)', () => {
    const kinds = [
      'battlecry',
      'deathrattle',
      'spell',
      'endOfTurn',
      'startOfTurn',
      'onDamaged',
      'heroPower',
    ] as const
    for (const kind of kinds) {
      const line = formatEvent(
        { type: 'EffectTriggered', player: 0, sourceDefId: 'guan-yu', kind },
        CTX,
      )
      expect(line.zh, `kind=${kind}`).not.toContain('undefined')
      expect(line.en, `kind=${kind}`).not.toContain('undefined')
    }
  })
})

describe('飘字', () => {
  it('伤害/治疗/增益/护甲/法力都有飘字,且负增益不会显示成 +-1', () => {
    const floats = extractFloats(
      [
        { type: 'GeneralDamaged', player: 1, iid: 3, amount: 2, healthAfter: 4 },
        { type: 'GeneralHealed', player: 0, iid: 2, amount: 2, healthAfter: 7 },
        { type: 'GeneralBuffed', player: 0, iid: 2, attack: 1, health: 1 },
        { type: 'GeneralBuffed', player: 0, iid: 2, attack: -2, health: -1 },
        { type: 'ArmorGained', player: 0, amount: 3, armorAfter: 3 },
        { type: 'ManaGained', player: 0, amount: 1, temporary: true },
      ],
      1,
    )
    const texts = floats.map((f) => f.text)
    expect(texts).toContain('-2')
    expect(texts).toContain('+2')
    expect(texts).toContain('+1/+1')
    // 临时增益到期走的是同一个事件、数值为负 —— 不能拼成 "+-2/+-1"
    expect(texts).toContain('-2/-1')
    expect(texts.some((t) => t.includes('+-'))).toBe(false)
  })

  it('同一目标的多条飘字会错位,不会叠在一起', () => {
    const floats = extractFloats(
      [
        { type: 'GeneralDamaged', player: 1, iid: 3, amount: 1, healthAfter: 4 },
        { type: 'GeneralDamaged', player: 1, iid: 3, amount: 2, healthAfter: 2 },
      ],
      1,
    )
    expect(floats.map((f) => f.offset)).toEqual([0, 1])
  })

  it('飘字 id 在同一批次内唯一(否则 React key 冲突会丢动画)', () => {
    const floats = extractFloats(
      [
        { type: 'GeneralDamaged', player: 1, iid: 3, amount: 1, healthAfter: 4 },
        { type: 'GeneralDamaged', player: 1, iid: 4, amount: 1, healthAfter: 4 },
        { type: 'HeroDamaged', player: 1, amount: 1, hpAfter: 29 },
      ],
      7,
    )
    expect(new Set(floats.map((f) => f.id)).size).toBe(floats.length)
  })
})

describe('架构铁律 7 的另一半:该看得见的事件要真的看得见', () => {
  // 战报文案有了不等于玩家看得见 —— 战报是折叠面板,多数人不看。
  //
  // 这里**不能**断言「所有事件都要有飘字」:TurnEnded、MulliganDone 这类
  // 本来就不该有。所以维护一份「必须有视觉反馈」的清单。
  // 清单是人写的,但比没有强 —— 第四卡包上线时我只补了 eventText,
  // 伏兵翻开在画面上毫无提示,玩家只会看到场面莫名其妙变了。
  const MUST_BE_VISIBLE: GameEvent[] = [
    { type: 'SecretPlayed', player: 0, iid: 7, defId: 'secret-da-cao-jing-she' },
    { type: 'ComboTriggered', player: 0, iid: 8, defId: 'strat-tou-liang-huan-zhu' },
    { type: 'ManaOverloaded', player: 0, amount: 2 },
    { type: 'ManaLocked', player: 0, amount: 2 },
    { type: 'GeneralSilenced', player: 1, iid: 3 },
    { type: 'GeneralFrozen', player: 1, iid: 4 },
    { type: 'DivineShieldPopped', player: 1, iid: 5 },
    { type: 'ArmorGained', player: 0, amount: 3, armorAfter: 3 },
  ]

  it('每条都会产出飘字', () => {
    for (const ev of MUST_BE_VISIBLE) {
      const floats = extractFloats([ev], 1, 'zh')
      expect(floats.length, `${ev.type} 没有任何飘字`).toBeGreaterThan(0)
      expect(floats[0].text.trim().length).toBeGreaterThan(0)
    }
  })

  it('伏兵翻开走展示大卡,而不是一行飘字', () => {
    // 这一条单列:伏兵是唯一「对手的牌突然生效」的机制,
    // 玩家刚点了攻击、场面就变了,他需要看到**是哪张牌**。
    // 飘字给不了这个信息,所以它必须走 cast(展示大卡)那条路。
    const src = readFileSync(new URL('../useEventAnimations.ts', import.meta.url), 'utf8')
    const branch = src.slice(src.indexOf("case 'SecretRevealed'"))
    const body = branch.slice(0, branch.indexOf('break'))
    expect(body).toContain('cast:')
  })
})
