import { useState } from 'react'
import type { CSSProperties } from 'react'
import {
  HISTORY_BATTLES,
  battleDeck,
  battleModifiers,
  type HistoryBattle,
} from '../../content/historyBattles'
import { PRECON_DECKS } from '../../content/decks'
import { useHistory } from '../../app/historyStore'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { Portrait } from '../components/Portrait'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
// 复用「群雄逐鹿」的版式:同为「选卡组 → 挑一关 → 出战」的单人关卡列表,
// 沿用同一套样式,视觉与冒险模式保持一致,也省得再复刻一整份 CSS。
import styles from './CampaignScreen.module.css'

interface HistoryScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 历史名战「名局重现」。可自由重打的设定局,靠开局态势重现历史战场;首通发奖。
export function HistoryScreen({ onBack, onEnterMatch }: HistoryScreenProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const cleared = useHistory((s) => s.cleared)
  const begin = useHistory((s) => s.begin)
  const customDecks = useCollection((s) => s.customDecks)
  const [selected, setSelected] = useState<HistoryBattle | null>(null)
  const [deckIndex, setDeckIndex] = useState(0)

  const myDecks = [...PRECON_DECKS, ...customDecks]

  const fight = (battle: HistoryBattle) => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    if (!begin(battle.id)) return
    playSfx('duel')
    haptic('impact')
    const myHero = HEROES_BY_ID[mine.heroId]
    launchMatch({
      heroIds: [mine.heroId, battle.heroId],
      deckIds: [mine.cardIds.slice(), battleDeck(battle)],
      history: true,
      // 历史名战的不对称:敌方血更厚、主公技更强、卡组更好 —— 与 campaign 同;
      // 额外再叠一层双方开局态势(座位 0=我方 / 座位 1=敌方),这是设定局的灵魂。
      heroPowersOverride: [myHero?.power, battle.power],
      heroHpsOverride: [myHero?.hp ?? START_HP, battle.hp],
      modifiersOverride: battleModifiers(battle),
      objective: battle.objective,
    })
    onEnterMatch()
  }

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
        <h2 className={styles.title}>{t('名局重现', 'Great Battles')}</h2>
        <span className={styles.progress}>
          {cleared.length} / {HISTORY_BATTLES.length}
        </span>
      </header>

      <div className={styles.deckPicker}>
        <span className={styles.deckLabel}>{t('出征卡组', 'Your deck')}</span>
        {myDecks.map((d, i) => (
          <button
            key={`${d.heroId}-${d.name.zh}-${i}`}
            className={i === deckIndex ? styles.deckActive : styles.deckBtn}
            onClick={() => {
              playSfx('buttonTap')
              setDeckIndex(i)
            }}
          >
            {pickCompact(d.name)}
          </button>
        ))}
      </div>

      <ol className={styles.road}>
        {HISTORY_BATTLES.map((b, i) => {
          const done = cleared.includes(b.id)
          return (
            <li
              key={b.id}
              className={`${styles.stage} ${done ? styles.done : ''}`}
              style={{ '--doctrine': DOCTRINE_COLORS[b.doctrine] } as CSSProperties}
            >
              <button
                className={styles.stageBtn}
                aria-label={`${pick(b.name)} — ${pick(b.foeName)}`}
                onClick={() => {
                  playSfx('buttonTap')
                  setSelected(b)
                }}
              >
                <span className={styles.stageNo}>{i + 1}</span>
                <span className={styles.stagePortrait}>
                  <Portrait id={b.heroId} nameZh={b.foeName.zh} doctrine={b.doctrine} />
                </span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>{pickCompact(b.name)}</span>
                  <span className={styles.stageTitle}>{pick(b.era)}</span>
                </span>
                <span className={styles.stageMeta}>
                  {done ? (
                    <span className={styles.clearedTag}>{t('已破', 'Cleared')}</span>
                  ) : (
                    <span className={styles.hp}>{pickCompact(b.foeName)}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div
            className={styles.brief}
            role="dialog"
            aria-modal="true"
            aria-label={pick(selected.name)}
            style={{ '--doctrine': DOCTRINE_COLORS[selected.doctrine] } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.briefPortrait}>
              <Portrait
                id={selected.heroId}
                nameZh={selected.foeName.zh}
                doctrine={selected.doctrine}
                full
              />
            </div>
            <h3 className={styles.briefName}>
              {pick(selected.name)}
              <span className={styles.briefTitle}>{pick(selected.era)}</span>
            </h3>
            <p className={styles.briefIntro}>{pick(selected.intro)}</p>
            <div className={styles.briefStats}>
              <span>
                {t('对手', 'Foe')}{' '}
                <b>
                  {pickCompact(selected.foeName)} · {pick(selected.foeTitle)}
                </b>
              </span>
              <span>
                {t('血量', 'Health')} <b>{selected.hp}</b>
              </span>
              <span>
                {t('主义', 'Doctrine')} <b>{pickCompact(DOCTRINE_NAME[selected.doctrine])}</b>
              </span>
            </div>
            <p className={styles.briefIntro}>{pick(selected.situation)}</p>
            <div className={styles.briefPower}>
              <span className={styles.briefPowerName}>{pickCompact(selected.power.name)}</span>
              <span className={styles.briefPowerText}>{pick(selected.power.text)}</span>
            </div>
            <p className={styles.briefReward}>
              {cleared.includes(selected.id)
                ? t('已通关 —— 重打不再发放战利', 'Cleared — no further spoils')
                : t(
                    `首通战利:卡包 ×${selected.rewardPacks},功勋 +${selected.rewardMerit}`,
                    `First clear: ${selected.rewardPacks} packs, +${selected.rewardMerit} merit`,
                  )}
            </p>
            <div className={styles.briefActions}>
              <button className={styles.primary} onClick={() => fight(selected)}>
                {t('出战', 'Fight')}
              </button>
              <button className={styles.plain} onClick={() => setSelected(null)}>
                {t('再看看', 'Not yet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
