// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useBossRush, BOSS_RUSH_HEAL } from './bossRushStore'
import { useCollection } from './collectionStore'
import { BOSSES } from '../content/campaign'

beforeEach(() => {
  localStorage.clear()
  useBossRush.setState({ stage: 0, hp: null, active: false, best: 0, cleared: false })
  useCollection.setState({ merit: 0 })
})

describe('群雄连斩', () => {
  // 血量结转是这个模式的全部 —— 不结转它就只是「冒险再打一遍」
  it('打赢结转血量,并回一点点', () => {
    const s = useBossRush.getState()
    s.begin(30)
    s.settle(true, 18)
    expect(useBossRush.getState().stage).toBe(1)
    expect(useBossRush.getState().hp).toBe(18 + BOSS_RUSH_HEAL)
  })

  it('倒下从头再来,但最远记录保留', () => {
    useBossRush.setState({ stage: 5, hp: 12 })
    useBossRush.getState().begin(30)
    useBossRush.getState().settle(false, 0)
    expect(useBossRush.getState().stage).toBe(0)
    expect(useBossRush.getState().hp).toBeNull()
    expect(useBossRush.getState().best).toBe(5)
  })

  it('打完最后一关算通关,奖励只发一次', () => {
    useBossRush.setState({ stage: BOSSES.length - 1, hp: 9 })
    useBossRush.getState().begin(30)
    const r = useBossRush.getState().settle(true, 3)
    expect(r?.finished).toBe(true)
    expect(r?.merit).toBe(800)
    expect(useCollection.getState().merit).toBe(800)
    expect(useBossRush.getState().cleared).toBe(true)

    // 第二次通关不再发
    useBossRush.setState({ stage: BOSSES.length - 1, hp: 9 })
    useBossRush.getState().begin(30)
    expect(useBossRush.getState().settle(true, 3)?.merit).toBe(0)
    expect(useCollection.getState().merit).toBe(800)
  })

  it('血量最低结转 1 点 —— 不会因为舍入把人卡死在 0 血开局', () => {
    useBossRush.getState().begin(30)
    useBossRush.getState().settle(true, 0)
    expect(useBossRush.getState().hp).toBe(1 + BOSS_RUSH_HEAL)
  })
})
