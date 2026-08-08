import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { refreshAuras, requiresChosenTarget, chosenTargetPool } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'

// `clanOfChosenEnemy` —— 由「选中的那一个」派生出「一组」。
//
// 【最容易漏的一处,单独钉住】
// 这条目标必须进 `CHOSEN_TARGETS`。漏在集合外面的后果**不是报错**:
// 那张牌会被判成「不需要目标」→ 打出时 chosen 恒为 undefined →
// 目标解析返回空 → **这张牌恒定什么都不做**。不崩、不红、卡面照常显示。
// 下面第一条就是钉它的:`requiresChosenTarget` 与 `legalCommands` 都得认。
//
// 另两件事:无族的人只诛他自己(这条目标的下限就是一张单体解场),
// 以及**潜行只挡「被选中」那一步** —— 族长已经选定了,躲在暗处的族人一样跑不掉。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const clanOf = (id: string, size = 3) => ({
  id: `clan-${id}`,
  name: { zh: '某氏', en: 'House' },
  size,
})

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 96000,
  name: { zh: '甲', en: 'A' },
  type: 'general',
  doctrine: 'neutral',
  dynasty: 'qun',
  rarity: 'common',
  archetype: 'warrior',
  cost: 1,
  attack: 1,
  health: 4,
  keywords: [],
  ...over,
})

const CAO_A = base({ id: 't-cao-a', clan: clanOf('cao') })
const CAO_B = base({ id: 't-cao-b', clan: clanOf('cao') })
const CAO_STEALTH = base({ id: 't-cao-stealth', clan: clanOf('cao'), keywords: ['stealth'] })
const XIAHOU = base({ id: 't-xiahou', clan: clanOf('xiahou') })
const LONER = base({ id: 't-loner' })
const PURGE = base({
  id: 't-purge',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  spell: { ops: [{ op: 'destroy', target: 'clanOfChosenEnemy' }] },
})
const LIB = libWith([CAO_A, CAO_B, CAO_STEALTH, XIAHOU, LONER, PURGE])

function game(side1: Partial<PuzzleSide>): GameState {
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
    scenario: { activePlayer: 0, players: [mk({ hand: ['t-purge'] }), mk(side1)] },
  }
  const s = createGame(cfg, LIB)
  refreshAuras(s, LIB)
  return s
}

function purge(s: GameState, targetDefId: string): GameState {
  const victim = s.players[1].board.find((c) => c.defId === targetDefId)
  expect(victim, `场上没有 ${targetDefId}`).toBeTruthy()
  const r = applyCommand(
    s,
    0,
    {
      type: 'PlayCard',
      iid: s.players[0].hand[0].iid,
      target: { kind: 'general', iid: victim!.iid },
    },
    LIB,
  )
  if (!r.ok) throw new Error(`打不出来:${r.error}`)
  return r.state
}

const left = (s: GameState) => s.players[1].board.map((c) => c.defId)

describe('夷三族 · clanOfChosenEnemy', () => {
  it('**它要选目标** —— 漏进 CHOSEN_TARGETS 的话这张牌会恒定什么都不做', () => {
    expect(requiresChosenTarget(PURGE.spell)).toBe(true)
    const s = game({ board: [{ defId: 't-cao-a' }] })
    // 目标池要列得出敌方武将,否则 legalCommands 根本不会给出这条指令
    expect(chosenTargetPool(s, 0, PURGE.spell)).toHaveLength(1)
    const cmds = legalCommands(s, 0, LIB)
    expect(cmds.some((c) => c.type === 'PlayCard' && c.target?.kind === 'general')).toBe(true)
  })

  it('同族一起诛,别族不动', () => {
    const s = purge(
      game({
        board: [
          { defId: 't-cao-a' },
          { defId: 't-xiahou' },
          { defId: 't-cao-b' },
          { defId: 't-loner' },
        ],
      }),
      't-cao-a',
    )
    expect(left(s)).toEqual(['t-xiahou', 't-loner'])
  })

  it('无族的人只诛他自己 —— 这条目标的下限就是一张单体解场', () => {
    const s = purge(
      game({ board: [{ defId: 't-loner' }, { defId: 't-cao-a' }, { defId: 't-cao-b' }] }),
      't-loner',
    )
    expect(left(s)).toEqual(['t-cao-a', 't-cao-b'])
  })

  it('**潜行只挡「被选中」那一步**:选不了他,但族长被选中时他一样跑不掉', () => {
    const s = game({ board: [{ defId: 't-cao-a' }, { defId: 't-cao-stealth' }] })
    // 潜行的那个不在可选池里
    const pool = chosenTargetPool(s, 0, PURGE.spell)
    expect(pool).toHaveLength(1)
    // 但选了族长之后,他跟着一起没
    expect(left(purge(s, 't-cao-a'))).toEqual([])
  })

  it('只有一个人的族 —— 和单体解场没有区别', () => {
    const s = purge(game({ board: [{ defId: 't-xiahou' }, { defId: 't-loner' }] }), 't-xiahou')
    expect(left(s)).toEqual(['t-loner'])
  })

  it('打我方的族人不生效 —— 这条目标只看敌方场面', () => {
    const s = game({ board: [{ defId: 't-cao-a' }] })
    s.players[0].board.push({ ...s.players[1].board[0], iid: 999 })
    refreshAuras(s, LIB)
    const after = purge(s, 't-cao-a')
    expect(after.players[0].board.map((c) => c.defId)).toEqual(['t-cao-a'])
    expect(after.players[1].board).toHaveLength(0)
  })
})
