import type { MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { useSettings } from '../../app/settingsStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { Portrait } from './Portrait'
import styles from './CardFace.module.css'

interface CardFaceProps {
  inst: CardInstance
  playable?: boolean
  selected?: boolean
  large?: boolean
  onClick?: (e: MouseEvent) => void
}

// 手牌卡面:费用宝石、立绘、名字、攻血宝石、主义色边框、稀有度点。
export function CardFace({ inst, playable, selected, large, onClick }: CardFaceProps) {
  const lang = useSettings((s) => s.language)
  const def = CARDS_BY_ID[inst.defId]
  if (!def) {
    return (
      <div className={styles.face} onClick={onClick}>
        <div className={styles.nameBox}>
          <div className={styles.name}>{inst.defId}</div>
        </div>
      </div>
    )
  }

  const mainName = lang === 'en' ? def.name.en : def.name.zh
  const subName = lang === 'both' ? def.name.en : null
  const cls = [
    styles.face,
    large ? styles.large : '',
    playable ? styles.playable : '',
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      style={{ borderColor: DOCTRINE_COLORS[def.doctrine] }}
      onClick={onClick}
      title={def.text ? (lang === 'en' ? def.text.en : def.text.zh) : undefined}
    >
      <span className={styles.cost}>{def.cost}</span>
      <div className={styles.art}>
        <Portrait id={def.id} nameZh={def.name.zh} doctrine={def.doctrine} />
      </div>
      <div className={styles.nameBox}>
        <div className={styles.name}>{mainName}</div>
        {subName && <div className={styles.sub}>{subName}</div>}
      </div>
      <span className={`${styles.rarity} ${styles[def.rarity]}`}>●</span>
      {def.type === 'general' ? (
        <>
          <span className={styles.atk}>{inst.attack}</span>
          <span className={styles.hp}>{inst.health}</span>
        </>
      ) : (
        <span className={styles.spellMark}>锦囊</span>
      )}
    </div>
  )
}
