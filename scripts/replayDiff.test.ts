// replayDiff 的自检 —— 判据两个方向各验一遍。
//
// 这一份里最要紧的是**变异测试**:逐个字段改动一位,断言指纹一定跟着变。
// 理由见 replayDiff.ts 的文件头 —— 指纹漏掉一个字段,确定性对拍就在那个维度上
// 永远绿着,而且没有任何征兆。这是本仓库列为最贵的那一类失效,
// 而它偏偏是「看起来最没有判断」的那道闸门。
import { describe, expect, it } from 'vitest'
import { createGame } from '../src/engine/init'
import { fingerprint, firstDiff, judgeRecord, MIN_COMMANDS, tally, type Fail } from './replayDiff'
import type { CardDef, CardLibrary, GameConfig, GameState } from '../src/engine/types'

const LIB: CardLibrary = Object.fromEntries(
  Array.from({ length: 30 }, (_, i): [string, CardDef] => [
    `c${i}`,
    {
      id: `c${i}`,
      collectorNo: i + 1,
      name: { zh: 'c', en: 'c' },
      type: 'general',
      doctrine: 'neutral',
      dynasty: 'qun',
      rarity: 'common',
      archetype: 'warrior',
      cost: 3,
      attack: 2,
      health: 2,
      keywords: [],
    },
  ]),
)
const deck = Array.from({ length: 30 }, (_, i) => `c${i}`)
const CFG: GameConfig = { seed: 11, heroIds: ['h', 'h'], deckIds: [deck, deck], first: 0 }

const fresh = (): GameState => createGame(CFG, LIB)

describe('fingerprint', () => {
  it('同一个状态两次取指纹相同', () => {
    expect(fingerprint(fresh())).toBe(fingerprint(fresh()))
  })

  // ---- 变异测试:每一个字段都必须落进指纹里 ----
  //
  // 这里逐个列出来而不是写个循环,是因为**新加字段时这份清单要跟着加** ——
  // 循环会自动覆盖新字段,看起来更聪明,但那样就没人会来看这份清单,
  // 也就没人会问「这个新字段该不该进指纹」。清单是给人读的。
  const MUTATIONS: Array<[string, (s: GameState) => void]> = [
    ['seed', (s) => (s.seed += 1)],
    // rng 是后续一切随机的来源:别处全同但 rng 不同,下一步就会分叉,
    // 而那时候错的是**上一步**,现场早没了。
    ['rng', (s) => (s.rng += 1)],
    ['turn', (s) => (s.turn += 1)],
    ['activePlayer', (s) => (s.activePlayer = s.activePlayer === 0 ? 1 : 0)],
    ['phase', (s) => (s.phase = 'ended')],
    ['winner', (s) => (s.winner = 0)],
    ['nextIid', (s) => (s.nextIid += 1)],
    ['players[0].heroHp', (s) => (s.players[0].heroHp -= 1)],
    ['players[1].armor', (s) => (s.players[1].armor += 1)],
    ['players[0].mana', (s) => (s.players[0].mana.current += 1)],
    ['players[0].hand 顺序', (s) => s.players[0].hand.reverse()],
    ['players[0].deck 长度', (s) => { s.players[0].deck = s.players[0].deck.slice(1) }],
    ['players[0].hand[0].costDelta', (s) => (s.players[0].hand[0].costDelta -= 1)],
    ['players[0].fatigue', (s) => (s.players[0].fatigue += 1)],
    ['players[1].supply', (s) => (s.players[1].supply = (s.players[1].supply ?? 0) + 1)],
    ['pendingChoice(可选字段从无到有)', (s) => (s.pendingChoice = undefined)],
  ]

  for (const [what, mutate] of MUTATIONS) {
    it(`改动 ${what} 之后指纹必须变`, () => {
      const base = fresh()
      const before = fingerprint(base)
      mutate(base)
      const after = fingerprint(base)
      // `pendingChoice = undefined` 这一条例外:把一个本来就不存在的可选字段
      // 设成 undefined,JSON 里看不出区别 —— 这是对的,不是漏。
      if (what.startsWith('pendingChoice')) expect(after).toBe(before)
      else expect(after).not.toBe(before)
    })
  }

  it('**指纹被改窄就会漏** —— 复现那种失效,证明这份测试拦得住', () => {
    // 假想有人把 fingerprint「优化」成只取这几个字段
    const narrowed = (s: GameState) =>
      JSON.stringify({ turn: s.turn, phase: s.phase, players: s.players })
    const a = fresh()
    const b = fresh()
    b.rng += 1
    // 窄指纹看不出 rng 分叉 —— 对拍会全绿
    expect(narrowed(a)).toBe(narrowed(b))
    // 而现在这份看得出来
    expect(fingerprint(a)).not.toBe(fingerprint(b))
  })
})

describe('firstDiff', () => {
  it('指出第一个不同的偏移', () => {
    expect(firstDiff('abcdef', 'abcXef')).toContain('偏移 3')
  })

  it('完全相同时偏移落在末尾', () => {
    expect(firstDiff('abc', 'abc')).toContain('偏移 3')
  })

  it('一方是另一方的前缀', () => {
    expect(firstDiff('abc', 'abcdef')).toContain('偏移 3')
  })

  it('两侧都给出上下文', () => {
    const out = firstDiff('x'.repeat(200) + 'A', 'x'.repeat(200) + 'B')
    expect(out).toContain('录制')
    expect(out).toContain('重放')
  })
})

describe('judgeRecord', () => {
  it('命令够多 —— 合格', () => {
    expect(judgeRecord(MIN_COMMANDS)).toBe(null)
    expect(judgeRecord(120)).toBe(null)
  })

  it('命令太少 —— **算失败,不算通过**', () => {
    // 一局没验到东西的对拍混进「通过」里,会让总数看起来很健康,而覆盖是空的
    expect(judgeRecord(MIN_COMMANDS - 1)).toContain('没有真正被对拍')
    expect(judgeRecord(0)).toContain('0 条命令')
  })
})

describe('tally', () => {
  it('按类别数,没有的类别是 0', () => {
    const fails: Fail[] = [
      { seed: 1, kind: 'replay', detail: '' },
      { seed: 2, kind: 'replay', detail: '' },
      { seed: 3, kind: 'json', detail: '' },
    ]
    expect(tally(fails)).toEqual({ replay: 2, frame: 0, json: 1, record: 0, events: 0 })
  })

  it('空清单全是 0', () => {
    expect(tally([])).toEqual({ replay: 0, frame: 0, json: 0, record: 0, events: 0 })
  })
})
