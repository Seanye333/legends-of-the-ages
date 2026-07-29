import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { migrateState } from './migrate'
import { changeMorale, refreshAuras, skyOf } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type {
  CardDef,
  CardLibrary,
  GameConfig,
  GameState,
  HeroPowerDef,
  PuzzleSide,
} from './types'
import { CHAIN_TRIGGER, MORALE_CAP, MORALE_THRESHOLD, SUPPLY_CAP } from './types'

// 第二十一卡包的六条新轴:士气 / 天时 / 粮道 / 计谋链 / 双将 / 阵形。
// 六条都动了引擎,所以每条都得单独钉死不变量 —— 尤其是**收敛/清零**那几条,
// 它们才是这些机制不滚雪球的原因,漏掉一条平衡就无从谈起。

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

function game(
  lib: CardLibrary,
  side0: Partial<PuzzleSide>,
  side1: Partial<PuzzleSide> = {},
  cfgOver: Partial<GameConfig> = {},
): GameState {
  const mk = (s: Partial<PuzzleSide>): PuzzleSide => ({
    heroHp: 30,
    mana: 10,
    board: [],
    hand: [],
    ...s,
  })
  const cfg: GameConfig = {
    seed: 4,
    heroIds: ['liu-bei', 'cao-cao'],
    deckIds: [[], []],
    first: 0,
    scenario: { activePlayer: 0, players: [mk(side0), mk(side1)] },
    ...cfgOver,
  }
  const s = createGame(cfg, lib)
  refreshAuras(s, lib)
  return s
}

// ---------------------------------------------------------------- 士气

describe('士气', () => {
  const lib = libWith([base({ id: 't-a' }), base({ id: 't-b', attack: 1, health: 1 })])

  it('一换一净变化为零,白赚一个才是 2 点摆动', () => {
    // 我方 2/3 打对面 1/1:对面死,我方活 —— 这是「白赚」
    const s = game(lib, { board: [{ defId: 't-a' }] }, { board: [{ defId: 't-b' }] })
    const enemyIid = s.players[1].board[0].iid
    const r = applyCommand(s, 0, {
      type: 'Attack',
      attackerIid: s.players[0].board[0].iid,
      target: { kind: 'general', iid: enemyIid },
    }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[0].morale).toBe(1)
    expect(r.state.players[1].morale).toBe(-1)
  })

  it('|士气| 过线才给全场 +1/-1 攻,且只动攻不动血', () => {
    const s = game(lib, { board: [{ defId: 't-a' }, { defId: 't-a' }] })
    const events: never[] = []
    changeMorale(s, 0, MORALE_THRESHOLD - 1, events as never)
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(2)

    changeMorale(s, 0, 1, events as never)
    refreshAuras(s, lib)
    for (const u of s.players[0].board) {
      expect(u.attack).toBe(3)
      expect(u.maxHealth).toBe(3) // 血一点没动
    }

    // 一路掉到负数过线:增益先自动收回(走光环那条撤销路径),再倒扣
    changeMorale(s, 0, -(MORALE_THRESHOLD + MORALE_THRESHOLD), events as never)
    expect(s.players[0].morale).toBe(-MORALE_THRESHOLD)
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(1)
  })

  it('夹在 ±MORALE_CAP,不会无限涨', () => {
    const s = game(lib, {})
    for (let i = 0; i < 20; i++) changeMorale(s, 0, 1, [])
    expect(s.players[0].morale).toBe(MORALE_CAP)
    for (let i = 0; i < 40; i++) changeMorale(s, 0, -1, [])
    expect(s.players[0].morale).toBe(-MORALE_CAP)
  })

  it('自己的回合开始向 0 收敛一格 —— 这条没了就是滚雪球', () => {
    const s = game(lib, {})
    changeMorale(s, 0, MORALE_CAP, [])
    // 回合交给对手再回到自己
    const a = applyCommand(s, 0, { type: 'EndTurn' }, lib)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    // 对手的回合开始不该动我方士气
    expect(a.state.players[0].morale).toBe(MORALE_CAP)
    const b = applyCommand(a.state, 1, { type: 'EndTurn' }, lib)
    expect(b.ok).toBe(true)
    if (!b.ok) return
    expect(b.state.players[0].morale).toBe(MORALE_CAP - 1)
  })
})

// ---------------------------------------------------------------- 天时

describe('天时', () => {
  it('每 2 回合换一段,四段循环', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(skyOf)).toEqual([
      'dawn',
      'dawn',
      'noon',
      'noon',
      'dusk',
      'dusk',
      'night',
      'night',
      'dawn',
    ])
  })

  it('先后手拿到的天时序列完全一样 —— 天时不给任何一方结构性优势', () => {
    const first = [1, 3, 5, 7].map(skyOf)
    const second = [2, 4, 6, 8].map(skyOf)
    expect(first).toEqual(second)
  })

  it('零状态:GameState 里没有天时字段,它只由 turn 推出', () => {
    const s = game(libWith([]), {})
    expect(Object.keys(s)).not.toContain('sky')
    // 同一个 turn 反复问,答案恒定(回放/服务端权威对局靠这条)
    expect(skyOf(s.turn)).toBe(skyOf(s.turn))
  })

  it('ifSky 条件按当前回合判', () => {
    const nightRaid = base({
      id: 't-night-raid',
      type: 'stratagem',
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 5, target: 'enemyHero' }], condition: { ifSky: 'night' } },
    })
    const lib = libWith([nightRaid])
    // turn 1 = 拂晓 → 条件不成立,什么都不该发生
    const dawn = game(lib, { hand: ['t-night-raid'] })
    const a = applyCommand(dawn, 0, { type: 'PlayCard', iid: dawn.players[0].hand[0].iid }, lib)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    expect(a.state.players[1].heroHp).toBe(30)
  })
})

