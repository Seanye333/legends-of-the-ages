// 存档迁移测试。
//
// 这个文件存在的理由是一次真实事故:第四卡包给 PlayerState 加了四个必填字段,
// 本地 drive-test 立刻在 `redactState` 里抛 `Cannot read properties of undefined (reading 'map')`
// —— 服务端 Durable Object 里躺着上一版引擎写下的对局,一唤醒就炸,
// 那一局的双方都会停在最后一帧。tsc 兜不住:反序列化出来的东西是 `any` 形状的。
//
// 所以这里的断言不是「迁移函数会填字段」(那是同义反复),
// 而是**「旧形状的存档经过迁移之后,真的能喂给下游而不炸」**。
import { describe, expect, it } from 'vitest'
import { migrateState } from './migrate'
import { redactState, redactForSpectator } from './redact'
import { applyCommand } from './reducer'
import { legalCommands } from './legal'
import type { CardDef, CardLibrary, GameState } from './types'

const LIB: CardLibrary = {
  vanilla: {
    id: 'vanilla',
    collectorNo: 1,
    name: { zh: 'v', en: 'v' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 3,
    keywords: [],
  } satisfies CardDef,
}

// 第四卡包**之前**的 PlayerState 形状:没有 secrets / overloadNext /
// overloadLocked / cardsPlayedThisTurn。故意用 as 绕开类型 ——
// 真实的旧存档就是这么从 JSON 里反序列化出来的。
function legacyState(): GameState {
  const legacyPlayer = {
    heroId: 'liu-bei',
    heroHp: 24,
    heroMaxHp: 30,
    armor: 0,
    fatigue: 0,
    mana: { current: 4, max: 6 },
    deck: [],
    hand: [],
    board: [],
    graveyard: [],
    mulliganDone: true,
    heroPowerUsed: false,
  }
  return {
    seed: 1,
    rng: 99,
    turn: 7,
    activePlayer: 0,
    phase: 'main',
    players: [structuredClone(legacyPlayer), structuredClone(legacyPlayer)],
    nextIid: 500,
  } as unknown as GameState
}

describe('存档迁移', () => {
  it('未迁移的旧存档确实会让 redactState 崩 —— 这条守着「为什么需要迁移」', () => {
    // 如果哪天这一条不再抛了,说明下游变得容错了,迁移的必要性要重新评估。
    expect(() => redactState(legacyState(), 0)).toThrow(TypeError)
  })

  it('迁移之后可以正常裁剪(两个视角 + 观战席)', () => {
    const s = migrateState(legacyState())
    const view = redactState(s, 0)
    expect(view.self.secrets).toEqual([])
    expect(view.opponent.secretIids).toEqual([])
    expect(view.self.overloadLocked).toBe(0)
    expect(() => redactState(s, 1)).not.toThrow()
    expect(() => redactForSpectator(s)).not.toThrow()
  })

  it('迁移之后能继续推进对局', () => {
    const s = migrateState(legacyState())
    const cmds = legalCommands(s, 0, LIB)
    expect(cmds.length).toBeGreaterThan(0)
    const r = applyCommand(s, 0, { type: 'EndTurn' }, LIB)
    expect(r.ok).toBe(true)
  })

  it('只补不改 —— 已有字段一律不动', () => {
    const s = legacyState()
    s.players[0].heroHp = 13
    s.players[1].mana = { current: 2, max: 9 }
    const m = migrateState(s)
    expect(m.players[0].heroHp).toBe(13)
    expect(m.players[1].mana).toEqual({ current: 2, max: 9 })
    expect(m.turn).toBe(7)
  })

  it('对已经是新形状的存档是幂等的', () => {
    const s = migrateState(legacyState())
    s.players[0].secrets = [{ iid: 3, defId: 'sec-trap' }]
    s.players[0].overloadNext = 2
    const again = migrateState(structuredClone(s))
    expect(again.players[0].secrets).toEqual([{ iid: 3, defId: 'sec-trap' }])
    expect(again.players[0].overloadNext).toBe(2)
  })
})
