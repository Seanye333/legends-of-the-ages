import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { changeMorale, refreshAuras, refreshInstance } from './resolve'
import { legalAttackTargets } from './combat'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'
import { MORALE_CAP, MORALE_THRESHOLD } from './types'

// 溃散 —— 士气触底(= -MORALE_CAP)那一方失去守護。
//
// 【为什么它是一个实例字段,而不是在 refreshAuras 里直接摘掉关键词】
// `refreshInstance` 每次受伤/治疗/加附魔都会被调,而它**从卡面重新算一遍关键词**。
// 在外面摘掉的守護,下一次挨打就长回来了 —— 而且不报任何错,
// 只是那个守護忽然又生效了,像是随机的。所以压制必须和 shieldUsed / stealthBroken
// 走同一条路:实例上留标记,由 refreshInstance 自己认。
// 下面「挨一下打之后守護不许长回来」那条就是钉这件事的,它是这份测试的主锚。
//
// 另一半是**复位**:士气每回合向 0 收敛一格,所以溃散必须能自己退掉。
// refreshAuras 里那一句是无条件写(不是只在触底时写),漏掉复位那一半
// 就变成「散过一次就永远散着」。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 92000,
  name: { zh: '甲', en: 'A' },
  type: 'general',
  doctrine: 'neutral',
  dynasty: 'qun',
  rarity: 'common',
  archetype: 'warrior',
  cost: 3,
  attack: 2,
  health: 8,
  keywords: [],
  ...over,
})

const GUARD = base({ id: 't-guard', keywords: ['guard'] })
const PLAIN = base({ id: 't-plain' })
const LIB = libWith([GUARD, PLAIN])

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

// 对手(座位 1)带一个守护、一个白板;我方(座位 0)一个白板准备打过去
const setup = (morale: number): GameState => {
  const s = game(
    { board: [{ defId: 't-plain' }] },
    { board: [{ defId: 't-guard' }, { defId: 't-plain' }] },
  )
  changeMorale(s, 1, morale, [])
  refreshAuras(s, LIB)
  return s
}

const guardOf = (s: GameState) => s.players[1].board[0]
const canHitThePlainOne = (s: GameState): boolean =>
  legalAttackTargets(s, 0, s.players[0].board[0]).some(
    (t) => t.kind === 'general' && t.iid === s.players[1].board[1].iid,
  )

describe('溃散', () => {
  it('士气过线但没触底 —— 守護还在', () => {
    const s = setup(-MORALE_THRESHOLD)
    expect(guardOf(s).keywords).toContain('guard')
    expect(canHitThePlainOne(s)).toBe(false)
    // 过线那一档该有的 -1 攻照常
    expect(guardOf(s).attack).toBe(1)
  })

  it('士气触底 —— 守護消失,后排可以直接打', () => {
    const s = setup(-MORALE_CAP)
    expect(guardOf(s).keywords).not.toContain('guard')
    expect(guardOf(s).routed).toBe(true)
    expect(canHitThePlainOne(s)).toBe(true)
  })

  it('**挨一下打之后守護不许长回来** —— 这条红了说明压制没走 refreshInstance', () => {
    const s = setup(-MORALE_CAP)
    const g = guardOf(s)
    // refreshInstance 是受伤/治疗都会走的那一条路,直接调它就是最短的复现
    g.damage += 1
    refreshInstance(g, LIB)
    expect(g.keywords).not.toContain('guard')
    expect(canHitThePlainOne(s)).toBe(true)
  })

  it('士气回到 -2 —— 溃散退掉,守護回来(复位那一半)', () => {
    const s = setup(-MORALE_CAP)
    expect(guardOf(s).keywords).not.toContain('guard')
    changeMorale(s, 1, 1, [])
    refreshAuras(s, LIB)
    expect(guardOf(s).routed).toBeFalsy()
    expect(guardOf(s).keywords).toContain('guard')
    expect(canHitThePlainOne(s)).toBe(false)
  })

  it('士气顶到 +MORALE_CAP 不是溃散 —— 只有触底那一端有', () => {
    const s = setup(MORALE_CAP)
    expect(guardOf(s).routed).toBeFalsy()
    expect(guardOf(s).keywords).toContain('guard')
    expect(guardOf(s).attack).toBe(3)
  })

  it('溃散只散触底那一方 —— 我方的守護不受影响', () => {
    const s = game(
      { board: [{ defId: 't-guard' }] },
      { board: [{ defId: 't-guard' }, { defId: 't-plain' }] },
    )
    changeMorale(s, 1, -MORALE_CAP, [])
    refreshAuras(s, LIB)
    expect(s.players[0].board[0].keywords).toContain('guard')
    expect(s.players[1].board[0].keywords).not.toContain('guard')
  })

  it('回合开始士气收敛一格,溃散跟着退 —— 走真的 reducer,不是手改状态', () => {
    const s = game({}, { board: [{ defId: 't-guard' }] })
    changeMorale(s, 1, -MORALE_CAP, [])
    refreshAuras(s, LIB)
    expect(s.players[1].board[0].keywords).not.toContain('guard')
    const r = applyCommand(s, 0, { type: 'EndTurn' }, LIB)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    // 座位 1 的回合开始:士气 -3 → -2,溃散退掉
    expect(r.state.players[1].morale).toBe(-MORALE_THRESHOLD)
    expect(r.state.players[1].board[0].keywords).toContain('guard')
  })
})
