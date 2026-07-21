import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { legalAttackTargets } from './combat'
import { createInstance } from './init'
import { refreshInstance } from './resolve'
import type {
  CardDef,
  CardInstance,
  CardLibrary,
  GameState,
  PlayerState,
} from './types'

let nextIid = 1000

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
    def('charger', { cost: 3, attack: 3, health: 2, keywords: ['charge'] }),
    def('rusher', { cost: 3, attack: 3, health: 2, keywords: ['rush'] }),
    def('wall', { cost: 2, attack: 1, health: 5, keywords: ['guard'] }),
    def('wind', { cost: 4, attack: 2, health: 4, keywords: ['windfury', 'charge'] }),
    def('duelist', { cost: 5, attack: 5, health: 4, keywords: ['duel'] }),
    def('shu-banner', {
      cost: 3,
      dynasty: 'shu',
      battlecry: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'friendlyDynastyGenerals' }] },
    }),
    def('shu-soldier', { dynasty: 'shu' }),
    def('sniper', {
      cost: 3,
      battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    }),
    def('bomber', {
      cost: 3,
      deathrattle: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    }),
    def('summoner', {
      cost: 4,
      battlecry: { ops: [{ op: 'summon', defId: 'vanilla', count: 2 }] },
    }),
    def('strat-bolt', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] },
    }),
    def('strat-storm', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    }),
    def('strat-scroll', {
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }] },
    }),
  ].map((d) => [d.id, d]),
)

// attack/health/keywords 现在是派生字段(见 resolve.ts 附魔层),不能直接赋值 ——
// 测试里指定的身材换算成一条附魔,再让 refreshInstance 算出派生值。
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
  // 同时给了 health 与 maxHealth 且前者更低 → 视为已受伤
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
    deck: [inst('vanilla'), inst('vanilla'), inst('vanilla')],
    hand: [],
    board: [],
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
    secrets: [],
    overloadNext: 0,
    overloadLocked: 0,
    cardsPlayedThisTurn: 0,
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

describe('playing generals', () => {
  it('deducts mana, summons exhausted, cannot attack that turn without charge', () => {
    const card = inst('vanilla')
    const s = battleState({ hand: [card] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    const p = r.state.players[0]
    expect(p.mana.current).toBe(8)
    expect(p.board).toHaveLength(1)
    expect(p.board[0].exhausted).toBe(true)
    expect(legalAttackTargets(r.state, 0, p.board[0])).toHaveLength(0)
    expect(r.events.map((e) => e.type)).toContain('GeneralSummoned')
  })

  it('rejects not-enough-mana and board-full', () => {
    const card = inst('vanilla')
    const s1 = battleState({ hand: [card], mana: { current: 1, max: 10 } })
    expect(applyCommand(s1, 0, { type: 'PlayCard', iid: card.iid }, LIB)).toMatchObject({
      ok: false,
      error: 'not-enough-mana',
    })
    const card2 = inst('vanilla')
    const s2 = battleState({
      hand: [card2],
      board: [inst('vanilla'), inst('vanilla'), inst('vanilla'), inst('vanilla'), inst('vanilla'), inst('vanilla')],
    })
    expect(applyCommand(s2, 0, { type: 'PlayCard', iid: card2.iid }, LIB)).toMatchObject({
      ok: false,
      error: 'board-full',
    })
  })
})

describe('keywords', () => {
  it('charge attacks hero immediately; rush cannot hit hero on summon turn', () => {
    const enemy = inst('vanilla')
    const chargeCard = inst('charger')
    const s = battleState({ hand: [chargeCard] }, { board: [enemy] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: chargeCard.iid }, LIB))
    const summoned = r.state.players[0].board[0]
    const targets = legalAttackTargets(r.state, 0, summoned)
    expect(targets).toContainEqual({ kind: 'hero', player: 1 })

    const rushCard = inst('rusher')
    const s2 = battleState({ hand: [rushCard] }, { board: [inst('vanilla')] })
    const r2 = must(applyCommand(s2, 0, { type: 'PlayCard', iid: rushCard.iid }, LIB))
    const rushTargets = legalAttackTargets(r2.state, 0, r2.state.players[0].board[0])
    expect(rushTargets.some((t) => t.kind === 'hero')).toBe(false)
    expect(rushTargets.some((t) => t.kind === 'general')).toBe(true)
  })

  it('guard forces attacks onto it and protects the hero', () => {
    const attacker = inst('vanilla')
    const wall = inst('wall')
    const squishy = inst('vanilla')
    const s = battleState({ board: [attacker] }, { board: [wall, squishy] })
    const targets = legalAttackTargets(s, 0, attacker)
    expect(targets).toEqual([{ kind: 'general', iid: wall.iid }])
  })

  it('windfury attacks twice, then stops', () => {
    const wind = inst('wind', { exhausted: false })
    const s = battleState({ board: [wind] })
    const r1 = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: wind.iid, target: { kind: 'hero', player: 1 } }, LIB),
    )
    const r2 = must(
      applyCommand(r1.state, 0, { type: 'Attack', attackerIid: wind.iid, target: { kind: 'hero', player: 1 } }, LIB),
    )
    expect(r2.state.players[1].heroHp).toBe(26)
    expect(
      applyCommand(r2.state, 0, { type: 'Attack', attackerIid: wind.iid, target: { kind: 'hero', player: 1 } }, LIB).ok,
    ).toBe(false)
  })
})

