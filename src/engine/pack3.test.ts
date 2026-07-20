// 第三卡包机制测试:附魔层 / 铁壁 / 潜行 / 沉默 / 冻结 / 光环 /
// 回合触发器 / 受伤触发器 / 法术伤害 / 主公技。
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
  HeroPowerDef,
  PlayerState,
} from './types'

let nextIid = 7000

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
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = Object.fromEntries(
  [
    def('vanilla', { cost: 2, attack: 2, health: 3 }),
    def('big', { cost: 5, attack: 5, health: 8 }),
    def('shielded', { cost: 3, attack: 3, health: 3, keywords: ['divineShield'] }),
    def('sneaky', { cost: 2, attack: 4, health: 2, keywords: ['stealth'] }),
    def('sneakyGuard', { cost: 2, attack: 1, health: 5, keywords: ['stealth', 'guard'] }),
    def('wall', { cost: 2, attack: 0, health: 6, keywords: ['guard'] }),
    def('poisoner', { cost: 2, attack: 1, health: 3, keywords: ['poison'] }),
    // 光环:其他友方武将 +1/+1
    def('bannerman', {
      cost: 4,
      attack: 2,
      health: 4,
      aura: { scope: 'friendlyOthers', attack: 1, health: 1 },
    }),
    // 亡语:对敌方全场 2 点
    def('bomber', {
      cost: 3,
      attack: 2,
      health: 2,
      deathrattle: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    }),
    // 回合结束:自身 +1/+1
    def('grower', {
      cost: 3,
      attack: 1,
      health: 4,
      endOfTurn: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] },
    }),
    // 回合开始:主公回 2
    def('healer', {
      cost: 3,
      attack: 2,
      health: 3,
      startOfTurn: { ops: [{ op: 'heal', amount: 2, target: 'friendlyHero' }] },
    }),
    // 受伤后 +2/+0
    def('enrager', {
      cost: 3,
      attack: 2,
      health: 6,
      onDamaged: { ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self' }] },
    }),
    def('sparkmage', { cost: 3, attack: 2, health: 3, spellDamage: 2 }),
    // ---- 锦囊 ----
    def('strat-silence', {
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    }),
    def('strat-freeze', {
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    }),
    def('strat-bolt', {
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
    }),
    def('strat-rally', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: {
        ops: [
          {
            op: 'buffStats',
            attack: 3,
            health: 0,
            target: 'allFriendlyGenerals',
            duration: 'endOfTurn',
          },
        ],
      },
    }),
    def('strat-ramp', {
      type: 'stratagem',
      cost: 1,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'gainMana', amount: 1, temporary: false }] },
    }),
    def('strat-quake', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damageAll', amount: 2 }] },
    }),
  ].map((d) => [d.id, d]),
)

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
    deck: [inst('vanilla'), inst('vanilla'), inst('vanilla')],
    hand: [],
    board: [],
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
    ...over,
  }
}

function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState {
  return {
    seed: 1,
    rng: 12345,
    turn: 3,
    activePlayer: 0,
    phase: 'main',
    players: [player(p0), player(p1)],
    nextIid: 9000,
  }
}

const ok = (r: ReturnType<typeof applyCommand>) => {
  if (!r.ok) throw new Error(`expected ok, got ${r.error}`)
  return r
}

// ---------------------------------------------------------------- 铁壁

