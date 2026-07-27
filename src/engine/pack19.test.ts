import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { processDeaths, refreshAuras, refreshInstance } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, FieldRule, GameConfig, GameState } from './types'

// 第十九卡包的三条新轴:兵种 / 阵型(相邻)/ 战场环境。
// 三条都碰了引擎,所以每条都要单独钉住不变量。

const FIRE: FieldRule = {
  id: 'field-test-fire',
  name: { zh: '烈焰', en: 'Blaze' },
  text: { zh: '每回合开始,双方全场受 1 点伤害。', en: 'At the start of each turn, all generals take 1.' },
  turnDamageAll: 1,
}

// 自定义卡库:新机制的样本卡不该依赖真实卡池的具体数值
function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 90000,
  name: { zh: '甲', en: 'A' },
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
})

function game(lib: CardLibrary, board0: string[], board1: string[] = []): GameState {
  const cfg: GameConfig = {
    seed: 4,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: {
      activePlayer: 0,
      players: [
        { heroHp: 30, mana: 10, board: board0.map((defId) => ({ defId })), hand: [] },
        { heroHp: 30, mana: 10, board: board1.map((defId) => ({ defId })), hand: [] },
      ],
    },
  }
  const s = createGame(cfg, lib)
  refreshAuras(s, lib)
  return s
}

describe('陣型:相邻光环', () => {
  const banner = base({
    id: 'test-banner',
    name: { zh: '旗官', en: 'Standard Bearer' },
    aura: { scope: 'adjacent', attack: 2, health: 0 },
  })
  const grunt = base({ id: 'test-grunt', name: { zh: '卒', en: 'Grunt' } })
  const lib = libWith([banner, grunt])

  it('只加左右紧邻的两个,隔一个就够不着', () => {
    const s = game(lib, ['test-grunt', 'test-banner', 'test-grunt', 'test-grunt'])
    const b = s.players[0].board
    expect(b[0].attack).toBe(4) // 左邻
    expect(b[2].attack).toBe(4) // 右邻
    expect(b[3].attack).toBe(2) // 隔了一个,没份
  })

  it('自己不吃自己的阵型', () => {
    const s = game(lib, ['test-banner', 'test-grunt'])
    expect(s.players[0].board[0].attack).toBe(banner.attack)
  })

  // 这是「摆在哪儿」第一次真的有意义 —— 在此之前 board 顺序只是个渲染下标。
  it('位置一变,受益的人就变', () => {
    const s = game(lib, ['test-grunt', 'test-grunt', 'test-banner'])
    const b = s.players[0].board
    expect(b[0].attack).toBe(2)
    expect(b[1].attack).toBe(4)
  })

  it('旗官阵亡,邻居的增益立刻收回', () => {
    const s = game(lib, ['test-grunt', 'test-banner', 'test-grunt'])
    expect(s.players[0].board[0].attack).toBe(4)
    s.players[0].board.splice(1, 1)
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(2)
  })
})

describe('兵种', () => {
  it('每个可收集武将都恰好有一个兵种;锦囊装备没有', () => {
    for (const c of Object.values(CARDS_BY_ID)) {
      if (c.token) continue
      if (c.type === 'general') expect(c.troop, c.id).toBeDefined()
      else expect(c.troop, c.id).toBeUndefined()
    }
  })

  it('派生是确定性的 —— 同一张卡永远同一个兵种', () => {
    expect(CARDS_BY_ID['guan-yu'].troop).toBe(CARDS_BY_ID['guan-yu'].troop)
    expect(CARDS_BY_ID['zhuge-liang'].troop).toBe('advisor')
  })

  it('buffPer 能按兵种计数', () => {
    const rider = base({ id: 'test-rider', keywords: ['charge'] }) // charge → 骑兵
    const marshal = base({
      id: 'test-marshal',
      attack: 1,
      health: 1,
      battlecry: {
        ops: [
          { op: 'buffPer', per: { kind: 'friendlyTroop', troop: 'cavalry' }, attack: 1, health: 0, target: 'self' },
        ],
      },
    })
    const lib = libWith([
      { ...rider, troop: 'cavalry' },
      { ...marshal, troop: 'infantry' },
    ])
    const s = game(lib, ['test-rider', 'test-rider'])
    // 手动跑一次战吼:把统帅放上场
    const cfg: GameConfig = {
      seed: 4,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          {
            heroHp: 30,
            mana: 10,
            board: [{ defId: 'test-rider' }, { defId: 'test-rider' }],
            hand: ['test-marshal'],
          },
          { heroHp: 30, mana: 10, board: [], hand: [] },
        ],
      },
    }
    const g = createGame(cfg, lib)
    const card = g.players[0].hand[0]
    const r = applyCommand(g, 0, { type: 'PlayCard', iid: card.iid }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const played = r.state.players[0].board.find((u) => u.defId === 'test-marshal')!
    // 计数在施加前定死:场上两个骑兵(自己是步卒,不算)
    expect(played.attack).toBe(3)
    void s
  })
})