describe('attack resolution', () => {
  it('trades damage both ways and processes deaths', () => {
    const a = inst('charger', { exhausted: false }) // 3/2
    const b = inst('vanilla', { attack: 2, health: 3 })
    const s = battleState({ board: [a] }, { board: [b] })
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: a.iid, target: { kind: 'general', iid: b.iid } }, LIB),
    )
    // 3攻杀3血,反击2打2血 → 双方同归于尽
    expect(r.state.players[1].board).toHaveLength(0)
    expect(r.state.players[0].board).toHaveLength(0)
    const died = r.events.filter((e) => e.type === 'GeneralDied')
    expect(died).toHaveLength(2)
  })
})

describe('duel 单挑', () => {
  it('higher attack strikes first and takes no counter when lethal', () => {
    const duelist = inst('duelist') // 5/4
    const target = inst('vanilla', { attack: 2, health: 3 })
    const s = battleState({ hand: [duelist] }, { board: [target] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: duelist.iid, target: { kind: 'general', iid: target.iid } },
        LIB,
      ),
    )
    const duelEvent = r.events.find((e) => e.type === 'DuelFought')
    expect(duelEvent).toMatchObject({ defenderDied: true, challengerDied: false })
    expect(r.state.players[0].board[0].health).toBe(4) // 无反击
    expect(r.state.players[1].board).toHaveLength(0)
  })

  it('equal attack trades simultaneously; playing without a duel target is legal', () => {
    const duelist = inst('duelist') // 5/4
    const bigTarget = inst('vanilla', { attack: 5, health: 9 })
    const s = battleState({ hand: [duelist] }, { board: [bigTarget] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: duelist.iid, target: { kind: 'general', iid: bigTarget.iid } },
        LIB,
      ),
    )
    // 同攻 5:互相打 5 → duelist 4hp 死,target 9-5=4
    expect(r.state.players[0].board).toHaveLength(0)
    expect(r.state.players[1].board[0].health).toBe(4)

    const duelist2 = inst('duelist')
    const s2 = battleState({ hand: [duelist2] }, { board: [inst('vanilla')] })
    const r2 = must(applyCommand(s2, 0, { type: 'PlayCard', iid: duelist2.iid }, LIB))
    expect(r2.state.players[0].board).toHaveLength(1) // 不单挑直接上场
  })
})

