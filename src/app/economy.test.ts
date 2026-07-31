// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { rollDailyQuests } from './questStore'
import { ARENA_ENTRY_MERIT, arenaReward } from './arenaStore'
import { disenchantValue, rollPack, useCollection } from './collectionStore'
import { ACHIEVEMENTS } from './achievementStore'
import { BOSSES } from '../content/campaign'

// 经济与进度的数值闸门。
//
// 这一批全是「注释写了一个数、代码是另一个数」的问题 ——
// 而它们能漂这么久,正是因为没有任何一条测试盯着这些常量之间的关系。
// 下面每一条都对应一处实际修过的偏差。

describe('每日军令的卡包产出', () => {
  it('一天三条,总产出不超过封顶(注释说 4 包,从前实际能到 6)', () => {
    for (let i = 0; i < 400; i++) {
      const date = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10)
      const quests = rollDailyQuests(date)
      expect(quests, `${date} 应当恰好三条`).toHaveLength(3)
      const packs = quests.reduce((n, q) => n + q.reward, 0)
      expect(packs, `${date} 产出 ${packs} 包,超过封顶`).toBeLessThanOrEqual(4)
    }
  })

  it('三条任务玩法各异(同 kind 不重复)', () => {
    for (let i = 0; i < 120; i++) {
      const date = new Date(Date.UTC(2026, 5, 1 + i)).toISOString().slice(0, 10)
      const kinds = rollDailyQuests(date).map((q) => q.kind)
      expect(new Set(kinds).size).toBe(kinds.length)
    }
  })
})

describe('竞技场是功勋出口,不是兑换点', () => {
  // 一包的功勋价值随收藏完整度上升 —— 报名费必须按**成型玩家**校准。
  // 从前按「一包 ≈ 25 功勋」定的 100 费,对满收藏玩家是净赚。
  it('满收藏时,0 胜是净亏损', () => {
    let rng = 12345
    const rand = () => {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0
      return rng / 0x100000000
    }
    let total = 0
    const N = 4000
    for (let i = 0; i < N; i++) {
      // disenchantValue 收的是 **cardId**,不是 rarity —— 传错了会静默返回 0
      for (const id of rollPack(rand)) total += disenchantValue(id)
    }
    const perPack = total / N
    // 实测约 126 功勋/包;留宽区间,这里要钉的是「报名费高于它」
    expect(perPack).toBeGreaterThan(90)
    const zeroWin = arenaReward(0)
    expect(zeroWin.packs).toBe(1)
    const zeroWinValue = zeroWin.packs * perPack + zeroWin.merit
    expect(
      zeroWinValue,
      `0 胜净值 ${Math.round(zeroWinValue - ARENA_ENTRY_MERIT)} —— 报名费必须高于一包的折算价值`,
    ).toBeLessThan(ARENA_ENTRY_MERIT)
  })

  it('打满仍然是一笔大赚(否则没人会去)', () => {
    const full = arenaReward(12)
    expect(full.packs).toBeGreaterThanOrEqual(7)
    expect(full.merit).toBeGreaterThan(ARENA_ENTRY_MERIT * 2)
  })
})

describe('成就的顶格档要跟着内容量走', () => {
  // 关卡从 16 扩到 24 时,这三条成就的顶格没跟着改 ——
  // 表现是「打满了 24 关,成就却在第 16 条就满了」。
  const maxGoal = (idPrefix: string) =>
    Math.max(...ACHIEVEMENTS.filter((a) => a.id.startsWith(idPrefix)).map((a) => a.goal))

  it('试炼与连斩的顶格 = 关卡总数', () => {
    expect(maxGoal('ach-trial')).toBe(BOSSES.length)
    expect(maxGoal('ach-gauntlet')).toBe(BOSSES.length)
  })

  it('爬塔是无上限的,顶格不能停在早期层数', () => {
    expect(maxGoal('ach-tower')).toBeGreaterThanOrEqual(40)
  })
})

describe('清空本地进度', () => {
  beforeEach(() => localStorage.clear())

  it('删掉所有 qiangu- 键,但保留搬迁凭据', () => {
    // 复刻设置页那段逻辑的契约。从前它只删三个键,而按钮写的是「清空本地进度」。
    localStorage.setItem('qiangu-collection', '{}')
    localStorage.setItem('qiangu-campaign', '{}')
    localStorage.setItem('qiangu-tower', '{}')
    localStorage.setItem('qiangu-player-id', 'pid')
    localStorage.setItem('qiangu-profile-secret', 'sec')
    localStorage.setItem('unrelated-key', 'keep')

    const keep = new Set(['qiangu-player-id', 'qiangu-profile-secret'])
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('qiangu-') && !keep.has(k)) localStorage.removeItem(k)
    }

    expect(localStorage.getItem('qiangu-collection')).toBeNull()
    expect(localStorage.getItem('qiangu-campaign')).toBeNull()
    expect(localStorage.getItem('qiangu-tower')).toBeNull()
    // 凭据要留:清进度不该把云端那份变成孤儿
    expect(localStorage.getItem('qiangu-player-id')).toBe('pid')
    expect(localStorage.getItem('qiangu-profile-secret')).toBe('sec')
    // 别人的键不碰
    expect(localStorage.getItem('unrelated-key')).toBe('keep')
  })
})

describe('collectionStore 的初始状态仍然自洽', () => {
  it('新号带两包与六套预组的并集', () => {
    const s = useCollection.getState()
    expect(s.packs).toBeGreaterThan(0)
    expect(Object.keys(s.owned).length).toBeGreaterThan(0)
  })
})
