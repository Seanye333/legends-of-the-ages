import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'

// 第二十二卡包的引擎地基:「最」类目标 / 五条新条件 / 两个新计数 /
// 断粮道 / 洗入牌库 / 驱散 / 借将。
//
// 这一批的共同点是**它们此前一条都表达不出来**,而不是「表达得不够好」——
// 所以测试的重点放在边界上:并列取谁、潜行躲不躲得掉、驱散会不会杀人、
// 借来的兵回合结束还不还得回去、原主满场怎么办。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 92200,
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
    seed: 7,
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

// 打出手牌第一张(锦囊/武将都走这条)
function play(s: GameState, lib: CardLibrary, player: 0 | 1 = 0) {
  const r = applyCommand(s, player, { type: 'PlayCard', iid: s.players[player].hand[0].iid }, lib)
  expect(r.ok, r.ok ? '' : r.error).toBe(true)
  if (!r.ok) throw new Error(r.error)
  return r
}

// ---------------------------------------------------------------- 「最」类目标

describe('「最」类目标', () => {
  const lib = libWith([
    base({ id: 'm-fat', attack: 1, health: 9 }),
    base({ id: 'm-thin', attack: 7, health: 2 }),
    base({ id: 'm-mid', attack: 3, health: 5 }),
    base({
      id: 'm-snipe',
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 2, target: 'strongestEnemyGeneral' }] },
    }),
    base({
      id: 'm-mercy',
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'heal', amount: 3, target: 'weakestFriendlyGeneral' }] },
    }),
  ])

  it('射杀最强者:打的是攻击最高的那个,不是随机', () => {
    const s = game(
      lib,
      { hand: ['m-snipe'] },
      { board: [{ defId: 'm-fat' }, { defId: 'm-thin' }, { defId: 'm-mid' }] },
    )
    const r = play(s, lib)
    // 7/2 的那个吃满 2 点当场倒下,9 血的肉盾一根汗毛没动 —— 随机目标做不到这件事
    expect(r.state.players[1].board.map((c) => c.defId)).toEqual(['m-fat', 'm-mid'])
    expect(r.state.players[1].board.every((c) => c.damage === 0)).toBe(true)
  })

  it('潜行躲得掉「最」类点名(和随机目标一个待遇)', () => {
    const lib2 = libWith([
      ...Object.values(lib).filter((c) => c.id.startsWith('m-')),
      base({ id: 'm-ninja', attack: 9, health: 9, keywords: ['stealth'] }),
    ])
    const s = game(
      lib2,
      { hand: ['m-snipe'] },
      { board: [{ defId: 'm-ninja' }, { defId: 'm-mid' }] },
    )
    const r = play(s, lib2)
    // 9 攻的潜行不可被点名 → 伤害落到 3 攻的 m-mid 上
    expect(r.state.players[1].board.find((c) => c.defId === 'm-ninja')?.damage).toBe(0)
    expect(r.state.players[1].board.find((c) => c.defId === 'm-mid')?.damage).toBe(2)
  })

  it('并列时取 iid 最小(入场最早),同一状态永远给同一答案', () => {
    const s = game(
      lib,
      { hand: ['m-mercy'], board: [{ defId: 'm-mid', damage: 4 }, { defId: 'm-mid', damage: 4 }] },
    )
    const firstIid = s.players[0].board[0].iid
    const r = play(s, lib)
    expect(r.state.players[0].board.find((c) => c.iid === firstIid)?.damage).toBe(1)
    expect(r.state.players[0].board[1].damage).toBe(4)
  })

  it('目标不在场时整条效果落空,不报错也不乱打', () => {
    const s = game(lib, { hand: ['m-snipe'] }, { board: [] })
    const r = play(s, lib)
    expect(r.state.players[1].heroHp).toBe(30) // 没有退化成打脸
  })
})

describe('相邻目标(adjacentFriendly)', () => {
  const lib = libWith([
    base({ id: 'a-plain' }),
    base({
      id: 'a-rally',
      battlecry: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'adjacentFriendly' }] },
    }),
  ])

  it('只给左右紧邻的两名,不给自己也不给更远的', () => {
    const s = game(lib, {
      hand: ['a-rally'],
      board: [{ defId: 'a-plain' }, { defId: 'a-plain' }, { defId: 'a-plain' }],
    })
    // 插到下标 1:左邻是 0,右邻是原来的 1(现在的 2)
    const r = applyCommand(
      s,
      0,
      { type: 'PlayCard', iid: s.players[0].hand[0].iid, boardPos: 1 },
      lib,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const atk = r.state.players[0].board.map((c) => c.attack)
    expect(atk).toEqual([3, 2, 3, 2])
  })
})