// ---------------------------------------------------------------- 粮道

describe('粮道', () => {
  const supplyCard = base({
    id: 't-junxu',
    type: 'stratagem',
    attack: undefined,
    health: undefined,
    cost: 1,
    supplyCost: 3,
    spell: { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
  })
  const lib = libWith([supplyCard])

  it('粮不够时打不出来,而且 legalCommands 也不会列它(契约)', () => {
    const s = game(lib, { hand: ['t-junxu'], supply: 2 })
    const iid = s.players[0].hand[0].iid
    const r = applyCommand(s, 0, { type: 'PlayCard', iid }, lib)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('not-enough-supply')
    expect(legalCommands(s, 0, lib).some((c) => c.type === 'PlayCard' && c.iid === iid)).toBe(false)
  })

  it('打出后扣粮', () => {
    const s = game(lib, { hand: ['t-junxu'], supply: 5 })
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[0].supply).toBe(2)
    expect(r.state.players[1].heroHp).toBe(26)
  })

  it('校验失败不产生任何变化 —— 法力也不能扣掉', () => {
    const s = game(lib, { hand: ['t-junxu'], supply: 0, mana: 5 })
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, lib)
    expect(r.ok).toBe(false)
    expect(s.players[0].mana.current).toBe(5)
    expect(s.players[0].hand).toHaveLength(1)
  })

  it('每逢自己的回合结束囤一格,封顶不溢出', () => {
    const s = game(lib, { supply: SUPPLY_CAP })
    const r = applyCommand(s, 0, { type: 'EndTurn' }, lib)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[0].supply).toBe(SUPPLY_CAP)
    expect(r.state.players[1].supply).toBe(0) // 对手的回合还没结束
  })
})

// ---------------------------------------------------------------- 计谋链

describe('计谋链', () => {
  const bolt = base({
    id: 't-bolt',
    type: 'stratagem',
    attack: undefined,
    health: undefined,
    cost: 0,
    spell: { ops: [{ op: 'damage', amount: 1, target: 'enemyHero' }] },
  })
  const lib = libWith([bolt])

  it(`本回合第 ${CHAIN_TRIGGER + 1} 张锦囊结算两次`, () => {
    let s = game(lib, { hand: Array(CHAIN_TRIGGER + 1).fill('t-bolt'), mana: 10 })
    for (let i = 0; i < CHAIN_TRIGGER + 1; i++) {
      const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, lib)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      s = r.state
    }
    // 前 CHAIN_TRIGGER 张各 1 点,第 CHAIN_TRIGGER+1 张 2 点
    expect(s.players[1].heroHp).toBe(30 - (CHAIN_TRIGGER + 2))
    expect(s.players[0].chain).toBe(0) // 触发后清零
  })

  it('跨回合攒不出连环计 —— 回合开始清零', () => {
    let s = game(lib, { hand: Array(CHAIN_TRIGGER + 1).fill('t-bolt'), mana: 10 })
    for (let i = 0; i < CHAIN_TRIGGER; i++) {
      const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, lib)
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    expect(s.players[0].chain).toBe(CHAIN_TRIGGER)
    for (const p of [0, 1] as const) {
      const r = applyCommand(s, p, { type: 'EndTurn' }, lib)
      if (!r.ok) throw new Error(r.error)
      s = r.state
    }
    expect(s.players[0].chain).toBe(0)
    // 回到自己回合再打一张,只结算一次
    const hp = s.players[1].heroHp
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, lib)
    if (!r.ok) throw new Error(r.error)
    expect(r.state.players[1].heroHp).toBe(hp - 1)
  })
})

// ---------------------------------------------------------------- 双将

