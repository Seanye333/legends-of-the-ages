import { useEffect } from 'react'
import { questText, useQuests } from '../../app/questStore'
import { useCollection } from '../../app/collectionStore'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './QuestPanel.module.css'

interface QuestPanelProps {
  onClose: () => void
}

// 每日任务:三条,当日零点刷新,达标领卡包。
export function QuestPanel({ onClose }: QuestPanelProps) {
  const t = useT()
  const pick = usePickText()
  const { quests, refreshIfNewDay, claim } = useQuests()
  const grantPacks = useCollection((s) => s.grantPacks)

  useEffect(() => refreshIfNewDay(), [refreshIfNewDay])

  const onClaim = (id: string) => {
    const reward = claim(id)
    if (reward > 0) {
      grantPacks(reward)
      playSfx('victory')
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{t('每日军令', 'Daily Orders')}</h2>
        <p className={styles.sub}>{t('每日零点更替,达标即领战功', 'Refreshes daily — claim your spoils')}</p>

        {quests.map((q) => {
          const done = q.progress >= q.goal
          const pct = Math.min(100, Math.round((q.progress / q.goal) * 100))
          return (
            <div key={q.id} className={`${styles.quest} ${q.claimed ? styles.questDone : ''}`}>
              <div className={styles.questHead}>
                <span className={styles.questText}>{pick(questText(q))}</span>
                <span className={styles.reward}>{t(`卡包 ×${q.reward}`, `${q.reward} pack`)}</span>
              </div>
              <div className={styles.barTrack}>
                <div className={styles.barFill} style={{ width: `${pct}%` }} />
                <span className={styles.barLabel}>
                  {Math.min(q.progress, q.goal)} / {q.goal}
                </span>
              </div>
              {q.claimed ? (
                <span className={styles.claimed}>{t('已领取', 'Claimed')}</span>
              ) : (
                <button
                  className={done ? styles.claimBtn : styles.claimBtnOff}
                  disabled={!done}
                  onClick={() => onClaim(q.id)}
                >
                  {done ? t('领取', 'Claim') : t('进行中', 'In progress')}
                </button>
              )}
            </div>
          )
        })}

        <button className={styles.closeBtn} onClick={onClose}>
          {t('关闭', 'Close')}
        </button>
      </div>
    </div>
  )
}
