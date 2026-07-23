import { useState } from 'react'
import { BRAWLS } from '../../content/brawls'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './BrawlScreen.module.css'

interface BrawlScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 乱斗:选一副牌 + 一个乱斗规则,和一个随机预组 AI 打一场怪规则的对局(规则双方同吃)。
export function BrawlScreen({ onBack, onEnterMatch }: BrawlScreenProps) {
  const t = useT()
  const pick = usePickText()
  const customDecks = useCollection((s) => s.customDecks)
  const [deckIndex, setDeckIndex] = useState(0)
  const myDecks = [...PRECON_DECKS, ...customDecks]

  const fight = (brawlIndex: number) => {
    const brawl = BRAWLS[brawlIndex]
    const mine = myDecks[deckIndex % myDecks.length]
    if (!brawl || !mine) return
    // 对手:随机一套预组(用 seed 派生,避免 Math.random 在渲染期的不确定)
    const oppSeed = Math.floor(Math.random() * PRECON_DECKS.length)
    const opp = PRECON_DECKS[oppSeed]
    const myHero = HEROES_BY_ID[mine.heroId]
    const oppHero = HEROES_BY_ID[opp.heroId]
    const hp = START_HP + (brawl.hpDelta ?? 0)
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [mine.heroId, opp.heroId],
      deckIds: [mine.cardIds.slice(), opp.cardIds.slice()],
      heroPowersOverride: [myHero?.power, oppHero?.power],
      heroHpsOverride: [hp, hp],
      modifiersOverride: [brawl.modifiers, brawl.modifiers], // 规则双方同吃
    })
    onEnterMatch()
  }

  const mine = myDecks[deckIndex % myDecks.length]

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
        <h2 className={styles.title}>{t('乱斗 · 群雄混战', 'Brawl')}</h2>
      </header>

      <p className={styles.intro}>
        {t('选一副牌,挑一个乱斗规则 —— 规则双方同吃,图个痛快。', 'Pick a deck and a wild ruleset. The rules hit both sides — just for fun.')}
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
            </>
          )}
        </div>
        <button className={styles.arrow} onClick={() => setDeckIndex((i) => (i + 1) % myDecks.length)}>
          ›
        </button>
      </div>

      <div className={styles.brawlList}>
        {BRAWLS.map((b, i) => (
          <button key={b.id} className={styles.brawlCard} onClick={() => fight(i)}>
            <div className={styles.brawlName}>{pick(b.name)}</div>
            <div className={styles.brawlText}>{pick(b.text)}</div>
            <div className={styles.brawlGo}>{t('开战 ›', 'Fight ›')}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
