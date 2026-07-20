import { useEffect, useRef, useState } from 'react'
import { ACHIEVEMENTS, useAchievements } from '../../app/achievementStore'
import { useCollection } from '../../app/collectionStore'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './AchievementPanel.module.css'

interface AchievementPanelProps {
  onClose: () => void
}

// 功名簿。与每日军令的区别是它**永不清零** ——
// 军令每天零点重置,玩家没有任何跨天累积的东西可追。
export function AchievementPanel({ onClose }: AchievementPanelProps) {
  const t = useT()
  const pick = usePickText()
  const stats = useAchievements((s) => s.stats)
  const claimedIds = useAchievements((s) => s.claimed)
  const claim = useAchievements((s) => s.claim)
  const grantPacks = useCollection((s) => s.grantPacks)
  const panelRef = useRef<HTMLDivElement>(null)
  const [toast, setToast] = useState<string | null>(null)

  // 与 ConfirmDialog 同一套模态礼仪:Esc 关闭 + 打开即聚焦
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onClaim = (id: string) => {
    const def = claim(id)
    if (!def) return
    playSfx('victory')
    haptic('reward')
    useCollection.setState({ merit: useCollection.getState().merit + def.merit })
    if (def.packs) grantPacks(def.packs)
    setToast(
      t(
        `功勋 +${def.merit}${def.packs ? ` · 卡包 ×${def.packs}` : ''}`,
        `+${def.merit} merit${def.packs ? ` · ${def.packs} packs` : ''}`,
      ),
    )
    window.setTimeout(() => setToast(null), 2200)
  }

  const done = ACHIEVEMENTS.filter((a) => (stats[a.stat] ?? 0) >= a.goal).length

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('功名簿', 'Achievements')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>{t('功名簿', 'Achievements')}</h2>
          <span className={styles.count}>
            {done} / {ACHIEVEMENTS.length}
          </span>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('关闭', 'Close')}>
            ✕
          </button>
        </header>

        <div className={styles.list}>
          {ACHIEVEMENTS.map((a) => {
            const progress = stats[a.stat] ?? 0
            const complete = progress >= a.goal
            const claimed = claimedIds.includes(a.id)
            const pct = Math.min(100, (progress / a.goal) * 100)
            return (
              <div
                key={a.id}
                className={`${styles.row} ${claimed ? styles.claimed : ''} ${complete && !claimed ? styles.ready : ''}`}
              >
                <div className={styles.rowMain}>
                  <div className={styles.name}>{pick(a.name)}</div>
                  <div className={styles.desc}>{pick(a.desc)}</div>
                  <div className={styles.bar}>
                    <div className={styles.barFill} style={{ width: `${pct}%` }} />
                  </div>
                  <div className={styles.progressText}>
                    {Math.min(progress, a.goal)} / {a.goal}
                  </div>
                </div>
                <div className={styles.rowSide}>
                  <div className={styles.reward}>
                    ✦ {a.merit}
                    {a.packs ? ` · ${t(`包×${a.packs}`, `${a.packs} pk`)}` : ''}
                  </div>
                  {claimed ? (
                    <span className={styles.claimedTag}>{t('已领', 'Claimed')}</span>
                  ) : (
                    <button
                      className={styles.claimBtn}
                      disabled={!complete}
                      onClick={() => onClaim(a.id)}
                    >
                      {complete ? t('领取', 'Claim') : t('未达成', 'Locked')}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {toast && (
          <div className={styles.toast} role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
