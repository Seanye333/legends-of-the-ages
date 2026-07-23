import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import { rngInt } from './rng'
import { replayMatch, type MatchRecord } from './replay'
import type { CardDef, CardLibrary, GameConfig, GameState } from './types'
import { BOARD_LIMIT, HAND_LIMIT, MANA_CAP, START_HP, TURN_LIMIT } from './types'

// 模糊测试:种子随机地在合法命令里乱走,任何违反不变量的路径都会暴露。
// 契约:legalCommands 返回的命令 applyCommand 必须全部接受。

function def(id: string, over: Partial<CardDef>): CardDef {
  return {
    id,
    collectorNo: 1,
    name: { zh: id, en: id },
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

const LIB: CardLibrary = Object.fromEntries(
  [
    def('f-van1', { cost: 1, attack: 1, health: 2 }),
    def('f-van2', {}),
    def('f-van3', { cost: 4, attack: 4, health: 5 }),
    def('f-charge', { cost: 3, attack: 3, health: 2, keywords: ['charge'] }),
    def('f-rush', { cost: 2, attack: 2, health: 2, keywords: ['rush'] }),
    def('f-wall', { cost: 3, attack: 2, health: 5, keywords: ['guard'] }),
    def('f-wind', { cost: 5, attack: 3, health: 4, keywords: ['windfury'] }),
    def('f-duel', { cost: 5, attack: 5, health: 4, keywords: ['duel'] }),
    def('f-sniper', {
      cost: 3,
      battlecry: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
    }),
    def('f-bomber', { cost: 3, deathrattle: { ops: [{ op: 'aoeDamage', amount: 1 }] } }),
    def('f-medic', {
      cost: 2,
      attack: 1,
      health: 3,
      battlecry: { ops: [{ op: 'heal', amount: 3, target: 'friendlyHero' }] },
    }),
    def('f-summoner', { cost: 4, battlecry: { ops: [{ op: 'summon', defId: 'f-van1', count: 2 }] } }),
    def('f-reaper', {
      cost: 6,
      attack: 4,
      health: 4,
      battlecry: { ops: [{ op: 'destroy', target: 'randomEnemyGeneral' }] },
    }),
    def('f-strat-bolt', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] },
    }),
    def('f-strat-aoe', {
      type: 'stratagem',
      cost: 4,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    }),
    def('f-strat-draw', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }] },
    }),
    def('f-strat-buff', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: {
        ops: [
          { op: 'buffStats', attack: 2, health: 2, target: 'chosenAny' },
          { op: 'grantKeyword', keyword: 'guard', target: 'chosenAny' },
        ],
      },
    }),
    // ---- 第五卡包:让 fuzz 真的踩到抉择与发现的路径 ----
    // 抉择武将:一个模式要目标、一个不要 —— 正是 legal/apply 契约最容易破的形状
    def('f-choose-gen', {
      cost: 3,
      attack: 2,
      health: 3,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'self' }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] } },
        ],
      },
    }),
    def('f-choose-strat', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      choose: {
        modes: [
          { label: { zh: 'A', en: 'A' }, script: { ops: [{ op: 'draw', count: 1 }] } },
          { label: { zh: 'B', en: 'B' }, script: { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }] } },
        ],
      },
    }),
    // 发现:把对局停在 pendingChoice 上,fuzz 必须能从挂起里选出去、不卡死
    def('f-discover', {
      type: 'stratagem',
      cost: 2,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    }),
    // ---- 第六卡包:势力羁绊 / 关键词 payoff ----
    def('f-dynasty-lord', {
      cost: 4,
      dynasty: 'shu',
      battlecry: { ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' }] },
    }),
    def('f-leech', { cost: 2, keywords: ['lifesteal'] }),
    def('f-leech-payoff', {
      type: 'stratagem',
      cost: 3,
      attack: undefined,
      health: undefined,
      spell: {
        ops: [{ op: 'buffPer', per: { kind: 'friendlyKeyword', keyword: 'lifesteal' }, attack: 1, health: 1, target: 'allFriendlyGenerals' }],
      },
    }),
    def('f-swarm-payoff', {
      type: 'stratagem',
      cost: 4,
      attack: undefined,
      health: undefined,
      spell: { ops: [{ op: 'draw', count: 2 }], condition: { ifKeywordCount: { keyword: 'guard', atLeast: 2 } } },
    }),
    // ---- 第七卡包:费用消减 / 牌生成 ----
    def('f-discount', {
      type: 'stratagem', cost: 2, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'reduceCost', amount: 1, filter: 'all' }] },
    }),
    def('f-generator', {
      cost: 3, battlecry: { ops: [{ op: 'addToHand', defId: 'f-van1', count: 2 }] },
    }),
    // ---- 第八卡包:变形 / 复生 ----
    def('f-polymorph', {
      type: 'stratagem', cost: 4, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'transform', target: 'chosenEnemyGeneral', into: 'f-van1' }] },
    }),
    def('f-rez', {
      type: 'stratagem', cost: 5, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'resurrect', count: 2 }] },
    }),
    // ---- 第十卡包:缩放伤害 / 献祭 ----
    def('f-warcry', {
      type: 'stratagem', cost: 4, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }] },
    }),
    def('f-sacrifice', {
      type: 'stratagem', cost: 2, attack: undefined, health: undefined,
      spell: { ops: [{ op: 'destroy', target: 'chosenFriendlyGeneral' }, { op: 'draw', count: 1 }] },
    }),
  ].map((d) => [d.id, d]),
)

