import { describe, expect, it } from 'vitest'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { solveLethal, hasLethal, trivialFaceLethal } from './lethalSolver'
import type {
  CardDef,
  CardLibrary,
  Command,
  GameConfig,
  GameState,
  HeroPowerDef,
  PlayerIdx,
  PuzzleScenario,
} from '../engine/types'

// —— 测试卡库 ——
function unit(id: string, attack: number, health: number, extra: Partial<CardDef> = {}): CardDef {
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
    attack,
    health,
    keywords: [],
    ...extra,
  }
}

const LIB: CardLibrary = {
  soldier: unit('soldier', 2, 3),
  charger: unit('charger', 3, 2, { keywords: ['charge'] }),
  bruiser: unit('bruiser', 5, 2), // 用来清守护
  guardwall: unit('guardwall', 0, 5, { keywords: ['guard'] }),
  firebolt: {
    id: 'firebolt',
    collectorNo: 2,
    name: { zh: '火計', en: 'Firebolt' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'damage', amount: 3, target: 'enemyHero' }] },
  },
  warcry: {
    id: 'warcry',
    collectorNo: 3,
    name: { zh: '擂鼓', en: 'War Drums' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    spell: { ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'chosenFriendlyGeneral' }] },
  },
}

// 每回合造成 1 点伤害的主公技(用于「主公技补最后一刀」)
const PING: HeroPowerDef = {
  id: 'ping',
  name: { zh: '点杀', en: 'Ping' },
  text: { zh: '造成 1 点伤害', en: 'Deal 1' },
  cost: 2,
  script: { ops: [{ op: 'damage', amount: 1, target: 'enemyHero' }] },
}

function cfg(
  scenario: PuzzleScenario,
  heroPowers?: [HeroPowerDef | undefined, HeroPowerDef | undefined],
): GameConfig {
  return { seed: 1, heroIds: ['liu-bei', 'cao-cao'], deckIds: [[], []], first: 0, scenario, heroPowers }
}

// 把求解出的命令序列真正走一遍,断言最终确实赢了 —— 求解器最重要的正确性保证。
function replay(state: GameState, player: PlayerIdx, line: Command[]): GameState {
  let s = state
  for (const cmd of line) {
    const r = applyCommand(s, player, cmd, LIB)
    if (!r.ok) throw new Error(`line 走不通: ${JSON.stringify(cmd)} → ${r.error}`)
    s = r.state
  }
  return s
}

// 解出斩杀 + 回放验证真赢,一步到位
function solveAndVerify(scenario: PuzzleScenario, heroPowers?: Parameters<typeof cfg>[1]) {
  const s = createGame(cfg(scenario, heroPowers), LIB)
  const res = solveLethal(s, 0, LIB)
  expect(res).not.toBeNull()
  const end = replay(s, 0, res!.line)
  expect(end.phase).toBe('ended')
  expect(end.winner).toBe(0)
  return res!
}

describe('solveLethal —— 四类解法', () => {
  it('平凡:直接把已就绪单位砸向英雄', () => {
    const scenario: PuzzleScenario = {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 10, board: [{ defId: 'charger' }], hand: [] }, // 3 攻
        { heroHp: 3, mana: 0, board: [], hand: [] },
      ],
    }
    const s = createGame(cfg(scenario), LIB)
    expect(trivialFaceLethal(s, 0)).toBe(true)
    solveAndVerify(scenario)
  })

  it('守护墙后:先清掉守护再打脸', () => {
    const scenario: PuzzleScenario = {
      activePlayer: 0,
      players: [
        // bruiser 5 攻清掉 0/5 守护,charger 3 攻打脸
        { heroHp: 20, mana: 10, board: [{ defId: 'bruiser' }, { defId: 'charger' }], hand: [] },
        { heroHp: 3, mana: 0, board: [{ defId: 'guardwall' }], hand: [] },
      ],
    }
    const s = createGame(cfg(scenario), LIB)
    expect(trivialFaceLethal(s, 0)).toBe(false) // 有守护,直接打脸不行
    const res = solveAndVerify(scenario)
    expect(res.steps).toBeGreaterThanOrEqual(2) // 至少「清墙 + 打脸」两步
  })

  it('主公技补刀:场面差 1 点,用点杀补上', () => {
    const scenario: PuzzleScenario = {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 10, board: [{ defId: 'soldier' }], hand: [] }, // 2 攻
        { heroHp: 3, mana: 0, board: [], hand: [] },
      ],
    }
    const s = createGame(cfg(scenario, [PING, undefined]), LIB)
    expect(trivialFaceLethal(s, 0)).toBe(false) // 2 < 3
    solveAndVerify(scenario, [PING, undefined])
  })

  it('先 buff 再挥:擂鼓 +2 攻后一击致命', () => {
    const scenario: PuzzleScenario = {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 1, board: [{ defId: 'soldier' }], hand: ['warcry'] }, // 2 攻 +2 = 4
        { heroHp: 4, mana: 0, board: [], hand: [] },
      ],
    }
    const s = createGame(cfg(scenario), LIB)
    expect(trivialFaceLethal(s, 0)).toBe(false) // 2 < 4
    solveAndVerify(scenario)
  })

  it('法术烧脸:火計直接带走', () => {
    const scenario: PuzzleScenario = {
      activePlayer: 0,
      players: [
        { heroHp: 20, mana: 2, board: [], hand: ['firebolt'] },
        { heroHp: 3, mana: 0, board: [], hand: [] },
      ],
    }
    solveAndVerify(scenario)
  })
})

describe('solveLethal —— 边界', () => {
  it('无解:资源不够就返回 null', () => {
    const s = createGame(
      cfg({
        activePlayer: 0,
        players: [
          { heroHp: 20, mana: 0, board: [{ defId: 'soldier' }], hand: [] }, // 2 攻
          { heroHp: 30, mana: 0, board: [], hand: [] },
        ],
      }),
      LIB,
    )
    expect(solveLethal(s, 0, LIB)).toBeNull()
    expect(hasLethal(s, 0, LIB)).toBe(false)
  })

  it('节点预算耗尽时保守返回 null(未能证明有解)', () => {
    // 「守护墙后」本可解,但预算卡到 1 步就走不完
    const s = createGame(
      cfg({
        activePlayer: 0,
        players: [
          { heroHp: 20, mana: 10, board: [{ defId: 'bruiser' }, { defId: 'charger' }], hand: [] },
          { heroHp: 3, mana: 0, board: [{ defId: 'guardwall' }], hand: [] },
        ],
      }),
      LIB,
    )
    expect(solveLethal(s, 0, LIB, { nodeBudget: 1 })).toBeNull()
    // 预算放开则找得到
    expect(solveLethal(s, 0, LIB)).not.toBeNull()
  })
})
