import { useEffect, useState } from 'react'
import styles from './TargetArrow.module.css'

interface TargetArrowProps {
  // 起点元素的 data-fxkey(`gen-<iid>` / `hero-0` / `hero-1`)。null = 不画
  fromKey: string | null
}

// 指向箭:从「已选中的攻击者 / 待指定目标的牌」拉一条弧线到指针。
//
// 【为什么需要】
// 现在选中攻击者之后,画面上只有两件事发生:攻击者高亮、可打的目标脉动。
// 场上有五个可选目标时,这两件事**都没说清「谁打谁」** ——
// 玩家得自己记住刚才点的是哪个。炉石那条拉出来的箭之所以是标配,
// 是因为它把「我正在指定一次攻击」这件事变成了一个持续可见的状态,
// 而不是两处闪烁需要脑内连线。
//
// 【为什么是弧线不是直线】
// 直线在两个单位挨得近的时候会被它们自己盖住,而且和战线、落地影这些
// 水平结构线混在一起分不出来。弧线永远从下方兜上去,任何角度都读得出方向。
//
// 【为什么用 SVG 覆盖层而不是 canvas】
// 一条线而已,SVG 省掉一整套重绘管理;而且它天然跟随 devicePixelRatio,
// 不用管高分屏。pointer-events: none 保证它不吃点击 ——
// 这一条至关重要:箭正好横在玩家要点的目标上方。
export function TargetArrow({ fromKey }: TargetArrowProps) {
  const [from, setFrom] = useState<{ x: number; y: number } | null>(null)
  const [to, setTo] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!fromKey) {
      setFrom(null)
      setTo(null)
      return
    }
    const el = document.querySelector<HTMLElement>(`[data-fxkey="${fromKey}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    setFrom(origin)
    // 指针还没动过时,先把终点放在起点上方一点 —— 否则触屏上(没有 mousemove)
    // 会是一条零长度的线,看起来像什么都没发生。
    setTo({ x: origin.x, y: origin.y - 60 })

    const move = (e: PointerEvent) => setTo({ x: e.clientX, y: e.clientY })
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [fromKey])

  if (!from || !to) return null

  // 控制点抬到两端中点的上方:抬多少跟着水平距离走,
  // 距离近时几乎是直线,距离远时兜得更高。
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const lift = Math.min(160, 40 + Math.abs(to.x - from.x) * 0.28)
  const path = `M ${from.x} ${from.y} Q ${midX} ${midY - lift} ${to.x} ${to.y}`

  return (
    <svg className={styles.layer} aria-hidden="true">
      {/* 两道:底下一条粗的暗描边保证任何底色上都看得见,上面一条亮金的本体 */}
      <path className={styles.stroke} d={path} />
      <path className={styles.line} d={path} />
      {/* 箭头端点:一个跟着指针的实心菱形,和战线中央那颗同一个语汇 */}
      <rect
        className={styles.head}
        x={to.x - 7}
        y={to.y - 7}
        width={14}
        height={14}
        transform={`rotate(45 ${to.x} ${to.y})`}
      />
    </svg>
  )
}
