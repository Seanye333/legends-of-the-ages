import { useMemo, useState } from 'react'
import { exportCareerImage, type CareerProfile } from '../careerExport'
import { useCollection } from '../../app/collectionStore'
import { useCampaign } from '../../app/campaignStore'
import { useHistory } from '../../app/historyStore'
import { useTower } from '../../app/towerStore'
import { useExpedition } from '../../app/expeditionStore'
import { useBossRush } from '../../app/bossRushStore'
import { useDeckStats, winRate } from '../../app/deckStatsStore'
import { modeCounts, modeName } from '../../app/telemetry'
import { BOSSES } from '../../content/campaign'
import { HISTORY_BATTLES } from '../../content/historyBattles'
import { eraProgress } from '../../content/collectionGoals'
import { useRecords, type RecordKey } from '../../app/recordsStore'
import { rankOf, toNextRank, warMerit } from '../../content/ranks'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { useLang, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './StudyScreen.module.css'

interface Props {
  onBack: () => void
}

// 纪录的展示顺序与名字。**每一项都要能一句话读懂它是什么局面** ——
// 一列光秃秃的数字读不出故事,而故事才是纪录这件事的全部意义。
const RECORD_ORDER: RecordKey[] = [
  'fastestWin',
  'mostSlain',
  'mostDamage',
  'mostFaceDamage',
  'peakBoard',
  'longestStreak',
]

const RECORD_NAME: Record<RecordKey, { zh: string; en: string }> = {
  fastestWin: { zh: '速勝 —— 最少回合拿下', en: 'Swiftest win' },
  mostSlain: { zh: '屠場 —— 單局斬敵最多', en: 'Most generals slain' },
  mostDamage: { zh: '破陣 —— 單局總傷害', en: 'Most damage in a match' },
  mostFaceDamage: { zh: '面傷 —— 單局打在主公臉上', en: 'Most damage to the enemy hero' },
  peakBoard: { zh: '陣容 —— 同時在場最多', en: 'Largest board' },
  longestStreak: { zh: '連勝 —— 最長的一串', en: 'Longest win streak' },
}

const RECORD_UNIT: Record<RecordKey, { zh: string; en: string }> = {
  fastestWin: { zh: ' 回合', en: ' turns' },
  mostSlain: { zh: ' 員', en: '' },
  mostDamage: { zh: '', en: '' },
  mostFaceDamage: { zh: '', en: '' },
  peakBoard: { zh: ' 員', en: '' },
  longestStreak: { zh: ' 連勝', en: '' },
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
  const useLangIsZh = useLang() !== 'en'
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

  const best = useRecords((s) => s.best)
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  // 生涯档案:把这一屏排好版发出去。
  // 内容**跟着屏幕走**(同一批数字、同样的顺序),不另起一套 ——
  // 两处各写一份的话,改了一处忘了另一处,发出去的图就和屏幕对不上。
  const shareCareer = async () => {
    playSfx('buttonTap')
    const profile: CareerProfile = {
      rank: pick(rank.rank.name),
      merit,
      title: milestone
        ? t(`已經打過 ${milestone} 局以上`, `More than ${milestone} matches played`)
        : '',
      sections: [
        {
          heading: t('征戰', 'Campaigns'),
          lines: [
            { label: t('群雄逐鹿', 'Contenders'), value: `${campaignDone} / ${BOSSES.length}` },
            { label: t('關底試煉', 'Trials'), value: `${trialsDone} / ${BOSSES.length}` },
            { label: t('名局重現', 'Great Battles'), value: `${historyDone} / ${HISTORY_BATTLES.length}` },
            { label: t('登樓最高', 'Tower'), value: `${towerBest}` },
            { label: t('遠征最深', 'Expedition'), value: `${expeditionDepth}` },
          ],
        },
        {
          heading: t('個人紀錄', 'Personal Bests'),
          lines: RECORD_ORDER.filter((k) => best[k]).map((k) => ({
            label: pick(RECORD_NAME[k]),
            value: `${best[k]!.value}${pick(RECORD_UNIT[k])}`,
          })),
        },
        {
          heading: t('典藏', 'Collection'),
          lines: [
            { label: t('已收', 'Owned'), value: `${ownedCount} / ${COLLECTIBLE_CARDS.length}` },
            { label: t('勝 / 負', 'Wins / Losses'), value: `${wins} / ${losses}` },
          ],
        },
      ],
    }
    const outcome = await exportCareerImage(profile, useLangIsZh)
    setExportMsg(
      outcome === 'failed'
        ? t('出图失败', 'Could not render the image')
        : outcome === 'canceled'
          ? null
          : outcome === 'shared'
            ? t('已分享', 'Shared')
            : t('已保存到下载', 'Saved to downloads'),
    )
  }

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
        <button className={styles.shareBtn} onClick={shareCareer}>
          {t('生涯檔案', 'Export')}
        </button>
      </header>
      {exportMsg && <p className={styles.exportMsg}>{exportMsg}</p>}

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

      {/* 個人紀錄:书房其余部分全是**累计量**(只会涨,所以没有紧张感);
          纪录是**会被打破的**,每一局都可能有事发生。放在战绩之前 ——
          它比「一共赢了多少局」更值得先看到。 */}
      <section className={styles.card}>
        <h3 className={styles.sectionTitle}>{t('個人紀錄', 'Personal Bests')}</h3>
        {RECORD_ORDER.every((k) => !best[k]) ? (
          <p className={styles.emptyHint}>
            {t(
              '还没有纪录 —— 打完一局就会有第一条。',
              'No records yet — your first match will set them all.',
            )}
          </p>
        ) : (
          RECORD_ORDER.filter((k) => best[k]).map((k) => (
            <div className={styles.row} key={k}>
              <span className={styles.rowLabel}>
                {pick(RECORD_NAME[k])}
                <span className={styles.recordDate}>{best[k]!.date}</span>
              </span>
              <span className={styles.rowValue}>
                {best[k]!.value}
                {pick(RECORD_UNIT[k])}
              </span>
            </div>
          ))
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
              .map(([k, n]) => row(pick(modeName(k)), `${n}`))}
          </>
        )}
      </section>
    </div>
  )
}
