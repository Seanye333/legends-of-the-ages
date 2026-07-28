import { useMemo } from 'react'
import { useCollection } from '../../app/collectionStore'
import { useCampaign } from '../../app/campaignStore'
import { useHistory } from '../../app/historyStore'
import { useTower } from '../../app/towerStore'
import { useExpedition } from '../../app/expeditionStore'
import { useBossRush } from '../../app/bossRushStore'
import { useDeckStats, winRate } from '../../app/deckStatsStore'
import { modeCounts } from '../../app/telemetry'
import { BOSSES } from '../../content/campaign'
import { HISTORY_BATTLES } from '../../content/historyBattles'
import { eraProgress } from '../../content/collectionGoals'
import { rankOf, toNextRank, warMerit } from '../../content/ranks'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './StudyScreen.module.css'

interface Props {
  onBack: () => void
}

// 書房 —— 一屏看完「我在这个游戏里做过什么」。
//
// 【为什么需要】
// 进度散落在八个 store 里:冒险在 campaignStore、名局在 historyStore、
// 爬塔在 towerStore、远征在 expeditionStore、收藏在 collectionStore……
// 每一个都只在自己那一屏露出,于是**没有任何一屏能回答「我玩了多少」**。
// 军衔给了一个总分,书房给的是那个分数的**明细**。
//
// 【为什么不做成成就页的一部分】
// 功名簿回答的是「还有什么可领」——它天然是一张待办清单。
// 书房回答的是「我做过什么」,是一张回顾。两者的读法完全不同,合在一起谁都读不好。
export function StudyScreen({ onBack }: Props) {
  const t = useT()
  const pick = usePickText()
  const owned = useCollection((s) => s.owned)
  const wins = useCollection((s) => s.wins)
  const losses = useCollection((s) => s.losses)
  const campaignDone = useCampaign((s) => s.cleared.length)
  const trialsDone = useCampaign((s) => s.trialsCleared.length)
  const historyDone = useHistory((s) => s.cleared.length)
  const towerBest = useTower((s) => s.best)
  const expeditionDepth = useExpedition((s) => s.bestDepth)
  const bossRushBest = useBossRush((s) => s.best)
  const records = useDeckStats((s) => s.records)

  const merit = warMerit({
    casualWins: wins,
    campaignCleared: campaignDone,
    trialsCleared: trialsDone,
    historyCleared: historyDone,
    expeditionDepth,
    towerBest,
    bossRushBest,
  })
  const rank = rankOf(merit)
  const next = toNextRank(merit)

  const ownedCount = useMemo(
    () => COLLECTIBLE_CARDS.filter((c) => (owned[c.id] ?? 0) > 0).length,
    [owned],
  )
  const eras = useMemo(() => eraProgress(owned), [owned])
  const counts = useMemo(() => modeCounts(), [])

  // 里程碑:把「你打了多少局」这件事说成一句人话。
  // 只报**刚刚跨过**的那一档 —— 每局都恭喜一次就没人看了。
  const total = wins + losses
  const milestone = [1000, 500, 300, 200, 100, 50, 25, 10].find((n) => total >= n)

  const bestDeck = useMemo(() => {
    const entries = Object.entries(records).filter(([, r]) => r.wins + r.losses >= 5)
    if (entries.length === 0) return null
    return entries.sort((a, b) => (winRate(b[1]) ?? 0) - (winRate(a[1]) ?? 0))[0]
  }, [records])

  const row = (label: string, value: string) => (
    <div className={styles.row} key={label}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  )

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
        <h2 className={styles.title}>{t('書房', 'The Study')}</h2>
      </header>

      <section className={styles.card}>
        <div className={styles.rankBig}>{pick(rank.rank.name)}</div>
        <div className={styles.rankMeta}>
          {t(`累计战功 ${merit}`, `${merit} war merit`)}
          {next && ` · ${t(`距${pick(rank.next!.name)}还差 ${next.need}`, `${next.need} to ${pick(rank.next!.name)}`)}`}
        </div>
        {milestone && (
          <div className={styles.milestone}>
            {t(`你已经打过 ${milestone} 局以上了。`, `You have played more than ${milestone} matches.`)}
          </div>
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('征戰', 'Campaigns')}</h3>
        {row(t('群雄逐鹿', 'Contenders'), `${campaignDone} / ${BOSSES.length}`)}
        {row(t('關底試煉', 'Trials'), `${trialsDone} / ${BOSSES.length}`)}
        {row(t('名局重現', 'Great Battles'), `${historyDone} / ${HISTORY_BATTLES.length}`)}
        {row(t('登樓最高', 'Tower'), `${towerBest}`)}
        {row(t('遠征最深', 'Expedition'), `${expeditionDepth} / ${BOSSES.length}`)}
        {row(t('群雄連斬', 'Gauntlet'), `${bossRushBest} / ${BOSSES.length}`)}
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('典藏', 'Collection')}</h3>
        {row(t('已收', 'Owned'), `${ownedCount} / ${COLLECTIBLE_CARDS.length}`)}
        {eras.map((e) =>
          row(pick(e.name), `${e.owned} / ${e.total} (${Math.round(e.ratio * 100)}%)`),
        )}
      </section>

      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('戰績', 'Record')}</h3>
        {row(t('勝 / 負', 'Wins / Losses'), `${wins} / ${losses}`)}
        {bestDeck &&
          row(
            t('最好的一套牌', 'Best deck'),
            `${winRate(bestDeck[1]) ?? 0}% (${bestDeck[1].wins}胜 ${bestDeck[1].losses}负)`,
          )}
        {Object.entries(counts).length > 0 && (
          <>
            <div className={styles.subTitle}>{t('玩得最多的模式', 'Most played')}</div>
            {Object.entries(counts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([k, n]) => row(k, `${n}`))}
          </>
        )}
      </section>
    </div>
  )
}