// ---------------------------------------------------------------- 条件扩表

describe('新条件', () => {
  const cond = (over: Partial<CardDef>, condition: NonNullable<CardDef['spell']>['condition']) =>
    base({
      type: 'stratagem',
      cost: 0,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 5, target: 'enemyHero' }], condition },
      ...over,
    })

  it('ifTroopCount:数的是兵种,不是人数', () => {
    const lib = libWith([
      base({ id: 'c-horse', troop: 'cavalry' }),
      base({ id: 'c-foot', troop: 'infantry' }),
      cond({ id: 'c-charge' }, { ifTroopCount: { troop: 'cavalry', atLeast: 2 } }),
    ])
    const one = game(lib, { hand: ['c-charge'], board: [{ defId: 'c-horse' }, { defId: 'c-foot' }] })
    expect(play(one, lib).state.players[1].heroHp).toBe(30)
    const two = game(lib, {
      hand: ['c-charge'],
      board: [{ defId: 'c-horse' }, { defId: 'c-horse' }],
    })
    expect(play(two, lib).state.players[1].heroHp).toBe(25)
  })

  it('ifField:没有环境不成立;指定 id 时认那一片', () => {
    const rule = { id: 'f-fire', name: { zh: '火', en: 'Fire' }, text: { zh: '火', en: 'Fire' } }
    const lib = libWith([cond({ id: 'c-fan' }, { ifField: { id: 'f-fire' } })])
    const none = game(lib, { hand: ['c-fan'] })
    expect(play(none, lib).state.players[1].heroHp).toBe(30)
    const other = game(lib, { hand: ['c-fan'] }, {}, {
      field: { rule: { ...rule, id: 'f-snow' } },
    })
    expect(play(other, lib).state.players[1].heroHp).toBe(30)
    const match = game(lib, { hand: ['c-fan'] }, {}, { field: { rule } })
    expect(play(match, lib).state.players[1].heroHp).toBe(25)
  })

  it('ifGraveyardCount 只数武将,锦囊不算', () => {
    const lib = libWith([
      base({ id: 'c-dead' }),
      base({ id: 'c-scroll', type: 'stratagem', attack: undefined, health: undefined, spell: { ops: [{ op: 'draw', count: 0 }] } }),
      cond({ id: 'c-necro' }, { ifGraveyardCount: { atLeast: 2 } }),
    ])
    const s = game(lib, { hand: ['c-necro'] })
    s.players[0].graveyard.push('c-dead', 'c-scroll')
    expect(play(s, lib).state.players[1].heroHp).toBe(30)
    const s2 = game(lib, { hand: ['c-necro'] })
    s2.players[0].graveyard.push('c-dead', 'c-dead')
    expect(play(s2, lib).state.players[1].heroHp).toBe(25)
  })

  it('ifEnemyHeroHpBelow 是处决线', () => {
    const lib = libWith([cond({ id: 'c-exec' }, { ifEnemyHeroHpBelow: 15 })])
    const high = game(lib, { hand: ['c-exec'] }, { heroHp: 15 })
    expect(play(high, lib).state.players[1].heroHp).toBe(15)
    const low = game(lib, { hand: ['c-exec'] }, { heroHp: 14 })
    expect(play(low, lib).state.players[1].heroHp).toBe(9)
  })

  it('ifTurnAtLeast 按回合数开闸', () => {
    const lib = libWith([cond({ id: 'c-late' }, { ifTurnAtLeast: 5 })])
    const s = game(lib, { hand: ['c-late'] })
    expect(play(s, lib).state.players[1].heroHp).toBe(30)
    const s2 = game(lib, { hand: ['c-late'] })
    s2.turn = 5
    expect(play(s2, lib).state.players[1].heroHp).toBe(25)
  })
})

describe('新计数', () => {
  it('enemyGenerals:对面铺得越满越狠(对手不铺场也躲不掉自己没场面)', () => {
    const lib = libWith([
      base({ id: 'n-any' }),
      base({
        id: 'n-storm',
        type: 'stratagem',
        cost: 0,
        attack: undefined,
        health: undefined,
        spell: {
          ops: [{ op: 'damagePer', per: { kind: 'enemyGenerals' }, amount: 2, target: 'enemyHero' }],
        },
      }),
    ])
    const s = game(lib, { hand: ['n-storm'] }, { board: [{ defId: 'n-any' }, { defId: 'n-any' }, { defId: 'n-any' }] })
    expect(play(s, lib).state.players[1].heroHp).toBe(24)
  })

  it('handCount 数的是打出后的手牌(先扣牌再结算)', () => {
    const lib = libWith([
      base({ id: 'n-any' }),
      base({
        id: 'n-hoard',
        type: 'stratagem',
        cost: 0,
        attack: undefined,
        health: undefined,
        spell: {
          ops: [{ op: 'damagePer', per: { kind: 'handCount' }, amount: 1, target: 'enemyHero' }],
        },
      }),
    ])
    const s = game(lib, { hand: ['n-hoard', 'n-any', 'n-any'] })
    expect(play(s, lib).state.players[1].heroHp).toBe(28)
  })
})

