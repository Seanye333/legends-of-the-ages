// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useExpedition } from './expeditionStore'
import { BOSSES } from '../content/campaign'

beforeEach(() => {
  localStorage.clear()
  useExpedition.setState({ run: null, bestDepth: 0, totalRuns: 0 })
})

describe('远征 run 状态机', () => {
  it('开局 → 打赢 → 亮宝物 → 选一个 → 进下一关', () => {
    const exp = useExpedition.getState()
    exp.start('liu-bei', Array(30).fill('c'))
    expect(useExpedition.getState().run?.stage).toBe(0)

    exp.settle(true) // 第 1 关胜
    const afterWin = useExpedition.getState().run!
    expect(afterWin.offered).toHaveLength(3) // 三选一
    expect(afterWin.stage).toBe(0) // 选完才进关
    expect(useExpedition.getState().bestDepth).toBe(1)

    const pick = afterWin.offered![0]
    useExpedition.getState().pickRelic(pick)
    const afterPick = useExpedition.getState().run!
    expect(afterPick.relics).toEqual([pick])
    expect(afterPick.offered).toBeNull()
    expect(afterPick.stage).toBe(1) // 进第 2 关
  })

  it('选宝物期间 settle 不生效(必须先选)', () => {
    const exp = useExpedition.getState()
    exp.start('liu-bei', Array(30).fill('c'))
    exp.settle(true)
    const before = useExpedition.getState().run
    useExpedition.getState().settle(true) // 正在选宝物,应无效
    expect(useExpedition.getState().run).toBe(before)
  })

  it('打输 → 远征结束,记录深度', () => {
    const exp = useExpedition.getState()
    exp.start('liu-bei', Array(30).fill('c'))
    exp.settle(true)
    useExpedition.getState().pickRelic(useExpedition.getState().run!.offered![0]) // 进第 2 关
    useExpedition.getState().settle(false) // 第 2 关败
    expect(useExpedition.getState().run).toBeNull()
    expect(useExpedition.getState().bestDepth).toBe(1) // 通了第 1 关
  })

  it('通关最后一关 → 满进度、无残留 run', () => {
    const exp = useExpedition.getState()
    exp.start('liu-bei', Array(30).fill('c'))
    // 直接把 run 推到最后一关
    useExpedition.setState({
      run: { heroId: 'liu-bei', deck: [], stage: BOSSES.length - 1, relics: [], offered: null, rngState: 1 },
    })
    useExpedition.getState().settle(true)
    expect(useExpedition.getState().run).toBeNull()
    expect(useExpedition.getState().bestDepth).toBe(BOSSES.length)
  })

  it('三选一排除已拥有的宝物', () => {
    const exp = useExpedition.getState()
    exp.start('liu-bei', Array(30).fill('c'))
    useExpedition.setState({
      run: { heroId: 'liu-bei', deck: [], stage: 0, relics: ['relic-jinpai'], offered: null, rngState: 42 },
    })
    useExpedition.getState().settle(true)
    const offered = useExpedition.getState().run!.offered!
    expect(offered).not.toContain('relic-jinpai') // 已有的不再出现
    expect(new Set(offered).size).toBe(offered.length) // 不重复
  })
})
