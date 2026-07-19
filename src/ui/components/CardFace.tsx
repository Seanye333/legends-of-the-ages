import type { CSSProperties, MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { useSettings } from '../../app/settingsStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { Portrait } from './Portrait'
import { useLongPress } from '../useLongPress'
import styles from './CardFace.module.css'

interface CardFaceProps {
  inst: CardInstance
  playable?: boolean
  selected?: boolean
  large?: boolean
  onClick?: (e: MouseEvent) => void
  onInspect?: () => void // 长按查看详情
}

// 手牌卡面:多层描金卡框、费用宝石、立绘、名字铭牌、攻血宝石、稀有度玉印。
export function CardFace({ inst, playable, selected, large, onClick, onInspect }: CardFaceProps) {
  const lang = useSettings((s) => s.language)
  const longPress = useLongPress(() => onInspect?.())
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
  const isSpell = def.type !== 'general'
  const frameRarity = {
    common: '',
    rare: styles.frameRare,
    epic: styles.frameEpic,
    legendary: styles.frameLegendary,
  }[def.rarity]
  const cls = [
    styles.face,
    large ? styles.large : '',
    frameRarity,
    isSpell ? styles.stratagem : '',
    playable ? styles.playable : '',
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={cls}
      style={{ '--doctrine': DOCTRINE_COLORS[def.doctrine] } as CSSProperties}
      {...(onInspect ? longPress.handlers : {})}
      onClick={(e) => {
        if (onInspect && longPress.consumed()) {
          e.stopPropagation()
          return
        }
        onClick?.(e)
      }}
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
      <span className={`${styles.rarity} ${styles[def.rarity]}`} />
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
