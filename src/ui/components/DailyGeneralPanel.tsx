import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { dailyGeneralFor, dailyStoryFor } from '../../content/dailyGeneral'
import { cardName } from '../../content/relations'
import { dayKey } from '../../content/dailyPuzzle'
import { useDailyGeneral } from '../../app/dailyGeneralStore'
import { Portrait } from './Portrait'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { useDialog } from '../useDialog'
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
  const story = dailyStoryFor(today)

  useEffect(() => {
    markSeen(today)
  }, [markSeen, today])

  // 弹层键盘契约(Esc / 焦点环 / 焦点还原)。必须在下面那句 `if (!daily) return null`
  // **之前**调用 —— hook 不能落在提前返回的后面。
  // onClose 由父级以内联箭头传入,每次父级渲染都是新引用,而它是 useDialog 的 effect
  // 依赖:不稳住的话上层一重渲染焦点环就重挂一遍。用 ref 存最新的一份,对外恒定同一个函数。
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const stableClose = useCallback(() => closeRef.current(), [])
  const panelRef = useDialog(stableClose)

  if (!daily) return null
  const { card, lore } = daily

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('每日一将', 'General of the Day')}
        tabIndex={-1}
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
        {/* 今日战事:每日一将推的是**一个人**,而这个游戏真正独有的素材是**关系** ——
            31 条羁绊与 29 对宿敌背后各有一段真事,而它们只在对局里偶然撞见。 */}
        {story && (
          <div className={styles.story}>
            <span className={styles.storyHead}>
              {story.kind === 'rival' ? t('今日戰事 · 宿敵', 'Today · Rivalry') : t('今日戰事 · 羈絆', 'Today · Bond')}
            </span>
            <span className={styles.storyTitle}>{pick(story.title)}</span>
            <span className={styles.storyPeople}>
              {story.people.map((id) => pickCompact(cardName(id))).join(story.kind === 'rival' ? ' ⇄ ' : ' · ')}
            </span>
            {story.lore && <span className={styles.storyLore}>{pick(story.lore)}</span>}
          </div>
        )}
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
