import type { Rarity } from '../../engine/types'
import styles from './FoilLayer.module.css'

interface FoilLayerProps {
  rarity: Rarity
  /** 开包演出:更亮的流光、更快的扫光节奏 */
  intense?: boolean
}

// 闪卡层:纯 CSS 流光覆层,epic 淡紫辉光,legendary 彩虹流光 + 星屑。
// 动画只用 transform/opacity(GPU 合成),不跑每帧 JS,移动端安全。
// 挂载约定:父元素需 position:relative 且带圆角(闪层 border-radius:inherit);
// 集合页只给「已拥有的高稀有卡」挂载以控制动画层数量。
export function FoilLayer({ rarity, intense }: FoilLayerProps) {
  if (rarity !== 'epic' && rarity !== 'legendary') return null
  const cls = [styles.foil, styles[rarity], intense ? styles.intense : '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} aria-hidden>
      <span className={styles.tint} />
      <span className={styles.sheen} />
      {rarity === 'legendary' && <span className={styles.rainbow} />}
      {rarity === 'legendary' && <span className={styles.sparkles} />}
    </div>
  )
}
