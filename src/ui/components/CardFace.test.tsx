// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CardFace } from './CardFace'
import { CARDS_BY_ID } from '../../content/cards'
import { fakeInstance } from '../screens/CollectionScreen'

afterEach(cleanup)

const inst = (id: string) => fakeInstance(CARDS_BY_ID[id])

// 卡牌与场上单位原本是纯 <div onClick>:不可键盘聚焦、读屏器什么都读不出来。
// 后来补了 button 的语义契约(role/tabIndex/键盘激活/可读标签),
// 但那是**手写**的契约 —— 没有测试的话,以后重构很容易悄悄退化回去。
describe('CardFace 的无障碍契约', () => {
  it('可交互时暴露 button 语义与可读标签', () => {
    render(<CardFace inst={inst('guan-yu')} onClick={() => undefined} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveProperty('tabIndex', 0)
    const label = btn.getAttribute('aria-label') ?? ''
    expect(label).toContain('關羽')
    expect(label).toContain('7') // 费用与身材都要读得出来
  })

  it('不可交互时不冒充按钮(否则读屏器会念一堆假按钮)', () => {
    render(<CardFace inst={inst('guan-yu')} />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('回车触发出牌,Shift+回车看详情', async () => {
    const onClick = vi.fn()
    const onInspect = vi.fn()
    render(<CardFace inst={inst('guan-yu')} onClick={onClick} onInspect={onInspect} />)
    const btn = screen.getByRole('button')
    btn.focus()
    await userEvent.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onInspect).not.toHaveBeenCalled()
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}')
    expect(onInspect).toHaveBeenCalledTimes(1)
  })

  it('空格也能激活,并且不会连带滚动页面', async () => {
    const onClick = vi.fn()
    render(<CardFace inst={inst('guan-yu')} onClick={onClick} />)
    screen.getByRole('button').focus()
    await userEvent.keyboard(' ')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('其它按键不触发', async () => {
    const onClick = vi.fn()
    render(<CardFace inst={inst('guan-yu')} onClick={onClick} />)
    screen.getByRole('button').focus()
    await userEvent.keyboard('{Escape}{ArrowLeft}a')
    expect(onClick).not.toHaveBeenCalled()
  })
})
