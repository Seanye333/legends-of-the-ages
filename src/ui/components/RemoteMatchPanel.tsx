import { useEffect, useState } from 'react'
import { useMatch } from '../../app/matchStore'
import { getPlayerName } from '../../app/leaderboard'
import { DEFAULT_SERVER } from '../../app/protocol'
import type { DeckList } from '../../content/decks'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './RemoteMatchPanel.module.css'

const SERVER_KEY = 'qiangu-server-addr'

interface RemoteMatchPanelProps {
  deck: DeckList
  onStart: () => void
  onClose: () => void
}

const STATUS_ZH: Record<string, string> = {
  connecting: '连接服务器…',
  queued: '匹配中,等待对手…',
  matched: '已匹配!进入对局…',
  playing: '对局开始!',
  'opponent-left': '对手已离开',
  closed: '连接已断开',
}

// 联机匹配:连服务器 → 排队 → 撮合 → 对局开场后切入 MatchScreen。
export function RemoteMatchPanel({ deck, onStart, onClose }: RemoteMatchPanelProps) {
  const t = useT()
  const { remoteStatus, error, startRemoteMatch, reset } = useMatch()
  const [server, setServer] = useState(
    () => localStorage.getItem(SERVER_KEY) ?? DEFAULT_SERVER,
  )
  const [searching, setSearching] = useState(false)

  // 对局开场 → 切入对战画面
  useEffect(() => {
    if (remoteStatus === 'playing') onStart()
  }, [remoteStatus, onStart])

  const onQueue = () => {
    playSfx('buttonTap')
    localStorage.setItem(SERVER_KEY, server.trim())
    setSearching(true)
    startRemoteMatch({
      server: server.trim(),
      deck,
      playerName: getPlayerName() || '无名氏',
    })
  }

  const onCancel = () => {
    playSfx('buttonTap')
    if (searching) reset()
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.panel}>
        <h2 className={styles.title}>{t('联机对战', 'Online Match')}</h2>
        <p className={styles.deckLine}>
          {t(`出战卡组:${deck.name.zh}`, `Deck: ${deck.name.en}`)}
        </p>

        <label className={styles.label}>{t('服务器地址', 'Server address')}</label>
        <input
          className={styles.input}
          value={server}
          disabled={searching}
          onChange={(e) => setServer(e.target.value)}
          placeholder={DEFAULT_SERVER}
        />

        {searching && (
          <div className={styles.status}>
            <span className={styles.spinner} />
            {STATUS_ZH[remoteStatus ?? ''] ?? remoteStatus}
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.buttons}>
          {!searching && (
            <button className={styles.goldBtn} onClick={onQueue}>
              {t('开始匹配', 'Find Match')}
            </button>
          )}
          <button className={styles.plainBtn} onClick={onCancel}>
            {searching ? t('取消匹配', 'Cancel') : t('关闭', 'Close')}
          </button>
        </div>
      </div>
    </div>
  )
}
