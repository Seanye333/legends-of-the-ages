import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { canAttackNow } from './combat'
import type { CardDef, CardLibrary, GameConfig, PuzzleScenario } from './types'
import { START_HP } from './types'

// —— 测试卡库:够覆盖残局构造器的所有分支即可 ——
function unit(id: string, attack: number, health: number, extra: Partial<CardDef> = {}): CardDef {
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
    attack,
    health,
    keywords: [],
    ...extra,
  }
}

const LIB: CardLibrary = {
  soldier: unit('soldier', 2, 3),
  charger: unit('charger', 3, 2, { keywords: ['charge'] }),
  guard: unit('guard', 2, 5, { keywords: ['guard'] }),
  firebolt: {
    id: 'firebolt',
    collectorNo: 2,
    name: { zh: '火計', en: 'Fire Attack' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
  },
}

function cfg(scenario: PuzzleScenario, seed = 1): GameConfig {
  return { seed, heroIds: ['liu-bei', 'cao-cao'], deckIds: [[], []], first: 0, scenario }
}

// 一个最小可用残局:我方一个已就绪的 charger,对手空场
function baseScenario(overrides: Partial<PuzzleScenario['players'][0]> = {}): PuzzleScenario {
  return {
    activePlayer: 0,
    players: [
      { heroHp: 20, mana: 10, board: [{ defId: 'charger' }], hand: [], ...overrides },
      { heroHp: 10, mana: 0, board: [], hand: [] },
    ],
  }
}

describe('createScenarioGame', () => {
  it('构造出一个「你的回合」的可对局残局', () => {
    const s = createGame(cfg(baseScenario()), LIB)
    expect(s.phase).toBe('main')
    expect(s.activePlayer).toBe(0)
    expect(s.turn).toBe(1)
    expect(s.players[0].mulliganDone).toBe(true)
    expect(s.players[1].mulliganDone).toBe(true)
    expect(s.players[0].heroHp).toBe(20)
    expect(s.players[1].heroHp).toBe(10)
    expect(s.players[0].mana).toEqual({ current: 10, max: 10 })
  })

  it('对同一 seed 与规格是确定性的', () => {
    expect(createGame(cfg(baseScenario()), LIB)).toEqual(createGame(cfg(baseScenario()), LIB))
  })

  it('heroMaxHp 默认取 max(heroHp, START_HP)', () => {
    const low = createGame(cfg(baseScenario({ heroHp: 12 })), LIB)
    expect(low.players[0].heroMaxHp).toBe(START_HP) // 12 < 30 → 30
    const high = createGame(
      cfg({ ...baseScenario(), players: [
        { heroHp: 45, mana: 10, board: [], hand: [] },
        { heroHp: 10, mana: 0, board: [], hand: [] },
      ] }),
      LIB,
    )
    expect(high.players[0].heroMaxHp).toBe(45)
  })

  it('预置伤害:health = maxHealth - damage', () => {
    const s = createGame(cfg(baseScenario({ board: [{ defId: 'soldier', damage: 1 }] })), LIB)
    const u = s.players[0].board[0]
    expect(u.maxHealth).toBe(3)
    expect(u.damage).toBe(1)
    expect(u.health).toBe(2)
  })

  it('预置伤害 ≥ 上限时夹到留 1 血,不出生即死', () => {
    const s = createGame(cfg(baseScenario({ board: [{ defId: 'soldier', damage: 99 }] })), LIB)
    const u = s.players[0].board[0]
    expect(u.health).toBe(1)
    expect(u.damage).toBe(u.maxHealth - 1)
  })

  it('预置附魔叠加进派生身材', () => {
    const s = createGame(
      cfg(baseScenario({ board: [{ defId: 'soldier', enchants: [{ attack: 2, health: 2 }] }] })),
      LIB,
    )
    const u = s.players[0].board[0]
    expect(u.attack).toBe(4) // 2 + 2
    expect(u.maxHealth).toBe(5) // 3 + 2
  })

  it('我方场上单位默认已就绪、可攻击', () => {
    const s = createGame(cfg(baseScenario({ board: [{ defId: 'soldier' }] })), LIB)
    const u = s.players[0].board[0]
    expect(u.exhausted).toBe(false)
    expect(u.attacksUsed).toBe(0)
    expect(canAttackNow(u)).toBe(true)
  })

  it('所有实例 iid 全局唯一(含双方场面/手牌/牌库/伏兵)', () => {
    const s = createGame(
      cfg({
        activePlayer: 0,
        players: [
          { heroHp: 20, mana: 10, board: [{ defId: 'soldier' }, { defId: 'charger' }], hand: ['firebolt', 'soldier'], deck: ['soldier'] },
          { heroHp: 10, mana: 0, board: [{ defId: 'guard' }], hand: [], secrets: [] },
        ],
      }),
      LIB,
    )
    const iids = [
      ...s.players[0].board,
      ...s.players[0].hand,
      ...s.players[0].deck,
      ...s.players[1].board,
    ].map((c) => c.iid)
    expect(new Set(iids).size).toBe(iids.length)
    expect(s.nextIid).toBeGreaterThan(Math.max(...iids))
  })

  it('是一个真正可对局的状态:攻击敌方英雄扣血', () => {
    const s = createGame(cfg(baseScenario()), LIB) // charger 3 攻,敌 10 血
    const atk = s.players[0].board[0]
    const r = applyCommand(s, 0, { type: 'Attack', attackerIid: atk.iid, target: { kind: 'hero', player: 1 } }, LIB)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.players[1].heroHp).toBe(7)
  })

  it('是一个真正可对局的状态:法术能打出并结算', () => {
    const s = createGame(cfg(baseScenario({ mana: 10, board: [], hand: ['firebolt'] })), LIB)
    const bolt = s.players[0].hand[0]
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid }, LIB)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.players[1].heroHp).toBe(7) // 10 - 3
  })

  it('残局能直接构成斩杀(火計 3 点带走 3 血的对手)', () => {
    const s = createGame(
      cfg({
        activePlayer: 0,
        players: [
          { heroHp: 20, mana: 10, board: [], hand: ['firebolt'] },
          { heroHp: 3, mana: 0, board: [], hand: [] },
        ],
      }),
      LIB,
    )
    const bolt = s.players[0].hand[0]
    const r = applyCommand(s, 0, { type: 'PlayCard', iid: bolt.iid }, LIB)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.state.phase).toBe('ended')
      expect(r.state.winner).toBe(0)
    }
  })

  it('未知 defId 抛错', () => {
    expect(() => createGame(cfg(baseScenario({ board: [{ defId: 'nope' }] })), LIB)).toThrow(/unknown card/)
  })

  it('场面超过上限抛错', () => {
    const seven = Array.from({ length: 7 }, () => ({ defId: 'soldier' }))
    expect(() => createGame(cfg(baseScenario({ board: seven })), LIB)).toThrow(/board exceeds/)
  })
})
