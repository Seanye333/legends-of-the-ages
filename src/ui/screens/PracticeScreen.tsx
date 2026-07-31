import { useState } from 'react'
import { PRECON_DECKS, type DeckList } from '../../content/decks'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { useCollection } from '../../app/collectionStore'
import type { Difficulty } from '../../app/settingsStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './PracticeScreen.module.css'

interface PracticeScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

const DIFFS: { key: Difficulty; zh: string; en: string }[] = [
  { key: 'recruit', zh: '新兵', en: 'Novice' },
  { key: 'veteran', zh: '宿将', en: 'Veteran' },
  { key: 'general', zh: '名将', en: 'Legend' },
  { key: 'marshal', zh: '军神', en: 'Marshal' },
]

// 演武场:自选双方主公/卡组 + AI 难度,自由对练。不计战绩/军令/成就 —— 纯练手、试阵、学对位。
export function PracticeScreen({ onBack, onEnterMatch }: PracticeScreenProps) {
  const t = useT()
  const pick = usePickText()
  const customDecks = useCollection((s) => s.customDecks)
  const decks = [...PRECON_DECKS, ...customDecks]
  const [mineIdx, setMineIdx] = useState(0)
  const [oppIdx, setOppIdx] = useState(decks.length > 1 ? 1 : 0)
  const [diff, setDiff] = useState<Difficulty>('veteran')
  // 热座:双人同机。放在演武场里而不是单开一个模式 ——
  // 它要的东西(自选双方主公与卡组)和演武场一模一样,只是把 AI 换成了另一个人。
  const [hotSeat, setHotSeat] = useState(false)

  const mine = decks[mineIdx % decks.length]
  const opp = decks[oppIdx % decks.length]

  const fight = () => {
    if (!mine || !opp) return
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [mine.heroId, opp.heroId],
      deckIds: [mine.cardIds.slice(), opp.cardIds.slice()],
      heroPowersOverride: [HEROES_BY_ID[mine.heroId]?.power, HEROES_BY_ID[opp.heroId]?.power],
      practice: true,
      difficultyOverride: diff,
      hotSeat,
    })
    onEnterMatch()
  }

  const picker = (
    deck: DeckList | undefined,
    setIdx: (fn: (i: number) => number) => void,
    label: string,
    accent: boolean,
  ) => (
    <div className={`${styles.side} ${accent ? styles.mineSide : ''}`}>
      <div className={styles.sideLabel}>{label}</div>
      <div className={styles.pickRow}>
        <button
          className={styles.arrow}
          aria-label={t('上一套', 'Previous')}
          onClick={() => setIdx((i) => (i - 1 + decks.length) % decks.length)}
        >
          ‹
        </button>
        <div className={styles.card}>
          {deck && (
            <>
              <div className={styles.portrait}>
                <Portrait
                  id={deck.heroId}
                  nameZh={HEROES_BY_ID[deck.heroId]?.name.zh ?? deck.heroId}
                  doctrine={HEROES_BY_ID[deck.heroId]?.doctrine ?? 'neutral'}
                />
              </div>
              <div className={styles.deckName}>{pick(deck.name)}</div>
            </>
          )}
        </div>
        <button
          className={styles.arrow}
          aria-label={t('下一套', 'Next')}
          onClick={() => setIdx((i) => (i + 1) % decks.length)}
        >
          ›
        </button>
      </div>
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
        <h2 className={styles.title}>{t('演武场 · 自由对练', 'Training Ground')}</h2>
      </header>

      <p className={styles.intro}>
        {t(
          '自选双方主公与卡组、挑一档 AI,随便打 —— 不计战绩、不刷军令,专为练手、试阵、学对位。',
          'Pick both heroes, both decks, and an AI tier. Nothing is recorded — pure practice, testing, and learning matchups.',
        )}
      </p>

      <div className={styles.arena}>
        {picker(mine, setMineIdx, t('你', 'You'), true)}
        <div className={styles.vs}>{t('对', 'vs')}</div>
        {picker(opp, setOppIdx, t('对手', 'Opponent'), false)}
      </div>

      <div className={styles.diffRow}>
        <span className={styles.diffLabel}>{t('对手强度', 'AI tier')}</span>
        {DIFFS.map((d) => (
          <button
            key={d.key}
            className={`${styles.diffBtn} ${diff === d.key ? styles.diffOn : ''}`}
            onClick={() => {
              playSfx('buttonTap')
              setDiff(d.key)
            }}
          >
            {t(d.zh, d.en)}
          </button>
        ))}
        {/* 热座:把 AI 换成坐在对面的人。同一台设备轮流出牌,换人时落一道帘。 */}
        <button
          className={`${styles.diffBtn} ${hotSeat ? styles.diffOn : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setHotSeat((v) => !v)
          }}
        >
          {t('热座双人', 'Hot seat')}
        </button>
      </div>

      <button className={styles.fightBtn} onClick={fight}>
        {hotSeat ? t('对坐开战 ›', 'Hot seat ›') : t('开战 ›', 'Fight ›')}
      </button>
    </div>
  )
}