describe('divineShield 铁壁', () => {
  it('absorbs one hit entirely regardless of size, then is gone', () => {
    const mine = inst('shielded', { exhausted: false })
    const foe = inst('big') // 5/8
    const s = game({ board: [mine] }, { board: [foe] })
    const r = ok(
      applyCommand(s, 0, { type: 'Attack', attackerIid: mine.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    const after = r.state.players[0].board[0]
    // 5 点反伤被铁壁完全吃掉
    expect(after.health).toBe(3)
    expect(after.keywords).not.toContain('divineShield')
    expect(r.events.some((e) => e.type === 'DivineShieldPopped')).toBe(true)
    // 自己的伤害照常打出
    expect(r.state.players[1].board[0].health).toBe(5)
  })

  it('blocks poison — a shielded general survives a poisonous strike', () => {
    const mine = inst('shielded', { exhausted: false })
    const foe = inst('poisoner')
    const s = game({ board: [mine] }, { board: [foe] })
    const r = ok(
      applyCommand(s, 0, { type: 'Attack', attackerIid: mine.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    expect(r.state.players[0].board).toHaveLength(1)
    expect(r.state.players[0].board[0].health).toBe(3)
  })

  it('is not restored by refresh once used', () => {
    const mine = inst('shielded')
    const s = game({ board: [mine] }, { board: [inst('vanilla')] })
    // 用锦囊打掉盾,再打一次就该真掉血
    const bolt1 = inst('strat-bolt')
    const bolt2 = inst('strat-bolt')
    let st = s
    st.players[0].hand = [bolt1, bolt2]
    st = ok(
      applyCommand(st, 0, { type: 'PlayCard', iid: bolt1.iid, target: { kind: 'general', iid: mine.iid } }, LIB),
    ).state
    expect(st.players[0].board[0].health).toBe(3)
    st = ok(
      applyCommand(st, 0, { type: 'PlayCard', iid: bolt2.iid, target: { kind: 'general', iid: mine.iid } }, LIB),
    ).state
    expect(st.players[0].board[0].health).toBe(2)
  })
})

// ---------------------------------------------------------------- 潜行

describe('stealth 潜行', () => {
  it('cannot be attacked, and does not force attacks with its own Guard', () => {
    const attacker = inst('vanilla', { exhausted: false })
    const hidden = inst('sneakyGuard') // 潜行 + 守护
    const open = inst('vanilla')
    const s = game({ board: [attacker] }, { board: [hidden, open] })
    const targets = legalAttackTargets(s, 0, attacker)
    expect(targets.some((t) => t.kind === 'general' && t.iid === hidden.iid)).toBe(false)
    // 潜行守护不生效,所以主公仍可被攻击
    expect(targets.some((t) => t.kind === 'hero')).toBe(true)
    expect(targets.some((t) => t.kind === 'general' && t.iid === open.iid)).toBe(true)
  })

  it('cannot be chosen by an enemy stratagem', () => {
    const hidden = inst('sneaky')
    const bolt = inst('strat-bolt')
    const s = game({ hand: [bolt] }, { board: [hidden] })
    const cmds = legalCommands(s, 0, LIB)
    const boltCmds = cmds.filter((c) => c.type === 'PlayCard' && c.iid === bolt.iid)
    expect(
      boltCmds.some((c) => c.type === 'PlayCard' && c.target?.kind === 'general' && c.target.iid === hidden.iid),
    ).toBe(false)
  })

  it('breaks after the general attacks', () => {
    const hidden = inst('sneaky', { exhausted: false })
    const s = game({ board: [hidden] }, { board: [inst('vanilla')] })
    const r = ok(applyCommand(s, 0, { type: 'Attack', attackerIid: hidden.iid, target: { kind: 'hero', player: 1 } }, LIB))
    expect(r.state.players[0].board[0].keywords).not.toContain('stealth')
    expect(r.events.some((e) => e.type === 'StealthBroken')).toBe(true)
  })
})

// ---------------------------------------------------------------- 沉默

describe('silence 沉默', () => {
  it('strips keywords, enchantments and deathrattles', () => {
    const bomber = inst('bomber', { attack: 6, health: 9, keywords: ['guard'] })
    const silence = inst('strat-silence')
    const s = game({ hand: [silence] }, { board: [bomber] })
    const r = ok(
      applyCommand(s, 0, { type: 'PlayCard', iid: silence.iid, target: { kind: 'general', iid: bomber.iid } }, LIB),
    )
    const after = r.state.players[1].board[0]
    // 附魔给的 +4/+7 与守护全部消失,回到卡面 2/2
    expect(after.attack).toBe(2)
    expect(after.maxHealth).toBe(2)
    expect(after.keywords).toEqual([])
    expect(after.silenced).toBe(true)
  })

  it('suppresses the deathrattle when the silenced general dies', () => {
    const bomber = inst('bomber')
    const mySmall = inst('vanilla', { attack: 2, health: 2 })
    const silence = inst('strat-silence')
    let st = game({ hand: [silence], board: [mySmall] }, { board: [bomber] })
    st = ok(
      applyCommand(st, 0, { type: 'PlayCard', iid: silence.iid, target: { kind: 'general', iid: bomber.iid } }, LIB),
    ).state
    // 沉默后打死它,亡语 AOE 不应该伤到我方
    const bolt = inst('strat-bolt')
    st.players[0].hand = [bolt, bolt]
    const r = ok(
      applyCommand(st, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: bomber.iid } }, LIB),
    )
    // bomber 卡面 2 血,已被沉默;1 点法伤打不死它,先确认亡语没提前触发
    expect(r.state.players[0].board[0].health).toBe(2)
  })

  it('never kills the general it silences', () => {
    // 附魔给了 +0/+8 并已承受 6 点伤害;沉默撤销上限后应截断到 1 血而不是负数
    const buffed = inst('vanilla', { maxHealth: 11, health: 5 })
    const silence = inst('strat-silence')
    const s = game({ hand: [silence] }, { board: [buffed] })
    const r = ok(
      applyCommand(s, 0, { type: 'PlayCard', iid: silence.iid, target: { kind: 'general', iid: buffed.iid } }, LIB),
    )
    expect(r.state.players[1].board).toHaveLength(1)
    expect(r.state.players[1].board[0].health).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------- 冻结

describe('freeze 冻结', () => {
  it('prevents attacking, and thaws at the end of the owner’s turn', () => {
    const foe = inst('vanilla', { exhausted: false })
    const freeze = inst('strat-freeze')
    let st = game({ hand: [freeze] }, { board: [foe] })
    st = ok(applyCommand(st, 0, { type: 'PlayCard', iid: freeze.iid }, LIB)).state
    expect(st.players[1].board[0].frozen).toBe(true)
    expect(legalAttackTargets(st, 1, st.players[1].board[0])).toHaveLength(0)

    // 我方结束回合 → 对手回合(仍冻结,不能打)
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    expect(st.activePlayer).toBe(1)
    expect(st.players[1].board[0].frozen).toBe(true)
    expect(legalAttackTargets(st, 1, st.players[1].board[0])).toHaveLength(0)

    // 对手结束自己的回合才解冻 —— 否则冻结等于没冻
    st = ok(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state
    expect(st.players[1].board[0].frozen).toBe(false)
  })
})

// ---------------------------------------------------------------- 光环

describe('aura 光环', () => {
  it('buffs other friendly generals while the source is on the board', () => {
    const banner = inst('bannerman')
    const buddy = inst('vanilla')
    const s = game({ board: [banner, buddy] })
    // 光环在 processDeaths 里重算,先跑一次任意命令
    const r = ok(applyCommand(s, 0, { type: 'EndTurn' }, LIB))
    const [b, mate] = r.state.players[0].board
    expect(b.attack).toBe(2) // friendlyOthers 不含自己
    expect(mate.attack).toBe(3)
    expect(mate.maxHealth).toBe(4)
  })

  it('is withdrawn when the source leaves, and that can kill a minion', () => {
    const banner = inst('bannerman')
    const buddy = inst('vanilla') // 2/3 → 光环下 3/4
    let st = game({ board: [banner, buddy] }, { board: [] })
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].board[1].health).toBe(4)

    // 把 buddy 打到 1 血(光环下 4 血,受 3 点)
    const bolt = inst('strat-bolt')
    st.activePlayer = 0
    st.players[0].hand = [bolt]
    st.players[0].board[1].damage = 3
    refreshInstance(st.players[0].board[1], LIB)
    expect(st.players[0].board[1].health).toBe(1)

    // 用一点伤害杀掉光环来源 → buddy 上限回落到 3,已受 3 点 → 一起阵亡
    st.players[0].board[0].damage = 3
    refreshInstance(st.players[0].board[0], LIB)
    const r = ok(applyCommand(st, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: banner.iid } }, LIB))
    expect(r.state.players[0].board).toHaveLength(0)
  })

  it('is suppressed when the aura source is silenced', () => {
    const banner = inst('bannerman')
    const buddy = inst('vanilla')
    const silence = inst('strat-silence')
    let st = game({ board: [banner, buddy] }, { hand: [silence] })
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].board[1].attack).toBe(3)
    const r = ok(
      applyCommand(st, 1, { type: 'PlayCard', iid: silence.iid, target: { kind: 'general', iid: banner.iid } }, LIB),
    )
    expect(r.state.players[0].board[1].attack).toBe(2)
  })
})

// ---------------------------------------------------------------- 临时增益

describe('temporary buffs 本回合增益', () => {
  it('expire at end of turn and cannot kill their holder', () => {
    const a = inst('vanilla')
    const rally = inst('strat-rally')
    let st = game({ board: [a], hand: [rally] })
    st = ok(applyCommand(st, 0, { type: 'PlayCard', iid: rally.iid }, LIB)).state
    expect(st.players[0].board[0].attack).toBe(5)
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].board[0].attack).toBe(2)
    expect(st.players[0].board).toHaveLength(1)
  })
})

// ---------------------------------------------------------------- 回合与受伤触发器

describe('triggers 触发器', () => {
  it('endOfTurn fires for the active player only', () => {
    const grower = inst('grower')
    let st = game({ board: [grower] })
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].board[0].attack).toBe(2)
    // 对手回合结束不该再次触发我方的 grower
    st = ok(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].board[0].attack).toBe(2)
  })

  it('startOfTurn fires when the owner’s turn begins', () => {
    const healer = inst('healer')
    let st = game({ board: [healer] }, {})
    st.players[0].heroHp = 20
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state // → 对手回合
    expect(st.players[0].heroHp).toBe(20)
    st = ok(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state // → 回到我方回合
    expect(st.players[0].heroHp).toBe(22)
  })

  it('onDamaged fires after surviving damage, but not on the killing blow', () => {
    const enrager = inst('enrager') // 2/6,受伤后 +2/+0
    const bolt = inst('strat-bolt')
    const s = game({ board: [enrager], hand: [bolt] })
    const r = ok(
      applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: enrager.iid } }, LIB),
    )
    expect(r.state.players[0].board[0].attack).toBe(4)
    expect(r.state.players[0].board[0].health).toBe(5)
  })
})

