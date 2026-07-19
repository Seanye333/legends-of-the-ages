import { useEffect, useState, type CSSProperties } from 'react'
import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS } from '../doctrineColors'
import styles from './Portrait.module.css'

interface PortraitProps {
  id: string
  nameZh: string
  doctrine: CardDef['doctrine']
  full?: boolean // 优先用全身立绘(<id>-full.webp),缺则退回头像
}

// 大多数卡没有配图:兜底改为「拓印风」——主义色晕染 + 印环 + 首字书法大字。
export function Portrait({ id, nameZh, doctrine, full }: PortraitProps) {
  // 0=尝试 full,1=退回头像,2=拓印兜底
  const [stage, setStage] = useState(full ? 0 : 1)
  useEffect(() => setStage(full ? 0 : 1), [id, full])

  const color = DOCTRINE_COLORS[doctrine] ?? DOCTRINE_COLORS.neutral
  if (stage >= 2) {
    const glyph = nameZh.trim().charAt(0) || '将'
    return (
      <div className={styles.fallback} style={{ '--doctrine': color } as CSSProperties}>
        <span className={styles.fallbackGlyph}>{glyph}</span>
      </div>
    )
  }
  const file = stage === 0 ? `${id}-full.webp` : `${id}.webp`
  return (
    <img
      className={styles.img}
      src={`${import.meta.env.BASE_URL}portraits/${file}`}
      alt={nameZh}
      loading="lazy"
      draggable={false}
      onError={() => setStage((s) => s + 1)}
    />
  )
}
