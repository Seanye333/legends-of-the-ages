import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'
import { MORALE_CAP } from './types'

// 将星陨落 —— 传奇武将阵亡时士气**再摆一格**。
//
// 【这份测试要挡住的两件事】
// 1. **一换一的净变化必须仍然为零。** 士气那条通则的全部意义是「奖励打得划算」
//    (双方各死一个 → 各 +1 -1 → 净零)。传奇那额外一格如果只发给一侧,
//    或者忘了给对面对称的那一格,这条不变量就破了 —— 而它不会红任何现有测试,
//    只会让士气在传奇互换之后莫名其妙地漂。
// 2. **只有传奇算。** 判据读的是 `lib[defId].rarity`,而衍生物、被变形过的单位
//    都是照 defId 查的 —— 拿实例上的什么字段去判都会在这些地方出错。
//
// 另钉一条它和溃散的接缝:斩掉两个传奇 = 对面士气 -4 夹到 -3 = 全场失去守護。
// 那是这条机制存在的理由,不是副作用。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 93000,
  name: { zh: '甲', en: 'A' },
  type: 'general',
  doctrine: 'neutral',
  dynasty: 'qun',
  rarity: 'common',
  archetype: 'warrior',
  cost: 3,
  attack: 5,
  health: 1,
  keywords: [],
  ...over,
})

const COMMON = base({ id: 't-common' })
const LEGEND = base({ id: 't-legend', rarity: 'legendary' })
const TOUGH_GUARD = base({ id: 't-tough-guard', attack: 1, health: 9, keywords: ['guard'] })
// 点杀锦囊:守护会逼着**攻击**打它,而法术不受这条限制 ——
// 想在守护还站着的时候斩掉它身后的两个传奇,只能用锦囊。
const SNIPE = base({
  id: 't-snipe',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  spell: { ops: [{ op: 'damage', amount: 5, target: 'weakestEnemyGeneral' }] },
})
const LIB = libWith([COMMON, LEGEND, TOUGH_GUARD, SNIPE])

function game(side0: Partial<PuzzleSide>, side1: Partial<PuzzleSide> = {}): GameState {
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
  }
  const s = createGame(cfg, LIB)
  refreshAuras(s, LIB)
  return s
}

// 我方第 i 个打对面第 j 个。双方都是 5/1,所以互相一击必杀 —— 一换一。
function trade(s: GameState, i = 0, j = 0) {
  const r = applyCommand(s, 0, {
    type: 'Attack',
    attackerIid: s.players[0].board[i].iid,
    target: { kind: 'general', iid: s.players[1].board[j].iid },
  }, LIB)
  if (!r.ok) throw new Error(`打不了:${r.error}`)
  return r
}

describe('将星陨落', () => {
  it('普通换普通 —— 士气净变化为零(基线,先量尺子)', () => {
    const s = game({ board: [{ defId: 't-common' }] }, { board: [{ defId: 't-common' }] })
    const r = trade(s)
    expect(r.state.players[0].morale ?? 0).toBe(0)
    expect(r.state.players[1].morale ?? 0).toBe(0)
  })

  it('**传奇换普通:两侧之差和普通换普通一样** —— 这条是差值中性的主锚', () => {
    // 我方派普通去撞对面的传奇:对面死传奇、我方死普通
    const s = game({ board: [{ defId: 't-common' }] }, { board: [{ defId: 't-legend' }] })
    const r = trade(s)
    // 通则:我方 -1(死了自己人)+1(斩了对面)= 0;对面 -1 +1 = 0
    // 陨落:双方各再 -1 —— 所以两边都是 -1,**差仍然是 0**
    expect(r.state.players[0].morale).toBe(-1)
    expect(r.state.players[1].morale).toBe(-1)
    expect((r.state.players[0].morale ?? 0) - (r.state.players[1].morale ?? 0)).toBe(0)
    // 对照:第一版写成「斩将方 +1」时这里是 +1 / -1,差 2 —— 那一版实测把
    // 魏武揮鞭 顶到 61.8%,闸门当场红。差值中性就是为了挡住那件事。
  })

  it('传奇换传奇 —— 双方各 -2(净差仍为零,但两边一起靠近溃散)', () => {
    const s = game({ board: [{ defId: 't-legend' }] }, { board: [{ defId: 't-legend' }] })
    const r = trade(s)
    expect(r.state.players[0].morale).toBe(-2)
    expect(r.state.players[1].morale).toBe(-2)
  })

  it('只有传奇算 —— 普通武将不发 LegendFell', () => {
    const s = game({ board: [{ defId: 't-common' }] }, { board: [{ defId: 't-common' }] })
    const r = trade(s)
    expect(r.events.filter((e) => e.type === 'LegendFell')).toHaveLength(0)
  })

  it('传奇阵亡各发一条 LegendFell,带得出是谁', () => {
    const s = game({ board: [{ defId: 't-legend' }] }, { board: [{ defId: 't-legend' }] })
    const r = trade(s)
    const fell = r.events.filter((e) => e.type === 'LegendFell')
    expect(fell).toHaveLength(2)
    expect(fell.map((e) => (e.type === 'LegendFell' ? e.defId : ''))).toEqual([
      't-legend',
      't-legend',
    ])
    // 两侧各一个
    expect(new Set(fell.map((e) => (e.type === 'LegendFell' ? e.player : -1)))).toEqual(
      new Set([0, 1]),
    )
  })

  it('斩掉对面两个传奇 → 士气触底 → 对面全场失去守護(和溃散的接缝)', () => {
    let s = game(
      { hand: ['t-snipe', 't-snipe'] },
      { board: [{ defId: 't-legend' }, { defId: 't-legend' }, { defId: 't-tough-guard' }] },
    )
    expect(s.players[1].board[2].keywords).toContain('guard')
    for (let i = 0; i < 2; i++) {
      const r = applyCommand(s, 0, { type: 'PlayCard', iid: s.players[0].hand[0].iid }, LIB)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      s = r.state
    }
    // 对面:两次「死传奇」各 -2 = -4,夹到 -MORALE_CAP
    expect(s.players[1].morale).toBe(-MORALE_CAP)
    expect(s.players[1].board.map((u) => u.defId)).toEqual(['t-tough-guard'])
    expect(s.players[1].board[0].keywords).not.toContain('guard')
  })
})