// ---------------------------------------------------------------- 断粮道 / 洗入牌库

describe('断粮道(mill)', () => {
  const lib = libWith([
    base({ id: 'k-any' }),
    base({
      id: 'k-mill',
      type: 'stratagem',
      cost: 0,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'mill', count: 2 }] },
    }),
  ])

  it('削的是对手牌库顶,牌进墓地,且**不造成疲劳伤害**', () => {
    const s = game(lib, { hand: ['k-mill'] }, {})
    const cfgDeck = ['k-any', 'k-any', 'k-any']
    // 手搓一个牌库(残局默认空库)
    for (const id of cfgDeck) {
      s.players[1].deck.push({
        iid: s.nextIid++,
        defId: id,
        attack: 2,
        health: 3,
        maxHealth: 3,
        keywords: [],
        exhausted: true,
        attacksUsed: 0,
        enchants: [],
        damage: 0,
        silenced: false,
        frozen: false,
        shieldUsed: false,
        stealthBroken: false,
        costDelta: 0,
      })
    }
    const r = play(s, lib)
    expect(r.state.players[1].deck).toHaveLength(1)
    expect(r.state.players[1].graveyard).toEqual(['k-any', 'k-any'])
    expect(r.state.players[1].heroHp).toBe(30)
    expect(r.state.players[1].fatigue).toBe(0)
  })

  it('库已空时静默停手,不报错', () => {
    const s = game(lib, { hand: ['k-mill'] })
    const r = play(s, lib)
    expect(r.state.players[1].deck).toHaveLength(0)
  })
})

describe('洗入牌库', () => {
  const lib = libWith([
    base({ id: 'w-junk', cost: 9, attack: 0, health: 1 }),
    base({
      id: 'w-curse',
      type: 'stratagem',
      cost: 0,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'shuffleIntoDeck', defId: 'w-junk', count: 2, side: 'enemy' }] },
    }),
  ])

  it('塞进对手牌库,发一条公开事件(否则他抽到时无从解释)', () => {
    const s = game(lib, { hand: ['w-curse'] })
    const r = play(s, lib)
    expect(r.state.players[1].deck.map((c) => c.defId)).toEqual(['w-junk', 'w-junk'])
    expect(r.events.some((e) => e.type === 'CardShuffledIn' && e.player === 1 && e.count === 2)).toBe(true)
  })
})

// ---------------------------------------------------------------- 驱散

describe('驱散(dispel)', () => {
  const lib = libWith([
    base({ id: 'd-any' }),
    base({ id: 'd-lord', attack: 1, health: 1, aura: { scope: 'friendlyOthers', attack: 2, health: 2 } }),
    base({
      id: 'd-dispel',
      type: 'stratagem',
      cost: 0,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'dispel', target: 'chosenEnemyGeneral' }] },
    }),
  ])

  it('摘掉附魔但不动卡面关键词、不封亡语(区别于沉默)', () => {
    const withRattle = base({
      id: 'd-rattle',
      keywords: ['guard'],
      deathrattle: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
    })
    const lib2 = libWith([...Object.values(lib).filter((c) => c.id.startsWith('d-')), withRattle])
    const s = game(
      lib2,
      { hand: ['d-dispel'] },
      { board: [{ defId: 'd-rattle', enchants: [{ attack: 5, health: 5 }] }] },
    )
    const iid = s.players[1].board[0].iid
    const r = applyCommand(
      s,
      0,
      { type: 'PlayCard', iid: s.players[0].hand[0].iid, target: { kind: 'general', iid } },
      lib2,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const unit = r.state.players[1].board[0]
    expect(unit.attack).toBe(2) // 5/5 增益已被摘掉
    expect(unit.keywords).toContain('guard') // 卡面关键词还在
    expect(unit.silenced).toBe(false) // 亡语没被封
  })

  it('驱散不杀人:撤销后血量归零则夹回 1', () => {
    const s = game(
      lib,
      { hand: ['d-dispel'] },
      { board: [{ defId: 'd-any', damage: 4, enchants: [{ attack: 0, health: 5 }] }] },
    )
    const iid = s.players[1].board[0].iid
    const r = applyCommand(
      s,
      0,
      { type: 'PlayCard', iid: s.players[0].hand[0].iid, target: { kind: 'general', iid } },
      lib,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[1].board).toHaveLength(1)
    expect(r.state.players[1].board[0].health).toBe(1)
  })

  it('光环附魔不摘 —— 来源还在场,摘了下一帧就回来', () => {
    const s = game(
      lib,
      { hand: ['d-dispel'] },
      { board: [{ defId: 'd-lord' }, { defId: 'd-any' }] },
    )
    const iid = s.players[1].board[1].iid
    const r = applyCommand(
      s,
      0,
      { type: 'PlayCard', iid: s.players[0].hand[0].iid, target: { kind: 'general', iid } },
      lib,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.state.players[1].board[1].attack).toBe(4) // 2 + 光环 2
  })
})

