import { useRef, useState } from 'react'
import type { CardInstance } from '../../engine/types'
import { CardFace } from './CardFace'
import styles from './HandFan.module.css'

interface HandFanProps {
  hand: CardInstance[]
  playableIids: ReadonlySet<number>
  selectedIid: number | null
  onCardClick: (iid: number) => void
  onInspectCard?: (defId: string) => void
}

// 拖拽出牌的两个阈值。
// · MOVE_SLOP:超过这个距离才算「在拖」,以内一律当点击。
//   8px 是手指在屏幕上「按住不动」的实际抖动量 —— 定小了轻点会被误判成拖拽,
//   定大了拖拽的起步会有一段死区。
// · PLAY_LIFT:往上抬多少算「打出去」。负值 = 向上。
//   取 64px ≈ 半张牌高:比手指的自然抖动大一个数量级,又不需要划到屏幕中间。
const MOVE_SLOP = 8
const PLAY_LIFT = -64

interface DragState {
  iid: number
  pointerId: number
  x0: number
  y0: number
  dx: number
  dy: number
  moved: boolean
}

// 我方手牌扇形排布。CSS 变量承载每张牌的旋转/下沉与自适应叠压,便于 hover 时用类覆盖。
//
// 【拖拽出牌是加法,不是替换】
// 点击出牌一直保留着,原因有三:桌面端鼠标点击更快;无障碍(键盘/开关控制)只有点击;
// 端到端用例全是 `.click()`。所以这里的规则是:
//   位移 < 8px  → 当作点击,走原来那条路(交给 CardFace 的 onClick)
//   位移 ≥ 8px  → 进入拖拽,松手时抬得够高才出牌,不够高就弹回去(**不出牌**)
// 「不够高就弹回」是拖拽相对点击唯一多出来的能力:**反悔**。
// 点击是没有反悔余地的,而手牌里最贵的那张牌,玩家往往想先比划一下。
export function HandFan({ hand, playableIids, selectedIid, onCardClick, onInspectCard }: HandFanProps) {
  const n = hand.length
  const mid = (n - 1) / 2
  const rotStep = Math.min(4.5, 36 / Math.max(n, 1))
  const dragRef = useRef<DragState | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  // 真正拖过之后,浏览器仍然会补一个 click —— 那一下必须吞掉,
  // 否则「拖到一半又拉回来」会在松手时被 click 当成点击照样打出去。
  const swallowClickRef = useRef(false)

  const onPointerDown = (iid: number) => (e: React.PointerEvent) => {
    // 只接主键/单指;右键与多指交给浏览器
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const st: DragState = {
      iid,
      pointerId: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      dx: 0,
      dy: 0,
      moved: false,
    }
    dragRef.current = st
    // 捕获指针:手指划出这张牌的范围之后仍然收得到 move/up。
    // 没有这一句的话,牌一被拖离原位就再也收不到事件,卡在半空。
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* 某些环境不支持指针捕获 —— 退化成「拖出范围就取消」,不影响点击 */
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const st = dragRef.current
    if (!st || st.pointerId !== e.pointerId) return
    const dx = e.clientX - st.x0
    const dy = e.clientY - st.y0
    const moved = st.moved || Math.hypot(dx, dy) > MOVE_SLOP
    const next = { ...st, dx, dy, moved }
    dragRef.current = next
    if (moved) setDrag(next)
  }

  const endDrag = (e: React.PointerEvent) => {
    const st = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!st || st.pointerId !== e.pointerId) return
    if (!st.moved) return // 没动过 —— 让 click 照常触发,走点击那条路
    swallowClickRef.current = true
    // 抬够高才出牌。打不出的牌照样能拖(手感一致),只是松手时什么都不发生 ——
    // 「为什么打不出」由点击那条路负责回答,拖拽不抢它的活。
    if (st.dy <= PLAY_LIFT && playableIids.has(st.iid)) onCardClick(st.iid)
  }

  return (
    <div className={styles.fan} style={{ '--n': Math.max(n, 1) } as React.CSSProperties}>
      {hand.map((c, i) => {
        const selected = selectedIid === c.iid
        const dragging = drag?.iid === c.iid
        const armed = dragging && drag.dy <= PLAY_LIFT && playableIids.has(c.iid)
        return (
          <div
            key={c.iid}
            className={`${styles.slot} ${selected ? styles.slotSelected : ''} ${
              dragging ? styles.slotDragging : ''
            } ${armed ? styles.slotArmed : ''}`}
            onPointerDown={onPointerDown(c.iid)}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={
              {
                '--rot': `${(i - mid) * rotStep}deg`,
                '--sink': `${Math.abs(i - mid) * 4}px`,
                // 拖拽期间用位移覆盖扇形的旋转与下沉:牌跟着手指走,
                // 并按横向速度轻微倾斜(dx/9 度)—— 这一点惯性倾斜是「有重量」的全部来源。
                '--drag-x': dragging ? `${drag.dx}px` : '0px',
                '--drag-y': dragging ? `${drag.dy}px` : '0px',
                '--drag-tilt': dragging ? `${Math.max(-12, Math.min(12, drag.dx / 9))}deg` : '0deg',
                zIndex: dragging ? 80 : selected ? 50 : i + 1,
              } as React.CSSProperties
            }
          >
            <CardFace
              inst={c}
              playable={playableIids.has(c.iid)}
              selected={selected}
              onInspect={onInspectCard ? () => onInspectCard(c.defId) : undefined}
              onClick={(e) => {
                e.stopPropagation()
                if (swallowClickRef.current) {
                  swallowClickRef.current = false
                  return
                }
                onCardClick(c.iid)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
