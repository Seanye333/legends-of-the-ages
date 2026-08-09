import { describe, expect, it } from 'vitest'
import { LETHAL_PUZZLES } from './lethalPuzzles'
import { LETHAL_PUZZLE_ID_SET, LETHAL_PUZZLE_IDS } from './lethalIndex'

// 轻量索引与真数据的对拍 —— 那份索引存在的前提。
// 理由与 historyIndex.test.ts 一字不差:手写的投影会烂,而烂法都是不崩不红的。
// 少一道 → 「全套通关」永远凑不齐;多一道 → 那道题的首解功勋发不出来。
//
// 测试里引重的那一份没关系:测试不进包。索引整个的用处就是让**首屏**不必加载它。

describe('斩杀谜题轻量索引', () => {
  it('id 一道不多一道不少,顺序也一样', () => {
    expect([...LETHAL_PUZZLE_IDS]).toEqual(LETHAL_PUZZLES.map((p) => p.id))
  })

  it('Set 与数组是同一批 id', () => {
    // 两份东西就有两处会走样。这条盯的是「派生的那份没漏」。
    expect(LETHAL_PUZZLE_ID_SET.size).toBe(LETHAL_PUZZLE_IDS.length)
    for (const id of LETHAL_PUZZLE_IDS) expect(LETHAL_PUZZLE_ID_SET.has(id)).toBe(true)
  })

  it('真数据里没有重复 id —— 有的话上面两条会一起说谎', () => {
    // Set 的 size 对不上时,分不清是索引抄漏了还是源数据本来就重。
    expect(new Set(LETHAL_PUZZLES.map((p) => p.id)).size).toBe(LETHAL_PUZZLES.length)
  })
})
