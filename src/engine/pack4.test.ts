// 第四卡包机制测试:伏兵 / 连击 / 过载。
//
// 重点不在「效果对不对」,而在三条**跨流程**的不变量 —— 它们是这一包
// 真正危险的地方,因为伏兵是引擎里第一个「一方的动作会跑另一方脚本」的机制:
//   1. 伏兵可以在攻击结算**中途**把攻击者带走,调用方必须重新取引用;
//   2. 伏兵对对手必须只暴露数量,不暴露牌面(裁剪层);
//   3. legalCommands 给出的每条命令 applyCommand 都必须接受(连击改脚本后尤其容易破)。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { createInstance } from './init'
import { redactState, redactEvent, redactForSpectator } from './redact'
import { refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'
import { SECRET_LIMIT } from './types'

let nextIid = 8000

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

const strat = (id: string, over: Partial<CardDef>): CardDef =>
  def(id, { type: 'stratagem', attack: undefined, health: undefined, ...over })

const LIB: CardLibrary = Object.fromEntries(
  [
    def('vanilla', { cost: 2, attack: 2, health: 3 }),
    def('bruiser', { cost: 4, attack: 5, health: 5 }),
    def('wall', { cost: 2, attack: 0, health: 6, keywords: ['guard'] }),
    def('bannerman', {
      cost: 4,
      attack: 2,
      health: 4,
      aura: { scope: 'friendlyOthers', attack: 1, health: 1 },
    }),
    // ---- 伏兵 ----
    strat('sec-trap', {
      cost: 2,
      secret: {
        trigger: 'enemyAttack',
        script: { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] },
      },
    }),
    strat('sec-bounce', {
      cost: 2,
      secret: {
        trigger: 'enemySummon',
        script: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
      },
    }),
    strat('sec-silence', {
      cost: 3,
      secret: {
        trigger: 'enemySummon',
        script: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
      },
    }),
    strat('sec-draw', {
      cost: 1,
      secret: { trigger: 'enemyStratagem', script: { ops: [{ op: 'draw', count: 2 }] } },
    }),
    // ---- 连击 ----
    strat('combo-bolt', {
      cost: 2,
      spell: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] },
      combo: { ops: [{ op: 'damage', amount: 4, target: 'chosenAny' }] },
    }),
    // 基础脚本**不要**目标、连击脚本**要**目标 —— 专门用来打 legal/apply 的契约
    strat('combo-shift', {
      cost: 1,
      spell: { ops: [{ op: 'draw', count: 1 }] },
      combo: { ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }] },
    }),
    def('combo-assassin', {
      cost: 4,
      attack: 4,
      health: 3,
      combo: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'self' }] },
    }),
    // ---- 过载 ----
    strat('ol-nuke', { cost: 3, overload: 2, spell: { ops: [{ op: 'aoeDamage', amount: 4 }] } }),
    def('ol-champion', { cost: 5, attack: 8, health: 7, keywords: ['charge'], overload: 2 }),
    strat('plain-bolt', { cost: 1, spell: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] } }),
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
    deck: [inst('vanilla'), inst('vanilla'), inst('vanilla'), inst('vanilla')],
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

function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState {
  return {
    seed: 1,
    rng: 4242,
    turn: 5,
    activePlayer: 0,
    phase: 'main',
    players: [player(p0), player(p1)],
    nextIid: 9500,
  }
}

function must(r: ReturnType<typeof applyCommand>) {
  if (!r.ok) throw new Error(`command rejected: ${r.error}`)
  return r
}

// 伏兵住在 1 号玩家(防守方),0 号玩家动作触发它
const secretOf = (defId: string) => ({ iid: nextIid++, defId })

