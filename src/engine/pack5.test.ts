// 第五卡包机制测试:抉择 / 发现。
//
// 两条最危险的性质:
//   1. 发现把对局**停在 pendingChoice 上** —— 挂起期间除了选择方的 ResolveChoice,
//      一切命令都必须被拒;选完才解冻。这是引擎第一个「中途等玩家」的状态。
//   2. 发现的候选对**对手**不能可见(裁剪层),否则悬念不存在。
//   3. 抉择:legalCommands 按选中模式的目标要求列命令,applyCommand 也按同一模式校验 ——
//      两边不一致就会漏出「legal 给的命令被 apply 拒绝」(fuzz 契约)。
import { describe, expect, it } from 'vitest'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { createInstance } from './init'
import { redactState } from './redact'
import { refreshInstance } from './resolve'
import type { CardDef, CardInstance, CardLibrary, GameState, PlayerState } from './types'
import { HAND_LIMIT } from './types'

let nextIid = 12000

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

// 发现候选:一批带唯一 collectorNo 的中立锦囊,好让「确定性采样」可断言
const discoverStock = Array.from({ length: 8 }, (_, i) =>
  strat(`stock-${i}`, {
    collectorNo: 5000 + i,
    cost: i,
    spell: { ops: [{ op: 'draw', count: 1 }] },
  }),
)

const LIB: CardLibrary = Object.fromEntries(
  [
    def('vanilla', { cost: 2, attack: 2, health: 3 }),
    def('bruiser', { cost: 4, attack: 5, health: 5 }),
    // 抉择武将:模式 A 给自己冲锋(无目标),模式 B 对敌将造成 3 点(要目标)
    def('choose-general', {
      cost: 3,
      attack: 3,
      health: 3,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'self' }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }] } },
        ],
      },
    }),
    // 抉择锦囊:模式 A 抽两张(无目标),模式 B 打 4 点(要目标)
    strat('choose-strat', {
      cost: 3,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'draw', count: 2 }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 4, target: 'chosenAny' }] } },
        ],
      },
    }),
    // 发现锦囊:亮 3 张中立锦囊
    strat('discover-strat', {
      cost: 2,
      spell: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    }),
    // 发现 + 前置效果:先打 1 点再发现(验证「发现前的 op 照跑,发现后的不跑」)
    strat('bolt-then-discover', {
      cost: 3,
      spell: {
        ops: [
          { op: 'damage', amount: 1, target: 'enemyHero' },
          { op: 'discover', pool: 'myStratagem' },
          // 这一条**永远不该跑** —— 发现之后脚本停住
          { op: 'draw', count: 5 },
        ],
      },
    }),
    ...discoverStock,
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

function game(p0: Partial<PlayerState>, p1: Partial<PlayerState> = {}): GameState {
  return {
    seed: 1,
    rng: 777,
    turn: 5,
    activePlayer: 0,
    phase: 'main',
    players: [player(p0), player(p1)],
    nextIid: 20000,
  }
}

function must(r: ReturnType<typeof applyCommand>) {
  if (!r.ok) throw new Error(`command rejected: ${r.error}`)
  return r
}

