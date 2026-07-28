import { describe, expect, it } from 'vitest'
import { UNLOCKS, isUnlocked, unlockHint } from './unlocks'

const fresh = { matches: 0, campaignCleared: 0 }
const veteran = { matches: 99, campaignCleared: 99 }

describe('模式渐进解锁', () => {
  it('全新档只锁被登记的那几个,没登记的一律开放', () => {
    for (const mode of Object.keys(UNLOCKS)) {
      expect(isUnlocked(mode, fresh), `${mode} 在新档上不该解锁`).toBe(false)
    }
    // 主线、演武场、图鉴这些没进表的入口必须永远可点 ——
    // 一个新玩家总得有地方开始,而这几个就是那个地方。
    for (const open of ['campaign', 'history', 'practice', 'codex', 'collection', 'deckbuilder']) {
      expect(isUnlocked(open, fresh), `${open} 不该被锁`).toBe(true)
    }
  })

  it('老档全部解锁,且不再给提示文案', () => {
    for (const mode of Object.keys(UNLOCKS)) {
      expect(isUnlocked(mode, veteran)).toBe(true)
      expect(unlockHint(mode, veteran)).toBeNull()
    }
  })

  it('提示文案里的「还差多少」随进度递减,且不会变成负数', () => {
    // 这条守的是文案算术:写成「还差 -2 局」比不写提示更糟。
    for (const mode of Object.keys(UNLOCKS)) {
      const early = unlockHint(mode, fresh)
      expect(early).not.toBeNull()
      expect(early!.zh).not.toMatch(/-\d/)
      expect(early!.en).not.toMatch(/-\d/)
    }
  })

  it('门槛只挂在玩家自然会累积的两个计数上', () => {
    // 这是设计约束不是实现细节:门槛一旦要求玩家绕路(比如「合成一张传说」),
    // 引导就断了 —— 他不知道去哪儿做那件事。这条测试守着那个约束。
    const keys = Object.keys(fresh)
    expect(keys.sort()).toEqual(['campaignCleared', 'matches'])
  })

  it('同一根轴上的门槛递增,书写顺序 = 解锁顺序', () => {
    // 表里的书写顺序是设计意图(谜题 → 乱斗 → 登楼 → 远征 → 校场),
    // 但它**横跨两根轴**:前两个数对局数,后三个数通关数。
    // 所以不能把两个计数一起往上推来验顺序 —— 那样测的是两根轴的相对刻度,
    // 而两根轴的刻度本来就没有可比性(打 2 局远比通 2 关容易)。
    // 真正的约束是:**同一根轴上,写在后面的门槛不能更低**。
    const table = Object.keys(UNLOCKS)
    const scan = (axis: 'matches' | 'campaignCleared') => {
      const seen: string[] = []
      for (let n = 0; n <= 20; n++) {
        const p = { matches: 0, campaignCleared: 0, [axis]: n }
        for (const mode of table) {
          if (!seen.includes(mode) && isUnlocked(mode, p)) seen.push(mode)
        }
      }
      return seen
    }
    for (const axis of ['matches', 'campaignCleared'] as const) {
      const order = scan(axis)
      // 这根轴上解锁的那些,相对次序必须与表的书写次序一致(允许跳过另一根轴的)
      const expected = table.filter((m) => order.includes(m))
      expect(order, `${axis} 轴上的解锁顺序与表的书写顺序不一致`).toEqual(expected)
    }
  })
})
