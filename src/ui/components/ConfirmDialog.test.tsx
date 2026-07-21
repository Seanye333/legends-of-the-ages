// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './ConfirmDialog'

afterEach(cleanup)

const setup = (over: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) => {
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  render(
    <ConfirmDialog
      title="确定认输?"
      body="认输将立即判负。"
      confirmLabel="认输"
      cancelLabel="继续对局"
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...over}
    />,
  )
  return { onConfirm, onCancel }
}

// 这是全站第一个「正经」模态,后面的弹窗都照它抄 —— 它的礼仪必须被钉住。
describe('ConfirmDialog 的模态礼仪', () => {
  it('是带标题与描述的 aria 模态', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBeTruthy()
    expect(dialog.getAttribute('aria-describedby')).toBeTruthy()
  })

  it('默认焦点落在取消上 —— 误触回车不该直接认输', () => {
    setup()
    expect(document.activeElement?.textContent).toBe('继续对局')
  })

  it('Esc 关闭', async () => {
    const { onCancel, onConfirm } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Tab 在框内循环,不会跑到背景页面上', async () => {
    setup()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(2)
    // 从最后一个再 Tab 应该回到第一个
    buttons[buttons.length - 1].focus()
    await userEvent.tab()
    expect(document.activeElement).toBe(buttons[0])
    // Shift+Tab 从第一个回到最后一个
    await userEvent.tab({ shift: true })
    expect(document.activeElement).toBe(buttons[buttons.length - 1])
  })

  it('点确认才触发确认', async () => {
    const { onConfirm, onCancel } = setup()
    await userEvent.click(screen.getByRole('button', { name: '认输' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('点背景遮罩等于取消', async () => {
    const { onCancel } = setup()
    await userEvent.click(screen.getByRole('dialog').parentElement!)
    expect(onCancel).toHaveBeenCalled()
  })
})
