import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { cachedStage, portraitCandidates, rememberStage } from '../portraitSource'
import styles from './Portrait.module.css'

interface PortraitProps {
  id: string
  nameZh: string
  doctrine: CardDef['doctrine']
  full?: boolean // 优先用全身立绘(<id>-full.webp),缺则退回头像
}

// 取图优先级见 portraitSource.ts:随包(签名卡)→ CDN(可选)→ 拓印兜底。
// 「拓印风」兜底(主义色晕染 + 印环 + 首字书法大字)恒在底层,既是无图时的终态,
// 也是有图时的加载占位 —— 图片淡入覆盖上去,不会出现空框闪跳。
export function Portrait({ id, nameZh, doctrine, full }: PortraitProps) {
  const candidates = useMemo(() => portraitCandidates(id, !!full), [id, full])
  // 已解析过的卡直接从命中的那一档起步,避免重复走已知失败的候选
  const [stage, setStage] = useState(() => cachedStage(id, !!full))
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setStage(cachedStage(id, !!full))
    setLoaded(false)
  }, [id, full])

  const color = DOCTRINE_COLORS[doctrine] ?? DOCTRINE_COLORS.neutral
  const glyph = nameZh.trim().charAt(0) || '将'
  const src: string | undefined = candidates[stage]
  const pending = src !== undefined && !loaded

  return (
    <div className={styles.wrap} style={{ '--doctrine': color } as CSSProperties}>
      <div className={`${styles.fallback} ${pending ? styles.pending : ''}`}>
        <span className={styles.fallbackGlyph}>{glyph}</span>
      </div>
      {src !== undefined && (
        <img
          key={src}
          className={`${styles.img} ${loaded ? styles.imgIn : ''}`}
          src={src}
          alt={nameZh}
          loading="lazy"
          decoding="async"
          draggable={false}
          onLoad={() => {
            rememberStage(id, !!full, stage)
            setLoaded(true)
          }}
          onError={() => {
            rememberStage(id, !!full, stage + 1)
            setStage((s) => s + 1)
          }}
        />
      )}
    </div>
  )
}
