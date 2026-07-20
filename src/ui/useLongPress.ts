import { useRef } from 'react'

// 长按识别:按住 ≥350ms 触发 onLongPress(炉石式按住看牌),
// 快速点击仍走 onClick。移动/离开取消,避免拖动误触。
export function useLongPress(onLongPress: () => void, delayMs = 350) {
  const timerRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const clear = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  return {
    // 结合到元素:{...longPress.handlers};onClick 里先问 longPress.consumed()
    handlers: {
      onPointerDown: () => {
        firedRef.current = false
        clear()
        timerRef.current = window.setTimeout(() => {
          firedRef.current = true
          onLongPress()
        }, delayMs)
      },
      onPointerUp: clear,
      onPointerLeave: clear,
      onPointerMove: clear,
      onContextMenu: (e: { preventDefault(): void }) => {
        // 移动端长按会弹系统菜单,屏蔽
        e.preventDefault()
      },
    },
    // 长按已触发时,点击事件应被吞掉
    consumed: () => {
      const fired = firedRef.current
      firedRef.current = false
      return fired
    },
  }
}
