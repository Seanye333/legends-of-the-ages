import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { LORE_OVERRIDES } from './overrides/lore-quotes'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'
import { LORE } from './generated/lore.gen'

// 手写列传补遗的闸门。这一层最容易出的问题不是 bug,是**编史料** ——
// 而编出来的东西不报错、不崩溃,只是让整个游戏不值得信。
// 所以这里守的是「写了的必须能核对」与「该空的必须空着」。

describe('手写名言与台词', () => {
  it('每条都指向真实存在的卡', () => {
    for (const id of Object.keys(LORE_OVERRIDES)) {
      expect(CARDS_BY_ID[id], `${id} 不在卡池里`).toBeTruthy()
    }
  })

  it('中英双语都齐 —— 只写一半等于英文玩家看不到', () => {
    for (const [id, ov] of Object.entries(LORE_OVERRIDES)) {
      for (const key of ['quote', 'line'] as const) {
        const v = ov[key]
        if (!v) continue
        expect(v.zh.trim(), `${id}.${key} 缺中文`).not.toBe('')
        expect(v.en.trim(), `${id}.${key} 缺英文`).not.toBe('')
      }
    }
  })

  it('每条名言在源码里都标了出处 —— 核不了的不许写', () => {
    // 出处写在注释里(不进游戏内文案)。这一条检查的是:
    // 凡是给了 quote 的 id,它上面若干行内必须有一条注释 ——
    // 「拿不准就空着」这条规矩只有靠它才守得住。
    const src = readFileSync(new URL('./overrides/lore-quotes.ts', import.meta.url), 'utf8')
    const lines = src.split('\n')
    for (const [id, ov] of Object.entries(LORE_OVERRIDES)) {
      if (!ov.quote) continue
      const at = lines.findIndex((l) => l.includes(`'${id}': {`))
      expect(at, `源码里找不到 ${id}`).toBeGreaterThan(-1)
      // 条目开头几行里必须有一条**像样的**出处注释。
      // 不强求书名号 —— 出处不都是书:雍正那条是印文与朱批,蔡锷那条是通电。
      // 所以只要求「有注释,且写了至少八个字」:它拦的是「一句话都没写就贴上来」。
      const head = lines.slice(at, at + 4)
      const note = head.map((l) => l.match(/\/\/\s*(.*)$/)?.[1] ?? '').find((x) => x.length >= 8)
      expect(note, `${id} 的名言没有标出处`).toBeTruthy()
    }
  })

  it('中文里不许混进英文单词 —— 手写时真的会漏', () => {
    // 实际发生过两次:「睢陽still在」「天下無defeat之理」——
    // 边写中英双语边打字,英文那半会串到中文里来。
    // 类型系统与既有测试都拦不住(它是合法字符串),但玩家一眼就看见。
    for (const [id, ov] of Object.entries(LORE_OVERRIDES)) {
      for (const key of ['quote', 'line', 'poem'] as const) {
        const zh = ov[key]?.zh
        if (!zh) continue
        expect(zh, `${id}.${key} 的中文里混进了英文`).not.toMatch(/[A-Za-z]{2,}/)
      }
    }
  })

  // 撞键在这张表上**完全静默**:对象字面量里写两次 'sun-jian',
  // 后写的整条盖掉先写的,而 tsc 对 Record<string, T> 的重复字符串键不报错
  //(实测:第三批补名言时就这么把孙坚原有的台词冲掉了,是这条闸门加进来之前发生的)。
  // 表现和卡牌 id 撞车同一类 —— 不崩、不红、只是有东西不见了。
  it('表里没有重复的 id —— 后写的会静默盖掉先写的', () => {
    const src = readFileSync(new URL('./overrides/lore-quotes.ts', import.meta.url), 'utf8')
    const seen = new Map<string, number>()
    for (const m of src.matchAll(/^\s{2}'([a-z0-9-]+)':\s*\{/gm)) {
      seen.set(m[1], (seen.get(m[1]) ?? 0) + 1)
    }
    expect([...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)).toEqual([])
  })

  // 手写生平只补**源头真的没有**的那几位。写在源头已有的人身上会静默盖掉真传 ——
  // 而且下一次姊妹仓库补了传,我们这条假的还会继续盖着,没人会发现。
  it('手写生平不许盖住生成层已有的传', () => {
    const shadowed = Object.entries(LORE_OVERRIDES)
      .filter(([id, ov]) => ov.bio && LORE[id]?.bio?.zh)
      .map(([id]) => id)
    expect(shadowed).toEqual([])
  })

  it('本作自造的卡不许有名言 —— 它们没有史料', () => {
    // 說客(纵横家的泛称)与長蛇陣旗(阵形旗)是我们造的,给风味可以,给「名言」不行
    for (const id of ['gen-fame-lobbyist', 'gen-chang-she-qi']) {
      expect(LORE_OVERRIDES[id]?.quote, `${id} 是自造卡,不该有名言`).toBeUndefined()
    }
  })

  it('补完之后传奇的名言覆盖率确实上去了', () => {
    const legends = COLLECTIBLE_CARDS.filter((c) => c.type === 'general' && c.rarity === 'legendary')
    const has = legends.filter((c) => LORE[c.id]?.quote?.zh || LORE_OVERRIDES[c.id]?.quote?.zh)
    // 数字会随内容增长,这里只钉一条下限 —— 掉下去说明有人删了东西
    expect(has.length / legends.length).toBeGreaterThan(0.6)
  })
})
