import { useEffect, useState } from 'react'
import { useMatch } from '../../app/matchStore'
import { getPlayerId, getPlayerName } from '../../app/leaderboard'
import { loadSession } from '../../app/remoteMatch'
import {
  DEFAULT_RATING,
  DEFAULT_SERVER,
  httpBase,
  rankOf,
  type RatingRow,
} from '../../app/protocol'
import type { DeckList } from '../../content/decks'
import type { LocalizedText } from '../../engine/types'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './RemoteMatchPanel.module.css'

const SERVER_KEY = 'qiangu-server-addr'

interface RemoteMatchPanelProps {
  deck: DeckList
  onStart: () => void
  onClose: () => void
}

const STATUS_TEXT: Record<string, LocalizedText> = {
  connecting: { zh: '连接服务器…', en: 'Connecting to server…' },
  queued: { zh: '匹配中,等待对手…', en: 'Searching for an opponent…' },
  'room-waiting': { zh: '房间已开,等好友加入…', en: 'Room open — waiting for your friend…' },
  matched: { zh: '已匹配!进入对局…', en: 'Matched! Entering the battle…' },
  playing: { zh: '对局开始!', en: 'The battle begins!' },
  reconnecting: { zh: '连接中断,重连中…', en: 'Connection lost — reconnecting…' },
  'opponent-left': { zh: '对手已离开', en: 'Your opponent left' },
  closed: { zh: '连接已断开', en: 'Disconnected' },
}

type Tab = 'queue' | 'room'

