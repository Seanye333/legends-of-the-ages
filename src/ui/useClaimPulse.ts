import { useEffect, useRef, useState } from 'react'

// 领取的统一仪式。
//
// 校场/每日/成就/图鉴四处的「领取」原来都是**按钮文字变一下就完了** ——
// 拿到东西的那一刻在画面上不存在。全局类 .claim-pulse(index.css)
// 让金环从按钮胀开 + 按钮自己弹一下;这里只管挂类与摘类。
//
// 重复触发:直接再挂同一个类不会重播动画,先摘一帧再挂回去。
export function useClaimPulse(): [string, () => void] {
  const [on, setOn] = useState(false)
  const timerRef = useRef(0)
  const rafRef = useRef(0)
  const fire = () => {
    window.clearTimeout(timerRef.current)
    cancelAnimationFrame(rafRef.current)
    setOn(false)
    rafRef.current = requestAnimationFrame(() => {
      setOn(true)
      timerRef.current = window.setTimeout(() => setOn(false), 650)
    })
  }
  useEffect(
    () => () => {
      window.clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    },
    [],
  )
  return [on ? 'claim-pulse' : '', fire]
}