describe('双将', () => {
  const mainPower: HeroPowerDef = {
    id: 'hp-main',
    name: { zh: '主', en: 'Main' },
    text: { zh: '造成 1 点', en: 'Deal 1' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 1, target: 'enemyHero' }] },
  }
  const vicePower: HeroPowerDef = {
    id: 'hp-vice',
    name: { zh: '副', en: 'Vice' },
    text: { zh: '抽一张', en: 'Draw 1' },
    cost: 2,
    script: { ops: [{ op: 'draw', count: 1 }] },
  }
  const lib = libWith([base({ id: 't-a' })])
  const withPowers = (over: Partial<GameConfig> = {}) =>
    game(lib, { deck: ['t-a', 't-a'] }, {}, {
      heroPowers: [mainPower, undefined],
      vicePowers: [vicePower, undefined],
      ...over,
    })

  it('两条技能都出现在 legalCommands 里 —— 少列一条 AI 就永远看不见副将', () => {
    const cmds = legalCommands(withPowers(), 0, lib).filter((c) => c.type === 'UseHeroPower')
    expect(cmds.some((c) => c.type === 'UseHeroPower' && c.vice === true)).toBe(true)
    expect(cmds.some((c) => c.type === 'UseHeroPower' && c.vice === false)).toBe(true)
  })

  it('共用每回合一次的额度:用了副将,主将技这回合就不能再用', () => {
    const s = withPowers()
    const a = applyCommand(s, 0, { type: 'UseHeroPower', vice: true }, lib)
    expect(a.ok).toBe(true)
    if (!a.ok) return
    expect(a.state.players[0].hand).toHaveLength(1) // 副将技抽了一张
    expect(a.state.players[1].heroHp).toBe(30) // 主将技没跑
    const b = applyCommand(a.state, 0, { type: 'UseHeroPower' }, lib)
    expect(b.ok).toBe(false)
    if (b.ok) return
    expect(b.error).toBe('hero-power-used')
  })

  it('没配副将时请求副将技被拒,而不是悄悄用成主将技', () => {
    const s = withPowers({ vicePowers: undefined })
    const r = applyCommand(s, 0, { type: 'UseHeroPower', vice: true }, lib)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toBe('no-vice-power')
  })
})

// ---------------------------------------------------------------- 阵形

describe('阵形', () => {
  const wedge = base({
    id: 't-wedge',
    formation: {
      id: 'f-wedge',
      name: { zh: '锋矢', en: 'Wedge' },
      shape: 'wedge',
      attack: 2,
      health: 0,
    },
  })
  const crane = base({
    id: 't-crane',
    formation: {
      id: 'f-crane',
      name: { zh: '鹤翼', en: 'Crane' },
      shape: 'crane',
      attack: 0,
      health: 2,
    },
  })
  const lib = libWith([wedge, crane, base({ id: 't-a' })])

  it('锋矢:人不够形不成阵', () => {
    const s = game(lib, { board: [{ defId: 't-wedge' }, { defId: 't-a' }] })
    expect(s.players[0].board[0].attack).toBe(2) // 只有 2 人,没成阵
  })

  it('锋矢:凑够 3 人后只有阵头(最左)吃增益', () => {
    const s = game(lib, {
      board: [{ defId: 't-a' }, { defId: 't-wedge' }, { defId: 't-a' }],
    })
    expect(s.players[0].board[0].attack).toBe(4)
    expect(s.players[0].board[1].attack).toBe(2)
    expect(s.players[0].board[2].attack).toBe(2)
  })

  it('鹤翼:两翼吃增益,中间不吃', () => {
    const s = game(lib, {
      board: [{ defId: 't-a' }, { defId: 't-crane' }, { defId: 't-a' }, { defId: 't-a' }],
    })
    const hp = s.players[0].board.map((u) => u.maxHealth)
    expect(hp).toEqual([5, 3, 3, 5])
  })

  it('阵形一散,增益自动收回(走的是光环那条撤销路径)', () => {
    const s = game(lib, {
      board: [{ defId: 't-a' }, { defId: 't-wedge' }, { defId: 't-a' }],
    })
    expect(s.players[0].board[0].attack).toBe(4)
    // 锚点离场 → 阵散
    s.players[0].board.splice(1, 1)
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(2)
  })

  it('沉默锚点等于拆阵', () => {
    const s = game(lib, {
      board: [{ defId: 't-a' }, { defId: 't-wedge' }, { defId: 't-a' }],
    })
    s.players[0].board[1].silenced = true
    refreshAuras(s, lib)
    expect(s.players[0].board[0].attack).toBe(2)
  })

  it('legalCommands 会为带阵形的牌枚举摆放位置 —— 否则 AI 永远塞最右', () => {
    const s = game(lib, { board: [{ defId: 't-a' }], hand: ['t-crane'], mana: 10 })
    const iid = s.players[0].hand[0].iid
    const positions = legalCommands(s, 0, lib)
      .filter((c) => c.type === 'PlayCard' && c.iid === iid)
      .map((c) => (c.type === 'PlayCard' ? c.boardPos : undefined))
    expect(positions).toEqual([0, 1])
  })
})

// ---------------------------------------------------------------- 迁移

describe('迁移:老存档不带这四个字段', () => {
  it('补成零值而不是 undefined —— UI 直接读它,缺了会渲染成空格', () => {
    const s = game(libWith([]), {})
    for (const p of s.players) {
      delete (p as { morale?: number }).morale
      delete (p as { supply?: number }).supply
      delete (p as { chain?: number }).chain
    }
    const m = migrateState(s)
    expect(m.players.map((p) => [p.morale, p.supply, p.chain])).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  it('副将刻意不补 —— 它没有「零值」,没有就是没有', () => {
    const s = migrateState(game(libWith([]), {}))
    expect(s.players[0].vicePower).toBeUndefined()
  })
})