// 联机匹配:快速匹配(计天梯)或房间码约战(不计天梯)。
export function RemoteMatchPanel({ deck, onStart, onClose }: RemoteMatchPanelProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const { remoteStatus, error, roomCode, startRemoteMatch, resumeRemoteMatch, reset } = useMatch()
  const [server, setServer] = useState(
    () => localStorage.getItem(SERVER_KEY) ?? DEFAULT_SERVER,
  )
  const [tab, setTab] = useState<Tab>('queue')
  const [joinCode, setJoinCode] = useState('')
  const [searching, setSearching] = useState(false)
  const [myRating, setMyRating] = useState<number | null>(null)
  const [ladder, setLadder] = useState<RatingRow[] | null>(null)
  const [hasSession] = useState(() => loadSession() !== null)

  // 对局开场 → 切入对战画面
  useEffect(() => {
    if (remoteStatus === 'playing') onStart()
  }, [remoteStatus, onStart])

  // 打开面板即拉天梯积分与前十(静默容错)
  useEffect(() => {
    const base = httpBase(server.trim())
    let alive = true
    void fetch(`${base}/rating?playerId=${encodeURIComponent(getPlayerId())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rating?: number } | null) => {
        if (alive && j?.rating !== undefined) setMyRating(j.rating)
      })
      .catch(() => undefined)
    void fetch(`${base}/ladder`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { rows?: RatingRow[] } | null) => {
        if (alive && j?.rows) setLadder(j.rows.slice(0, 10))
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [server])

  const begin = (mode: 'queue' | 'create-room' | 'join-room' | 'watch-room') => {
    playSfx('buttonTap')
    localStorage.setItem(SERVER_KEY, server.trim())
    setSearching(true)
    startRemoteMatch({
      server: server.trim(),
      deck,
      playerName: getPlayerName() || pickCompact({ zh: '无名氏', en: 'Nameless' }),
      mode,
      code: joinCode,
    })
  }

  const onResume = () => {
    playSfx('buttonTap')
    if (resumeRemoteMatch()) onStart()
  }

  const onCancel = () => {
    playSfx('buttonTap')
    if (searching) reset()
    onClose()
  }

  const rating = myRating ?? DEFAULT_RATING
  const rank = rankOf(rating)

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.panel}>
        <h2 className={styles.title}>{t('联机对战', 'Online Match')}</h2>
        <p className={styles.deckLine}>
          {t(`出战卡组:${deck.name.zh}`, `Deck: ${deck.name.en}`)}
        </p>
        <p className={styles.ratingLine}>
          {t(
            `天梯:${rank.zh} · ${rating} 分`,
            `Ladder: ${rank.en} · ${rating}`,
          )}
        </p>

        {hasSession && !searching && (
          <button className={styles.resumeBtn} onClick={onResume}>
            {t('发现未完成对局 · 立即回到战场', 'Unfinished match found · Rejoin')}
          </button>
        )}

        <label className={styles.label}>{t('服务器地址', 'Server address')}</label>
        <input
          className={styles.input}
          value={server}
          disabled={searching}
          onChange={(e) => setServer(e.target.value)}
          placeholder={DEFAULT_SERVER}
        />

        {!searching && (
          <div className={styles.tabs}>
            <button
              className={tab === 'queue' ? styles.tabActive : styles.tab}
              onClick={() => {
                playSfx('buttonTap')
                setTab('queue')
              }}
            >
              {t('快速匹配', 'Ranked')}
            </button>
            <button
              className={tab === 'room' ? styles.tabActive : styles.tab}
              onClick={() => {
                playSfx('buttonTap')
                setTab('room')
              }}
            >
              {t('好友约战', 'Friendly')}
            </button>
          </div>
        )}

        {searching && (
          <div className={styles.status}>
            <span className={styles.spinner} />
            {remoteStatus && STATUS_TEXT[remoteStatus]
              ? pick(STATUS_TEXT[remoteStatus])
              : remoteStatus}
          </div>
        )}
        {searching && roomCode && (
          <div className={styles.roomCodeBox}>
            <span className={styles.roomCodeLabel}>{t('房间码', 'Room code')}</span>
            <span className={styles.roomCode}>{roomCode}</span>
            <span className={styles.roomCodeHint}>
              {t('告诉好友这四个字符即可加入', 'Share this code with a friend')}
            </span>
          </div>
        )}
        {error && <div className={styles.error}>{error}</div>}

        {!searching && tab === 'queue' && (
          <div className={styles.buttons}>
            <button className={styles.goldBtn} onClick={() => begin('queue')}>
              {t('开始匹配', 'Find Match')}
            </button>
            <button className={styles.plainBtn} onClick={onCancel}>
              {t('关闭', 'Close')}
            </button>
          </div>
        )}

        {!searching && tab === 'room' && (
          <>
            <button className={styles.goldBtn} onClick={() => begin('create-room')}>
              {t('创建房间', 'Create Room')}
            </button>
            <div className={styles.joinRow}>
              <input
                className={styles.codeInput}
                value={joinCode}
                maxLength={8}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder={t('房间码', 'Code')}
              />
              <button
                className={styles.goldBtn}
                disabled={joinCode.trim().length < 4}
                onClick={() => begin('join-room')}
              >
                {t('加入', 'Join')}
              </button>
              {/* 观战:同一个房间码,以观战席接入。看得到双方场面与手牌数,
                  但看不到任何一方的手牌牌面(服务端 redactForSpectator 保证) */}
              <button
                className={styles.plainBtn}
                disabled={joinCode.trim().length < 4}
                onClick={() => begin('watch-room')}
              >
                {t('观战', 'Watch')}
              </button>
            </div>
            <div className={styles.buttons}>
              <button className={styles.plainBtn} onClick={onCancel}>
                {t('关闭', 'Close')}
              </button>
            </div>
          </>
        )}

        {searching && (
          <div className={styles.buttons}>
            <button className={styles.plainBtn} onClick={onCancel}>
              {t('取消', 'Cancel')}
            </button>
          </div>
        )}

        {!searching && ladder && ladder.length > 0 && (
          <div className={styles.ladderBox}>
            <div className={styles.ladderTitle}>{t('天梯前十', 'Top 10')}</div>
            {ladder.map((row, i) => (
              <div key={`${row.name}-${i}`} className={styles.ladderRow}>
                <span className={styles.ladderNo}>{i + 1}</span>
                <span className={styles.ladderName}>{row.name}</span>
                <span className={styles.ladderRank}>{pickCompact(rankOf(row.rating))}</span>
                <span className={styles.ladderScore}>{row.rating}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
