// 第八卡包机制层:变形 / 复生。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { createInstance } from './init'
import { refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'

let nextIid = 25000

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id, collectorNo: 1, name: { zh: id, en: id }, type: 'general', doctrine: 'neutral',
    dynasty: 'qun', rarity: 'common', archetype: 'warrior', cost: 3, attack: 3, health: 3, keywords: [], ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('bruiser', { cost: 6, attack: 6, health: 6 }),
    def('sheep', { cost: 1, attack: 1, health: 1, token: true }),
    def('bomber', { cost: 3, attack: 2, health: 2, deathrattle: { ops: [{ op: 'damage', amount: 5, target: 'enemyHero' }] } }),
    // 变形:把一个敌将变成 1/1 绵羊
    def('polymorph', {
      type: 'stratagem', cost: 4, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'transform', target: 'chosenEnemyGeneral', into: 'sheep' }] },
    }),
    // 复生:召回两个死去的友方武将
    def('rez', {
      type: 'stratagem', cost: 5, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'resurrect', count: 2 }] },
    }),
  ].map((d) => [d.id, d]),
)

function inst(defId: string, over: Partial<CardInstance> = {}): CardInstance {
  const base = createInstance(defId, nextIid++, LIB)
  const merged: CardInstance = { ...base, ...over }
  refreshInstance(merged, LIB)
  return merged
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    heroId: 'hero', heroHp: 30, heroMaxHp: 30, armor: 0, fatigue: 0,
    mana: { current: 10, max: 10 }, deck: [], hand: [], board: [], graveyard: [],
    mulliganDone: true, heroPowerUsed: false, secrets: [],
    overloadNext: 0, overloadLocked: 0, cardsPlayedThisTurn: 0, heroPowerCostDelta: 0, ...over,
  }
}

function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState {
  return { seed: 1, rng: 99, turn: 5, activePlayer: 0, phase: 'main', players: [player(p0), player(p1)], nextIid: 50000 }
}

const must = (r: ReturnType<typeof applyCommand>) => {
  if (!r.ok) throw new Error(`rejected: ${r.error}`)
  return r
}

describe('变形', () => {
  it('把敌将原地变成 1/1 绵羊,保持位置,不触发亡语', () => {
    const poly = inst('polymorph')
    const bomber = inst('bomber') // 亡语:对我方主公 5 点
    const s = game({ hand: [poly], heroHp: 30 }, { board: [inst('bruiser'), bomber, inst('bruiser')] })
    const before = s.players[1].board.map((c) => c.iid)
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: poly.iid, target: { kind: 'general', iid: bomber.iid } }, LIB),
    )
    const board = r.state.players[1].board
    // 位置 1 现在是绵羊
    expect(board[1].defId).toBe('sheep')
    expect([board[1].attack, board[1].health]).toEqual([1, 1])
    // 前后左右没动
    expect(board[0].iid).toBe(before[0])
    expect(board[2].iid).toBe(before[2])
    // 亡语没触发 —— 变形不是死亡
    expect(r.state.players[0].heroHp).toBe(30)
    expect(r.events.some((e) => e.type === 'GeneralTransformed')).toBe(true)
  })
})

describe('复生', () => {
  it('从墓地召回死去的友方武将', () => {
    const rez = inst('rez')
    // 墓地里有两个死去的猛将
    const s = game({ hand: [rez], graveyard: ['bruiser', 'bruiser'] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: rez.iid }, LIB))
    const board = r.state.players[0].board
    expect(board.filter((c) => c.defId === 'bruiser')).toHaveLength(2)
    // 复生的是满血新实例
    expect(board[0].health).toBe(6)
  })

  it('墓地不足则能召回几个算几个', () => {
    const rez = inst('rez')
    const s = game({ hand: [rez], graveyard: ['bruiser'] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: rez.iid }, LIB))
    expect(r.state.players[0].board.filter((c) => c.defId === 'bruiser')).toHaveLength(1)
  })

  it('只复生武将,不复生墓地里的锦囊/衍生物', () => {
    const rez = inst('rez')
    // 墓地混着锦囊(polymorph)和衍生物(sheep)+ 一个武将
    const s = game({ hand: [rez], graveyard: ['polymorph', 'sheep', 'bruiser'] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: rez.iid }, LIB))
    const board = r.state.players[0].board
    expect(board.every((c) => c.defId === 'bruiser')).toBe(true)
    expect(board).toHaveLength(1) // 只有那 1 个武将
  })
})
