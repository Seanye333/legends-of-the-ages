import { useEffect, useRef } from 'react'

// 弹层的键盘契约:Esc 关闭 + 焦点困在层内 + 关闭后焦点回到原处。
//
// 【为什么要收成一个 hook】
// 全站 15 个覆盖层里,只有 ConfirmDialog 一个实现了这三件事;其余十来个
// (每日军令、功名簿、战绩、榜单、每日名将、墓地、联机、列传详情、
// 名局简报、冒险简报、回放…)都是一句 `<div onClick={onClose}>` ——
// 用鼠标点背景能关,用键盘**根本出不去**:Tab 会一路走到弹层后面那一屏的
// 按钮上,而那些按钮此刻在视觉上被遮住了。
//
// 【为什么焦点要还回去】
// 不还的话焦点会掉回 <body>,下一次 Tab 从页面最顶上重新开始 ——
// 对读屏器用户来说,关掉一个弹层等于回到了页首。
export function useDialog(onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement>(null)
  // 打开这一刻的焦点。存在 ref 里而不是闭包里 —— 它要活到卸载那一刻。
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    restoreRef.current = document.activeElement as HTMLElement | null
    const panel = ref.current
    // 先把焦点送进弹层。没有可聚焦元素时聚焦容器本身(它带 tabIndex={-1})。
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null)
    const first = focusables()[0]
    if (first) first.focus()
    else panel?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const firstEl = list[0]
      const lastEl = list[list.length - 1]
      // 环形:最后一个再 Tab 回到第一个,反之亦然
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      restoreRef.current?.focus?.()
    }
  }, [onClose])

  return ref
}