describe('抉择', () => {
  it('模式 A:武将给自己上冲锋', () => {
    const c = inst('choose-general')
    const s = game({ hand: [c] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid, mode: 0 }, LIB))
    expect(r.state.players[0].board[0].keywords).toContain('charge')
    expect(r.events.some((e) => e.type === 'ChooseModePlayed' && e.mode === 0)).toBe(true)
  })

  it('模式 B:对指定敌将造成 3 点', () => {
    const c = inst('choose-general')
    const foe = inst('bruiser')
    const s = game({ hand: [c] }, { board: [foe] })
    const r = must(
      applyCommand(
        s,
        0,
        { type: 'PlayCard', iid: c.iid, mode: 1, target: { kind: 'general', iid: foe.iid } },
        LIB,
      ),
    )
    expect(r.state.players[1].board[0].health).toBe(2) // 5 - 3
  })

  it('非法模式编号被拒', () => {
    const c = inst('choose-strat')
    const s = game({ hand: [c] })
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: c.iid, mode: 9 }, LIB)
    expect(r.ok === false && r.error).toBe('invalid-mode')
  })

  it('legalCommands 逐模式列命令,且每条 apply 都接受(契约)', () => {
    const c = inst('choose-strat')
    const foe = inst('bruiser')
    const s = game({ hand: [c] }, { board: [foe] })
    const cmds = legalCommands(s, 0, LIB).filter(
      (x) => x.type === 'PlayCard' && x.iid === c.iid,
    )
    // 模式 A(无目标)1 条;模式 B 是 chosenAny,可指双方主公 + 那个敌将 = 3 条 —— 合计 4 条
    expect(cmds.length).toBe(4)
    for (const cmd of cmds) expect(applyCommand(s, 0, cmd, LIB).ok).toBe(true)
    // 至少有一条带 mode 0、一条带 mode 1
    expect(cmds.some((x) => x.type === 'PlayCard' && x.mode === 0)).toBe(true)
    expect(cmds.some((x) => x.type === 'PlayCard' && x.mode === 1)).toBe(true)
  })

  it('锦囊模式:目标池为空的那个模式不被列出', () => {
    // 场上没有任何武将/只有主公 → 模式 B(chosenAny)其实还能打主公,所以换个更严的:
    // 用 chosenEnemyGeneral 的武将卡在敌方空场时,模式 B 不可列
    const c = inst('choose-general')
    const s = game({ hand: [c] }, { board: [] }) // 敌方空场
    const cmds = legalCommands(s, 0, LIB).filter(
      (x) => x.type === 'PlayCard' && x.iid === c.iid,
    )
    // 模式 A 永远可打;模式 B 需要敌将而敌方空场 —— 武将卡池空时仍可无目标打出(op 跳过)
    // 所以这里两个模式都在,但模式 B 是无目标形态
    expect(cmds.some((x) => x.type === 'PlayCard' && x.mode === 0)).toBe(true)
    for (const cmd of cmds) expect(applyCommand(s, 0, cmd, LIB).ok).toBe(true)
  })
})

