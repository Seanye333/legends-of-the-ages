import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef, HeroDef } from '../../engine/types'
import { DECK_SIZE } from '../../engine/types'
import { CARDS, CARDS_BY_ID } from '../../content/cards'
import { HEROES } from '../../content/overrides/heroes'
import { useCollection, copyLimit } from '../../app/collectionStore'
import { DOCTRINE_COLORS, DOCTRINE_ZH } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { Portrait } from '../components/Portrait'
import { fakeInstance } from './CollectionScreen'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './DeckBuilderScreen.module.css'

interface DeckBuilderScreenProps {
  onBack: () => void
}

// 卡组构筑:选主公定主义 → 本主义 + 中立卡池(仅已拥有)→ 凑满 30 张保存。
export function DeckBuilderScreen({ onBack }: DeckBuilderScreenProps) {
  const t = useT()
  const owned = useCollection((s) => s.owned)
  const customDecks = useCollection((s) => s.customDecks)
  const saveDeck = useCollection((s) => s.saveDeck)
  const deleteDeck = useCollection((s) => s.deleteDeck)

  const [hero, setHero] = useState<HeroDef | null>(null)
  const [deckName, setDeckName] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<string[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const [inspect, setInspect] = useState<CardDef | null>(null)

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  const pool = useMemo(() => {
    if (!hero) return []
    return CARDS.filter(
      (c) => (c.doctrine === hero.doctrine || c.doctrine === 'neutral') && (owned[c.id] ?? 0) > 0,
    ).sort((a, b) => a.cost - b.cost || a.collectorNo - b.collectorNo)
  }, [hero, owned])

  const curve = useMemo(() => {
    const bars = Array.from({ length: 8 }, () => 0)
    for (const [id, n] of Object.entries(counts)) {
      const cost = Math.min(7, CARDS_BY_ID[id]?.cost ?? 0)
      bars[cost] += n
    }
    return bars
  }, [counts])
  const curveMax = Math.max(1, ...curve)

  const add = (id: string) => {
    const have = counts[id] ?? 0
    if (total >= DECK_SIZE) return
    if (have >= Math.min(copyLimit(id), owned[id] ?? 0)) return
    playSfx('cardPlay')
    setCounts((c) => ({ ...c, [id]: have + 1 }))
    setSavedMsg(false)
  }

  const remove = (id: string) => {
    playSfx('buttonTap')
    setCounts((c) => {
      const n = (c[id] ?? 0) - 1
      const next = { ...c }
      if (n <= 0) delete next[id]
      else next[id] = n
      return next
    })
    setSavedMsg(false)
  }

  const onSave = () => {
    if (!hero) return
    playSfx('buttonTap')
    const name = deckName.trim() || t('自组卡组', 'Custom Deck')
    const cardIds = Object.entries(counts).flatMap(([id, n]) => Array.from({ length: n }, () => id))
    const errs = saveDeck({ heroId: hero.id, name: { zh: name, en: name }, cardIds })
    setErrors(errs)
    if (errs.length === 0) {
      setSavedMsg(true)
      playSfx('heal')
    }
  }

  const loadDeck = (deckNameZh: string) => {
    const deck = customDecks.find((d) => d.name.zh === deckNameZh)
    if (!deck) return
    playSfx('buttonTap')
    const h = HEROES.find((x) => x.id === deck.heroId) ?? null
    setHero(h)
    setDeckName(deck.name.zh)
    const c: Record<string, number> = {}
    for (const id of deck.cardIds) c[id] = (c[id] ?? 0) + 1
    setCounts(c)
    setErrors([])
    setSavedMsg(false)
  }

  // —— 第一步:选主公 ——
  if (!hero) {
    return (
      <div className={styles.screen}>
        <header className={styles.head}>
          <button className={styles.backBtn} onClick={() => { playSfx('buttonTap'); onBack() }}>
            {t('← 返回', '← Back')}
          </button>
          <h2 className={styles.title}>{t('组建卡组 · 择主而事', 'Deck Builder')}</h2>
        </header>
        <div className={styles.heroRow}>
          {HEROES.map((h) => (
            <button
              key={h.id}
              className={styles.heroCard}
              style={{ '--doctrine': DOCTRINE_COLORS[h.doctrine] } as CSSProperties}
              onClick={() => {
                playSfx('buttonTap')
                setHero(h)
              }}
            >
              <div className={styles.heroPortrait}>
                <Portrait id={h.id} nameZh={h.name.zh} doctrine={h.doctrine} />
              </div>
              <div className={styles.heroName}>{h.name.zh}</div>
              <div className={styles.heroDoctrine}>{DOCTRINE_ZH[h.doctrine]}</div>
            </button>
          ))}
        </div>
        {customDecks.length > 0 && (
          <div className={styles.savedList}>
            <div className={styles.savedHead}>{t('已存卡组', 'Saved decks')}</div>
            {customDecks.map((d) => (
              <div key={d.name.zh} className={styles.savedRow}>
                <button className={styles.savedName} onClick={() => loadDeck(d.name.zh)}>
                  {d.name.zh}
                </button>
                <span className={styles.savedHero}>
                  {HEROES.find((h) => h.id === d.heroId)?.name.zh ?? d.heroId}
                </span>
                <button
                  className={styles.deleteBtn}
                  onClick={() => {
                    playSfx('buttonTap')
                    deleteDeck(d.name.zh)
                  }}
                >
                  {t('删除', 'Delete')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // —— 第二步:构筑 ——
  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button className={styles.backBtn} onClick={() => { playSfx('buttonTap'); setHero(null); setCounts({}); setErrors([]) }}>
          {t('← 换主公', '← Change hero')}
        </button>
        <div
          className={styles.heroChip}
          style={{ '--doctrine': DOCTRINE_COLORS[hero.doctrine] } as CSSProperties}
        >
          {hero.name.zh} · {DOCTRINE_ZH[hero.doctrine]}
        </div>
        <span className={styles.deckCount}>
          {total}/{DECK_SIZE}
        </span>
      </header>

      <div className={styles.builder}>
        <div className={styles.poolPane}>
          <div className={styles.poolGrid}>
            {pool.map((def) => {
              const inDeck = counts[def.id] ?? 0
              const limit = Math.min(copyLimit(def.id), owned[def.id] ?? 0)
              const maxed = inDeck >= limit || total >= DECK_SIZE
              return (
                <div key={def.id} className={`${styles.poolCell} ${maxed ? styles.maxed : ''}`}>
                  <CardFace
                    inst={fakeInstance(def)}
                    onInspect={() => setInspect(def)}
                    onClick={() => add(def.id)}
                  />
                  <span className={styles.limitTag}>
                    {inDeck}/{limit}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.deckPane}>
          <input
            className={styles.nameInput}
            placeholder={t('卡组名…', 'Deck name…')}
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
          />
          <div className={styles.curve}>
            {curve.map((n, cost) => (
              <div key={cost} className={styles.curveCol} title={`${cost}${cost === 7 ? '+' : ''}费 ×${n}`}>
                <div className={styles.curveBar} style={{ height: `${(n / curveMax) * 100}%` }} />
                <span className={styles.curveLabel}>{cost === 7 ? '7+' : cost}</span>
              </div>
            ))}
          </div>
          <div className={styles.deckList}>
            {Object.entries(counts)
              .sort(
                ([a], [b]) =>
                  (CARDS_BY_ID[a]?.cost ?? 0) - (CARDS_BY_ID[b]?.cost ?? 0) ||
                  a.localeCompare(b),
              )
              .map(([id, n]) => {
                const def = CARDS_BY_ID[id]
                return (
                  <button
                    key={id}
                    className={styles.deckRow}
                    style={{ '--doctrine': DOCTRINE_COLORS[def?.doctrine ?? 'neutral'] } as CSSProperties}
                    onClick={() => remove(id)}
                    title={t('点击移除一张', 'Click to remove one')}
                  >
                    <span className={styles.rowCost}>{def?.cost ?? '?'}</span>
                    <span className={styles.rowName}>{def?.name.zh ?? id}</span>
                    <span className={styles.rowCount}>×{n}</span>
                  </button>
                )
              })}
            {total === 0 && <p className={styles.hint}>{t('点左侧卡牌加入卡组', 'Tap cards to add')}</p>}
          </div>
          {errors.length > 0 && (
            <div className={styles.errors}>
              {errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
          {savedMsg && <div className={styles.savedOk}>{t('已保存!可在标题页选用', 'Saved!')}</div>}
          <div className={styles.actions}>
            <button className={styles.saveBtn} disabled={total !== DECK_SIZE} onClick={onSave}>
              {t(`保存卡组(${total}/${DECK_SIZE})`, `Save (${total}/${DECK_SIZE})`)}
            </button>
            <button className={styles.backBtn} onClick={() => { playSfx('buttonTap'); onBack() }}>
              {t('完成', 'Done')}
            </button>
          </div>
        </div>
      </div>

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}
