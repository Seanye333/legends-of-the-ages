import { describe, expect, it } from 'vitest'
import { DECK_SIZE } from '../engine/types'
import { HISTORY_BATTLES, battleDeck, battleModifiers } from './historyBattles'
import { CARDS_BY_ID } from './cards'
import { createGame } from '../engine/init'
import { HEROES_BY_ID } from './overrides/heroes'
import { PRECON_DECKS } from './decks'

describe('历史名战', () => {
  it('每场敌方 heroId 都在花名册里(否则立绘与名字退化)', () => {
    for (const b of HISTORY_BATTLES) {
      expect(CARDS_BY_ID[b.heroId], `${b.id} → ${b.heroId}`).toBeDefined()
    }
  })

  it('战役 id 与主公技 id 都唯一', () => {
    const ids = HISTORY_BATTLES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    const powers = HISTORY_BATTLES.map((b) => b.power.id)
    expect(new Set(powers).size).toBe(powers.length)
  })

  it('敌方卡组是恰好 30 张真实、可收集的卡', () => {
    for (const b of HISTORY_BATTLES) {
      const deck = battleDeck(b)
      expect(deck, b.id).toHaveLength(DECK_SIZE)
      for (const id of deck) {
        const card = CARDS_BY_ID[id]
        expect(card, `${b.id} → ${id}`).toBeDefined()
        expect(card.token ?? false, `${b.id} 用了衍生物 ${id}`).toBe(false)
        expect(['neutral', b.doctrine]).toContain(card.doctrine)
      }
    }
  })

  it('开局态势里引用的衍生物都真实存在且确为 token', () => {
    for (const b of HISTORY_BATTLES) {
      const [mine, foe] = battleModifiers(b)
      for (const id of [...(mine?.startTokens ?? []), ...(foe?.startTokens ?? [])]) {
        const c = CARDS_BY_ID[id]
        expect(c, `${b.id} 引用了不存在的衍生物 ${id}`).toBeDefined()
        expect(c.token ?? false, `${b.id} 引用的 ${id} 不是衍生物`).toBe(true)
      }
    }
  })

  it('奖励为正', () => {
    for (const b of HISTORY_BATTLES) {
      expect(b.rewardMerit, b.id).toBeGreaterThan(0)
      expect(b.rewardPacks, b.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('特殊目标(若有)格式合法', () => {
    for (const b of HISTORY_BATTLES) {
      if (!b.objective) continue
      if (b.objective.kind === 'survive') {
        expect(b.objective.turns, `${b.id} survive turns`).toBeGreaterThan(0)
      }
    }
  })

  it('一场名战真的能被引擎构造出来,且不对称配置与开局态势都落到了状态上', () => {
    const mine = PRECON_DECKS[0]
    const chibi = HISTORY_BATTLES.find((b) => b.id === 'hb-chibi')!
    const state = createGame(
      {
        seed: 1,
        heroIds: [mine.heroId, chibi.heroId],
        deckIds: [mine.cardIds.slice(), battleDeck(chibi)],
        first: 0,
        heroPowers: [HEROES_BY_ID[mine.heroId].power, chibi.power],
        heroHps: [30, chibi.hp],
        modifiers: battleModifiers(chibi),
      },
      CARDS_BY_ID,
    )
    expect(state.players[1].heroHp).toBe(chibi.hp)
    expect(state.players[1].heroPower?.id).toBe(chibi.power.id)
    // 赤壁:敌方开局铁骑(连环战船)+ 我方借东风 3 甲 —— 双方开局态势都铺到了状态上
    expect(state.players[1].board.length).toBeGreaterThanOrEqual(1)
    expect(state.players[0].armor).toBe(3)
  })

  it('battleDeck 确定性 —— 同一场每次都是同一套牌', () => {
    for (const b of HISTORY_BATTLES) {
      expect(battleDeck(b)).toEqual(battleDeck(b))
    }
  })
})
