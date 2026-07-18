import type { CardInstance } from '../../engine/types'
import { CardFace } from './CardFace'
import styles from './HandFan.module.css'

interface HandFanProps {
  hand: CardInstance[]
  playableIids: ReadonlySet<number>
  selectedIid: number | null
  onCardClick: (iid: number) => void
}

// 我方手牌扇形排布。CSS 变量承载每张牌的旋转/下沉,便于 hover 时用类覆盖。
export function HandFan({ hand, playableIids, selectedIid, onCardClick }: HandFanProps) {
  const n = hand.length
  const mid = (n - 1) / 2
  const rotStep = Math.min(4.5, 36 / Math.max(n, 1))
  return (
    <div className={styles.fan}>
      {hand.map((c, i) => {
        const selected = selectedIid === c.iid
        return (
          <div
            key={c.iid}
            className={`${styles.slot} ${selected ? styles.slotSelected : ''}`}
            style={
              {
                '--rot': `${(i - mid) * rotStep}deg`,
                '--sink': `${Math.abs(i - mid) * 5}px`,
                zIndex: selected ? 50 : i + 1,
              } as React.CSSProperties
            }
          >
            <CardFace
              inst={c}
              playable={playableIids.has(c.iid)}
              selected={selected}
              onClick={(e) => {
                e.stopPropagation()
                onCardClick(c.iid)
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
