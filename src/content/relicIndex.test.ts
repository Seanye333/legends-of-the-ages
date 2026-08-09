import { describe, expect, it } from 'vitest'
import { RELICS } from './relics'
import { RELIC_INDEX, RELIC_RARITY_WEIGHT, type RelicRarityCode } from './relicIndex'

// 轻量索引与真数据的对拍 —— 那份索引存在的前提。
//
// 这一份比 history/campaign 那两份更要紧一档,因为**顺序影响的是抽取结果**:
// `expeditionStore.offerRelics` 用一个从 rngState 推出的 LCG 按数组顺序累加权重,
// 顺序一变,同一个 rngState 抽到的就是另外三件 ——
// 进行中的远征在玩家眼前换了一批宝物,而且没有任何东西会报错。

const CODE: Record<string, RelicRarityCode> = { rare: 'r', epic: 'e', legendary: 'l' }

describe('远征宝物轻量索引', () => {
  it('件数、id、顺序**逐位**与真数据一致', () => {
    expect(RELIC_INDEX.map((r) => r.id)).toEqual(RELICS.map((r) => r.id))
  })

  it('稀有度逐位一致', () => {
    expect(RELIC_INDEX.map((r) => r.rarity)).toEqual(RELICS.map((r) => CODE[r.rarity]))
  })

  it('权重表覆盖到每一种稀有度 —— 漏一种的表现是那一类宝物权重变 undefined', () => {
    // `undefined` 参与 `roll -= w` 会让整个累加变 NaN,于是抽取悄悄退化成
    // 「永远取第一件」。这条盯的就是它。
    for (const r of RELIC_INDEX) {
      expect(RELIC_RARITY_WEIGHT[r.rarity], `${r.id} 的稀有度没有权重`).toBeTypeOf('number')
    }
    expect(new Set(RELIC_INDEX.map((r) => r.rarity)).size).toBe(
      new Set(RELICS.map((r) => r.rarity)).size,
    )
  })

  it('真数据里没有重复 id', () => {
    expect(new Set(RELICS.map((r) => r.id)).size).toBe(RELICS.length)
  })
})
