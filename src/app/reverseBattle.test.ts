// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useHistory } from './historyStore'
import { useCollection } from './collectionStore'
import { REVERSE_BATTLES, HISTORY_BATTLES } from '../content/historyBattles'
import { BOSSES } from '../content/campaign'

beforeEach(() => {
  localStorage.clear()
  useHistory.setState({ cleared: [], reversed: [], active: null, activeReverse: false })
  useCollection.setState({ merit: 0 })
})

describe('逆位挑战内容', () => {
  // 逆位不是把字段对调就有的:名局的数据里只有敌方是完整定义的,
  // 玩家那一侧只有「你自己的卡组」。所以它需要一个真实存在的对手。
  it('每一条逆位都指向真实的名局与真实的关底', () => {
    for (const r of REVERSE_BATTLES) {
      expect(HISTORY_BATTLES.some((b) => b.id === r.battleId), r.battleId).toBe(true)
      expect(BOSSES.some((b) => b.id === r.bossId), r.bossId).toBe(true)
    }
  })

  it('battleId 唯一', () => {
    const ids = REVERSE_BATTLES.map((r) => r.battleId)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('逆位进度', () => {
  const B = REVERSE_BATTLES[0].battleId

  it('没正位通关就打不了逆位', () => {
    expect(useHistory.getState().isReverseUnlocked(B)).toBe(false)
    expect(useHistory.getState().begin(B, true)).toBe(false)
  })

  it('正位通关后解锁,首成发功勋(不发卡包)', () => {
    useHistory.getState().begin(B)
    useHistory.getState().settle(true)
    const merit0 = useCollection.getState().merit

    expect(useHistory.getState().isReverseUnlocked(B)).toBe(true)
    expect(useHistory.getState().begin(B, true)).toBe(true)
    const r = useHistory.getState().settle(true)
    expect(r?.packs).toBe(0)
    expect(r!.merit).toBeGreaterThan(0)
    expect(useCollection.getState().merit).toBe(merit0 + r!.merit)
    expect(useHistory.getState().reversed).toEqual([B])
  })

  it('逆位不算正位通关 —— 两条账各记各的', () => {
    useHistory.getState().begin(B)
    useHistory.getState().settle(true)
    useHistory.getState().begin(B, true)
    useHistory.getState().settle(true)
    expect(useHistory.getState().cleared).toEqual([B])
  })

  it('逆位重打不再发奖', () => {
    useHistory.getState().begin(B)
    useHistory.getState().settle(true)
    useHistory.getState().begin(B, true)
    useHistory.getState().settle(true)
    useHistory.getState().begin(B, true)
    expect(useHistory.getState().settle(true)).toBeNull()
  })
})
