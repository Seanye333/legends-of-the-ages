import { describe, expect, it } from 'vitest'
import { COLLECTIBLE_CARDS, CARDS_BY_ID } from '../content/cards'
import { createGame } from './init'
import { applyCommand } from './reducer'
import type { GameConfig } from './types'

// 战役同袍(CountSource.friendlyBattle)。
//
// 名单挂在**卡上**(CardDef.battles),引擎不查任何表 —— 和 clan / bond 同一条铁律。
// 这里守两件事:名单本身是干净的,以及数人头时**不把自己数进去**。
const WITH_BATTLES = COLLECTIBLE_CARDS.filter((c) => c.battles?.length)

describe('战役同袍', () => {
  it('名单有规模,且每一场都不是空串', () => {
    expect(WITH_BATTLES.length).toBeGreaterThan(100)
    for (const c of WITH_BATTLES) {
      for (const b of c.battles!) expect(b.length, `${c.name.zh} 的战役名是空的`).toBeGreaterThan(1)
      expect(new Set(c.battles).size, `${c.name.zh} 的战役有重复`).toBe(c.battles!.length)
    }
  })

  it('同一场战役的人互相认得出对方', () => {
    // 找一场至少两个人的仗
    const byBattle = new Map<string, string[]>()
    for (const c of WITH_BATTLES) for (const b of c.battles!) byBattle.set(b, [...(byBattle.get(b) ?? []), c.id])
    const pair = [...byBattle.values()].find((ids) => ids.length >= 2)!
    const [a, b] = pair
    expect(CARDS_BY_ID[a].battles!.some((x) => CARDS_BY_ID[b].battles!.includes(x))).toBe(true)
  })

  it('数同袍时不含自己 —— 场上只有他一个时是 0', () => {
    const c = WITH_BATTLES[0]
    const cfg: GameConfig = {
      seed: 5,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 10, board: [{ defId: c.id }], hand: [] },
          { heroHp: 30, mana: 10, board: [], hand: [] },
        ],
      },
    }
    const s = createGame(cfg, CARDS_BY_ID)
    // 身材没有被自己撑起来:场上只有他一个,同袍数为 0
    expect(s.players[0].board[0].attack).toBe(CARDS_BY_ID[c.id].attack)
    void applyCommand
  })
})
