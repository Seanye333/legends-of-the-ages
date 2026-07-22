import { useDeferredValue, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef, CardType, HeroDef, LocalizedText } from '../../engine/types'
import { DECK_SIZE } from '../../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../../content/cards'
import { ALL_HEROES } from '../../content/overrides/heroes'
import { PRECON_DECKS, type DeckList } from '../../content/decks'

// 主公选择器按主义分组:同主义的基准与备选主公相邻。
const DOCTRINE_ORDER = ['royal', 'hegemonic', 'ritual', 'fame', 'separatist', 'reclusion']
const HERO_PICKS = [...ALL_HEROES].sort(
  (a, b) => DOCTRINE_ORDER.indexOf(a.doctrine) - DOCTRINE_ORDER.indexOf(b.doctrine),
)
import { decodeDeck, encodeDeck } from '../../content/deckCode'
import { useCollection, copyLimit } from '../../app/collectionStore'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { Portrait } from '../components/Portrait'
import { fakeInstance } from './CollectionScreen'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './DeckBuilderScreen.module.css'

interface DeckBuilderScreenProps {
  onBack: () => void
}

// 卡组构筑:选主公定主义 → 本主义 + 中立卡池(仅已拥有)→ 凑满 30 张保存。
type SortKey = 'cost' | 'attack' | 'rarity' | 'name'

const POOL_PAGE = 60
const RARITY_RANK = { legendary: 0, epic: 1, rare: 2, common: 3 } as const

const TYPE_FILTERS: { key: 'all' | CardType; label: LocalizedText }[] = [
  { key: 'all', label: { zh: '全部', en: 'All' } },
  { key: 'general', label: { zh: '武将', en: 'Generals' } },
  { key: 'stratagem', label: { zh: '锦囊', en: 'Stratagems' } },
  { key: 'equipment', label: { zh: '装备', en: 'Equipment' } },
]

const SORTS: { key: SortKey; label: LocalizedText }[] = [
  { key: 'cost', label: { zh: '按费用', en: 'By cost' } },
  { key: 'attack', label: { zh: '按攻击', en: 'By attack' } },
  { key: 'rarity', label: { zh: '按稀有', en: 'By rarity' } },
  { key: 'name', label: { zh: '按名字', en: 'By name' } },
]