// ---------------------------------------------------------------- 借将

describe('借将(borrow)', () => {
  const lib = libWith([
    base({ id: 'b-any', attack: 4, health: 4 }),
    base({
      id: 'b-borrow',
      type: 'stratagem',
      cost: 0,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'borrow', target: 'chosenEnemyGeneral' }] },
    }),
  ])

  const borrow = (s: GameState) => {
    const iid = s.players[1].board[0].iid
    const r = applyCommand(
      s,
      0,
      { type: 'PlayCard', iid: s.players[0].hand[0].iid, target: { kind: 'general', iid } },
      lib,
    )
    expect(r.ok, r.ok ? '' : r.error).toBe(true)
    if (!r.ok) throw new Error(r.error)
    return r
  }

  it('借来的当回合就能动(这正是它和策反的区别)', () => {
    const s = game(lib, { hand: ['b-borrow'] }, { board: [{ defId: 'b-any' }] })
    const r = borrow(s)
    const unit = r.state.players[0].board[0]
    expect(unit.defId).toBe('b-any')
    expect(unit.exhausted).toBe(false)
    expect(unit.borrowedFrom).toBe(1)
  })

  it('回合结束原样还回去,且不带走我这边挂的临时增益', () => {
    const s = game(lib, { hand: ['b-borrow'] }, { board: [{ defId: 'b-any' }] })
    const after = borrow(s).state
    // 借来之后给他挂一条「本回合 +3/+0」—— 这条必须在他还站在我这边时消退
    after.players[0].board[0].enchants.push({ attack: 3, health: 0, duration: 'endOfTurn' })
    const end = applyCommand(after, 0, { type: 'EndTurn' }, lib)
    expect(end.ok).toBe(true)
    if (!end.ok) return
    expect(end.state.players[0].board).toHaveLength(0)
    expect(end.state.players[1].board).toHaveLength(1)
    const home = end.state.players[1].board[0]
    expect(home.borrowedFrom).toBeUndefined()
    expect(home.enchants).toHaveLength(0)
    expect(home.attack).toBe(4)
  })

  it('原主满场则放逐 —— 不入墓、不触发亡语(还不回去就散了)', () => {
    const s = game(
      lib,
      { hand: ['b-borrow'] },
      { board: [{ defId: 'b-any' }, { defId: 'b-any' }, { defId: 'b-any' }, { defId: 'b-any' }, { defId: 'b-any' }, { defId: 'b-any' }] },
    )
    const after = borrow(s).state
    expect(after.players[1].board).toHaveLength(5)
    // 趁这一回合把对面补满
    for (let i = 0; i < 1; i++) {
      after.players[1].board.push({ ...after.players[1].board[0], iid: after.nextIid++ })
    }
    const end = applyCommand(after, 0, { type: 'EndTurn' }, lib)
    expect(end.ok).toBe(true)
    if (!end.ok) return
    expect(end.state.players[0].board).toHaveLength(0)
    expect(end.state.players[1].board).toHaveLength(6)
    expect(end.state.players[1].graveyard).not.toContain('b-any')
    expect(end.events.some((e) => e.type === 'GeneralBanished')).toBe(true)
  })

  it('已经借来的不再转借(借用链会丢掉最初的主人)', () => {
    const s = game(lib, { hand: ['b-borrow', 'b-borrow'] }, { board: [{ defId: 'b-any' }] })
    const after = borrow(s).state
    const iid = after.players[0].board[0].iid
    const again = applyCommand(
      after,
      0,
      { type: 'PlayCard', iid: after.players[0].hand[0].iid, target: { kind: 'general', iid } },
      lib,
    )
    // 目标已在我方场上 → 不是合法的「敌方武将」目标
    expect(again.ok).toBe(false)
  })
})
