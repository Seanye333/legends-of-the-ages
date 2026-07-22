import { useState } from 'react'
import { BOSSES, bossDeck } from '../../content/campaign'
import { RELICS_BY_ID, combineRelics } from '../../content/relics'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { useExpedition } from '../../app/expeditionStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './ExpeditionScreen.module.css'

interface ExpeditionScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 远征:单人 roguelike。选一副牌,连打 8 关 Boss,每通一关三选一宝物。
export function ExpeditionScreen({ onBack, onEnterMatch }: ExpeditionScreenProps) {
  const t = useT()
  const pick = usePickText()
  const customDecks = useCollection((s) => s.customDecks)
  const { run, bestDepth, start, pickRelic, abandon } = useExpedition()
  const [deckIndex, setDeckIndex] = useState(0)
  const myDecks = [...PRECON_DECKS, ...customDecks]

  const beginRun = () => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    playSfx('buttonTap')
    start(mine.heroId, mine.cardIds.slice())
  }

  const fight = () => {
    if (!run) return
    const boss = BOSSES[run.stage]
    if (!boss) return
    const myHero = HEROES_BY_ID[run.heroId]
    const { bonusHp, modifiers } = combineRelics(run.relics)
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [run.heroId, boss.heroId],
      deckIds: [run.deck.slice(), bossDeck(boss.doctrine, boss.deckTier)],
      expedition: true,
      heroPowersOverride: [myHero?.power, boss.power],
      heroHpsOverride: [(myHero?.hp ?? START_HP) + bonusHp, boss.hp],
      modifiersOverride: [modifiers, undefined],
    })
    onEnterMatch()
  }

  const header = (
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
      <h2 className={styles.title}>{t('远征 · 逐鹿中原', 'Expedition')}</h2>
      <span className={styles.best}>
        {t(`最深:${bestDepth}/8 关`, `Best: ${bestDepth}/8`)}
      </span>
    </header>
  )

  // ---- 选宝物 ----
  if (run && run.offered) {
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.relicPrompt}>
          {t(`第 ${run.stage + 1} 关已克 —— 择一宝物`, `Stage ${run.stage + 1} cleared — choose a relic`)}
        </div>
        <div className={styles.relicRow}>
          {run.offered.map((id) => {
            const r = RELICS_BY_ID[id]
            if (!r) return null
            return (
              <button
                key={id}
                className={`${styles.relicCard} ${styles[r.rarity]}`}
                onClick={() => {
                  playSfx('cardPlay')
                  haptic('impact')
                  pickRelic(id)
                }}
              >
                <div className={styles.relicName}>{pick(r.name)}</div>
                <div className={styles.relicRarity}>
                  {pick(
                    { rare: { zh: '稀有', en: 'Rare' }, epic: { zh: '史诗', en: 'Epic' }, legendary: { zh: '传说', en: 'Legendary' } }[
                      r.rarity
                    ],
                  )}
                </div>
                <div className={styles.relicText}>{pick(r.text)}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 进行中的远征:关卡进度 + 已得宝物 + 开战 ----
  if (run) {
    const boss = BOSSES[run.stage]
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.map}>
          {BOSSES.map((b, i) => (
            <div
              key={b.id}
              className={`${styles.node} ${i < run.stage ? styles.cleared : i === run.stage ? styles.current : ''}`}
              title={pick(b.name)}
            >
              {i < run.stage ? '✓' : i + 1}
            </div>
          ))}
        </div>

        {boss && (
          <div className={styles.bossCard}>
            <div className={styles.bossPortrait}>
              <Portrait id={boss.heroId} nameZh={boss.name.zh} doctrine={boss.doctrine} />
            </div>
            <div className={styles.bossInfo}>
              <div className={styles.bossName}>
                {t(`第 ${run.stage + 1} 关`, `Stage ${run.stage + 1}`)} · {pick(boss.name)}
              </div>
              <div className={styles.bossTitle}>{pick(boss.title)}</div>
              <div className={styles.bossHp}>{t(`血量 ${boss.hp}`, `${boss.hp} HP`)}</div>
            </div>
            <button className={styles.fightBtn} onClick={fight}>
              {t('开战', 'Fight')}
            </button>
          </div>
        )}

        <div className={styles.relicsHeld}>
          <div className={styles.relicsHeldHead}>
            {t(`已得宝物(${run.relics.length})`, `Relics (${run.relics.length})`)}
          </div>
          {run.relics.length === 0 ? (
            <span className={styles.relicsEmpty}>{t('尚无 —— 通关即可择宝', 'None yet — clear a stage to choose one')}</span>
          ) : (
            <div className={styles.relicsList}>
              {run.relics.map((id) => {
                const r = RELICS_BY_ID[id]
                return (
                  <span key={id} className={`${styles.relicChip} ${styles[r?.rarity ?? 'rare']}`} title={r ? pick(r.text) : id}>
                    {r ? pick(r.name) : id}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <button
          className={styles.abandonBtn}
          onClick={() => {
            playSfx('buttonTap')
            abandon()
          }}
        >
          {t('放弃远征', 'Abandon expedition')}
        </button>
      </div>
    )
  }

  // ---- 没有进行中的远征:选牌开局 ----
  const mine = myDecks[deckIndex % myDecks.length]
  return (
    <div className={styles.screen}>
      {header}
      <p className={styles.intro}>
        {t(
          '选一副牌,连闯 8 关。每通一关择一宝物,越滚越强;败一场,远征即止。',
          'Pick a deck and fight through 8 stages. Choose a relic after each — but one defeat ends the run.',
        )}
      </p>
      <div className={styles.deckPick}>
        <button
          className={styles.arrow}
          onClick={() => setDeckIndex((i) => (i - 1 + myDecks.length) % myDecks.length)}
        >
          ‹
        </button>
        <div className={styles.deckCard}>
          {mine && (
            <>
              <div className={styles.deckPortrait}>
                <Portrait
                  id={mine.heroId}
                  nameZh={HEROES_BY_ID[mine.heroId]?.name.zh ?? mine.heroId}
                  doctrine={HEROES_BY_ID[mine.heroId]?.doctrine ?? 'neutral'}
                />
              </div>
              <div className={styles.deckName}>{pick(mine.name)}</div>
              <div className={styles.deckHero}>
                {pick(HEROES_BY_ID[mine.heroId]?.name ?? { zh: mine.heroId, en: mine.heroId })}
              </div>
            </>
          )}
        </div>
        <button className={styles.arrow} onClick={() => setDeckIndex((i) => (i + 1) % myDecks.length)}>
          ›
        </button>
      </div>
      <button className={styles.startBtn} onClick={beginRun}>
        {t('出征', 'Set Out')}
      </button>
    </div>
  )
}
