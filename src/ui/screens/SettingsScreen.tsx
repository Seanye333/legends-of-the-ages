import { useEffect, useState } from 'react'
import { useSettings } from '../../app/settingsStore'
import { useCollection } from '../../app/collectionStore'
import { getSyncStatus, onSyncStatus, syncNow, type SyncStatus } from '../../app/profileSync'
import { getPlayerId } from '../../app/leaderboard'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { useT, usePickText } from '../i18n'
import { playSfx, setMasterVolume, setMusicVolume, startMusic, stopMusic } from '../sound'
import { ConfirmDialog } from '../components/ConfirmDialog'
import styles from './SettingsScreen.module.css'

interface SettingsScreenProps {
  onBack: () => void
}

const SYNC_LABEL: Record<SyncStatus, { zh: string; en: string }> = {
  idle: { zh: '未同步', en: 'Not synced' },
  syncing: { zh: '同步中…', en: 'Syncing…' },
  synced: { zh: '已同步', en: 'Synced' },
  offline: { zh: '离线(本地优先,不影响游玩)', en: 'Offline — local-first, play continues' },
}

// 设置页。之前根本没有这一屏:语言/音效/难度是标题页上的三排小胶囊,
// 没有音量、没有战绩、没有账号、也没有「立即同步」——
// 而 profileSync 里的 syncNow()/getSyncStatus()/onSyncStatus() 早就写好了,
// 注释直接写着「设置页『立即同步』用」,却一个调用方都没有。
export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const t = useT()
  const pick = usePickText()
  const s = useSettings()
  const wins = useCollection((c) => c.wins)
  const losses = useCollection((c) => c.losses)
  const packs = useCollection((c) => c.packs)
  const merit = useCollection((c) => c.merit)
  const owned = useCollection((c) => c.owned)

  const [sync, setSync] = useState<SyncStatus>(getSyncStatus())
  const [confirmReset, setConfirmReset] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => onSyncStatus(setSync), [])

  const total = wins + losses
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0
  const ownedCount = Object.values(owned).filter((n) => n > 0).length

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button
          className={styles.backBtn}
          onClick={() => {
            playSfx('buttonTap')
            onBack()
          }}
        >
          {t('← 返回', '← Back')}
        </button>
        <h2 className={styles.title}>{t('设置', 'Settings')}</h2>
      </header>

      {/* ---- 战绩:一直在记录、一直在同步,但界面上从来没显示过 ---- */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('战绩', 'Record')}</h3>
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{wins}</span>
            <span className={styles.statLabel}>{t('胜', 'Wins')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{losses}</span>
            <span className={styles.statLabel}>{t('负', 'Losses')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{winRate}%</span>
            <span className={styles.statLabel}>{t('胜率', 'Win rate')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {ownedCount}
              <small>/{COLLECTIBLE_CARDS.length}</small>
            </span>
            <span className={styles.statLabel}>{t('收集', 'Collected')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{packs}</span>
            <span className={styles.statLabel}>{t('卡包', 'Packs')}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{merit}</span>
            <span className={styles.statLabel}>{t('功勋', 'Merit')}</span>
          </div>
        </div>
      </section>

      {/* ---- 音频 ---- */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('音效', 'Audio')}</h3>
        <label className={styles.toggleRow}>
          <span>{t('音效开关', 'Sound effects')}</span>
          <input
            type="checkbox"
            checked={s.soundEnabled}
            onChange={(e) => {
              s.setSoundEnabled(e.target.checked)
              if (e.target.checked) playSfx('buttonTap')
            }}
          />
        </label>
        <label className={styles.sliderRow}>
          <span>
            {t('音效音量', 'SFX volume')} · {Math.round(s.volume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.volume * 100)}
            disabled={!s.soundEnabled}
            onChange={(e) => {
              const v = Number(e.target.value) / 100
              s.setVolume(v)
              setMasterVolume(v)
            }}
            onPointerUp={() => playSfx('buttonTap')}
          />
        </label>
        <label className={styles.toggleRow}>
          <span>
            {t('背景音乐', 'Music')}
            <small className={styles.hint}>
              {t('五声音阶实时合成,不循环固定旋律', 'Pentatonic, synthesised live — never loops')}
            </small>
          </span>
          <input
            type="checkbox"
            checked={s.musicEnabled}
            onChange={(e) => {
              s.setMusicEnabled(e.target.checked)
              if (e.target.checked) startMusic('title')
              else stopMusic()
            }}
          />
        </label>
        <label className={styles.sliderRow}>
          <span>
            {t('音乐音量', 'Music volume')} · {Math.round(s.musicVolume * 100)}%
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.musicVolume * 100)}
            disabled={!s.musicEnabled || !s.soundEnabled}
            onChange={(e) => {
              const v = Number(e.target.value) / 100
              s.setMusicVolume(v)
              setMusicVolume(v)
            }}
          />
        </label>
      </section>

      {/* ---- 显示 ---- */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('显示', 'Display')}</h3>
        <div className={styles.chipRow}>
          {(['zh', 'en', 'both'] as const).map((lang) => (
            <button
              key={lang}
              className={s.language === lang ? styles.chipActive : styles.chip}
              onClick={() => {
                playSfx('buttonTap')
                s.setLanguage(lang)
              }}
            >
              {lang === 'zh' ? '中文' : lang === 'en' ? 'English' : '双语 · Both'}
            </button>
          ))}
        </div>
        <label className={styles.toggleRow}>
          <span>
            {t('减少动效', 'Reduce motion')}
            <small className={styles.hint}>
              {t('关闭冲锋/震屏/斩杀白闪', 'Turns off lunge, shake and lethal flash')}
            </small>
          </span>
          <input
            type="checkbox"
            checked={s.reducedMotion}
            onChange={(e) => s.setReducedMotion(e.target.checked)}
          />
        </label>
      </section>

      {/* ---- 难度 ---- */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('敌手强度', 'AI difficulty')}</h3>
        <div className={styles.chipRow}>
          {(
            [
              { k: 'recruit', zh: '新兵', en: 'Recruit', d: { zh: '常有失误,看不见多步斩杀', en: 'Blunders often; misses multi-step lethal' } },
              { k: 'veteran', zh: '宿将', en: 'Veteran', d: { zh: '偶尔失误', en: 'Occasional blunders' } },
              { k: 'general', zh: '名将', en: 'Legend', d: { zh: '零失误,必算斩杀', en: 'No blunders; always finds lethal' } },
            ] as const
          ).map((o) => (
            <button
              key={o.k}
              className={s.difficulty === o.k ? styles.chipActive : styles.chip}
              title={pick(o.d)}
              onClick={() => {
                playSfx('buttonTap')
                s.setDifficulty(o.k)
              }}
            >
              {pick({ zh: o.zh, en: o.en })}
            </button>
          ))}
        </div>
        <p className={styles.hint}>
          {pick(
            [
              { zh: '新兵', en: 'Recruit' },
              { zh: '宿将', en: 'Veteran' },
              { zh: '名将', en: 'Legend' },
            ][['recruit', 'veteran', 'general'].indexOf(s.difficulty)] ?? { zh: '', en: '' },
          )}
          {' — '}
          {pick(
            [
              { zh: '常有失误,且看不见多步斩杀线', en: 'Blunders often and cannot see multi-step lethal' },
              { zh: '偶尔失误', en: 'Blunders occasionally' },
              { zh: '零失误,每回合先算一遍斩杀', en: 'No blunders; checks for lethal every turn' },
            ][['recruit', 'veteran', 'general'].indexOf(s.difficulty)] ?? { zh: '', en: '' },
          )}
        </p>
      </section>

      {/* ---- 账号与存档 ---- */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('存档', 'Save data')}</h3>
        <div className={styles.kvRow}>
          <span>{t('云同步', 'Cloud sync')}</span>
          <span className={styles.kvValue}>{pick(SYNC_LABEL[sync])}</span>
        </div>
        <div className={styles.kvRow}>
          <span>{t('设备 ID', 'Device ID')}</span>
          <code className={styles.deviceId}>{getPlayerId()}</code>
        </div>
        <p className={styles.hint}>
          {t(
            '存档本地优先,云端只是镜像。换设备时把这串 ID 抄过去即可延续进度 —— 目前还没有账号系统。',
            'Saves are local-first; the cloud is only a mirror. To move devices, copy this ID over — there is no account system yet.',
          )}
        </p>
        <div className={styles.buttonRow}>
          <button
            className={styles.action}
            onClick={() => {
              playSfx('buttonTap')
              void syncNow().then(setSync)
            }}
          >
            {t('立即同步', 'Sync now')}
          </button>
          <button
            className={styles.action}
            onClick={() => {
              playSfx('buttonTap')
              void navigator.clipboard?.writeText(getPlayerId())
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            }}
          >
            {copied ? t('已复制', 'Copied') : t('复制设备 ID', 'Copy device ID')}
          </button>
          <button className={styles.danger} onClick={() => setConfirmReset(true)}>
            {t('清空本地进度', 'Reset local progress')}
          </button>
        </div>
      </section>

      {confirmReset && (
        <ConfirmDialog
          title={t('清空本地进度?', 'Reset local progress?')}
          body={t(
            '收藏、卡包、功勋、战绩与自组卡组都会清空,且无法撤销。若此前同步过云端,下次同步会以清空后的版本覆盖。',
            'Your collection, packs, merit, record and custom decks will be erased. This cannot be undone, and the next cloud sync will overwrite the server copy.',
          )}
          confirmLabel={t('清空', 'Erase')}
          cancelLabel={t('取消', 'Cancel')}
          onConfirm={() => {
            localStorage.removeItem('qiangu-collection')
            localStorage.removeItem('qiangu-quests')
            localStorage.removeItem('qiangu-replays')
            location.reload()
          }}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  )
}
