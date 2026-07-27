// 远征/乱斗内容自检:宝物、关卡修饰符、乱斗规则里引用的衍生物必须真实存在,
// id 不能撞车。这些内容平时不走引擎类型检查(startTokens 是字符串),
// 一个拼错的 token id 只会在运行时静默变成空场面 —— 这条守着别让它溜进去。
import { describe, expect, it } from 'vitest'
import { RELICS, combineRelics } from './relics'
import { EXPEDITION_MODIFIERS } from './expeditionModifiers'
import { BRAWLS } from './brawls'
import { CARDS_BY_ID } from './cards'
import type { BattleObjective, RunModifiers } from '../engine/types'

function tokensOf(m?: RunModifiers): string[] {
  return m?.startTokens ?? []
}

function assertRealTokens(ids: string[], where: string) {
  for (const id of ids) {
    const c = CARDS_BY_ID[id]
    expect(c, `${where} 引用了不存在的衍生物 ${id}`).toBeDefined()
    expect(c.token ?? false, `${where} 引用的 ${id} 不是衍生物(token)`).toBe(true)
  }
}

// 斩将/护送的目标靠 startTokens 摆上场,`targetDefId` 与摆上去的那张对不上时,
// createGame 解析不到 targetIid —— 目标**永不触发**,而且一声不吭:
// 守成会正常判、斩将会变成打不赢、护送会变成永远不输。这条闸门专门钉它。
export function assertObjectiveTargetPlaced(
  objective: BattleObjective | undefined,
  playerTokens: string[],
  oppTokens: string[],
  where: string,
) {
  if (!objective || objective.kind === 'survive') return
  const placed = objective.targetSide === 0 ? playerTokens : oppTokens
  expect(placed, `${where} 的目标 ${objective.targetDefId} 没有被 startTokens 摆上场`).toContain(
    objective.targetDefId,
  )
}

describe('远征宝物', () => {
  it('id 唯一', () => {
    const ids = RELICS.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('startTokens 都是真实衍生物', () => {
    for (const r of RELICS) assertRealTokens(tokensOf(r.modifiers), `宝物 ${r.id}`)
  })
  it('合并一整趟宝物也只产出真实衍生物', () => {
    const { modifiers } = combineRelics(RELICS.map((r) => r.id))
    assertRealTokens(tokensOf(modifiers), '合并宝物')
  })
})

describe('远征关卡修饰符', () => {
  it('id 唯一', () => {
    const ids = EXPEDITION_MODIFIERS.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('boss/both/player 的 startTokens 都是真实衍生物', () => {
    for (const m of EXPEDITION_MODIFIERS) {
      assertRealTokens(tokensOf(m.boss), `修饰符 ${m.id} (boss)`)
      assertRealTokens(tokensOf(m.both), `修饰符 ${m.id} (both)`)
      assertRealTokens(tokensOf(m.player), `修饰符 ${m.id} (player)`)
    }
  })
  it('权重为正', () => {
    for (const m of EXPEDITION_MODIFIERS) expect(m.weight, m.id).toBeGreaterThan(0)
  })
  it('带目标的修饰符,目标单位真的被摆上了场', () => {
    for (const m of EXPEDITION_MODIFIERS) {
      assertObjectiveTargetPlaced(
        m.objective,
        [...tokensOf(m.player), ...tokensOf(m.both)],
        [...tokensOf(m.boss), ...tokensOf(m.both)],
        `修饰符 ${m.id}`,
      )
    }
  })
})

describe('乱斗规则', () => {
  it('id 唯一', () => {
    const ids = BRAWLS.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('startTokens 都是真实衍生物', () => {
    for (const b of BRAWLS) {
      assertRealTokens(tokensOf(b.modifiers), `乱斗 ${b.id}`)
      assertRealTokens(tokensOf(b.playerOnly), `乱斗 ${b.id} (playerOnly)`)
      assertRealTokens(tokensOf(b.oppOnly), `乱斗 ${b.id} (oppOnly)`)
    }
  })
  it('带目标的乱斗,目标单位真的被摆上了场', () => {
    for (const b of BRAWLS) {
      assertObjectiveTargetPlaced(
        b.objective,
        [...tokensOf(b.modifiers), ...tokensOf(b.playerOnly)],
        [...tokensOf(b.modifiers), ...tokensOf(b.oppOnly)],
        `乱斗 ${b.id}`,
      )
    }
  })
})
