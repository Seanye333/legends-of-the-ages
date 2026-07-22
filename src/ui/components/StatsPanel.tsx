import { useEffect, useRef } from 'react'
import { useAchievements } from '../../app/achievementStore'
import { useCollection } from '../../app/collectionStore'
import { useExpedition } from '../../app/expeditionStore'
import { DOCTRINE_NAME } from '../doctrineColors'
import type { Doctrine } from '../../engine/types'
import { usePickText, useT } from '../i18n'
import styles from './StatsPanel.module.css'

interface StatsPanelProps {
  onClose: () => void
}

// 战绩簿:把散在各处的终身统计汇成一页。数据全部来自既有的 store,不新记账。
export function StatsPanel({ onClose }: StatsPanelProps) {
  const t = useT()
  const pick = usePickText()
  const stats = useAchievements((s) => s.stats)
  const wins = useCollection((s) => s.wins)
  const losses = useCollection((s) => s.losses)
  const bestDepth = useExpedition((s) => s.bestDepth)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const s = (k: string) => stats[k as keyof typeof stats] ?? 0

  const doctrines: Doctrine[] = ['royal', 'hegemonic', 'ritual', 'fame', 'separatist', 'reclusion']

  // 一行统计:标签 + 数值
  const Row = ({ label, value }: { label: string; value: number | string }) => (
    <div className={styles.row}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
    </div>
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.panel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <h2 className={styles.title}>{t('战绩簿', 'Record')}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('关闭', 'Close')}>
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {/* 总览 */}
          <div className={styles.hero}>
            <div className={styles.heroRate}>{winRate}%</div>
            <div className={styles.heroSub}>
              {t(`${wins} 胜 · ${losses} 负 · 共 ${total} 场`, `${wins}W · ${losses}L · ${total} total`)}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('各主义胜场', 'Wins by Doctrine')}</div>
            <div className={styles.grid}>
              {doctrines.map((d) => (
                <Row key={d} label={pick(DOCTRINE_NAME[d])} value={s(`won_${d}`)} />
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('机制', 'Mechanics')}</div>
            <div className={styles.grid}>
              <Row label={t('单挑击杀', 'Duel kills')} value={s('duelKills')} />
              <Row label={t('主公技发动', 'Hero Powers used')} value={s('heroPowersUsed')} />
              <Row label={t('伏兵触发', 'Secrets sprung')} value={s('secretsSprung')} />
              <Row label={t('连击触发', 'Combos')} value={s('combosTriggered')} />
              <Row label={t('抉择', 'Choose One')} value={s('chooseModes')} />
              <Row label={t('发现', 'Discovers')} value={s('discoveries')} />
              <Row label={t('沉默敌将', 'Silences')} value={s('silences')} />
              <Row label={t('冻结敌将', 'Freezes')} value={s('freezes')} />
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('纪录', 'Records')}</div>
            <div className={styles.grid}>
              <Row label={t('单回合最高脸伤', 'Best turn face damage')} value={s('bestTurnDamage')} />
              <Row label={t('竞技场最佳', 'Best Arena run')} value={`${s('arenaBestWins')} ${t('胜', 'W')}`} />
              <Row label={t('远征最深', 'Deepest Expedition')} value={`${bestDepth}/8`} />
              <Row label={t('累计脸伤', 'Total face damage')} value={s('heroDamage')} />
              <Row label={t('登场武将', 'Generals fielded')} value={s('generalsPlayed')} />
              <Row label={t('开启卡包', 'Packs opened')} value={s('packsOpened')} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
