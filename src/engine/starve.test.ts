import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'
import { MORALE_THRESHOLD, SUPPLY_CAP } from './types'

// 粮尽 —— 粮道这条轴一直缺的「代价」那一侧。
//
// 【这份测试真正守的是「边沿而不是电平」】
// 把判据写成「回合开始时粮道为 0 就扣士气」看上去更自然,而且**大部分用例照样绿**:
// 花光军需会扣、被断粮会扣,只有一条会红 —— 开局。
// 开局粮道本来就是 0,电平式判据会让先手在第一个回合当场挨罚,
// 而那跟「断粮」没有半点关系。所以下面第一条(开局那条)是这份测试的**主锚**,
// 它红了说明判据从边沿滑回了电平。
//
// 反向也钉死:掉到 1 不算粮尽、0 上再减还是 0 不重复扣 ——
// 后者尤其容易在「夹到 [0, CAP] 之后再判」的写法里变成每减一次扣一次。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 91000,
  name: { zh: '甲', en: 'A' },
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
})

// 军需 2 的锦囊、断敌方 3 粮的锦囊、给自己屯 2 粮的锦囊,外加一个白板身子
const JUNXU = base({
  id: 't-junxu2',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  supplyCost: 2,
  spell: { ops: [{ op: 'draw', count: 0 }] },
})
const DUANLIANG = base({
  id: 't-duanliang',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  spell: { ops: [{ op: 'gainSupply', amount: -3, side: 'enemy' }] },
})
const TUNLIANG = base({
  id: 't-tunliang',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  spell: { ops: [{ op: 'gainSupply', amount: 2 }] },
})
const BODY = base({ id: 't-body', attack: 1, health: 3 })
const LIB = libWith([JUNXU, DUANLIANG, TUNLIANG, BODY])

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

// 打出手牌第 i 张;打不出来直接把错误码抛出来,免得下一行读到 undefined 才发现
function play(s: GameState, handIndex = 0): GameState {
  const iid = s.players[0].hand[handIndex].iid
  const r = applyCommand(s, 0, { type: 'PlayCard', iid }, LIB)
  if (!r.ok) throw new Error(`打不出来:${r.error}`)
  return r.state
}

describe('粮尽是边沿不是电平', () => {
  it('**开局粮道就是 0,不算粮尽** —— 这条红了说明判据滑回了电平', () => {
    let s = game({})
    expect([s.players[0].supply ?? 0, s.players[1].supply ?? 0]).toEqual([0, 0])
    // 走两个回合交接。**两侧都要查**:电平式判据最先打中的是
    // 「刚接手、粮道还是 0」的那一方,只看自己那一侧会漏掉它。
    for (const who of [0, 1] as const) {
      const r = applyCommand(s, who, { type: 'EndTurn' }, LIB)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      s = r.state
      expect([s.players[0].morale ?? 0, s.players[1].morale ?? 0]).toEqual([0, 0])
    }
    expect([s.players[0].supply, s.players[1].supply]).toEqual([1, 1])
  })

  it('花光军需 → 粮尽,士气 -1', () => {
    const s = play(game({ hand: ['t-junxu2'], supply: 2 }))
    expect(s.players[0].supply).toBe(0)
    expect(s.players[0].morale).toBe(-1)
  })

  it('没花光就不算 —— 掉到 1 士气不动', () => {
    const s = play(game({ hand: ['t-junxu2'], supply: 3 }))
    expect(s.players[0].supply).toBe(1)
    expect(s.players[0].morale ?? 0).toBe(0)
  })

  it('已经是 0 了再减,不重复扣 —— 夹完再判会在这里红', () => {
    const a = play(game({ hand: ['t-duanliang', 't-duanliang'] }, { supply: 0 }))
    expect(a.players[1].supply ?? 0).toBe(0)
    expect(a.players[1].morale ?? 0).toBe(0)
    const b = play(a)
    expect(b.players[1].morale ?? 0).toBe(0)
  })

  it('断粮打到 0 → 对手粮尽(减的是**对手**的粮、扣的是**对手**的士气)', () => {
    const s = play(game({ hand: ['t-duanliang'] }, { supply: 3 }))
    expect(s.players[1].supply).toBe(0)
    expect(s.players[1].morale).toBe(-1)
    // 自己这一侧一格都没动
    expect(s.players[0].supply ?? 0).toBe(0)
    expect(s.players[0].morale ?? 0).toBe(0)
  })

  it('屯粮默认给自己 —— `side` 缺省不许被读成 enemy', () => {
    const s = play(game({ hand: ['t-tunliang'] }, { supply: 1 }))
    expect(s.players[0].supply).toBe(2)
    expect(s.players[1].supply).toBe(1)
  })

  it('连断两次过 MORALE_THRESHOLD,那一方全场 -1 攻,且当场生效', () => {
    const a = play(
      game({ hand: ['t-duanliang', 't-duanliang'] }, { supply: 1, board: [{ defId: 't-body' }] }),
    )
    // 第一次:1 → 0,粮尽,士气 -1(还没过线)
    expect(a.players[1].morale).toBe(-1)
    expect(a.players[1].board[0].attack).toBe(1)
    // 补一格粮再断第二次,才是第二次「掉到 0」
    a.players[1].supply = 1
    const b = play(a)
    expect(b.players[1].morale).toBe(-MORALE_THRESHOLD)
    // 光环当场生效,不用等下一次不相干的场面变动
    expect(b.players[1].board[0].attack).toBe(0)
  })

  it('顶到 SUPPLY_CAP 之后屯不进去,也就谈不上粮尽', () => {
    const s = play(game({ hand: ['t-tunliang'], supply: SUPPLY_CAP }))
    expect(s.players[0].supply).toBe(SUPPLY_CAP)
    expect(s.players[0].morale ?? 0).toBe(0)
  })
})
