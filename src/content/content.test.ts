import { describe, expect, it } from 'vitest'
import { AMBIGUOUS_NAMES, CARDS, CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'
import type { CardDef } from '../engine/types'
import { PRECON_DECKS, validateDeck } from './decks'
import { GENERATED_CARDS } from './generated/cards.gen'
import { HEROES, HEROES_BY_ID } from './overrides/heroes'
import { SIGNATURE_OVERRIDES } from './overrides/signature'
import { STRATAGEMS } from './overrides/stratagems'

describe('signature overrides', () => {
  it('every override key exists in the generated pool', () => {
    const genIds = new Set(GENERATED_CARDS.map((c) => c.id))
    for (const key of Object.keys(SIGNATURE_OVERRIDES)) {
      expect(genIds.has(key), `override key not in generated pool: ${key}`).toBe(true)
    }
  })

  it('every override with a battlecry or deathrattle has zh text', () => {
    for (const [id, o] of Object.entries(SIGNATURE_OVERRIDES)) {
      if (o.battlecry || o.deathrattle) {
        expect(o.text?.zh, `override ${id} has an effect but no text.zh`).toBeTruthy()
      }
    }
  })

  it('summoned defIds exist in the merged pool', () => {
    for (const card of CARDS) {
      for (const script of [card.battlecry, card.deathrattle, card.spell]) {
        for (const op of script?.ops ?? []) {
          if (op.op === 'summon') {
            expect(CARDS_BY_ID[op.defId], `${card.id} summons unknown defId ${op.defId}`).toBeDefined()
          }
        }
      }
    }
  })
})

describe('stratagems', () => {
  it('has 15 stratagems with unique strat- ids', () => {
    expect(STRATAGEMS.length).toBe(15)
    const ids = new Set(STRATAGEMS.map((s) => s.id))
    expect(ids.size).toBe(STRATAGEMS.length)
    for (const s of STRATAGEMS) expect(s.id, `stratagem id must start with strat-: ${s.id}`).toMatch(/^strat-/)
  })

  it('collectorNo >= 9001 and unique', () => {
    const nos = STRATAGEMS.map((s) => s.collectorNo)
    for (const no of nos) expect(no).toBeGreaterThanOrEqual(9001)
    expect(new Set(nos).size).toBe(nos.length)
  })

  it('no attack/health, and every stratagem has a spell and zh text', () => {
    for (const s of STRATAGEMS) {
      expect(s.type).toBe('stratagem')
      expect(s.attack, `${s.id} must not have attack`).toBeUndefined()
      expect(s.health, `${s.id} must not have health`).toBeUndefined()
      expect(s.spell, `${s.id} must have a spell`).toBeDefined()
      expect(s.spell!.ops.length).toBeGreaterThan(0)
      expect(s.text?.zh, `${s.id} must have text.zh`).toBeTruthy()
    }
  })
})

describe('heroes', () => {
  it('six heroes, one per doctrine, START_HP each', () => {
    expect(HEROES.length).toBe(6)
    const doctrines = new Set(HEROES.map((h) => h.doctrine))
    expect(doctrines.size).toBe(6)
    for (const h of HEROES) expect(h.hp).toBe(30)
  })

  it('every hero id exists in the merged pool (portraits follow roster ids)', () => {
    for (const h of HEROES) {
      expect(CARDS_BY_ID[h.id], `hero id not in pool: ${h.id}`).toBeDefined()
    }
  })
})

describe('precon decks', () => {
  it('one deck per hero', () => {
    expect(PRECON_DECKS.length).toBe(6)
    const heroIds = new Set(PRECON_DECKS.map((d) => d.heroId))
    expect(heroIds.size).toBe(6)
    for (const d of PRECON_DECKS) expect(HEROES_BY_ID[d.heroId], `deck hero missing: ${d.heroId}`).toBeDefined()
  })

  it('all six precons pass validateDeck with zero violations', () => {
    for (const deck of PRECON_DECKS) {
      expect(validateDeck(deck, CARDS_BY_ID, HEROES_BY_ID), `deck ${deck.heroId}`).toEqual([])
    }
  })

  it('each precon carries 2-4 stratagems', () => {
    for (const deck of PRECON_DECKS) {
      const strats = deck.cardIds.filter((id) => CARDS_BY_ID[id]?.type === 'stratagem').length
      expect(strats, `deck ${deck.heroId} stratagem count`).toBeGreaterThanOrEqual(2)
      expect(strats, `deck ${deck.heroId} stratagem count`).toBeLessThanOrEqual(4)
    }
  })
})

describe('重名卡', () => {
  // 卡池里既有真正的同名异人(蜀漢馬忠 / 東吳馬忠、東漢賈逵 / 曹魏賈逵),
  // 也有导入期两批花名册重叠留下的同一个人(杜預、嵇康、阮籍…在三国册记「群」、
  // 两晋册记「晋」)。分辨这两类要逐条史料判断,而合并是不可逆的 ——
  // 卡 id 从池子里消失,玩家收藏里的那张就静默蒸发。
  //
  // 所以这里不断言「没有重名」(那是假的),而是**钉住数量**:
  // 现状可以接受,但不能在没人注意的时候变多。
  // 界面上这些卡会带朝代标注(见 CardFace 的 dynastyTag),所以玩家分得清。
  it('数量被钉住 —— 变多说明又导入了一批重叠的花名册', () => {
    expect(AMBIGUOUS_NAMES.size).toBe(36)
  })

  it('每一个重名都必须能靠朝代或身材区分,否则界面上无法分辨', () => {
    const byName = new Map<string, CardDef[]>()
    for (const c of COLLECTIBLE_CARDS) {
      if (!AMBIGUOUS_NAMES.has(c.name.zh)) continue
      const list = byName.get(c.name.zh) ?? []
      list.push(c)
      byName.set(c.name.zh, list)
    }
    const indistinguishable: string[] = []
    for (const [name, cards] of byName) {
      const keys = new Set(cards.map((c) => `${c.dynasty}/${c.cost}/${c.attack}/${c.health}`))
      if (keys.size < cards.length) indistinguishable.push(name)
    }
    // 这一条现在是绿的。将来它红了,说明有两张卡在玩家眼里**完全一样** ——
    // 那才是真正必须合并的情况。
    expect(indistinguishable).toEqual([])
  })
})
