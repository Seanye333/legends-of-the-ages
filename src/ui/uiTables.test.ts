import { describe, expect, it } from 'vitest'
import { KEYWORD_BADGE, KEYWORD_NAME, KEYWORD_RULE, DOCTRINE_COLORS, RARITY_NAME } from './doctrineColors'
import { DOCTRINE_NAME } from '../content/names'
import { matchErrorText, isProtocolOutdated } from './components/errorText'
import { deckViolationText } from '../content/deckErrorText'
import { CARDS } from '../content/cards'
import type { Keyword } from '../engine/types'

// 这些查表结构一旦漏了一项,表现是**界面上出现 undefined**,而不是报错。
// TypeScript 的 Record<Keyword, X> 已经挡住了「少一个键」,
// 但挡不住「键在、值是空串」或「加了新主义忘了配色」。

describe('关键词表', () => {
  const keywords = [...new Set(CARDS.flatMap((c) => c.keywords))] as Keyword[]

  it('卡池里实际用到的每个关键词都有徽章/译名/规则说明', () => {
    for (const kw of keywords) {
      expect(KEYWORD_BADGE[kw]?.zh, `${kw} 缺徽章`).toBeTruthy()
      expect(KEYWORD_NAME[kw]?.zh, `${kw} 缺译名`).toBeTruthy()
      expect(KEYWORD_RULE[kw]?.zh, `${kw} 缺规则说明`).toBeTruthy()
      expect(KEYWORD_RULE[kw]?.en, `${kw} 缺英文规则说明`).toBeTruthy()
    }
  })

  it('徽章是单字/单字母,否则会撑破卡面角标', () => {
    for (const kw of keywords) {
      expect(KEYWORD_BADGE[kw].zh.length, `${kw} 的中文徽章过长`).toBeLessThanOrEqual(1)
      expect(KEYWORD_BADGE[kw].en.length, `${kw} 的英文徽章过长`).toBeLessThanOrEqual(2)
    }
  })
})

describe('主义与稀有度表', () => {
  it('卡池里出现的每个主义都有名字与主题色', () => {
    for (const d of new Set(CARDS.map((c) => c.doctrine))) {
      expect(DOCTRINE_NAME[d]?.zh, `${d} 缺主义名`).toBeTruthy()
      expect(DOCTRINE_COLORS[d], `${d} 缺主题色`).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('每个稀有度都有名字', () => {
    for (const r of new Set(CARDS.map((c) => c.rarity))) {
      expect(RARITY_NAME[r]?.zh, `${r} 缺稀有度名`).toBeTruthy()
    }
  })
})

describe('错误码译文', () => {
  it('把引擎与服务器的内部码翻成人话', () => {
    expect(matchErrorText('not-your-turn').zh).toBe('还没轮到你')
    expect(matchErrorText('match-abandoned').zh).not.toBe('match-abandoned')
    expect(matchErrorText('turn-timeout').en).toMatch(/timed out/i)
  })

  it('带冒号的复合码取前缀再匹配', () => {
    expect(matchErrorText('illegal-deck: too many copies').zh).toContain('卡组不合法')
  })

  it('版本过旧是唯一需要给动作的一条', () => {
    expect(isProtocolOutdated('protocol-outdated:0<1')).toBe(true)
    expect(isProtocolOutdated('connect-failed')).toBe(false)
    expect(matchErrorText('protocol-outdated:0<1').zh).toContain('刷新')
  })

  it('未知码原样透出,而不是吞掉(至少还能截图报 bug)', () => {
    expect(matchErrorText('some-brand-new-error').zh).toBe('some-brand-new-error')
  })
})

describe('构筑违规译文', () => {
  it('每种违规都翻成人话,且不出现内部码', () => {
    const cases = [
      { code: 'unknown-hero', heroId: 'x' },
      { code: 'bad-size', size: 27 },
      { code: 'bad-size', size: 33 },
      { code: 'unknown-card', cardId: 'nope' },
      { code: 'not-collectible', cardId: 'token-si-shi' },
      { code: 'too-many-copies', cardId: 'guan-yu', count: 2, limit: 1 },
      { code: 'too-many-copies', cardId: 'wang-ping', count: 3, limit: 2 },
      { code: 'wrong-doctrine', cardId: 'cao-cao', doctrine: 'hegemonic', heroDoctrine: 'royal' },
    ] as const
    for (const v of cases) {
      const text = deckViolationText(v)
      expect(text.zh.trim(), JSON.stringify(v)).not.toBe('')
      expect(text.en.trim(), JSON.stringify(v)).not.toBe('')
      expect(text.zh, `${v.code} 泄漏了内部码`).not.toContain(v.code)
    }
  })

  it('缺牌与超牌给的是不同的话', () => {
    const few = deckViolationText({ code: 'bad-size', size: 27 }).zh
    const many = deckViolationText({ code: 'bad-size', size: 33 }).zh
    expect(few).toContain('还差 3')
    expect(many).toContain('多了 3')
  })
})
