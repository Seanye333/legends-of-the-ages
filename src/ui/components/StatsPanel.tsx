import { useEffect, useMemo, useRef } from 'react'
import { useAchievements } from '../../app/achievementStore'
import { useCollection } from '../../app/collectionStore'
import { useExpedition } from '../../app/expeditionStore'
import { useDeckStats, winRate as deckWinRate } from '../../app/deckStatsStore'
import { PRECON_DECKS, deckKey } from '../../content/decks'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { DOCTRINE_NAME } from '../doctrineColors'
import type { Doctrine } from '../../engine/types'
import { usePickText, useT } from '../i18n'
import styles from './StatsPanel.module.css'

const POOL_TOTAL = COLLECTIBLE_CARDS.length
const LEGEND_TOTAL = COLLECTIBLE_CARDS.filter((c) => c.rarity === 'legendary').length

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
  const customDecks = useCollection((s) => s.customDecks)
  const deckRecords = useDeckStats((s) => s.records)
  const bestDepth = useExpedition((s) => s.bestDepth)
  const panelRef = useRef<HTMLDivElement>(null)

  // 每套卡组的战绩(按内容哈希去重),只列打过的,按场次排序取前几
  const deckRows = useMemo(() => {
    const seen = new Set<string>()
    const rows: { name: string; wins: number; losses: number; rate: number }[] = []
    for (const d of [...PRECON_DECKS, ...customDecks]) {
      const key = deckKey(d.heroId, d.cardIds)
      if (seen.has(key)) continue
      seen.add(key)
      const rec = deckRecords[key]
      if (!rec) continue
      const played = rec.wins + rec.losses + rec.draws
      if (played === 0) continue
      rows.push({ name: pick(d.name), wins: rec.wins, losses: rec.losses, rate: deckWinRate(rec) ?? 0 })
    }
    return rows.sort((a, b) => b.wins + b.losses - (a.wins + a.losses)).slice(0, 6)
  }, [customDecks, deckRecords, pick])

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
            <div className={styles.sectionTitle}>{t('收藏与磨练', 'Collection & Craft')}</div>
            <div className={styles.grid}>
              <Row label={t('收藏', 'Cards collected')} value={`${s('collectionSize')} / ${POOL_TOTAL}`} />
              <Row label={t('传说', 'Legendaries')} value={`${s('legendariesOwned')} / ${LEGEND_TOTAL}`} />
              <Row label={t('斩杀谜题', 'Lethal puzzles solved')} value={s('puzzlesSolved')} />
              <Row label={t('每日连击最长', 'Best daily streak')} value={s('bestPuzzleStreak')} />
            </div>
          </div>

          {deckRows.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>{t('卡组胜率', 'Deck Win Rates')}</div>
              <div className={styles.grid}>
                {deckRows.map((d) => (
                  <Row
                    key={d.name}
                    label={d.name}
                    value={t(
                      `${d.wins}胜${d.losses}负 · ${d.rate}%`,
                      `${d.wins}W ${d.losses}L · ${d.rate}%`,
                    )}
                  />
                ))}
              </div>
            </div>
          )}

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
