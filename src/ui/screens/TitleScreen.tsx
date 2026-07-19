import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CARDS, CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES } from '../../content/overrides/heroes'
import type { CardDef } from '../../engine/types'
import { quickDeck, type StartMatchArgs } from '../../app/matchStore'
import { usePickText, useT } from '../i18n'
import { useSettings } from '../../app/settingsStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { launchMatch } from '../matchSetup'
import { initSound, playSfx } from '../sound'
import { useCollection } from '../../app/collectionStore'
import type { DeckList } from '../../content/decks'
import { PackOpening } from '../components/PackOpening'
import styles from './TitleScreen.module.css'

function MiniCard({ card }: { card: CardDef }) {
  const pick = usePickText()
  const frameRarity = {
    common: '',
    rare: styles.frameRare,
    epic: styles.frameEpic,
    legendary: styles.frameLegendary,
  }[card.rarity]
  return (
    <div
      className={`${styles.card} ${frameRarity}`}
      style={{ '--doctrine': DOCTRINE_COLORS[card.doctrine] } as CSSProperties}
    >
      <span className={styles.cost}>{card.cost}</span>
      <div className={styles.portraitBox}>
        <img
          className={styles.portrait}
          src={`${import.meta.env.BASE_URL}portraits/${card.id}.webp`}
          alt={card.name.zh}
          loading="lazy"
        />
      </div>
      <div className={styles.cardName}>{pick(card.name)}</div>
      <div className={styles.statsRow}>
        <span className={styles.attack}>{card.attack}</span>
        <span className={`${styles.rarity} ${styles[card.rarity]}`} />
        <span className={styles.health}>{card.health}</span>
      </div>
    </div>
  )
}

// 可选卡组 = 预组 + 自组;AI 恒拿一套预组。
function buildMatchArgs(decks: DeckList[], myDeckIndex: number): StartMatchArgs {
  if (decks.length >= 1 && PRECON_DECKS.length >= 1) {
    const mine = decks[myDeckIndex % decks.length]
    const ai = PRECON_DECKS[(myDeckIndex + 1) % PRECON_DECKS.length]
    return {
      heroIds: [mine.heroId, ai.heroId],
      deckIds: [mine.cardIds.slice(), ai.cardIds.slice()],
    }
  }
  return {
    heroIds: [HEROES[0]?.id ?? 'liu-bei', HEROES[1]?.id ?? 'cao-cao'],
    deckIds: [quickDeck(), quickDeck()],
  }
}

interface TitleScreenProps {
  onStart?: () => void
  onNavigate?: (screen: 'collection' | 'deckbuilder') => void
}

export function TitleScreen({ onStart, onNavigate }: TitleScreenProps) {
  const t = useT()
  const pick = usePickText()
  const { language, setLanguage, soundEnabled, setSoundEnabled } = useSettings()
  const customDecks = useCollection((s) => s.customDecks)
  const packs = useCollection((s) => s.packs)
  const [deckIndex, setDeckIndex] = useState(0)
  const [startError, setStartError] = useState<string | null>(null)
  const [packsOpen, setPacksOpen] = useState(false)
  const dynastyCount = new Set(CARDS.map((c) => c.dynasty)).size
  const gallery = SIGNATURE_IDS.map((id) => CARDS_BY_ID[id]).filter(Boolean)
  const selectableDecks = useMemo(
    () => [...PRECON_DECKS, ...customDecks],
    [customDecks],
  )
  const hasPrecons = selectableDecks.length >= 2

  useEffect(() => initSound(), [])

  const onPlay = () => {
    playSfx('buttonTap')
    try {
      launchMatch(buildMatchArgs(selectableDecks, deckIndex))
      setStartError(null)
      onStart?.()
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={styles.screen}>
      <div className={styles.bg} aria-hidden="true" />
      <div className={styles.bgVignette} aria-hidden="true" />

      <header className={styles.masthead}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>千古名将</h1>
          <span className={styles.seal} aria-hidden="true">
            <span>名</span>
            <span>将</span>
          </span>
        </div>
        <p className={styles.subtitle}>Legends of the Ages</p>
        <div className={styles.rule} aria-hidden="true">
          <span className={styles.ruleDiamond} />
        </div>
        <p className={styles.tagline}>
          {t(
            `全卡池 ${CARDS.length} 张 · 横跨 ${dynastyCount} 个朝代阵营`,
            `${CARDS.length} cards across ${dynastyCount} dynasties`,
          )}
        </p>
      </header>

      {hasPrecons && (
        <div className={styles.deckRow}>
          {selectableDecks.map((deck, i) => (
            <button
              key={`${deck.heroId}-${deck.name.zh}-${i}`}
              className={i === deckIndex ? styles.deckActive : styles.deckBtn}
              onClick={() => {
                playSfx('buttonTap')
                setDeckIndex(i)
              }}
            >
              {pick(deck.name)}
            </button>
          ))}
        </div>
      )}

      <button className={styles.playButton} onClick={onPlay}>
        {t('开始对战', 'Play')}
      </button>

      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            onNavigate?.('collection')
          }}
        >
          {t('名将图鉴', 'Collection')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            onNavigate?.('deckbuilder')
          }}
        >
          {t('组建卡组', 'Deck Builder')}
        </button>
        <button
          className={`${styles.navBtn} ${packs > 0 ? styles.navGlow : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setPacksOpen(true)
          }}
        >
          {t(`卡包 ×${packs}`, `Packs ×${packs}`)}
        </button>
      </div>
      {startError && (
        <p className={styles.errorLine} role="alert">
          {t('开局失败:', 'Failed to start: ')}
          {startError}
        </p>
      )}

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
        <button
          className={soundEnabled ? styles.langActive : styles.lang}
          onClick={() => {
            setSoundEnabled(!soundEnabled)
            playSfx('buttonTap')
          }}
          title={t('音效开关', 'Sound on/off')}
        >
          {soundEnabled ? '音' : '静'}
        </button>
      </div>

      <div className={styles.galleryHead} aria-hidden="true">
        <span className={styles.galleryHeadLine} />
        <span className={styles.galleryHeadText}>{t('名将图鉴', 'Gallery of Legends')}</span>
        <span className={styles.galleryHeadLine} />
      </div>

      <div className={styles.gallery}>
        {gallery.map((card) => (
          <MiniCard key={card.id} card={card} />
        ))}
      </div>

      {packsOpen && <PackOpening onClose={() => setPacksOpen(false)} />}
    </div>
  )
}