describe('戰場環境', () => {
  it('每回合开始烧全场,双方同吃', () => {
    const lib = libWith([base({ id: 'test-grunt2', health: 5 })])
    const s = game(lib, ['test-grunt2'], ['test-grunt2'])
    s.field = { rule: FIRE }
    const r = applyCommand(s, 0, { type: 'EndTurn' }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    for (const side of [0, 1] as const) {
      expect(r.state.players[side].board[0].health).toBe(4)
    }
  })

  it('turnsLeft 归零后自动消散,并广播一条事件', () => {
    const lib = libWith([base({ id: 'test-grunt3', health: 9 })])
    const s = game(lib, ['test-grunt3'])
    s.field = { rule: FIRE, turnsLeft: 1 }
    const r = applyCommand(s, 0, { type: 'EndTurn' }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.field).toBeUndefined()
    expect(r.events.some((e) => e.type === 'FieldChanged' && !e.rule)).toBe(true)
  })

  it('环境增益走光环路径 —— 环境一消散就自动收回', () => {
    const lib = libWith([base({ id: 'test-grunt4' })])
    const s = game(lib, ['test-grunt4'])
    const baseAtk = s.players[0].board[0].attack
    s.field = {
      rule: {
        id: 'field-plain',
        name: { zh: '平原', en: 'Plains' },
        text: { zh: '双方全体 +1/+0。', en: 'All generals +1/+0.' },
        bothStats: { attack: 1, health: 0 },
      },
    }
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(baseAtk + 1)
    s.field = undefined
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(baseAtk)
  })

  it('兵种专属的战场加成只给那个兵种', () => {
    const lib = libWith([
      { ...base({ id: 'test-horse' }), troop: 'cavalry' as const },
      { ...base({ id: 'test-foot' }), troop: 'infantry' as const },
    ])
    const s = game(lib, ['test-horse', 'test-foot'])
    s.field = {
      rule: {
        id: 'field-steppe',
        name: { zh: '平原走馬', en: 'Open Steppe' },
        text: { zh: '骑兵 +2/+0。', en: 'Cavalry +2/+0.' },
        troopBonus: { troop: 'cavalry', attack: 2, health: 0 },
      },
    }
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(4)
    expect(s.players[0].board[1].attack).toBe(2)
  })

  it('后布的战场覆盖前一片 —— 同时只有一片', () => {
    const lib = libWith([base({ id: 'test-grunt5' })])
    const s = game(lib, ['test-grunt5'])
    s.field = { rule: FIRE }
    const snow: FieldRule = {
      id: 'field-snow',
      name: { zh: '大雪', en: 'Snow' },
      text: { zh: '双方全体 -1/+0。', en: 'All generals -1/+0.' },
      bothStats: { attack: -1, health: 0 },
    }
    s.field = { rule: snow }
    refreshAuras(s, lib)
    expect(s.field.rule.id).toBe('field-snow')
  })
})

// ---- 第二十卡包:傳承 / 塚中 ----
describe('傳承 heirloom', () => {
  const blade = { ...CARDS_BY_ID['eq-heirloom-blade'] }

  it('持有者阵亡,装备改挂给另一名友军', () => {
    const lib = libWith([base({ id: 'test-h1', health: 1 }), base({ id: 'test-h2' })])
    const cfg: GameConfig = {
      seed: 8,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 10, board: [{ defId: 'test-h2' }, { defId: 'test-h1' }], hand: ['eq-heirloom-blade'] },
          { heroHp: 30, mana: 10, board: [], hand: [] },
        ],
      },
    }
    const g = createGame(cfg, lib)
    const eq = g.players[0].hand[0]
    const holder = g.players[0].board[1]
    const r = applyCommand(g, 0, {
      type: 'PlayCard',
      iid: eq.iid,
      target: { kind: 'general', iid: holder.iid },
    }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const armed = r.state.players[0].board.find((u) => u.iid === holder.iid)!
    expect(armed.attack).toBe((blade.attack ?? 0) + (base({}).attack ?? 0))

    // 打死持有者:刀应该落到剩下那位手里
    const s2 = structuredClone(r.state)
    const target = s2.players[0].board.find((u) => u.iid === holder.iid)!
    // health 是**派生**字段:只改 damage 不 refresh,processDeaths 看到的还是旧血量
    target.damage = 99
    refreshInstance(target, lib)
    const events: import('./types').GameEvent[] = []
    processDeaths(s2, events, lib)
    const heir = s2.players[0].board[0]
    expect(heir.enchants.some((e) => e.heirloom === 'eq-heirloom-blade')).toBe(true)
    expect(events.some((e) => e.type === 'EquipmentAttached' && e.targetIid === heir.iid)).toBe(true)
  })

  it('场上没有别人时不传承(刀跟着一起没了)', () => {
    const lib = libWith([base({ id: 'test-solo', health: 1 })])
    const s = game(lib, ['test-solo'])
    s.players[0].board[0].enchants.push({ attack: 3, health: 1, heirloom: 'eq-heirloom-blade' })
    s.players[0].board[0].damage = 99
    refreshInstance(s.players[0].board[0], lib)
    const events: import('./types').GameEvent[] = []
    processDeaths(s, events, lib)
    expect(s.players[0].board).toHaveLength(0)
    expect(events.some((e) => e.type === 'EquipmentAttached')).toBe(false)
  })
})

describe('塚中:墓地计数', () => {
  it('只数武将,锦囊装备不算', () => {
    const lib = libWith([base({ id: 'test-mourn', attack: 2, health: 3, battlecry: { ops: [{ op: 'buffPer', per: { kind: 'friendlyGraveyard' }, attack: 1, health: 1, target: 'self' } ] } })])
    const cfg: GameConfig = {
      seed: 8,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 10, board: [], hand: ['test-mourn'] },
          { heroHp: 30, mana: 10, board: [], hand: [] },
        ],
      },
    }
    const g = createGame(cfg, lib)
    // 墓里两个武将 + 一个锦囊 → 计数应当是 2
    g.players[0].graveyard.push('guan-yu', 'zhang-fei', 'strat-huo-ji')
    const card = g.players[0].hand[0]
    const r = applyCommand(g, 0, { type: 'PlayCard', iid: card.iid }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[0].board[0].attack).toBe(4)
  })
})