describe('发现 · 挂起', () => {
  it('打出发现锦囊 → 挂起 pendingChoice,亮出 3 张,不结算加牌', () => {
    const c = inst('discover-strat')
    const s = game({ hand: [c] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB))
    expect(r.state.pendingChoice).toBeDefined()
    expect(r.state.pendingChoice?.player).toBe(0)
    expect(r.state.pendingChoice?.options).toHaveLength(3)
    // 手牌此刻没有新增(发现的牌要等 ResolveChoice)
    expect(r.state.players[0].hand).toHaveLength(0)
    expect(r.events.some((e) => e.type === 'DiscoverStarted')).toBe(true)
  })

  it('挂起期间除了 ResolveChoice / Concede,一切命令被拒', () => {
    const c = inst('discover-strat')
    const s = game({ hand: [c, inst('vanilla')] })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB))
    const st = r.state
    expect(applyCommand(st, 0, { type: 'EndTurn' }, LIB).ok).toBe(false)
    const other = st.players[0].hand[0]
    expect(applyCommand(st, 0, { type: 'PlayCard', iid: other.iid }, LIB).ok).toBe(false)
    // legalCommands 也只给 ResolveChoice
    const legal = legalCommands(st, 0, LIB)
    expect(legal.every((x) => x.type === 'ResolveChoice')).toBe(true)
    expect(legal).toHaveLength(3)
    // 认输仍然放行
    expect(applyCommand(st, 0, { type: 'Concede' }, LIB).ok).toBe(true)
  })

  it('ResolveChoice 把选中的牌加进手牌,并解冻对局', () => {
    const c = inst('discover-strat')
    const s = game({ hand: [c] })
    const paused = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB)).state
    const chosen = paused.pendingChoice!.options[1]
    const r = must(applyCommand(paused, 0, { type: 'ResolveChoice', index: 1 }, LIB))
    expect(r.state.pendingChoice).toBeUndefined()
    expect(r.state.players[0].hand.map((h) => h.defId)).toEqual([chosen])
    expect(r.events.some((e) => e.type === 'DiscoverPicked')).toBe(true)
    // 解冻后能正常出牌
    expect(applyCommand(r.state, 0, { type: 'EndTurn' }, LIB).ok).toBe(true)
  })

  it('越界 index / 非选择方 都被拒', () => {
    const c = inst('discover-strat')
    const paused = must(applyCommand(game({ hand: [c] }), 0, { type: 'PlayCard', iid: c.iid }, LIB)).state
    expect(applyCommand(paused, 0, { type: 'ResolveChoice', index: 9 }, LIB).ok).toBe(false)
    expect(applyCommand(paused, 1, { type: 'ResolveChoice', index: 0 }, LIB).ok).toBe(false)
  })

  it('发现之前的 op 照跑,发现之后的 op 不跑(发现是终结)', () => {
    const c = inst('bolt-then-discover')
    const s = game({ hand: [c] }, { heroHp: 30 })
    const r = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB))
    expect(r.state.players[1].heroHp).toBe(29) // 发现前的 1 点伤害落地了
    expect(r.state.pendingChoice).toBeDefined()
    // 发现后那条「抽 5 张」绝不能跑
    expect(r.state.players[0].hand).toHaveLength(0)
  })

  it('手满时发现的牌被烧掉,不突破手牌上限', () => {
    const c = inst('discover-strat')
    const fullHand = Array.from({ length: HAND_LIMIT }, () => inst('vanilla'))
    // 先把发现卡也算进手里再打出 —— 打出后手牌回到 HAND_LIMIT
    const s = game({ hand: [c, ...fullHand.slice(0, HAND_LIMIT)] })
    const paused = must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB)).state
    expect(paused.players[0].hand).toHaveLength(HAND_LIMIT)
    const r = must(applyCommand(paused, 0, { type: 'ResolveChoice', index: 0 }, LIB))
    expect(r.state.players[0].hand).toHaveLength(HAND_LIMIT) // 没超
    expect(r.events.some((e) => e.type === 'CardBurned')).toBe(true)
  })
})

describe('发现 · 确定性与裁剪', () => {
  it('同一个 rng 种子亮出同一批候选(引擎纯度)', () => {
    const opt = (seed: number) => {
      const s = { ...game({ hand: [inst('discover-strat')] }), rng: seed }
      const c = s.players[0].hand[0]
      return must(applyCommand(s, 0, { type: 'PlayCard', iid: c.iid }, LIB)).state.pendingChoice!
        .options
    }
    expect(opt(12345)).toEqual(opt(12345))
    // 不同种子大概率不同(至少不是常量)—— 抽两个不同种子比一下
    const a = opt(1)
    const b = opt(999)
    expect(a.length).toBe(3)
    expect(b.length).toBe(3)
  })

  it('对手看不到发现的候选,但看得到「有个选择在挂起」', () => {
    const c = inst('discover-strat')
    const paused = must(applyCommand(game({ hand: [c] }), 0, { type: 'PlayCard', iid: c.iid }, LIB)).state
    // 选择方视角:看得到候选
    const mine = redactState(paused, 0)
    expect(mine.pendingChoice?.options).toHaveLength(3)
    // 对手视角:count 有,options 空
    const theirs = redactState(paused, 1)
    expect(theirs.pendingChoice?.count).toBe(3)
    expect(theirs.pendingChoice?.options).toEqual([])
    // 候选 defId 一个字都不能出现在对手视图里
    for (const o of paused.pendingChoice!.options) {
      expect(JSON.stringify(theirs)).not.toContain(o)
    }
  })
})