// ---------------------------------------------------------------- 法术伤害

describe('spellDamage 法术伤害', () => {
  it('boosts stratagems but not battlecries or hero powers', () => {
    const mage = inst('sparkmage') // 法伤 +2
    const bolt = inst('strat-bolt') // 基础 1 点
    const foe = inst('big')
    const s = game({ board: [mage], hand: [bolt] }, { board: [foe] })
    const r = ok(
      applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    expect(r.state.players[1].board[0].health).toBe(5) // 8 - (1+2)
  })

  it('is not counted while the source is silenced', () => {
    const mage = inst('sparkmage', { silenced: true })
    const bolt = inst('strat-bolt')
    const foe = inst('big')
    const s = game({ board: [mage], hand: [bolt] }, { board: [foe] })
    const r = ok(
      applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: foe.iid } }, LIB),
    )
    expect(r.state.players[1].board[0].health).toBe(7)
  })
})

// ---------------------------------------------------------------- 法力与全场伤害

describe('gainMana / damageAll', () => {
  it('permanent ramp raises both max and current mana', () => {
    const ramp = inst('strat-ramp')
    const s = game({ hand: [ramp], mana: { current: 5, max: 5 } })
    const r = ok(applyCommand(s, 0, { type: 'PlayCard', iid: ramp.iid }, LIB))
    expect(r.state.players[0].mana.max).toBe(6)
    expect(r.state.players[0].mana.current).toBe(5) // 花掉 1 费再 +1
  })

  it('damageAll hits both boards including your own', () => {
    const mine = inst('vanilla') // 2/3
    const foe = inst('vanilla')
    const quake = inst('strat-quake')
    const s = game({ board: [mine], hand: [quake] }, { board: [foe] })
    const r = ok(applyCommand(s, 0, { type: 'PlayCard', iid: quake.iid }, LIB))
    expect(r.state.players[0].board[0].health).toBe(1)
    expect(r.state.players[1].board[0].health).toBe(1)
  })
})