describe('伏兵 · 埋设', () => {
  it('打出后进伏兵区而不是墓地,且不结算脚本', () => {
    const card = inst('sec-draw')
    const s = game({ hand: [card] })
    const deckBefore = s.players[0].deck.length
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    expect(r.state.players[0].secrets).toEqual([{ iid: card.iid, defId: 'sec-draw' }])
    expect(r.state.players[0].graveyard).toEqual([])
    // 抽两张的脚本此刻**不能**跑
    expect(r.state.players[0].deck.length).toBe(deckBefore)
    expect(r.events.some((e) => e.type === 'SecretPlayed')).toBe(true)
  })

  it('同名伏兵不能重复埋(否则「还剩几个」这个信息就失真了)', () => {
    const a = inst('sec-draw')
    const s = game({ hand: [a], secrets: [{ iid: 1, defId: 'sec-draw' }] })
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: a.iid }, LIB)
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.error).toBe('secret-duplicate')
  })

  it('伏兵区满了打不出', () => {
    const a = inst('sec-draw')
    const full = Array.from({ length: SECRET_LIMIT }, (_, i) => ({ iid: i, defId: `x${i}` }))
    const s = game({ hand: [a], secrets: full })
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: a.iid }, LIB)
    expect(r.ok === false && r.error).toBe('secrets-full')
  })
})

describe('伏兵 · enemyAttack', () => {
  it('在伤害结算之前触发 —— 打死攻击者就整次攻击作废', () => {
    const attacker = inst('vanilla', { exhausted: false }) // 2/3
    const s = game(
      { board: [attacker] },
      { secrets: [secretOf('sec-trap')], board: [inst('wall')] },
    )
    const wall = s.players[1].board[0]
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'general', iid: wall.iid } },
        LIB,
      ),
    )
    // 攻击者 2/3 吃 4 点直接死
    expect(r.state.players[0].board).toHaveLength(0)
    // 守护墙一点伤都没吃到 —— 证明伏兵确实在伤害之前
    expect(r.state.players[1].board[0].health).toBe(6)
    expect(r.events.some((e) => e.type === 'AttackResolved')).toBe(false)
    expect(r.state.players[1].secrets).toHaveLength(0)
  })

  it('攻击者活下来时攻击照常结算', () => {
    const attacker = inst('bruiser', { exhausted: false }) // 5/5,吃 4 点还剩 1
    const s = game({ board: [attacker] }, { secrets: [secretOf('sec-trap')] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'hero', player: 1 } },
        LIB,
      ),
    )
    expect(r.state.players[1].heroHp).toBe(25)
    expect(r.state.players[0].board[0].health).toBe(1)
  })

  it('触发伏兵不会让攻击者多打一次 —— attacksUsed 在触发前就扣了', () => {
    // 这一条盯的是 combat.ts 里那个 canAttackNow2:伏兵触发后要复检攻击者,
    // 但**不能**用 canAttackNow ——它会看 attacksUsed,而这次的次数在触发前
    // 就已经扣掉了,于是每一次「触发了伏兵的攻击」都会被误判成无效。
    // 反过来也不能不扣:不扣的话攻击者这回合还能再打一次,等于伏兵白埋。
    // 5/5 吃 4 点活下来 → 攻击照常结算,且 attacksUsed 恰好是 1。
    const attacker = inst('bruiser', { exhausted: false })
    const wall = inst('wall')
    const s = game(
      { board: [attacker] },
      { secrets: [secretOf('sec-trap')], board: [wall] },
    )
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'general', iid: wall.iid } },
        LIB,
      ),
    )
    const after = r.state.players[0].board[0]
    expect(after.health).toBe(1)
    expect(after.attacksUsed).toBe(1)
    // 攻击确实结算了(伏兵没打死它),守护墙吃到 5 点
    expect(r.state.players[1].board[0].health).toBe(1)
    // 再打一次要被拒
    const again = applyCommand(
      r.state,
      0,
      { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'general', iid: wall.iid } },
      LIB,
    )
    expect(again.ok).toBe(false)
  })

  it('一次动作最多只翻一个伏兵', () => {
    const attacker = inst('bruiser', { exhausted: false })
    const s = game(
      { board: [attacker] },
      { secrets: [secretOf('sec-trap'), secretOf('sec-trap')] },
    )
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'hero', player: 1 } },
        LIB,
      ),
    )
    expect(r.state.players[1].secrets).toHaveLength(1)
    expect(r.events.filter((e) => e.type === 'SecretRevealed')).toHaveLength(1)
  })
})

