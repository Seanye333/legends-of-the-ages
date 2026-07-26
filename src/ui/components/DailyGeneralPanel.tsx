import { useEffect } from 'react'
import type { CSSProperties } from 'react'
import { dailyGeneralFor } from '../../content/dailyGeneral'
import { dayKey } from '../../content/dailyPuzzle'
import { useDailyGeneral } from '../../app/dailyGeneralStore'
import { Portrait } from './Portrait'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './DailyGeneralPanel.module.css'

interface Props {
  onClose: () => void
}

// 每日一将:每天推一位历史名将 + 列传。打开即标记「今日已看」(标题页的高亮随之消失)。
export function DailyGeneralPanel({ onClose }: Props) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const markSeen = useDailyGeneral((s) => s.markSeen)
  const today = dayKey()
  const daily = dailyGeneralFor(today)

  useEffect(() => {
    markSeen(today)
  }, [markSeen, today])

  if (!daily) return null
  const { card, lore } = daily

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        style={{ '--doctrine': DOCTRINE_COLORS[card.doctrine] } as CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className={styles.title}>{t('每日一将', 'General of the Day')}</h2>
        <div className={styles.portrait}>
          <Portrait id={card.id} nameZh={card.name.zh} doctrine={card.doctrine} full />
        </div>
        <div className={styles.nameRow}>
          <span className={styles.name}>{pick(card.name)}</span>
          {lore.era && <span className={styles.era}>{pick(lore.era)}</span>}
        </div>
        <div className={styles.meta}>
          {pickCompact(DOCTRINE_NAME[card.doctrine])} · {card.attack}/{card.health} ·{' '}
          {t(`${card.cost} 费`, `${card.cost} cost`)}
        </div>
        <p className={styles.bio}>{pick(lore.bio)}</p>
        {lore.quote && <p className={styles.quote}>「{pick(lore.quote)}」</p>}
        <button
          className={styles.closeBtn}
          onClick={() => {
            playSfx('buttonTap')
            onClose()
          }}
        >
          {t('关闭', 'Close')}
        </button>
      </div>
    </div>
  )
}