const DECK_POOL = Object.keys(LIB)

function buildDeck(seedBase: number): string[] {
  const deck: string[] = []
  let s = seedBase
  for (let i = 0; i < 30; i++) {
    const roll = rngInt(s, DECK_POOL.length)
    s = roll.next
    deck.push(DECK_POOL[roll.value])
  }
  return deck
}

function assertInvariants(state: GameState): void {
  for (const p of state.players) {
    expect(p.hand.length).toBeLessThanOrEqual(HAND_LIMIT)
    expect(p.board.length).toBeLessThanOrEqual(BOARD_LIMIT)
    expect(p.heroHp).toBeLessThanOrEqual(START_HP)
    expect(p.mana.max).toBeLessThanOrEqual(MANA_CAP)
    expect(p.mana.current).toBeGreaterThanOrEqual(0)
    for (const c of p.board) {
      expect(c.health).toBeGreaterThan(0) // 死亡必须已被结算
      expect(c.attacksUsed).toBeLessThanOrEqual(2)
    }
  }
  expect(state.turn).toBeLessThanOrEqual(TURN_LIMIT + 1)
}

function runFuzzGame(seed: number): { state: GameState; record: MatchRecord; steps: number } {
  const cfg: GameConfig = {
    seed,
    heroIds: ['hero-a', 'hero-b'],
    deckIds: [buildDeck(seed * 7 + 1), buildDeck(seed * 13 + 5)],
    first: seed % 2 === 0 ? 0 : 1,
  }
  let state = createGame(cfg, LIB)
  const record: MatchRecord = { cfg, commands: [] }
  let pick = seed * 31 + 17
  let steps = 0

  while (state.phase !== 'ended') {
    steps++
    expect(steps).toBeLessThan(3000)
    const actors = state.phase === 'mulligan' ? ([0, 1] as const) : ([state.activePlayer] as const)
    for (const player of actors) {
      if (state.phase === 'ended') break
      const commands = legalCommands(state, player, LIB).filter((c) => c.type !== 'Concede')
      if (commands.length === 0) continue
      // 偏向前面的命令(出牌/攻击),EndTurn 兜底;避免全随机导致每回合立刻结束
      const roll = rngInt(pick, commands.length)
      pick = roll.next
      const cmd = commands[roll.value]
      const r = applyCommand(state, player, cmd, LIB)
      expect(r.ok, `legal command rejected: ${JSON.stringify(cmd)} → ${r.ok ? '' : r.error}`).toBe(true)
      if (r.ok) {
        state = r.state
        record.commands.push({ player, cmd })
        assertInvariants(state)
      }
    }
  }
  expect(state.winner).toBeDefined()
  return { state, record, steps }
}

describe('fuzz: random legal games', () => {
  // 显式放宽超时:卡池播种机制后单局分支变多,冷启动那一轮偶尔会顶到默认的 5s。
  it(
    '100 seeded games terminate with all invariants held',
    () => {
      for (let seed = 1; seed <= 100; seed++) {
        runFuzzGame(seed)
      }
    },
    20_000,
  )

  it('replays reproduce the exact final state', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { state, record } = runFuzzGame(seed)
      const replayed = replayMatch(record, LIB)
      expect(replayed.ok).toBe(true)
      if (replayed.ok) expect(replayed.state).toEqual(state)
    }
  })
})
