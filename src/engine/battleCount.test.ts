import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { refreshAuras } from './resolve'
import { CARDS_BY_ID } from '../content/cards'
import type { CardDef, CardLibrary, GameConfig, GameState, PuzzleSide } from './types'

// `CountSource.friendlyBattle` 的**非零性**。
//
// 【为什么单独钉这一条】
// 这条计数有一个别的计数都没有的前置:它数的是「与**来源卡**同赴过一场仗的友军」,
// 所以**来源卡自己得带 `battles`**,否则恒为 0 —— 一张读不到自己的卡。
// 那种卡不会报错、不会崩,只是效果永远是 0 层,和 壁中書 第一版
// 「洗进自己牌库的载荷本身是空的」是同一类失败:**模拟只会告诉你它偏弱,
// 不会告诉你它根本没在工作**。
//
// 所以在拿 sim-cards 的数字下任何结论之前,先用一条确定性的测试证明它真的在数。
// 顺带钉住第二十八卡包那三张锦囊自己的名单没写错(名单串一个字不同就恒为 0)。

function libWith(extra: CardDef[]): CardLibrary {
  return { ...CARDS_BY_ID, ...Object.fromEntries(extra.map((c) => [c.id, c])) }
}

const base = (over: Partial<CardDef>): CardDef => ({
  id: 'x',
  collectorNo: 94000,
  name: { zh: '甲', en: 'A' },
  type: 'general',
  doctrine: 'neutral',
  dynasty: 'qun',
  rarity: 'common',
  archetype: 'warrior',
  cost: 1,
  attack: 1,
  health: 5,
  keywords: [],
  ...over,
})

const VET = base({ id: 't-vet', battles: ['某役'] })
const OUTSIDER = base({ id: 't-outsider' })
// 带名单的锦囊(第二十八卡包那三张就是这个形状)
const RALLY = base({
  id: 't-rally',
  type: 'stratagem',
  attack: undefined,
  health: undefined,
  cost: 0,
  battles: ['某役'],
  spell: {
    ops: [
      {
        op: 'buffPer',
        per: { kind: 'friendlyBattle' },
        attack: 1,
        health: 1,
        target: 'chosenFriendlyGeneral',
      },
    ],
  },
})
// **同一张卡,唯一的区别是自己没写名单** —— 这才是那个失败模式
const RALLY_NO_LIST = base({
  ...RALLY,
  id: 't-rally-nolist',
  battles: undefined,
})
const LIB = libWith([VET, OUTSIDER, RALLY, RALLY_NO_LIST])

function game(side0: Partial<PuzzleSide>): GameState {
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
    scenario: { activePlayer: 0, players: [mk(side0), mk({})] },
  }
  const s = createGame(cfg, LIB)
  refreshAuras(s, LIB)
  return s
}

// 打出手牌第一张,目标是场上第 0 个友军
function cast(s: GameState): GameState {
  const r = applyCommand(
    s,
    0,
    {
      type: 'PlayCard',
      iid: s.players[0].hand[0].iid,
      target: { kind: 'general', iid: s.players[0].board[0].iid },
    },
    LIB,
  )
  if (!r.ok) throw new Error(`打不出来:${r.error}`)
  return r.state
}

describe('friendlyBattle 真的在数', () => {
  it('三名同袍在场 → +3/+3(不含来源自己,来源是锦囊)', () => {
    const s = cast(
      game({
        hand: ['t-rally'],
        board: [{ defId: 't-vet' }, { defId: 't-vet' }, { defId: 't-vet' }],
      }),
    )
    expect([s.players[0].board[0].attack, s.players[0].board[0].health]).toEqual([4, 8])
  })

  it('场上的人不是同袍 → 一层都不吃', () => {
    const s = cast(
      game({ hand: ['t-rally'], board: [{ defId: 't-outsider' }, { defId: 't-outsider' }] }),
    )
    expect([s.players[0].board[0].attack, s.players[0].board[0].health]).toEqual([1, 5])
  })

  it('**来源卡自己没写名单 → 恒为 0**(这条红了说明那张卡读不到自己)', () => {
    const s = cast(
      game({
        hand: ['t-rally-nolist'],
        board: [{ defId: 't-vet' }, { defId: 't-vet' }, { defId: 't-vet' }],
      }),
    )
    expect([s.players[0].board[0].attack, s.players[0].board[0].health]).toEqual([1, 5])
  })

  it('第二十八卡包三张的名单都对得上真实卡池(串错一个字就恒为 0)', () => {
    const rosters = new Map<string, number>()
    for (const c of Object.values(CARDS_BY_ID)) {
      for (const b of c.battles ?? []) rosters.set(b, (rosters.get(b) ?? 0) + 1)
    }
    for (const id of ['strat-guandu-xiangchi', 'strat-chibi-tongzhou', 'strat-xiaoyaojin']) {
      const card = CARDS_BY_ID[id]
      expect(card, `${id} 不在卡池里`).toBeTruthy()
      for (const b of card.battles ?? []) {
        // 减掉锦囊自己;剩下的必须是一支真的队伍,不是孤零零一张
        expect((rosters.get(b) ?? 0) - 1, `「${b}」的名单上没有别人`).toBeGreaterThan(4)
      }
    }
  })
})
