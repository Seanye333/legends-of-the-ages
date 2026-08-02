import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createGame } from './init'
import { redactState } from './redact'
import { inflateRedacted } from '../app/remoteMatch'
import { CARDS_BY_ID } from '../content/cards'
import type { GameConfig } from './types'

// 裁剪层的**静默丢字段**闸门。
//
// redactState 与 inflateRedacted 都是手写字段清单 —— 不能 spread(那会把
// deck/hand 一起漏给对手),所以每加一个 PlayerState 字段就得手动补两处。
// 这件事已经漏过一整个卡包:第二十一卡包的士气/粮道/计谋链/副将技,
// 加上 GameState.field,五个字段从来没进过裁剪层。表现是**单机全对、联机全无**:
// 天梯局里士气永远 0、副将技按钮根本不存在、赤壁的火只烧在服务端。
// 不报错、不崩溃,只是什么都没有 —— 和铁律 7 那一类完全相同的失败模式。
//
// 这里从 types.ts 源码抠出字段名,逐个断言两侧都提到了它。
// 源码文本检查很笨,但它拦得住「加了字段忘了补裁剪」这个唯一的失败模式。

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8')

// 从 `export interface X {` 到配对的 `}` 之间,抠出顶层字段名
function fieldsOf(src: string, name: string): string[] {
  const start = src.indexOf(`export interface ${name} {`)
  expect(start, `types.ts 里找不到 ${name}`).toBeGreaterThan(-1)
  const body = src.slice(start, src.indexOf('\n}', start))
  return [...new Set([...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]))]
}

describe('裁剪层字段覆盖', () => {
  const types = read('./types.ts')
  const redact = read('./redact.ts')
  const inflate = read('../app/remoteMatch.ts')

  // deck/hand 是**故意**不透传的(那正是裁剪的目的),secrets 走专门的 iid 通道
  const SECRET_BY_DESIGN = new Set(['deck', 'hand', 'secrets'])

  it('PlayerState 的每个字段都在 redact.ts 里被提到', () => {
    for (const f of fieldsOf(types, 'PlayerState')) {
      if (SECRET_BY_DESIGN.has(f)) continue
      expect(redact, `PlayerState.${f} 没有进裁剪层 —— 联机局会静默丢掉它`).toContain(`${f}:`)
    }
  })

  it('PlayerState 的每个字段都在 inflateRedacted 里被重建', () => {
    for (const f of fieldsOf(types, 'PlayerState')) {
      if (SECRET_BY_DESIGN.has(f)) continue
      expect(inflate, `inflateRedacted 没有重建 PlayerState.${f}`).toContain(`${f}:`)
    }
  })

  it('GameState 的公开字段都在裁剪层里(seed/rng/nextIid 除外)', () => {
    // seed/rng/nextIid 是**必须**藏起来的:泄漏 rng 等于泄漏对手接下来会抽到什么
    const HIDDEN = new Set(['seed', 'rng', 'nextIid', 'players'])
    for (const f of fieldsOf(types, 'GameState')) {
      if (HIDDEN.has(f)) continue
      expect(redact, `GameState.${f} 没有进裁剪层`).toContain(`${f}:`)
    }
  })

  it('裁剪→重建一个来回,士气/粮道/计谋链/副将/战场都还在', () => {
    const cfg: GameConfig = {
      seed: 3,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [[], []],
      first: 0,
      vicePowers: [
        {
          id: 'vp-test',
          name: { zh: '副将', en: 'Vice' },
          text: { zh: '测试', en: 'Test' },
          cost: 2,
          script: { ops: [{ op: 'draw', count: 1 }] },
        },
        undefined,
      ],
      field: {
        rule: {
          id: 'f-test',
          name: { zh: '烈火', en: 'Blaze' },
          text: { zh: '每回合烧 1', en: 'Burn 1' },
          turnDamageAll: 1,
        },
        turnsLeft: 3,
      },
      scenario: {
        activePlayer: 0,
        players: [
          { heroHp: 30, mana: 5, board: [], hand: [], supply: 4 },
          { heroHp: 30, mana: 5, board: [], hand: [] },
        ],
      },
    }
    const s = createGame(cfg, CARDS_BY_ID)
    s.players[0].morale = 2
    s.players[0].chain = 3
    s.players[0].heroPowerTier = 1

    const back = inflateRedacted(redactState(s, 0), 0)
    expect(back.players[0].morale).toBe(2)
    expect(back.players[0].supply).toBe(4)
    expect(back.players[0].chain).toBe(3)
    expect(back.players[0].heroPowerTier).toBe(1)
    expect(back.players[0].vicePower?.id).toBe('vp-test')
    expect(back.field?.rule.id).toBe('f-test')
    expect(back.field?.turnsLeft).toBe(3)
  })

  it('裁剪后对手的牌库与手牌内容依然不可见(别把闸门修成漏斗)', () => {
    const cfg: GameConfig = {
      seed: 3,
      heroIds: ['liu-bei', 'cao-cao'],
      deckIds: [
        Array.from({ length: 30 }, () => 'guan-yu'),
        Array.from({ length: 30 }, () => 'zhang-fei'),
      ],
      first: 0,
    }
    const s = createGame(cfg, CARDS_BY_ID)
    const rs = redactState(s, 0)
    expect(JSON.stringify(rs.opponent)).not.toContain('zhang-fei')
    expect(rs.opponent).not.toHaveProperty('deck')
    expect(rs.opponent).not.toHaveProperty('hand')
  })
})
