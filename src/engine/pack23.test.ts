import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { CARDS_BY_ID } from '../content/cards'
import { RELICS } from '../content/relics'
import { WAR_BOOKS } from '../content/warBooks'
import { BRAWLS } from '../content/brawls'
import { makeBoardInstance } from './resolve'
import type { GameConfig } from './types'

// 用真牌库而不是残局构造器:**残局分支会整个跳过开局修正**(那是给谜题用的),
// 而这里测的恰恰是修正有没有落地。
const DECK = Array.from({ length: 30 }, () => 'guan-yu')

// 第二十三卡包不开新轴,所以这里测的不是机制,是**接线**:
// 新维度有没有真的接进那三个 PvE 模式(远征宝物 / 兵书 / 乱斗)。
//
// 这三处的累加器都是**手写字段清单** —— RunModifiers 加了字段而累加器没补,
// 那件宝物就会安安静静地什么都不做。这一类失效不报错、不崩溃,只有断言拦得住。

describe('新轴接进 PvE 模式', () => {
  it('开局军令真的进了 PlayerState(RunModifiers → init)', () => {
    const quest = RELICS.find((r) => r.modifiers?.startQuest)
    expect(quest, '没有任何一件宝物带开局军令').toBeTruthy()
    const cfg: GameConfig = {
      seed: 1,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [DECK, DECK],
      first: 0,
      modifiers: [quest!.modifiers, undefined],
    }
    const s = createGame(cfg, CARDS_BY_ID)
    expect(s.players[0].quests).toHaveLength(1)
    expect(s.players[0].quests?.[0].progress).toBe(0)
    expect(s.players[1].quests).toBeUndefined()
  })

  it('开局士气/屯粮的宝物与兵书不会被累加器悄悄吃掉', () => {
    const relic = RELICS.find((r) => r.modifiers?.startSupply)
    const book = WAR_BOOKS.find((b) => b.modifiers.startMorale)
    expect(relic, '没有粮道宝物').toBeTruthy()
    expect(book, '没有士气兵书').toBeTruthy()
    const cfg: GameConfig = {
      seed: 1,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [DECK, DECK],
      first: 0,
      modifiers: [{ ...relic!.modifiers, ...book!.modifiers }, undefined],
    }
    const s = createGame(cfg, CARDS_BY_ID)
    expect(s.players[0].supply).toBe(relic!.modifiers!.startSupply)
    expect(s.players[0].morale).toBe(book!.modifiers.startMorale)
  })

  it('乱斗的开局军令双方同吃(乱斗规则的不变量)', () => {
    const brawl = BRAWLS.find((b) => b.modifiers.startQuest)
    expect(brawl, '没有军令乱斗').toBeTruthy()
    const cfg: GameConfig = {
      seed: 1,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [DECK, DECK],
      first: 0,
      modifiers: [brawl!.modifiers, brawl!.modifiers],
    }
    const s = createGame(cfg, CARDS_BY_ID)
    expect(s.players[0].quests).toHaveLength(1)
    expect(s.players[1].quests).toHaveLength(1)
  })

  it('开局军令照常记账并发奖 —— 不是一份只能看的摆设', () => {
    const cfg: GameConfig = {
      seed: 1,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [DECK, DECK],
      first: 0,
      modifiers: [
        {
          startQuest: {
            id: 'q-test',
            name: { zh: '测试', en: 'Test' },
            goal: { kind: 'playStratagems', count: 1 },
            reward: { ops: [{ op: 'gainArmor', amount: 7 }] },
          },
        },
        undefined,
      ],
    }
    const s = createGame(cfg, CARDS_BY_ID)
    // 跳过调度阶段:两边都保留起手牌
    for (const seat of [0, 1] as const) {
      const r = applyCommand(s, seat, { type: 'Mulligan', keepIids: s.players[seat].hand.map((c) => c.iid) }, CARDS_BY_ID)
      expect(r.ok, r.ok ? '' : r.error).toBe(true)
      if (!r.ok) return
      Object.assign(s, r.state)
    }
    // 塞一张不需要目标的锦囊进手牌,并给足法力
    const card = makeBoardInstance(s, 'strat-jue-liang-dao', CARDS_BY_ID)
    s.players[0].hand.push(card)
    s.players[0].mana = { current: 10, max: 10 }

    const r = applyCommand(s, 0, { type: 'PlayCard', iid: card.iid }, CARDS_BY_ID)
    expect(r.ok, r.ok ? '' : r.error).toBe(true)
    if (!r.ok) return
    expect(r.state.players[0].armor).toBe(7)
    expect(r.state.players[0].quests).toHaveLength(0)
  })
})
