// 第二卡包机制测试:吸血/剧毒、装备牌、护甲/弹回/弃牌操作码。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { createInstance } from './init'
import { refreshInstance } from './resolve'
import { HAND_LIMIT } from './types'
import type {
  CardDef,
  CardInstance,
  CardLibrary,
  GameState,
  PlayerState,
} from './types'

let nextIid = 5000

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: id, en: id },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('vanilla', {}),
    def('big', { cost: 8, attack: 8, health: 8 }),
    def('leech', { cost: 3, attack: 3, health: 3, keywords: ['lifesteal'] }),
    def('viper', { cost: 3, attack: 1, health: 3, keywords: ['poison'] }),
    def('viper-duelist', { cost: 5, attack: 4, health: 3, keywords: ['poison', 'duel'] }),
    def('buffed-target', { cost: 4, attack: 4, health: 4 }),
    def('eq-blade', {
      type: 'equipment',
      cost: 3,
      attack: 2,
      health: 1,
      keywords: ['lifesteal'],
    }),
    def('strat-armor', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'gainArmor', amount: 5 }] },
    }),
    def('strat-bounce', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    }),
    def('strat-mill', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'discardRandom', count: 2 }] },
    }),
  ].map((d) => [d.id, d]),
)

// 同 battle.test.ts:身材是派生字段,测试给的数值换算成一条附魔
function inst(defId: string, over: Partial<CardInstance> = {}): CardInstance {
  const base = createInstance(defId, nextIid++, LIB)
  const { attack, health, maxHealth, keywords, ...rest } = over
  const merged: CardInstance = { ...base, ...rest }
  const targetAtk = attack ?? base.attack
  const targetHp = maxHealth ?? health ?? base.maxHealth
  if (targetAtk !== base.attack || targetHp !== base.maxHealth || keywords) {
    merged.enchants = [
      { attack: targetAtk - base.attack, health: targetHp - base.maxHealth, keywords },
    ]
  }
  refreshInstance(merged, LIB)
  if (health !== undefined && maxHealth !== undefined && health < maxHealth) {
    merged.damage = maxHealth - health
    refreshInstance(merged, LIB)
  }
  return merged
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    heroId: 'hero',
    heroHp: 30,
    heroMaxHp: 30,
    armor: 0,
    fatigue: 0,
    mana: { current: 10, max: 10 },
    deck: [inst('vanilla'), inst('vanilla')],
    hand: [],
    board: [],
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
    secrets: [],
    overloadNext: 0,
    overloadLocked: 0,
    cardsPlayedThisTurn: 0,
    heroPowerCostDelta: 0,
    ...over,
  }
}

function battleState(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState {
  return {
    seed: 1,
    rng: 1,
    turn: 5,
    activePlayer: 0,
    phase: 'main',
    players: [player(p0), player(p1)],
    nextIid: 99999,
  }
}

function must(r: ReturnType<typeof applyCommand>) {
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('lifesteal 吸血', () => {
  it('attacking a general heals own hero by damage dealt', () => {
    const leech = inst('leech')
    const foe = inst('big')
    const s = battleState({ heroHp: 20, board: [leech] }, { board: [foe] })
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: leech.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    expect(r.state.players[0].heroHp).toBe(23)
    expect(r.events.some((e) => e.type === 'HeroHealed' && e.player === 0)).toBe(true)
  })

  it('attacking the enemy hero also heals', () => {
    const leech = inst('leech')
    const s = battleState({ heroHp: 20, board: [leech] })
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: leech.iid, target: { kind: 'hero', player: 1 } }, LIB),
    )
    expect(r.state.players[0].heroHp).toBe(23)
  })

  it('defender with lifesteal heals its owner on counter-strike', () => {
    const attacker = inst('vanilla')
    const leech = inst('leech')
    const s = battleState({ board: [attacker] }, { heroHp: 10, board: [leech] })
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'general', iid: leech.iid } }, LIB),
    )
    expect(r.state.players[1].heroHp).toBe(13)
  })
})

describe('poison 剧毒', () => {
  it('kills any general it damages in combat', () => {
    const viper = inst('viper')
    const foe = inst('big')
    const s = battleState({ board: [viper] }, { board: [foe] })
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: viper.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    expect(r.state.players[1].board).toHaveLength(0)
    expect(r.events.some((e) => e.type === 'GeneralDied' && e.iid === foe.iid)).toBe(true)
    // 毒蛇自己也吃了 8 点反击而死
    expect(r.state.players[0].board).toHaveLength(0)
  })

  it('poison duelist with first strike kills without taking counter damage', () => {
    const card = inst('viper-duelist')
    const foe = inst('vanilla', { attack: 2, health: 9, maxHealth: 9 })
    const s = battleState({ hand: [card] }, { board: [foe] })
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: card.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    // 攻 4 > 2 先手,4 伤 + 剧毒补足 → 9 血也直接死,单挑者无伤
    expect(r.state.players[1].board).toHaveLength(0)
    expect(r.state.players[0].board[0].health).toBe(3)
  })
})

