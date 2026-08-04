import { describe, expect, it } from 'vitest'
import { BATTLE_INDEX, LORE } from './generated/lore.gen'
import { CARDS_BY_ID } from './cards'

// 战役表是**手写**的(哪些字算一场战役没法自动判断 —— 「攻」「破」到处都是)。
// 手写清单在这个仓库有两种烂法,都不会报错:
//   · 写了没人读 —— 索引在界面上是空的
//   · 读了没内容 —— 某一场只连出零个或一个人,点开是空屏
// 生成层已经把「连不出两个人的」滤掉了,这里守的是**滤完之后还剩不剩东西**,
// 以及索引里的 id 是不是都真实存在(源数据换一批人名,索引会静默变空)。
describe('战役索引', () => {
  it('有规模 —— 索引空了不能静默通过', () => {
    expect(BATTLE_INDEX.length).toBeGreaterThanOrEqual(20)
    expect(BATTLE_INDEX.reduce((n, b) => n + b.ids.length, 0)).toBeGreaterThan(120)
  })

  it('每一场都真的连出了人,且不重不缺', () => {
    for (const b of BATTLE_INDEX) {
      expect(b.ids.length, `${b.name.zh} 只有 ${b.ids.length} 人`).toBeGreaterThanOrEqual(2)
      expect(new Set(b.ids).size, `${b.name.zh} 有重复 id`).toBe(b.ids.length)
      for (const id of b.ids) {
        expect(CARDS_BY_ID[id], `${b.name.zh} → ${id} 不在卡池里`).toBeDefined()
        // 索引是从生平原文反查的 —— 没有生平的人不可能出现在里面
        expect(LORE[id]?.bio?.zh, `${b.name.zh} → ${id} 没有生平`).toBeTruthy()
      }
    }
  })

  it('中英双语都齐 —— 只写一半等于英文玩家看到中文', () => {
    for (const b of BATTLE_INDEX) {
      expect(b.name.zh.length, JSON.stringify(b.name)).toBeGreaterThan(1)
      expect(b.name.en.length, JSON.stringify(b.name)).toBeGreaterThan(1)
      expect(b.name.en, `${b.name.zh} 的英文里有汉字`).not.toMatch(/[一-鿿]/)
    }
  })

  it('名字不重复 —— 两场同名会让展开的那一组张冠李戴', () => {
    const names = BATTLE_INDEX.map((b) => b.name.zh)
    expect(names.length).toBe(new Set(names).size)
  })
})
