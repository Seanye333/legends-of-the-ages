// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DiscoverOverlay } from './DiscoverOverlay'
import type { PendingChoice } from '../../engine/types'

afterEach(cleanup)

// 我方发现:三张真牌 —— 用真实卡池的 id,证明 CardFace 能渲染发现的候选
const MINE: PendingChoice = {
  player: 0,
  reason: 'discover',
  options: ['guan-yu', 'zhang-fei', 'liu-bei'],
}

// 对手发现:裁剪后 options 是空串(只知道数量)
const THEIRS: PendingChoice = {
  player: 1,
  reason: 'discover',
  options: ['', '', ''],
}

describe('发现浮层', () => {
  it('我方发现:三张候选都可点,点第 2 张回 index 1', async () => {
    const onPick = vi.fn()
    render(<DiscoverOverlay choice={MINE} mySeat={0} onPick={onPick} />)
    const picks = screen.getAllByRole('button')
    expect(picks).toHaveLength(3)
    await userEvent.click(picks[1])
    expect(onPick).toHaveBeenCalledWith(1)
  })

  it('对手发现:不给任何可点的牌,只显示牌背 —— 候选牌面绝不能出现', () => {
    const onPick = vi.fn()
    const { container } = render(<DiscoverOverlay choice={THEIRS} mySeat={0} onPick={onPick} />)
    // 一个可点按钮都没有(对手在挑,我不能替他点)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    // 三个牌背
    expect(container.querySelectorAll('[class*="cardBack"]')).toHaveLength(3)
  })

  it('对手发现空 options 时不渲染任何真实卡名', () => {
    // 这是裁剪层的最后一道 UI 保险:即便上游漏了,空串也不会渲染出牌
    render(<DiscoverOverlay choice={THEIRS} mySeat={0} onPick={vi.fn()} />)
    // 关羽/张飞/刘备的名字都不该出现在对手发现的视图里
    expect(screen.queryByText('關羽')).toBeNull()
    expect(screen.queryByText('張飛')).toBeNull()
  })
})
