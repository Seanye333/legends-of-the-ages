import { useEffect, useState, type CSSProperties } from 'react'
import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS } from '../doctrineColors'
import styles from './Portrait.module.css'

interface PortraitProps {
  id: string
  nameZh: string
  doctrine: CardDef['doctrine']
}

// 大多数卡没有配图:兜底改为「拓印风」——主义色晕染 + 印环 + 首字书法大字。
export function Portrait({ id, nameZh, doctrine }: PortraitProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [id])

  const color = DOCTRINE_COLORS[doctrine] ?? DOCTRINE_COLORS.neutral
  if (failed) {
    const glyph = nameZh.trim().charAt(0) || '将'
    return (
      <div className={styles.fallback} style={{ '--doctrine': color } as CSSProperties}>
        <span className={styles.fallbackGlyph}>{glyph}</span>
      </div>
    )
  }
  return (
    <img
      className={styles.img}
      src={`${import.meta.env.BASE_URL}portraits/${id}.webp`}
      alt={nameZh}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
    />
  )
}
