import { describe, expect, it } from 'vitest'
import type { GameEvent } from '../engine/types'
import { applyTally, rollDailyQuests, tallyMatch, type QuestState } from './questStore'
import { HEROES } from '../content/overrides/heroes'
import { COLLECTIBLE_CARDS } from '../content/cards'

const HERO_ID = HEROES[0].id
const HERO_DOCTRINE = HEROES[0].doctrine

describe('daily quest rolling', () => {
  it('is stable per date and gives 3 distinct kinds', () => {
    const a = rollDailyQuests('2026-07-19')
    const b = rollDailyQuests('2026-07-19')
    expect(a).toEqual(b)
    expect(a).toHaveLength(3)
    expect(new Set(a.map((q) => q.kind)).size).toBe(3)
  })

  it('differs across dates', () => {
    const days = ['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22'].map((d) =>
      rollDailyQuests(d)
        .map((q) => q.id)
        .join('|'),
    )
    expect(new Set(days).size).toBeGreaterThan(1)
  })
})

describe('tallyMatch', () => {
  const events: GameEvent[] = [
    { type: 'CardPlayed', player: 0, iid: 1, defId: 'guan-yu', cost: 7 },
    { type: 'CardPlayed', player: 0, iid: 2, defId: 'strat-huo-ji', cost: 3 },
    { type: 'CardPlayed', player: 1, iid: 3, defId: 'guan-yu', cost: 7 }, // 对手的不计
    { type: 'EquipmentAttached', player: 0, targetIid: 1, defId: 'eq-chitu-ma' },
    {
      type: 'DuelFought',
      challenger: 0,
      challengerIid: 1,
      defenderIid: 3,
      challengerDied: false,
      defenderDied: true,
    },
    {
      type: 'DuelFought',
      challenger: 1,
      challengerIid: 3,
      defenderIid: 1,
      challengerDied: false,
      defenderDied: true,
    }, // 对手发起的不计
    { type: 'HeroDamaged', player: 1, amount: 7, hpAfter: 23 },
    { type: 'HeroDamaged', player: 0, amount: 4, hpAfter: 26 }, // 我方受伤不计
    { type: 'GameEnded', winner: 0 },
  ]

  it('counts only the local player’s deeds', () => {
    const t = tallyMatch(events, HERO_ID)
    expect(t).toMatchObject({
      win: 1,
      playGenerals: 1,
      playStratagems: 1,
      equipGenerals: 1,
      duelKill: 1,
      heroDamage: 7,
      heroDoctrine: HERO_DOCTRINE,
    })
  })

  it('does not count a loss as a win', () => {
    expect(tallyMatch([{ type: 'GameEnded', winner: 1 }], HERO_ID).win).toBe(0)
    expect(tallyMatch([{ type: 'GameEnded', winner: 'draw' }], HERO_ID).win).toBe(0)
  })
})

describe('applyTally', () => {
  const quest = (over: Partial<QuestState>): QuestState => ({
    id: 'q',
    kind: 'win',
    goal: 3,
    reward: 1,
    progress: 0,
    claimed: false,
    ...over,
  })

  it('accumulates and clamps at the goal', () => {
    const tally = tallyMatch([{ type: 'GameEnded', winner: 0 }], HERO_ID)
    let qs = [quest({ goal: 2 })]
    qs = applyTally(qs, tally)
    expect(qs[0].progress).toBe(1)
    qs = applyTally(qs, tally)
    expect(qs[0].progress).toBe(2)
    qs = applyTally(qs, tally)
    expect(qs[0].progress).toBe(2) // 不超过 goal
  })

  it('matches doctrine quests against the local hero only', () => {
    const tally = tallyMatch([{ type: 'GameEnded', winner: 0 }], HERO_ID)
    const other = HERO_DOCTRINE === 'royal' ? 'hegemonic' : 'royal'
    const qs = applyTally(
      [
        quest({ id: 'match', kind: 'winWithDoctrine', goal: 1, doctrine: HERO_DOCTRINE }),
        quest({ id: 'miss', kind: 'winWithDoctrine', goal: 1, doctrine: other }),
      ],
      tally,
    )
    expect(qs[0].progress).toBe(1)
    expect(qs[1].progress).toBe(0)
  })

  it('accumulates hero damage across batches', () => {
    const batch: GameEvent[] = [{ type: 'HeroDamaged', player: 1, amount: 5, hpAfter: 25 }]
    let qs = [quest({ kind: 'heroDamage', goal: 12 })]
    for (let i = 0; i < 3; i++) qs = applyTally(qs, tallyMatch(batch, HERO_ID))
    expect(qs[0].progress).toBe(12)
  })
})

// ---- 与内容挂钩的三种军令 ----
//
// 任务池原来七种全是「打出 N 张」「造成 N 点」这类**与卡池无关**的计数 ——
// 换掉整个卡池它们一条都不用改,也就是说它们从不引导你去玩任何具体的东西。
describe('内容挂钩的军令', () => {
  const play = (defId: string): GameEvent => ({
    type: 'CardPlayed',
    player: 0,
    iid: 1,
    defId,
    cost: 1,
  })

  it('兵种军令按兵种分桶计数', () => {
    const cavalry = COLLECTIBLE_CARDS.find((c) => c.troop === 'cavalry')!
    const archer = COLLECTIBLE_CARDS.find((c) => c.troop === 'archer')!
    const tally = tallyMatch([play(cavalry.id), play(cavalry.id), play(archer.id)], 'liu-bei')
    expect(tally.playTroop.cavalry).toBe(2)
    expect(tally.playTroop.archer).toBe(1)
    expect(tally.playTroop.navy ?? 0).toBe(0)
  })

  it('时代军令按时代块计数', () => {
    const shu = COLLECTIBLE_CARDS.find((c) => c.dynasty === 'shu' && c.type === 'general')!
    const tally = tallyMatch([play(shu.id)], 'liu-bei')
    expect(tally.playEra['three-kingdoms']).toBe(1)
  })

  // 布下才算 —— 消散那一条 rule 是 undefined
  it('战场军令只数「布下」,不数「消散」', () => {
    const laid: GameEvent = {
      type: 'FieldChanged',
      rule: { id: 'f', name: { zh: 'x', en: 'x' }, text: { zh: 'x', en: 'x' }, turnDamageAll: 1 },
    }
    const gone: GameEvent = { type: 'FieldChanged' }
    expect(tallyMatch([laid, gone, laid], 'liu-bei').setField).toBe(2)
  })

  it('进度真的落到对应的任务上', () => {
    const cavalry = COLLECTIBLE_CARDS.find((c) => c.troop === 'cavalry')!
    const quests = [
      { kind: 'playTroop' as const, goal: 3, reward: 1, troop: 'cavalry' as const, id: 'q1', progress: 0, claimed: false },
      { kind: 'playTroop' as const, goal: 3, reward: 1, troop: 'navy' as const, id: 'q2', progress: 0, claimed: false },
    ]
    const next = applyTally(quests, tallyMatch([play(cavalry.id), play(cavalry.id)], 'liu-bei'))
    expect(next[0].progress).toBe(2)
    expect(next[1].progress).toBe(0)
  })
})