describe('伏兵 · enemySummon', () => {
  it('在战吼之后触发,弹回刚入场的武将', () => {
    const card = inst('vanilla')
    const s = game({ hand: [card] }, { secrets: [secretOf('sec-bounce')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(0)
    expect(r.state.players[0].hand.map((c) => c.defId)).toEqual(['vanilla'])
    expect(r.state.players[1].secrets).toHaveLength(0)
  })

  it('沉默类伏兵能拆掉入场的光环', () => {
    const card = inst('bannerman')
    const ally = inst('vanilla')
    const s = game({ hand: [card], board: [ally] }, { secrets: [secretOf('sec-silence')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    const flag = r.state.players[0].board.find((c) => c.defId === 'bannerman')
    expect(flag?.silenced).toBe(true)
    // 光环被拆 → 友军回到 2/3
    const friend = r.state.players[0].board.find((c) => c.iid === ally.iid)
    expect([friend?.attack, friend?.health]).toEqual([2, 3])
  })

  it('自己召唤自己的武将不会触发自己的伏兵', () => {
    const card = inst('vanilla')
    const s = game({ hand: [card], secrets: [secretOf('sec-bounce')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, LIB))
    expect(r.state.players[0].board).toHaveLength(1)
    expect(r.state.players[0].secrets).toHaveLength(1)
  })
})

describe('伏兵 · enemyStratagem', () => {
  it('在锦囊结算之后触发', () => {
    const bolt = inst('plain-bolt')
    const victim = inst('vanilla')
    const s = game({ hand: [bolt] }, { secrets: [secretOf('sec-draw')], board: [victim] })
    const deckBefore = s.players[1].deck.length
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: victim.iid } },
        LIB,
      ),
    )
    // 锦囊自己的效果落地了
    expect(r.state.players[1].board[0].health).toBe(2)
    // 伏兵也翻了
    expect(r.state.players[1].deck.length).toBe(deckBefore - 2)
    expect(r.state.players[1].secrets).toHaveLength(0)
  })

  it('埋伏兵这个动作本身不触发对手的锦囊类伏兵', () => {
    const mine = inst('sec-draw')
    const s = game({ hand: [mine] }, { secrets: [secretOf('sec-draw')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: mine.iid }, LIB))
    expect(r.state.players[1].secrets).toHaveLength(1)
  })
})

describe('伏兵 · 信息裁剪(这一条错了整个机制就不存在)', () => {
  it('对手只看到伏兵的数量与 iid,看不到牌面', () => {
    const s = game({}, { secrets: [secretOf('sec-trap'), secretOf('sec-draw')] })
    const view = redactState(s, 0)
    expect(view.opponent.secretIids).toHaveLength(2)
    expect(JSON.stringify(view.opponent)).not.toContain('sec-trap')
    expect(JSON.stringify(view.opponent)).not.toContain('sec-draw')
    // 自己的当然看得见
    const own = redactState(s, 1)
    expect(own.self.secrets.map((x) => x.defId)).toEqual(['sec-trap', 'sec-draw'])
  })

  it('SecretPlayed 事件对对手抹掉牌面,SecretRevealed 不抹', () => {
    const played = { type: 'SecretPlayed', player: 1, iid: 3, defId: 'sec-trap' } as const
    const revealed = { type: 'SecretRevealed', player: 1, iid: 3, defId: 'sec-trap' } as const
    expect(redactEvent(played, 0)).toMatchObject({ defId: '' })
    expect(redactEvent(played, 1)).toMatchObject({ defId: 'sec-trap' })
    expect(redactEvent(revealed, 0)).toMatchObject({ defId: 'sec-trap' })
  })

  it('观战席两边的伏兵都看不到', () => {
    const s = game({ secrets: [secretOf('sec-trap')] }, { secrets: [secretOf('sec-draw')] })
    const view = redactForSpectator(s)
    expect(view.self.secrets.every((x) => x.defId === '')).toBe(true)
    expect(JSON.stringify(view)).not.toContain('sec-trap')
    expect(JSON.stringify(view)).not.toContain('sec-draw')
  })
})

describe('连击', () => {
  it('本回合第一张牌走基础脚本', () => {
    const bolt = inst('combo-bolt')
    const victim = inst('bruiser')
    const s = game({ hand: [bolt] }, { board: [victim] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: victim.iid } },
        LIB,
      ),
    )
    expect(r.state.players[1].board[0].health).toBe(3) // 5 - 2
    expect(r.events.some((e) => e.type === 'ComboTriggered')).toBe(false)
  })

  it('第二张起走连击脚本(改用,不是追加)', () => {
    const bolt = inst('combo-bolt')
    const victim = inst('bruiser')
    const s = game({ hand: [bolt], cardsPlayedThisTurn: 1 }, { board: [victim] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: bolt.iid, target: { kind: 'general', iid: victim.iid } },
        LIB,
      ),
    )
    // 改用 = 只吃 4 点;追加的话会是 6 点
    expect(r.state.players[1].board[0].health).toBe(1)
    expect(r.events.some((e) => e.type === 'ComboTriggered')).toBe(true)
  })

  it('武将的连击脚本能给自己加关键词', () => {
    const ck = inst('combo-assassin')
    const s = game({ hand: [ck], cardsPlayedThisTurn: 2 })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: ck.iid }, LIB))
    expect(r.state.players[0].board[0].keywords).toContain('charge')
  })

  it('计数在回合开始时归零', () => {
    const s = game({ cardsPlayedThisTurn: 3 })
    s.activePlayer = 0
    const r = must(applyCommand(s, 0, { type: 'EndTurn' }, LIB))
    expect(r.state.players[1].cardsPlayedThisTurn).toBe(0)
  })

  it('legalCommands 按连击脚本的目标要求列命令(契约:列出的都得能被接受)', () => {
    const shift = inst('combo-shift')
    const victim = inst('vanilla')
    // 基础脚本不要目标,连击脚本要目标 —— 连击态下必须列成带目标的
    const s = game({ hand: [shift], cardsPlayedThisTurn: 1 }, { board: [victim] })
    const cmds = legalCommands(s, 0, LIB).filter(
      (c) => c.type === 'PlayCard' && c.iid === shift.iid,
    )
    expect(cmds).toHaveLength(1)
    for (const c of cmds) expect(applyCommand(s, 0, c, LIB).ok).toBe(true)
    // 非连击态则是无目标的那条
    const s2 = game({ hand: [shift] }, { board: [victim] })
    const cmds2 = legalCommands(s2, 0, LIB).filter(
      (c) => c.type === 'PlayCard' && c.iid === shift.iid,
    )
    expect(cmds2).toEqual([{ type: 'PlayCard', iid: shift.iid }])
    for (const c of cmds2) expect(applyCommand(s2, 0, c, LIB).ok).toBe(true)
  })
})

