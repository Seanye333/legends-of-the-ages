import { useState } from 'react'
import type { CSSProperties } from 'react'
import { BOSSES, bossDeck, bossPersonality, bossField } from '../../content/campaign'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { useBossRush, BOSS_RUSH_HEAL } from '../../app/bossRushStore'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { Portrait } from '../components/Portrait'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
// 与冒险同为「选卡组 → 一路往下打」的单人关卡页,沿用同一套版式
import styles from './CampaignScreen.module.css'

interface Props {
  onBack: () => void
  onEnterMatch: () => void
}

// 群雄連斬:十六关一口气连打,血量继承,中途不给任何补给。
// 冒险问的是「你会不会打这个对手」,连斩问的是「你的卡组撑不撑得住十六场」。
export function BossRushScreen({ onBack, onEnterMatch }: Props) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const { stage, hp, best, cleared, begin } = useBossRush()
  const customDecks = useCollection((s) => s.customDecks)
  const [deckIndex, setDeckIndex] = useState(0)
  const myDecks = [...PRECON_DECKS, ...customDecks]
  const boss = BOSSES[stage]

  const fight = () => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine || !boss) return
    const myHero = HEROES_BY_ID[mine.heroId]
    const startHp = myHero?.hp ?? START_HP
    begin(startHp)
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [mine.heroId, boss.heroId],
      deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
      bossRush: true,
      bossId: boss.id,
      heroPowersOverride: [myHero?.power, boss.power],
      // 继承来的血量在这里落地 —— 这一行就是整个模式
      heroHpsOverride: [hp ?? startHp, boss.hp],
      aiWeights: bossPersonality(boss.id),
      field: bossField(boss.id),
    })
    onEnterMatch()
  }

  return (
    <div className={styles.screen} data-mode="gauntlet">
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
        <h2 className={styles.title}>{t('群雄連斬', 'Gauntlet')}</h2>
        <span className={styles.progress}>
          {t(`最遠 ${best} / ${BOSSES.length}`, `Best ${best} / ${BOSSES.length}`)}
        </span>
      </header>

      <p className={styles.briefIntro} style={{ maxWidth: 720, margin: '0 auto 14px' }}>
        {t(
          `十六位群雄按序而来,中途不换卡组、不回满血 —— 每胜一场只回 ${BOSS_RUSH_HEAL} 点。倒下即从头再来。`,
          `Sixteen contenders in a row. No new deck, no full heal — only ${BOSS_RUSH_HEAL} HP between fights. Fall once and start over.`,
        )}
        {cleared && t(' 你已经走通过一次。', ' You have walked it through once.')}
      </p>

      <div className={styles.deckPicker}>
        <span className={styles.deckLabel}>{t('出征卡组', 'Your deck')}</span>
        {myDecks.map((d, i) => (
          <button
            key={`${d.heroId}-${d.name.zh}-${i}`}
            className={i === deckIndex ? styles.deckActive : styles.deckBtn}
            disabled={hp !== null}
            onClick={() => {
              playSfx('buttonTap')
              setDeckIndex(i)
            }}
          >
            {pickCompact(d.name)}
          </button>
        ))}
      </div>

      {boss && (
        <div
          className={styles.brief}
          style={
            {
              '--doctrine': DOCTRINE_COLORS[boss.doctrine],
              margin: '0 auto',
              width: 'min(400px, 100%)',
            } as CSSProperties
          }
        >
          <div className={styles.briefPortrait}>
            <Portrait id={boss.heroId} nameZh={boss.name.zh} doctrine={boss.doctrine} full />
          </div>
          <h3 className={styles.briefName}>
            {t(`第 ${stage + 1} 陣 · `, `Bout ${stage + 1} · `)}
            {pick(boss.name)}
            <span className={styles.briefTitle}>{pick(boss.title)}</span>
          </h3>
          <div className={styles.briefStats}>
            <span>
              {t('你的血量', 'Your HP')}{' '}
              <b>{hp ?? (HEROES_BY_ID[myDecks[deckIndex % myDecks.length]?.heroId]?.hp ?? START_HP)}</b>
            </span>
            <span>
              {t('对手', 'Foe')} <b>{boss.hp}</b>
            </span>
          </div>
          <div className={styles.briefActions}>
            <button className={styles.primary} onClick={fight}>
              {stage === 0 ? t('开阵', 'Begin') : t('续战', 'Fight on')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
