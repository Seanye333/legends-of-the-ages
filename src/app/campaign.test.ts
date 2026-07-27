// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useCampaign } from './campaignStore'
import { useCollection } from './collectionStore'
import { BOSSES, bossTrial } from '../content/campaign'

const FIRST = BOSSES[0].id
const SECOND = BOSSES[1].id

beforeEach(() => {
  localStorage.clear()
  useCampaign.setState({ cleared: [], trialsCleared: [], active: null, activeTrial: false })
  useCollection.setState({ merit: 0 })
})

describe('冒险进度', () => {
  it('线性解锁:通了第一关才能打第二关', () => {
    const c = useCampaign.getState()
    expect(c.isUnlocked(FIRST)).toBe(true)
    expect(c.isUnlocked(SECOND)).toBe(false)
    c.begin(FIRST)
    c.settle(true)
    expect(useCampaign.getState().isUnlocked(SECOND)).toBe(true)
  })

  it('首通发奖,重打不发', () => {
    const c = useCampaign.getState()
    c.begin(FIRST)
    expect(c.settle(true)).not.toBeNull()
    useCampaign.getState().begin(FIRST)
    expect(useCampaign.getState().settle(true)).toBeNull()
  })
})

describe('关底试炼', () => {
  it('没通关就没有试炼 —— 它是第二种打法,不是另一条捷径', () => {
    const c = useCampaign.getState()
    expect(c.isTrialUnlocked(FIRST)).toBe(false)
    expect(c.begin(FIRST, true)).toBe(false)
    expect(useCampaign.getState().active).toBeNull()
  })

  it('通关后解锁,打赢发功勋(只发一次)', () => {
    const c = useCampaign.getState()
    c.begin(FIRST)
    c.settle(true)
    const merit0 = useCollection.getState().merit

    expect(useCampaign.getState().isTrialUnlocked(FIRST)).toBe(true)
    expect(useCampaign.getState().begin(FIRST, true)).toBe(true)
    const reward = useCampaign.getState().settle(true)
    expect(reward?.merit).toBe(bossTrial(FIRST)!.rewardMerit)
    expect(reward?.packs).toBe(0) // 试炼不给卡包 —— 卡包产出会冲击「一局一包」的基线
    expect(useCollection.getState().merit).toBe(merit0 + bossTrial(FIRST)!.rewardMerit)
    expect(useCampaign.getState().trialsCleared).toEqual([FIRST])

    // 再打一次不再发
    useCampaign.getState().begin(FIRST, true)
    expect(useCampaign.getState().settle(true)).toBeNull()
  })

  it('试炼失败不发奖,也不影响已有的通关记录', () => {
    const c = useCampaign.getState()
    c.begin(FIRST)
    c.settle(true)
    useCampaign.getState().begin(FIRST, true)
    expect(useCampaign.getState().settle(false)).toBeNull()
    expect(useCampaign.getState().cleared).toEqual([FIRST])
    expect(useCampaign.getState().trialsCleared).toEqual([])
  })

  // 试炼与常规关底共用 settle,最容易搞混的就是「试炼赢了算不算通关」。
  it('试炼不会替代常规通关 —— 两条账各记各的', () => {
    const c = useCampaign.getState()
    c.begin(FIRST)
    c.settle(true)
    useCampaign.getState().begin(FIRST, true)
    useCampaign.getState().settle(true)
    expect(useCampaign.getState().cleared).toEqual([FIRST]) // 没有被记两次
    expect(useCampaign.getState().isUnlocked(BOSSES[2].id)).toBe(false) // 也没有推进解锁
  })
})
