import { describe, expect, it } from 'vitest'
import {
  DIVERGENCE_BY_BATTLE,
  HISTORY_BATTLES,
  REVERSE_BY_BATTLE,
} from './historyBattles'
import { HISTORY_BATTLE_COUNT, HISTORY_INDEX, type HistoryIndexEntry } from './historyIndex'

// 轻量索引与真数据的对拍。
//
// 【这道闸门是那份索引存在的前提】
// `historyIndex.ts` 是手写的,而手写的投影会烂 —— 加一场名局、改一次奖励、
// 给某一场补上逆位,只要忘了同步,表现都是**不崩不红**的那一类:
// 标题页的分母少一场、通关少发一个卡包、逆位入口点不开。
// 所以这里逐场逐字段两边对齐,四种走样都当场红。
//
// 而它**不能**换成「从 historyBattles 现算」—— 那样就把 35.4KB 的定义
// 又拉回首屏了,索引也就白抽了(它整个的用处就是让首屏不必加载定义)。
// 测试里引重的那一份是没关系的:测试不进包。

/** 从真数据现算出来的那一份 —— 索引应当与它一字不差。 */
const DERIVED: Record<string, HistoryIndexEntry> = Object.fromEntries(
  HISTORY_BATTLES.map((b) => {
    const entry: HistoryIndexEntry = { merit: b.rewardMerit, packs: b.rewardPacks }
    const rev = REVERSE_BY_BATTLE[b.id]
    const div = DIVERGENCE_BY_BATTLE[b.id]
    if (rev) entry.reverse = rev.rewardMerit
    if (div) entry.diverge = div.rewardMerit
    return [b.id, entry]
  }),
)

describe('名局轻量索引', () => {
  it('场次一场不多一场不少,而且顺序也一样', () => {
    // 顺序也钉:标题页的分母只看条数,但「第几场」在别处是有意义的,
    // 而 Object.keys 的顺序就是写进去的顺序。
    expect(Object.keys(HISTORY_INDEX)).toEqual(HISTORY_BATTLES.map((b) => b.id))
  })

  it('每一场的奖励、逆位、分歧点都与定义一致', () => {
    expect(HISTORY_INDEX).toEqual(DERIVED)
  })

  it('总场数就是真数据的条数', () => {
    expect(HISTORY_BATTLE_COUNT).toBe(HISTORY_BATTLES.length)
  })

  it('逆位/分歧点是「有才写」—— 没有的场次不许留一个 undefined 键', () => {
    // `{reverse: undefined}` 和没有这个键在 toEqual 下不等价,
    // 但在 `Boolean(entry.reverse)` 下等价 —— 也就是说抄错了不一定被上面那条抓到。
    // 这一条盯的是形状本身。
    for (const [id, e] of Object.entries(HISTORY_INDEX)) {
      expect(Object.hasOwn(e, 'reverse'), `${id}: reverse 应当有才写`).toBe(
        Boolean(REVERSE_BY_BATTLE[id]),
      )
      expect(Object.hasOwn(e, 'diverge'), `${id}: diverge 应当有才写`).toBe(
        Boolean(DIVERGENCE_BY_BATTLE[id]),
      )
    }
  })

  it('反过来也验:定义里有逆位/分歧点的场次,索引里必须写着', () => {
    // 上面那条从索引出发,漏一整场就查不到 —— 这一条从真数据出发补上。
    for (const id of Object.keys(REVERSE_BY_BATTLE)) {
      expect(HISTORY_INDEX[id]?.reverse, `${id} 有逆位而索引没写`).toBeTypeOf('number')
    }
    for (const id of Object.keys(DIVERGENCE_BY_BATTLE)) {
      expect(HISTORY_INDEX[id]?.diverge, `${id} 有分歧点而索引没写`).toBeTypeOf('number')
    }
  })
})