export function DeckBuilderScreen({ onBack }: DeckBuilderScreenProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const owned = useCollection((s) => s.owned)
  const customDecks = useCollection((s) => s.customDecks)
  const saveDeck = useCollection((s) => s.saveDeck)
  const deleteDeck = useCollection((s) => s.deleteDeck)

  const [hero, setHero] = useState<HeroDef | null>(null)
  const [deckName, setDeckName] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [errors, setErrors] = useState<LocalizedText[]>([])
  const [savedMsg, setSavedMsg] = useState(false)
  const [inspect, setInspect] = useState<CardDef | null>(null)
  // 图鉴一直有搜索和筛选,构筑器却什么都没有 —— 卡池一大就只能靠滚。
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | CardType>('all')
  const [sort, setSort] = useState<SortKey>('cost')
  const [poolLimit, setPoolLimit] = useState(POOL_PAGE)
  const [codeInput, setCodeInput] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])

  const pool = useMemo(() => {
    if (!hero) return []
    const q = deferredQuery.trim()
    const qLower = q.toLowerCase()
    const list = COLLECTIBLE_CARDS.filter((c) => {
      if (c.doctrine !== hero.doctrine && c.doctrine !== 'neutral') return false
      if ((owned[c.id] ?? 0) <= 0) return false
      if (typeFilter !== 'all' && c.type !== typeFilter) return false
      if (q && !c.name.zh.includes(q) && !c.name.en.toLowerCase().includes(qLower)) return false
      return true
    })
    const byName = (a: CardDef, b: CardDef) => a.name.zh.localeCompare(b.name.zh, 'zh')
    switch (sort) {
      case 'cost':
        return list.sort((a, b) => a.cost - b.cost || a.collectorNo - b.collectorNo)
      case 'attack':
        return list.sort((a, b) => (b.attack ?? 0) - (a.attack ?? 0) || a.cost - b.cost)
      case 'rarity':
        return list.sort(
          (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity] || a.cost - b.cost,
        )
      case 'name':
        return list.sort(byName)
    }
  }, [hero, owned, deferredQuery, typeFilter, sort])

  const shownPool = useMemo(() => pool.slice(0, poolLimit), [pool, poolLimit])

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

  // 载入预组当模板:名字后缀「· 改」,免得一保存就把预组名占掉
  const loadPrecon = (deck: DeckList) => {
    playSfx('buttonTap')
    setHero(ALL_HEROES.find((x) => x.id === deck.heroId) ?? null)
    setDeckName(`${deck.name.zh} · 改`)
    const c: Record<string, number> = {}
    for (const id of deck.cardIds) c[id] = (c[id] ?? 0) + 1
    setCounts(c)
    setErrors([])
    setSavedMsg(false)
  }

  const onCopyCode = () => {
    if (!hero || total !== DECK_SIZE) return
    playSfx('buttonTap')
    const cardIds = Object.entries(counts).flatMap(([id, n]) => Array.from({ length: n }, () => id))
    const heroNo = CARDS_BY_ID[hero.id]?.collectorNo ?? 0
    try {
      const code = encodeDeck(
        { heroId: hero.id, name: { zh: deckName, en: deckName }, cardIds },
        CARDS_BY_ID,
        heroNo,
      )
      void navigator.clipboard?.writeText(code)
      setCodeCopied(true)
      window.setTimeout(() => setCodeCopied(false), 1800)
    } catch {
      setErrors([{ zh: '生成卡组码失败', en: 'Could not generate a deck code' }])
    }
  }

  // 解码失败要给人话,不能把 'bad-base64' 这种内部码怼给玩家
  const onImportCode = () => {
    playSfx('buttonTap')
    try {
      const decoded = decodeDeck(codeInput, CARDS_BY_ID)
      const h = ALL_HEROES.find((x) => x.id === decoded.heroId)
      if (!h) throw new Error('unknown-hero')
      setHero(h)
      const c: Record<string, number> = {}
      for (const id of decoded.cardIds) c[id] = (c[id] ?? 0) + 1
      setCounts(c)
      setDeckName(t('导入的卡组', 'Imported deck'))
      setCodeInput('')
      setErrors([])
      setSavedMsg(false)
      playSfx('heal')
    } catch (e) {
      const reason = e instanceof Error ? e.message : ''
      setErrors([
        reason.startsWith('unknown-card')
          ? { zh: '卡组码里有本版本不存在的卡', en: 'This code contains cards not in this version' }
          : reason === 'bad-size'
            ? { zh: '卡组码不是完整的 30 张', en: 'That code is not a full 30-card deck' }
            : { zh: '卡组码无法识别', en: 'That deck code could not be read' },
      ])
    }
  }

  const loadDeck = (deckNameZh: string) => {
    const deck = customDecks.find((d) => d.name.zh === deckNameZh)
    if (!deck) return
    playSfx('buttonTap')
    const h = ALL_HEROES.find((x) => x.id === deck.heroId) ?? null
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
          {HERO_PICKS.map((h) => (
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
              <div className={styles.heroName}>{pickCompact(h.name)}</div>
              <div className={styles.heroDoctrine}>{pickCompact(DOCTRINE_NAME[h.doctrine])}</div>
              {/* 主公技是选主公时最该看到的信息 —— 六个主义的打法差别就在这一行 */}
              <div className={styles.heroPower}>
                <span className={styles.heroPowerName}>{pickCompact(h.power.name)}</span>
                <span className={styles.heroPowerText}>{pick(h.power.text)}</span>
              </div>
            </button>
          ))}
        </div>

        {/* 六套预组可以直接载入当模板改 —— 从零凑 30 张对新玩家太劝退 */}
        <div className={styles.savedList}>
          <div className={styles.savedHead}>{t('以预组为模板', 'Start from a preconstructed deck')}</div>
          {PRECON_DECKS.map((d) => (
            <div key={d.name.zh} className={styles.savedRow}>
              <button className={styles.savedName} onClick={() => loadPrecon(d)}>
                {pickCompact(d.name)}
              </button>
              <span className={styles.savedHero}>
                {pickCompact(ALL_HEROES.find((h) => h.id === d.heroId)?.name ?? { zh: d.heroId, en: d.heroId })}
              </span>
            </div>
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
                  {pickCompact(ALL_HEROES.find((h) => h.id === d.heroId)?.name ?? { zh: d.heroId, en: d.heroId })}
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
          {pickCompact(hero.name)} · {pickCompact(DOCTRINE_NAME[hero.doctrine])}
        </div>
        <span className={styles.deckCount}>
          {total}/{DECK_SIZE}
        </span>
      </header>

      <div className={styles.builder}>
        <div className={styles.poolPane}>
          <div className={styles.poolTools}>
            <input
              className={styles.poolSearch}
              placeholder={t('搜索卡池…', 'Search pool…')}
              value={query}
              aria-label={t('搜索卡池', 'Search pool')}
              onChange={(e) => {
                setQuery(e.target.value)
                setPoolLimit(POOL_PAGE)
              }}
            />
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.key}
                className={typeFilter === f.key ? styles.chipActive : styles.chip}
                onClick={() => {
                  playSfx('buttonTap')
                  setTypeFilter(f.key)
                  setPoolLimit(POOL_PAGE)
                }}
              >
                {pickCompact(f.label)}
              </button>
            ))}
            {SORTS.map((s) => (
              <button
                key={s.key}
                className={sort === s.key ? styles.chipActive : styles.chip}
                onClick={() => {
                  playSfx('buttonTap')
                  setSort(s.key)
                }}
              >
                {pickCompact(s.label)}
              </button>
            ))}
            <span className={styles.poolCount}>
              {shownPool.length}/{pool.length}
            </span>
          </div>
          <div className={styles.poolGrid}>
            {shownPool.map((def) => {
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
          {shownPool.length < pool.length && (
            <button
              className={styles.moreBtn}
              onClick={() => {
                playSfx('buttonTap')
                setPoolLimit((n) => n + POOL_PAGE)
              }}
            >
              {t(
                `加载更多(${shownPool.length}/${pool.length})`,
                `Load more (${shownPool.length}/${pool.length})`,
              )}
            </button>
          )}
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
              <div key={cost} className={styles.curveCol} title={t(`${cost}${cost === 7 ? '+' : ''}费 ×${n}`, `${cost}${cost === 7 ? '+' : ''} mana ×${n}`)}>
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
                    <span className={styles.rowName}>
                      {pickCompact(def?.name ?? { zh: id, en: id })}
                    </span>
                    <span className={styles.rowCount}>×{n}</span>
                  </button>
                )
              })}
            {total === 0 && <p className={styles.hint}>{t('点左侧卡牌加入卡组', 'Tap cards to add')}</p>}
          </div>
          {errors.length > 0 && (
            <div className={styles.errors}>
              {errors.map((e, i) => (
                <div key={i}>{pick(e)}</div>
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

          {/* 卡组码:以前只能导出单张卡面的 PNG,卡组本身没法分享给任何人 */}
          <div className={styles.codeRow}>
            <button
              className={styles.codeBtn}
              disabled={total !== DECK_SIZE}
              onClick={onCopyCode}
            >
              {codeCopied ? t('已复制卡组码', 'Code copied') : t('复制卡组码', 'Copy deck code')}
            </button>
            <input
              className={styles.codeInput}
              placeholder={t('粘贴卡组码…', 'Paste a deck code…')}
              value={codeInput}
              aria-label={t('粘贴卡组码', 'Paste a deck code')}
              onChange={(e) => setCodeInput(e.target.value)}
            />
            <button className={styles.codeBtn} disabled={!codeInput.trim()} onClick={onImportCode}>
              {t('导入', 'Import')}
            </button>
          </div>
        </div>
      </div>

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}