describe('battlecries & stratagems', () => {
  it('chosen-target battlecry requires a target only when one exists', () => {
    const sniper = inst('sniper')
    const enemy = inst('vanilla')
    const s = battleState({ hand: [sniper] }, { board: [enemy] })
    expect(applyCommand(s, 0, { type: 'PlayCard', iid: sniper.iid }, LIB)).toMatchObject({
      ok: false,
      error: 'target-required',
    })
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: sniper.iid, target: { kind: 'general', iid: enemy.iid } }, LIB),
    )
    expect(r.state.players[1].board[0].health).toBe(1)

    // 无敌方随从时可直接打出,效果跳过
    const sniper2 = inst('sniper')
    const s2 = battleState({ hand: [sniper2] })
    expect(applyCommand(s2, 0, { type: 'PlayCard', iid: sniper2.iid }, LIB).ok).toBe(true)
  })

  it('dynasty banner buffs all friendly generals of that dynasty including itself', () => {
    const banner = inst('shu-banner')
    const shu1 = inst('shu-soldier')
    const neutral = inst('vanilla')
    const s = battleState({ hand: [banner], board: [shu1, neutral] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: banner.iid }, LIB))
    const board = r.state.players[0].board
    expect(board.find((c) => c.iid === shu1.iid)?.attack).toBe(3) // 2+1
    expect(board.find((c) => c.iid === banner.iid)?.attack).toBe(3)
    expect(board.find((c) => c.iid === neutral.iid)?.attack).toBe(2) // 非蜀不吃
  })

  it('deathrattle aoe fires on death', () => {
    const bomber = inst('bomber', { exhausted: false })
    const killer = inst('vanilla', { attack: 4, health: 9 })
    const bystander1 = inst('vanilla')
    const s = battleState({ board: [killer, bystander1] }, { board: [bomber] })
    // 我方 killer 攻死对面 bomber → bomber 遗计对其敌方(我方)全体 2 伤
    const r = must(
      applyCommand(s, 0, { type: 'Attack', attackerIid: killer.iid, target: { kind: 'general', iid: bomber.iid } }, LIB),
    )
    const myBoard = r.state.players[0].board
    expect(myBoard.find((c) => c.iid === bystander1.iid)?.health).toBe(1) // 3-2
    expect(r.events.some((e) => e.type === 'EffectTriggered' && e.kind === 'deathrattle')).toBe(true)
  })

  it('summon battlecry respects board cap', () => {
    const summoner = inst('summoner')
    const s = battleState({
      hand: [summoner],
      board: [inst('vanilla'), inst('vanilla'), inst('vanilla'), inst('vanilla')],
    })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: summoner.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(6) // 4+召唤者+2 但上限6 → 只召1
  })

  it('targeted stratagem cannot be cast with no legal target; goes to graveyard when cast', () => {
    const bolt = inst('strat-bolt')
    const s = battleState({ hand: [bolt], board: [], deck: [] }, { board: [] })
    // chosenAny 池包含双方英雄,所以永远可指 → 用英雄当目标
    const r = must(
      applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'hero', player: 1 } }, LIB),
    )
    expect(r.state.players[1].heroHp).toBe(27)
    expect(r.state.players[0].graveyard).toContain('strat-bolt')
  })

  it('aoe and draw stratagems work untargeted', () => {
    const storm = inst('strat-storm')
    const scroll = inst('strat-scroll')
    const e1 = inst('vanilla')
    const e2 = inst('vanilla')
    const s = battleState({ hand: [storm, scroll] }, { board: [e1, e2] })
    const r1 = must(applyCommand(s, 0, { type: 'PlayCard', iid: storm.iid }, LIB))
    for (const c of r1.state.players[1].board) expect(c.health).toBe(1)
    const handBefore = r1.state.players[0].hand.length
    const deckBefore = r1.state.players[0].deck.length
    const r2 = must(applyCommand(r1.state, 0, { type: 'PlayCard', iid: scroll.iid }, LIB))
    expect(r2.state.players[0].hand.length).toBe(handBefore - 1 + 2)
    expect(r2.state.players[0].deck.length).toBe(deckBefore - 2)
  })
})

describe('legal/apply contract', () => {
  it('every legal command is accepted by applyCommand', () => {
    const s = battleState(
      {
        hand: [inst('sniper'), inst('duelist'), inst('strat-bolt'), inst('strat-storm'), inst('vanilla')],
        board: [inst('charger', { exhausted: false }), inst('wall', { exhausted: false })],
      },
      { board: [inst('vanilla'), inst('wall')] },
    )
    const commands = legalCommands(s, 0, LIB)
    expect(commands.length).toBeGreaterThan(10)
    for (const cmd of commands) {
      const r = applyCommand(s, 0, cmd, LIB)
      expect(r.ok, `command rejected: ${JSON.stringify(cmd)} → ${r.ok ? '' : r.error}`).toBe(true)
    }
  })
})
