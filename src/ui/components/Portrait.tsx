import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { CardDef } from '../../engine/types'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { useSettings } from '../../app/settingsStore'
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
  // 书法卡面:整站不加载任何立绘,全部落在拓印那一层。
  // 实现上**只需要把候选清单清空** —— 兜底层本来就恒在底下,
  // 没有候选就没有 <img>,也就没有淡入、没有请求、没有 CDN 回落。
  // 这是这个功能几乎零成本的原因:那层「无图时的终态」早就写好了,
  // 它一直只是被当成占位在用。
  const ink = useSettings((s) => s.portraitStyle) === 'ink'
  const candidates = useMemo(
    () => (ink ? [] : portraitCandidates(id, !!full)),
    [id, full, ink],
  )
  // 已解析过的卡直接从命中的那一档起步,避免重复走已知失败的候选
  // ink 模式下 candidates 为空,stage 取多少都无所谓 —— 但重置它能让
  // 从 ink 切回 art 时不至于停在一个上次失败的档位上。
  const [stage, setStage] = useState(() => cachedStage(id, !!full))
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    setStage(cachedStage(id, !!full))
    setLoaded(false)
  }, [id, full, ink])

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
