import { describe, expect, it } from 'vitest'
import { BOSSES, bossTrial } from './campaign'
import {
  CAMPAIGN_BOSS_COUNT,
  CAMPAIGN_BOSS_IDS,
  CAMPAIGN_INDEX,
  type CampaignIndexEntry,
} from './campaignIndex'

// 轻量索引与真数据的对拍 —— 那份索引存在的前提。
// 理由与 historyIndex.test.ts 相同:手写的投影会烂,而烂法全是不崩不红的。
// 这一份尤其要紧,因为**顺序也是数据**:解锁判定问的是「这一关排第几」,
// 顺序错了的表现是某一关永远解锁不了,而没有任何东西会报错。

const DERIVED: Record<string, CampaignIndexEntry> = Object.fromEntries(
  BOSSES.map((b) => {
    const entry: CampaignIndexEntry = { merit: b.rewardMerit, packs: b.rewardPacks }
    const t = bossTrial(b.id)
    if (t) entry.trial = t.rewardMerit
    return [b.id, entry]
  }),
)

describe('冒险关底轻量索引', () => {
  it('关数一关不多一关不少,而且**顺序一样** —— 顺序就是解锁次序', () => {
    expect([...CAMPAIGN_BOSS_IDS]).toEqual(BOSSES.map((b) => b.id))
  })

  it('每一关的奖励与试炼都与定义一致', () => {
    expect(CAMPAIGN_INDEX).toEqual(DERIVED)
  })

  it('总关数就是真数据的条数', () => {
    expect(CAMPAIGN_BOSS_COUNT).toBe(BOSSES.length)
  })

  it('试炼是「有才写」—— 没有的关不许留一个 undefined 键', () => {
    // `{trial: undefined}` 和没有这个键在 `Boolean()` 下等价,只靠 toEqual 抓不到。
    for (const id of CAMPAIGN_BOSS_IDS) {
      expect(Object.hasOwn(CAMPAIGN_INDEX[id], 'trial'), `${id}: trial 应当有才写`).toBe(
        Boolean(bossTrial(id)),
      )
    }
  })

  it('反过来也验:定义里有试炼的关,索引里必须写着', () => {
    for (const b of BOSSES) {
      if (bossTrial(b.id)) {
        expect(CAMPAIGN_INDEX[b.id]?.trial, `${b.id} 有试炼而索引没写`).toBeTypeOf('number')
      }
    }
  })
})
