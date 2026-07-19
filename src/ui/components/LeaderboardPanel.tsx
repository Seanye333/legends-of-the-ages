import { useEffect, useState } from 'react'
import {
  fetchLeaderboard,
  getPlayerName,
  setPlayerName,
  todayWins,
  type LeaderboardRow,
} from '../../app/leaderboard'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './LeaderboardPanel.module.css'

interface LeaderboardPanelProps {
  onClose: () => void
}

// 每日胜场榜:联网可用时显示全球榜;否则只显示本地战绩与提示。
export function LeaderboardPanel({ onClose }: LeaderboardPanelProps) {
  const t = useT()
  const [name, setName] = useState(getPlayerName())
  const [rows, setRows] = useState<LeaderboardRow[] | null | 'loading'>('loading')

  useEffect(() => {
    let cancelled = false
    fetchLeaderboard().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.panel}>
        <h2 className={styles.title}>{t('今日群雄榜', "Today's Ladder")}</h2>
        <div className={styles.mine}>
          {t(`我的今日胜场:${todayWins()}`, `My wins today: ${todayWins()}`)}
        </div>

        <div className={styles.nameRow}>
          <input
            className={styles.nameInput}
            placeholder={t('留名上榜…', 'Your name…')}
            value={name}
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className={styles.saveBtn}
            onClick={() => {
              playSfx('buttonTap')
              setPlayerName(name)
            }}
          >
            {t('保存', 'Save')}
          </button>
        </div>

        <div className={styles.list}>
          {rows === 'loading' && <p className={styles.hint}>{t('加载中…', 'Loading…')}</p>}
          {rows === null && (
            <p className={styles.hint}>
              {t('全球榜未开通(部署后自动启用),先在本地攒胜场吧', 'Global ladder offline — local wins still count')}
            </p>
          )}
          {Array.isArray(rows) && rows.length === 0 && (
            <p className={styles.hint}>{t('今日虚位以待,首胜即登榜', 'No entries yet today')}</p>
          )}
          {Array.isArray(rows) &&
            rows.map((r, i) => (
              <div key={`${r.name}-${i}`} className={styles.row}>
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.name}>{r.name}</span>
                <span className={styles.wins}>{t(`${r.wins} 胜`, `${r.wins}W`)}</span>
              </div>
            ))}
        </div>

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
