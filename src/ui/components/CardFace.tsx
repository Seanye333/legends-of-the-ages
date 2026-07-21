import type { CSSProperties, MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID, needsDynastyTag } from '../../content/cards'
import { useSettings } from '../../app/settingsStore'
import { DOCTRINE_COLORS, dynastyName } from '../doctrineColors'
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

  // 卡牌以前是纯 <div onClick>:不可键盘聚焦,读屏器什么都读不出来。
  // 这里不改成 <button>(卡面里有嵌套结构与长按手势,button 的默认行为会打架),
  // 而是补齐 button 的语义契约:role + tabIndex + 键盘激活 + 可读的标签。
  const interactive = Boolean(onClick || onInspect)
  const a11yLabel = [
    mainName,
    `${def.cost} ${lang === 'en' ? 'mana' : '费'}`,
    def.type === 'general' ? `${def.attack ?? 0}/${def.health ?? 0}` : '',
    def.text ? (lang === 'en' ? def.text.en : def.text.zh) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cls}
      style={{ '--doctrine': DOCTRINE_COLORS[def.doctrine] } as CSSProperties}
      {...(onInspect ? longPress.handlers : {})}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? a11yLabel : undefined}
      aria-disabled={onClick && playable === false ? true : undefined}
      onKeyDown={(e) => {
        if (!interactive) return
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        // 键盘上没有「长按」:回车出牌,Shift+回车看详情
        if (e.shiftKey && onInspect) onInspect()
        else onClick?.(e as unknown as MouseEvent)
      }}
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
        <div className={styles.name}>
          {mainName}
          {/* 重名卡才标朝代:光看卡面「杜預」和「杜預」分不出是两张不同的牌。
              只有 40 张卡会走到这里,不会给正常卡面添噪。 */}
          {needsDynastyTag(def) && (
            <span className={styles.dynastyTag}>
              {lang === 'en' ? dynastyName(def.dynasty).en : dynastyName(def.dynasty).zh}
            </span>
          )}
        </div>
        {subName && <div className={styles.sub}>{subName}</div>}
      </div>
      <span className={`${styles.rarity} ${styles[def.rarity]}`} />
      {def.type === 'general' ? (
        <>
          <span className={styles.atk}>{inst.attack}</span>
          <span className={styles.hp}>{inst.health}</span>
        </>
      ) : (
        <span className={styles.spellMark}>
          {lang === 'en' ? (def.type === 'equipment' ? 'GEAR' : 'PLOT') : '锦囊'}
        </span>
      )}
    </div>
  )
}
