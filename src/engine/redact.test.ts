import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { redactEvent, redactEventForSpectator, redactForSpectator, redactState } from './redact'
import type { CardDef, CardLibrary, GameConfig, GameEvent, GameState } from './types'
import { DECK_SIZE } from './types'

// 信息隐藏是**联机的作弊面**。
//
// 这个模块此前没有任何对口测试 —— 而它的失败模式是最坏的那一种:
// 不崩溃、不报错,只是把不该给的东西给出去了。客户端照常渲染,
// 谁也不会发现对手的手牌其实一直在网络包里。
//
// 下面按「哪些字段绝对不能出现在对手视角里」逐条钉死。

function vanilla(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: '步卒', en: 'Infantry' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
    ...over,
  }
}

const LIB: CardLibrary = { 'foot-soldier': vanilla('foot-soldier') }
const DECK = Array.from({ length: DECK_SIZE }, () => 'foot-soldier')

function makeCfg(seed: number): GameConfig {
  return { seed, heroIds: ['liu-bei', 'cao-cao'], deckIds: [[...DECK], [...DECK]], first: 0 }
}

function afterMulligan(seed = 7): GameState {
  let s = createGame(makeCfg(seed), LIB)
  for (const p of [0, 1] as const) {
    const r = applyCommand(s, p, { type: 'Mulligan', keepIids: s.players[p].hand.map((c) => c.iid) }, LIB)
    if (!r.ok) throw new Error(r.error)
    s = r.state
  }
  return s
}

describe('redactState:对手的手牌内容永远不能过网', () => {
  it('对手侧只给张数与 iid,不给 defId', () => {
    const s = afterMulligan()
    const view = redactState(s, 0)
    expect(view.opponent.handCount).toBe(s.players[1].hand.length)
    expect(view.opponent.handIids).toHaveLength(s.players[1].hand.length)
    // 结构上就没有 hand 这个字段 —— 不是「给了空数组」,是根本不存在
    expect('hand' in view.opponent).toBe(false)
  })

  it('对手的牌库只给张数', () => {
    const s = afterMulligan()
    const view = redactState(s, 0)
    expect(view.opponent.deckCount).toBe(s.players[1].deck.length)
    expect('deck' in view.opponent).toBe(false)
  })

  it('对手的伏兵只给 iid,不给是哪一张', () => {
    const s = afterMulligan()
    const view = redactState(s, 0)
    expect('secrets' in view.opponent).toBe(false)
    expect(Array.isArray(view.opponent.secretIids)).toBe(true)
  })

  it('自己那一半是完整的(不能连自己的牌都看不见)', () => {
    const s = afterMulligan()
    const view = redactState(s, 0)
    expect(view.self.hand).toHaveLength(s.players[0].hand.length)
    expect(view.self.hand[0].defId).toBeTruthy()
  })

  it('两个视角是对称的:1 号看 0 号,同样什么都看不到', () => {
    const s = afterMulligan()
    const view = redactState(s, 1)
    expect(view.viewer).toBe(1)
    expect('hand' in view.opponent).toBe(false)
    expect(view.self.hand[0].defId).toBeTruthy()
  })

  it('裁剪出来的是深拷贝 —— 改了视图不该动到真状态', () => {
    const s = afterMulligan()
    const view = redactState(s, 0)
    const before = s.players[0].hand[0].attack
    view.self.hand[0].attack = 999
    expect(s.players[0].hand[0].attack).toBe(before)
  })
})

describe('redactForSpectator:观众不能比双方都多知道', () => {
  it('两边的手牌内容都不给', () => {
    const s = afterMulligan()
    const view = redactForSpectator(s)
    expect('hand' in view.opponent).toBe(false)
    // 0 号的手牌被抹成占位:张数还在(要画牌背),但牌面是空的
    expect(view.self.hand).toHaveLength(s.players[0].hand.length)
    for (const c of view.self.hand) expect(c.defId).toBe('')
  })

  it('看不到任何一方在发现什么', () => {
    const s = afterMulligan()
    const view = redactForSpectator(s)
    expect(view.pendingChoice?.options ?? []).toHaveLength(0)
  })
})

describe('redactEvent:事件流里也不能漏', () => {
  // 小工具:把「抹没抹掉 defId」这件事写成一句话。
  // 直接 `redactEvent(x,0).type === 'X' && redactEvent(x,0).defId` 在
  // tsconfig.test.json 下过不了 —— 第二次调用不受第一次的窄化保护。
  const redactedDefId = (ev: GameEvent, viewer: 0 | 1): string | undefined => {
    const r = redactEvent(ev, viewer)
    return 'defId' in r ? r.defId : undefined
  }

  it('对手抽的牌抹掉牌面,自己抽的不动', () => {
    const drawn = { type: 'CardDrawn', player: 1, iid: 5, defId: 'guan-yu' } as const
    expect(redactedDefId(drawn, 0)).toBe('')
    const mine = { type: 'CardDrawn', player: 0, iid: 5, defId: 'guan-yu' } as const
    expect(redactEvent(mine, 0)).toEqual(mine)
  })

  it('埋下伏兵的那一刻是秘密,翻开才公开', () => {
    const played = { type: 'SecretPlayed', player: 1, iid: 7, defId: 'secret-x' } as const
    expect(redactedDefId(played, 0)).toBe('')
    // 翻开是公开信息 —— 抹掉的话玩家不知道自己被什么打了
    const revealed = { type: 'SecretRevealed', player: 1, iid: 7, defId: 'secret-x' } as const
    expect(redactEvent(revealed, 0)).toEqual(revealed)
  })

  it('发现的候选与选定都不给对手', () => {
    // 这里不能用 as const —— options 会变成只读元组,对不上 GameEvent 里的 string[]
    const started: GameEvent = {
      type: 'DiscoverStarted',
      player: 1,
      options: ['a', 'b', 'c'],
      reason: 'discover',
    }
    const r = redactEvent(started, 0)
    expect(r.type === 'DiscoverStarted' && r.options).toEqual([])
    const picked = { type: 'DiscoverPicked', player: 1, defId: 'a' } as const
    expect(redactedDefId(picked, 0)).toBe('')
  })

  it('生成进对手手牌的牌面同样不给', () => {
    const gen = { type: 'CardGenerated', player: 1, iid: 9, defId: 'token-x' } as const
    expect(redactedDefId(gen, 0)).toBe('')
  })

  it('观战视角:两边的抽牌都抹', () => {
    for (const p of [0, 1] as const) {
      const ev = { type: 'CardDrawn', player: p, iid: 1, defId: 'guan-yu' } as const
      const r = redactEventForSpectator(ev)
      expect('defId' in r ? r.defId : undefined, `${p} 号的抽牌没抹`).toBe('')
    }
  })

  it('与胜负/伤害有关的事件一律不动(抹了就没法演对局了)', () => {
    const dmg = { type: 'HeroDamaged', player: 1, amount: 5, hpAfter: 25 } as const
    expect(redactEvent(dmg, 0)).toEqual(dmg)
    const ended = { type: 'GameEnded', winner: 0 } as const
    expect(redactEvent(ended, 1)).toEqual(ended)
  })
})