describe('过载', () => {
  it('打出时只记账,当回合水晶不受影响', () => {
    const nuke = inst('ol-nuke')
    const s = game({ hand: [nuke], mana: { current: 6, max: 6 } })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: nuke.iid }, LIB))
    expect(r.state.players[0].mana.current).toBe(3) // 只扣了牌费
    expect(r.state.players[0].overloadNext).toBe(2)
    expect(r.events.some((e) => e.type === 'ManaOverloaded')).toBe(true)
  })

  it('下回合开始时真的锁掉水晶,并且只锁一回合', () => {
    const s = game({ overloadNext: 2, mana: { current: 6, max: 6 } })
    // 0 号结束回合 → 1 号回合 → 1 号结束 → 0 号回合开始,此时结算过载
    let st = must(applyCommand(s, 0, { type: 'EndTurn' }, LIB)).state
    st = must(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state
    const me = st.players[0]
    expect(me.mana.max).toBe(7)
    expect(me.mana.current).toBe(5) // 7 - 2
    expect(me.overloadLocked).toBe(2)
    expect(me.overloadNext).toBe(0)

    // 再过一轮:不再锁
    let st2 = must(applyCommand(st, 0, { type: 'EndTurn' }, LIB)).state
    st2 = must(applyCommand(st2, 1, { type: 'EndTurn' }, LIB)).state
    expect(st2.players[0].mana.current).toBe(st2.players[0].mana.max)
  })

  it('锁不出负数 —— 过载量大于当前水晶上限时只锁到 0', () => {
    const s = game({ overloadNext: 9, mana: { current: 1, max: 1 } })
    let st = must(applyCommand(s, 0, { type: 'EndTurn' }, LIB)).state
    st = must(applyCommand(st, 1, { type: 'EndTurn' }, LIB)).state
    expect(st.players[0].mana.current).toBe(0)
    expect(st.players[0].mana.current).toBeGreaterThanOrEqual(0)
  })
})
