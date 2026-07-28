import { describe, expect, it } from 'vitest'
import { DECK_SIZE } from '../engine/types'
import { BOSSES, bossChapter, bossDeck, bossTrial, bossPersonality, TRIALS } from './campaign'
import { bossLines } from './bossLines'
import { CARDS_BY_ID } from './cards'
import { createGame } from '../engine/init'
import { HEROES_BY_ID } from './overrides/heroes'
import { PRECON_DECKS } from './decks'

describe('campaign bosses', () => {
  it('every boss hero id exists in the roster (otherwise portrait and name degrade)', () => {
    for (const b of BOSSES) {
      expect(CARDS_BY_ID[b.heroId], `${b.id} → ${b.heroId}`).toBeDefined()
    }
  })

  it('boss ids and power ids are unique', () => {
    const ids = BOSSES.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
    const powers = BOSSES.map((b) => b.power.id)
    expect(new Set(powers).size).toBe(powers.length)
  })

  it('every boss deck is exactly 30 real, collectible cards', () => {
    for (const b of BOSSES) {
      const deck = bossDeck(b.doctrine, b.deckTier)
      expect(deck, b.id).toHaveLength(DECK_SIZE)
      for (const id of deck) {
        const card = CARDS_BY_ID[id]
        expect(card, `${b.id} → ${id}`).toBeDefined()
        expect(card.token ?? false, `${b.id} 用了衍生物 ${id}`).toBe(false)
        expect(['neutral', b.doctrine]).toContain(card.doctrine)
      }
    }
  })

  it('boss decks respect copy limits', () => {
    for (const b of BOSSES) {
      const counts = new Map<string, number>()
      for (const id of bossDeck(b.doctrine, b.deckTier)) {
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
      for (const [id, n] of counts) {
        const limit = CARDS_BY_ID[id].rarity === 'legendary' ? 1 : 2
        expect(n, `${b.id} 的 ${id} 有 ${n} 张`).toBeLessThanOrEqual(limit)
      }
    }
  })

  it('bossDeck is deterministic — same boss always gets the same deck', () => {
    for (const b of BOSSES) {
      expect(bossDeck(b.doctrine, b.deckTier)).toEqual(bossDeck(b.doctrine, b.deckTier))
    }
  })

  it('deckTier actually changes the deck (it is the difficulty dial)', () => {
    // 第一版用「跳过前 N 张」当旋钮,卡池太密导致几乎没效果 —— 这条守着不再退化
    const strong = bossDeck('royal', 0)
    const weak = bossDeck('royal', 0.75)
    const overlap = strong.filter((id) => weak.includes(id)).length
    expect(overlap).toBeLessThan(DECK_SIZE * 0.6)
  })

  // 血量按**章内**递增,不是全局:每一章都从一个较低的血量重新起步
  // (第三章开章的谢玄 46 血,比第二章收官的徐达 70 血低,这是对的 ——
  // 开章要友好,否则每一章的第一关都是一堵墙)。奖励则全局递增。
  // 血量与奖励都按**章内**递增,不是全局:每一章都从较低处重新起步
  // (第三章开章的谢玄 46 血 / 400 功勋,都低于第二章收官的徐达 70 血 / 1500)。
  // 这是对的 —— 开章要友好,收官才该是墙;拿全局单调去要求它,
  // 只会逼出「每一章的第一关都比上一章的最后一关更难」这种荒谬曲线。
  // 章与章之间另有一条:后一章的**开章**必须不低于前一章的开章。
  it('hp and reward rise within each chapter; later chapters open higher', () => {
    for (let i = 1; i < BOSSES.length; i++) {
      if (bossChapter(BOSSES[i]) !== bossChapter(BOSSES[i - 1])) continue
      expect(BOSSES[i].hp, `第 ${i + 1} 关血量应不低于同章前一关`).toBeGreaterThanOrEqual(
        BOSSES[i - 1].hp,
      )
      expect(BOSSES[i].rewardMerit, `第 ${i + 1} 关奖励应高于同章前一关`).toBeGreaterThan(
        BOSSES[i - 1].rewardMerit,
      )
    }
    const openers = new Map<number, (typeof BOSSES)[number]>()
    for (const b of BOSSES) if (!openers.has(bossChapter(b))) openers.set(bossChapter(b), b)
    const chapters = [...openers.keys()].sort((a, b) => a - b)
    for (let i = 1; i < chapters.length; i++) {
      expect(
        openers.get(chapters[i])!.rewardMerit,
        `第 ${chapters[i]} 章开章奖励应不低于前一章开章`,
      ).toBeGreaterThanOrEqual(openers.get(chapters[i - 1])!.rewardMerit)
    }
  })

  it('a boss match is actually constructible by the engine', () => {
    const mine = PRECON_DECKS[0]
    const boss = BOSSES[BOSSES.length - 1]
    const state = createGame(
      {
        seed: 1,
        heroIds: [mine.heroId, boss.heroId],
        deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
        first: 0,
        heroPowers: [HEROES_BY_ID[mine.heroId].power, boss.power],
        heroHps: [30, boss.hp],
      },
      CARDS_BY_ID,
    )
    // 不对称配置真的落到了状态上
    expect(state.players[1].heroHp).toBe(boss.hp)
    expect(state.players[1].heroPower?.id).toBe(boss.power.id)
    expect(state.players[0].heroHp).toBe(30)
  })
})

// ---- 关底试炼:同一个 Boss,换一个赢法 ----
//
// 最危险的失败方式是**静默**的:targetDefId 与 startTokens 对不上时,
// createGame 解析不到 targetIid,斩将会变成永远赢不了、护送会变成永远输不了,
// 而且一条报错都没有。所以这里不只查字符串,还真的建一局看目标解析到没有。
describe('campaign trials', () => {
  it('试炼 id 唯一,且只挂在真实存在的关卡上', () => {
    const ids = Object.values(TRIALS).map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const bossId of Object.keys(TRIALS)) {
      expect(BOSSES.find((b) => b.id === bossId), bossId).toBeDefined()
    }
  })

  it('每一关都有试炼 —— 漏一关就是那关的玩家少一半内容', () => {
    for (const b of BOSSES) expect(bossTrial(b.id), b.id).toBeDefined()
  })

  it('目标单位是真实衍生物,且摆在正确的一侧', () => {
    for (const [bossId, trial] of Object.entries(TRIALS)) {
      const obj = trial.objective
      if (obj.kind === 'survive') {
        expect(obj.turns, bossId).toBeGreaterThan(0)
        continue
      }
      const card = CARDS_BY_ID[obj.targetDefId]
      expect(card, `${bossId} → ${obj.targetDefId}`).toBeDefined()
      expect(card.token ?? false, `${bossId} 的目标不是衍生物`).toBe(true)
      const placed =
        obj.targetSide === 0 ? trial.playerModifiers?.startTokens : trial.bossModifiers?.startTokens
      expect(placed ?? [], `${bossId} 的目标没被摆上场`).toContain(obj.targetDefId)
    }
  })

  it('斩将/护送的目标在开局真的解析到了实例(否则目标永不触发)', () => {
    for (const [bossId, trial] of Object.entries(TRIALS)) {
      if (trial.objective.kind === 'survive') continue
      const boss = BOSSES.find((b) => b.id === bossId)!
      const mine = PRECON_DECKS[0]
      const s = createGame(
        {
          seed: 11,
          heroIds: [mine.heroId, boss.heroId],
          deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
          first: 0,
          heroPowers: [HEROES_BY_ID[mine.heroId]?.power, boss.power],
          modifiers: [trial.playerModifiers, trial.bossModifiers],
          objective: trial.objective,
        },
        CARDS_BY_ID,
      )
      const obj = s.objective!
      expect(obj.kind === 'survive' ? undefined : obj.targetIid, `${bossId} 目标没解析到`).toBeDefined()
    }
  })
})

describe('boss 台词', () => {
  it('每一关都有四句 —— 缺一关就是那个对手在牌桌上一言不发', () => {
    for (const b of BOSSES) {
      const lines = bossLines(b.id)
      expect(lines, b.id).toBeDefined()
      for (const k of ['open', 'kill', 'low', 'win'] as const) {
        expect(lines![k].zh.length, `${b.id}.${k}`).toBeGreaterThan(0)
        expect(lines![k].en.length, `${b.id}.${k}`).toBeGreaterThan(0)
      }
    }
  })

  it('每一关都有性格 —— 否则十六个对手打法一样', () => {
    for (const b of BOSSES) expect(bossPersonality(b.id), b.id).toBeDefined()
  })
})
