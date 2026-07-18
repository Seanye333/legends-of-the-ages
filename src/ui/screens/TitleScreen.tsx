import { CARDS, CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import type { CardDef } from '../../engine/types'
import { usePickText, useT } from '../i18n'
import { useSettings } from '../../app/settingsStore'
import styles from './TitleScreen.module.css'

const DOCTRINE_COLORS: Record<CardDef['doctrine'], string> = {
  royal: '#d4a84a',
  hegemonic: '#b8442e',
  ritual: '#88b7e8',
  fame: '#c19a3b',
  separatist: '#7a5a3a',
  reclusion: '#7a9a5a',
  neutral: '#8a8a8a',
}

function MiniCard({ card }: { card: CardDef }) {
  const pick = usePickText()
  return (
    <div className={styles.card} style={{ borderColor: DOCTRINE_COLORS[card.doctrine] }}>
      <span className={styles.cost}>{card.cost}</span>
      <img
        className={styles.portrait}
        src={`${import.meta.env.BASE_URL}portraits/${card.id}.webp`}
        alt={card.name.zh}
        loading="lazy"
      />
      <div className={styles.cardName}>{pick(card.name)}</div>
      <div className={styles.statsRow}>
        <span className={styles.attack}>{card.attack}</span>
        <span className={`${styles.rarity} ${styles[card.rarity]}`}>●</span>
        <span className={styles.health}>{card.health}</span>
      </div>
    </div>
  )
}

export function TitleScreen() {
  const t = useT()
  const { language, setLanguage } = useSettings()
  const dynastyCount = new Set(CARDS.map((c) => c.dynasty)).size
  const gallery = SIGNATURE_IDS.map((id) => CARDS_BY_ID[id]).filter(Boolean)

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>千古名将</h1>
      <p className={styles.subtitle}>Legends of the Ages</p>
      <p className={styles.tagline}>
        {t(
          `全卡池 ${CARDS.length} 张 · 横跨 ${dynastyCount} 个朝代阵营`,
          `${CARDS.length} cards across ${dynastyCount} dynasties`,
        )}
      </p>
      <div className={styles.gallery}>
        {gallery.map((card) => (
          <MiniCard key={card.id} card={card} />
        ))}
      </div>
      <button className={styles.playButton} disabled>
        {t('开始对战(Phase 1)', 'Play (Phase 1)')}
      </button>
      <div className={styles.langSwitch}>
        {(['zh', 'en', 'both'] as const).map((lang) => (
          <button
            key={lang}
            className={lang === language ? styles.langActive : styles.lang}
            onClick={() => setLanguage(lang)}
          >
            {lang === 'zh' ? '中' : lang === 'en' ? 'EN' : '双'}
          </button>
        ))}
      </div>
    </div>
  )
}
