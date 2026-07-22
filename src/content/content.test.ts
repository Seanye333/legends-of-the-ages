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

describe('collectorNo 稳定性', () => {
  // 卡组码把每张卡编成它的 collectorNo(见 deckCode.ts —— 编 id 的话码长
  // 会到七八百字符,没法手工传递)。这意味着 **collectorNo 一旦漂移,
  // 所有已经分享出去的卡组码都会静默解出另一副牌** ——
  // 不报错、不提示,玩家导入的就是别人的牌。
  //
  // 从卡池里删卡是安全的(码里引用的卡不存在会明确报错),
  // 危险的是「删卡导致后面的卡编号前移」。2026-07-21 合并四张重复卡时
  // 验证过没有漂移(生成器用的是源花名册的固定索引,不是数组下标),
  // 这里把几张锚点钉住,让下次真漂了能立刻发现。
  const ANCHORS: [string, number][] = [
    ['cao-cao', 1],
    ['liu-bei', 10],
    ['guan-yu', 11],
    ['zhang-fei', 12],
    ['hist-jing-ke', 1000],
    ['hist-xiang-yu', 1165],
    ['strat-huo-ji', 9001],
    ['eq-teng-jia', 9114],
  ]

  it('锚点卡的 collectorNo 不能变 —— 变了等于所有分享出去的卡组码都作废', () => {
    for (const [id, no] of ANCHORS) {
      expect(CARDS_BY_ID[id], `锚点卡 ${id} 从卡池里消失了`).toBeDefined()
      expect(CARDS_BY_ID[id].collectorNo, `${id} 的 collectorNo 漂移了`).toBe(no)
    }
  })

  it('全卡池 collectorNo 唯一 —— 撞号会让两张卡共用一个码位', () => {
    const seen = new Map<number, string>()
    const clashes: string[] = []
    for (const c of CARDS) {
      const prev = seen.get(c.collectorNo)
      if (prev) clashes.push(`${c.collectorNo}: ${prev} / ${c.id}`)
      else seen.set(c.collectorNo, c.id)
    }
    expect(clashes).toEqual([])
  })
})

describe('第五卡包:抉择与发现', () => {
  const withChoose = COLLECTIBLE_CARDS.filter((c) => c.choose)
  const withDiscover = COLLECTIBLE_CARDS.filter((c) =>
    JSON.stringify(c).includes('"discover"'),
  )

  it('抉择卡每个模式至少两个,且都带脚本与标签', () => {
    for (const c of withChoose) {
      expect(c.choose!.modes.length, `${c.id} 抉择模式不足两个`).toBeGreaterThanOrEqual(2)
      for (const m of c.choose!.modes) {
        expect(m.script.ops.length, `${c.id} 有空模式`).toBeGreaterThan(0)
        expect(m.label.zh.length, `${c.id} 模式缺中文标签`).toBeGreaterThan(0)
        expect(m.label.en.length, `${c.id} 模式缺英文标签`).toBeGreaterThan(0)
      }
    }
    expect(withChoose.length).toBeGreaterThan(0)
  })

  it('抉择与连击互斥 —— 一张牌只能是其一(reducer 的脚本优先级依赖这条)', () => {
    for (const c of withChoose) {
      expect(c.combo, `${c.id} 同时有 choose 和 combo`).toBeUndefined()
    }
  })

  it('抉择卡不该再留残余的 battlecry/spell —— 效果全在 modes 里,留着是死代码', () => {
    for (const c of withChoose) {
      if (c.type === 'general') expect(c.battlecry, `${c.id} 残留 battlecry`).toBeUndefined()
      if (c.type === 'stratagem') expect(c.spell, `${c.id} 残留 spell`).toBeUndefined()
    }
  })

  it('发现必须是脚本的最后一个 op —— 之后的 op 永远不会跑(runScript 见挂起即 break)', () => {
    const scriptsOf = (c: CardDef) =>
      [c.battlecry, c.spell, c.combo, ...(c.choose?.modes.map((m) => m.script) ?? [])].filter(
        (s): s is NonNullable<typeof s> => s !== undefined,
      )
    for (const c of withDiscover) {
      for (const s of scriptsOf(c)) {
        const idx = s.ops.findIndex((o) => o.op === 'discover')
        if (idx < 0) continue
        expect(idx, `${c.id} 的发现 op 后面还有 op,永远跑不到`).toBe(s.ops.length - 1)
      }
    }
    expect(withDiscover.length).toBeGreaterThan(0)
  })
})