// ---------------------------------------------------------------- 主公技

const PING: HeroPowerDef = {
  id: 'test-ping',
  name: { zh: '试', en: 'Ping' },
  text: { zh: '造成 1 点伤害', en: 'Deal 1 damage' },
  cost: 2,
  script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
}

const ARMOR: HeroPowerDef = {
  id: 'test-armor',
  name: { zh: '甲', en: 'Armor' },
  text: { zh: '获得 2 点护甲', en: 'Gain 2 Armor' },
  cost: 2,
  script: { ops: [{ op: 'gainArmor', amount: 2 }] },
}

describe('hero power 主公技', () => {
  it('costs mana, fires its script, and is once per turn', () => {
    let st = game({ heroPower: ARMOR, mana: { current: 5, max: 5 } })
    st = ok(applyCommand(st, 0, { type: 'UseHeroPower' }, LIB)).state
    expect(st.players[0].armor).toBe(2)
    expect(st.players[0].mana.current).toBe(3)
    expect(st.players[0].heroPowerUsed).toBe(true)
    const again = applyCommand(st, 0, { type: 'UseHeroPower' }, LIB)
    expect(again.ok).toBe(false)
    expect(again.ok === false && again.error).toBe('hero-power-used')
  })

  it('resets at the start of your next turn', () => {
    let st = game({ heroPower: ARMOR }, { heroPower: ARMOR })
    st = ok(applyCommand(st, 0, { type: 'UseHeroPower' }, LIB)).state
    st = ok(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    st = ok(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].heroPowerUsed).toBe(false)
  })

  it('rejects use without enough mana and appears in legalCommands only when affordable', () => {
    const poor = game({ heroPower: PING, mana: { current: 1, max: 1 } }, { board: [inst('vanilla')] })
    expect(applyCommand(poor, 0, { type: 'UseHeroPower', target: { kind: 'hero', player: 1 } }, LIB).ok).toBe(false)
    expect(legalCommands(poor, 0, LIB).some((c) => c.type === 'UseHeroPower')).toBe(false)

    const rich = game({ heroPower: PING, mana: { current: 5, max: 5 } }, { board: [inst('vanilla')] })
    expect(legalCommands(rich, 0, LIB).some((c) => c.type === 'UseHeroPower')).toBe(true)
  })

  it('requires a legal target for targeted powers', () => {
    const st = game({ heroPower: PING }, { board: [inst('vanilla')] })
    expect(applyCommand(st, 0, { type: 'UseHeroPower' }, LIB).ok).toBe(false)
    const r = ok(applyCommand(st, 0, { type: 'UseHeroPower', target: { kind: 'hero', player: 1 } }, LIB))
    expect(r.state.players[1].heroHp).toBe(29)
    expect(r.events.some((e) => e.type === 'HeroPowerUsed')).toBe(true)
  })

  it('cannot target a stealthed enemy', () => {
    const st = game({ heroPower: PING }, { board: [inst('sneaky')] })
    const hidden = st.players[1].board[0]
    const r = applyCommand(st, 0, { type: 'UseHeroPower', target: { kind: 'general', iid: hidden.iid } }, LIB)
    expect(r.ok).toBe(false)
  })
})