describe('equipment 装备牌', () => {
  it('buffs stats, grants keywords, goes to graveyard', () => {
    const blade = inst('eq-blade')
    const target = inst('buffed-target')
    const s = battleState({ hand: [blade], board: [target] })
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: blade.iid, target: { kind: 'general', iid: target.iid } }, LIB),
    )
    const p = r.state.players[0]
    expect(p.mana.current).toBe(7)
    expect(p.board[0].attack).toBe(6)
    expect(p.board[0].health).toBe(5)
    expect(p.board[0].maxHealth).toBe(5)
    expect(p.board[0].keywords).toContain('lifesteal')
    expect(p.graveyard).toContain('eq-blade')
    expect(p.hand).toHaveLength(0)
    const types = r.events.map((e) => e.type)
    expect(types).toContain('EquipmentAttached')
    expect(types).toContain('GeneralBuffed')
    expect(types).toContain('KeywordGranted')
  })

  it('requires a friendly general target', () => {
    const blade = inst('eq-blade')
    const foe = inst('vanilla')
    const s = battleState({ hand: [blade] }, { board: [foe] })
    expect(applyCommand(s, 0, { type: 'PlayCard', iid: blade.iid }, LIB)).toMatchObject({
      ok: false,
      error: 'target-required',
    })
    expect(
      applyCommand(s, 0, { type: 'PlayCard', iid: blade.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    ).toMatchObject({ ok: false, error: 'invalid-target' })
  })

  it('legalCommands enumerates equipment only with friendly board', () => {
    const blade = inst('eq-blade')
    const noBoard = battleState({ hand: [blade] })
    expect(legalCommands(noBoard, 0, LIB).filter((c) => c.type === 'PlayCard')).toHaveLength(0)
    const ally = inst('vanilla')
    const withBoard = battleState({ hand: [inst('eq-blade')], board: [ally] })
    const plays = legalCommands(withBoard, 0, LIB).filter((c) => c.type === 'PlayCard')
    expect(plays).toHaveLength(1)
    expect(plays[0]).toMatchObject({ target: { kind: 'general', iid: ally.iid } })
  })
})

describe('gainArmor 护甲', () => {
  it('adds armor which absorbs hero damage', () => {
    const scroll = inst('strat-armor')
    const s = battleState({ hand: [scroll] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: scroll.iid }, LIB))
    expect(r.state.players[0].armor).toBe(5)
    expect(r.events.some((e) => e.type === 'ArmorGained' && e.armorAfter === 5)).toBe(true)
    // 护甲先扣:7 伤 → 5 甲 + 2 血
    const foe = inst('vanilla', { attack: 7 })
    const s2 = { ...structuredClone(r.state), activePlayer: 1 as const }
    s2.players[1].board = [foe]
    const r2 = must(
      applyCommand(s2, 1, { type: 'Attack', attackerIid: foe.iid, target: { kind: 'hero', player: 0 } }, LIB),
    )
    expect(r2.state.players[0].armor).toBe(0)
    expect(r2.state.players[0].heroHp).toBe(28)
  })
})

describe('returnToHand 弹回', () => {
  it('returns enemy general to hand with base stats restored', () => {
    const bounce = inst('strat-bounce')
    const buffed = inst('vanilla', { attack: 7, health: 9, maxHealth: 9, keywords: ['guard'] })
    const s = battleState({ hand: [bounce] }, { board: [buffed] })
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: bounce.iid, target: { kind: 'general', iid: buffed.iid } }, LIB),
    )
    const foe = r.state.players[1]
    expect(foe.board).toHaveLength(0)
    expect(foe.hand).toHaveLength(1)
    expect(foe.hand[0]).toMatchObject({ defId: 'vanilla', attack: 2, health: 3, maxHealth: 3 })
    expect(foe.hand[0].keywords).toEqual([])
    expect(r.events.some((e) => e.type === 'GeneralReturned')).toBe(true)
  })

  it('burns the card when hand is full', () => {
    const bounce = inst('strat-bounce')
    const target = inst('vanilla')
    const fullHand = Array.from({ length: HAND_LIMIT }, () => inst('vanilla'))
    const s = battleState({ hand: [bounce] }, { board: [target], hand: fullHand })
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: bounce.iid, target: { kind: 'general', iid: target.iid } }, LIB),
    )
    const foe = r.state.players[1]
    expect(foe.board).toHaveLength(0)
    expect(foe.hand).toHaveLength(HAND_LIMIT)
    expect(foe.graveyard).toContain('vanilla')
    expect(r.events.some((e) => e.type === 'CardBurned')).toBe(true)
  })
})

describe('discardRandom 弃牌', () => {
  it('opponent discards to graveyard, deterministic per rng', () => {
    const mill = inst('strat-mill')
    const s = battleState(
      { hand: [mill] },
      { hand: [inst('vanilla'), inst('big'), inst('leech')] },
    )
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: mill.iid }, LIB))
    const foe = r.state.players[1]
    expect(foe.hand).toHaveLength(1)
    expect(foe.graveyard).toHaveLength(2)
    expect(r.events.filter((e) => e.type === 'CardDiscarded')).toHaveLength(2)
    // 同一初始状态重放结果一致(确定性)
    const r2 = must(applyCommand(s, 0, { type: 'PlayCard', iid: mill.iid }, LIB))
    expect(r2.state.players[1].graveyard).toEqual(foe.graveyard)
  })

  it('discarding an empty hand does nothing', () => {
    const mill = inst('strat-mill')
    const s = battleState({ hand: [mill] }, { hand: [] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: mill.iid }, LIB))
    expect(r.state.players[1].graveyard).toHaveLength(0)
    expect(r.events.some((e) => e.type === 'CardDiscarded')).toBe(false)
  })
})
