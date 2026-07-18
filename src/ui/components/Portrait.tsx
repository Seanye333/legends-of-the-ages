import { useEffect, useState } from 'react'
import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS } from '../doctrineColors'
import styles from './Portrait.module.css'

interface PortraitProps {
  id: string
  nameZh: string
  doctrine: CardDef['doctrine']
}

// 大多数卡没有配图:加载失败时用主义渐变 + 名字大字兜底。
export function Portrait({ id, nameZh, doctrine }: PortraitProps) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [id])

  const color = DOCTRINE_COLORS[doctrine] ?? DOCTRINE_COLORS.neutral
  if (failed) {
    return (
      <div
        className={styles.fallback}
        style={{
          background: `radial-gradient(circle at 30% 22%, ${color}55, #17140e 82%)`,
          borderColor: `${color}66`,
        }}
      >
        <span className={styles.fallbackName}>{nameZh}</span>
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