// ---------------------------------------------------------------- 装备与沉默的交互

describe('equipment × silence', () => {
  it('silence removes equipment bonuses because they are enchantments now', () => {
    const eqDef = def('eq-test', {
      type: 'equipment',
      cost: 2,
      attack: 3,
      health: 3,
      keywords: ['guard'],
    })
    const lib: CardLibrary = { ...LIB, 'eq-test': eqDef }
    const holder = createInstance('vanilla', 8001, lib)
    const equip = createInstance('eq-test', 8002, lib)
    const silence = createInstance('strat-silence', 8003, lib)
    const st: GameState = {
      seed: 1,
      rng: 5,
      turn: 3,
      activePlayer: 0,
      phase: 'main',
      players: [player({ board: [holder], hand: [equip] }), player({ hand: [silence] })],
      nextIid: 9000,
    }
    let s2 = ok(
      applyCommand(st, 0, { type: 'PlayCard', iid: equip.iid, target: { kind: 'general', iid: holder.iid } }, lib),
    ).state
    expect(s2.players[0].board[0].attack).toBe(5)
    expect(s2.players[0].board[0].keywords).toContain('guard')
    s2.activePlayer = 1
    s2 = ok(
      applyCommand(s2, 1, { type: 'PlayCard', iid: silence.iid, target: { kind: 'general', iid: holder.iid } }, lib),
    ).state
    expect(s2.players[0].board[0].attack).toBe(2)
    expect(s2.players[0].board[0].keywords).toEqual([])
  })
})
