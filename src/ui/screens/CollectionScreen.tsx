import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef, CardInstance, Doctrine } from '../../engine/types'
import { CARDS } from '../../content/cards'
import { useCollection } from '../../app/collectionStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { useT, usePickText } from '../i18n'
import { playSfx } from '../sound'
import styles from './CollectionScreen.module.css'

const DOCTRINE_TABS: { key: Doctrine | 'neutral' | 'all'; zh: string; en: string }[] = [
  { key: 'all', zh: '全部', en: 'All' },
  { key: 'royal', zh: '王道', en: 'Royal' },
  { key: 'hegemonic', zh: '霸道', en: 'Hegemony' },
  { key: 'ritual', zh: '礼教', en: 'Ritual' },
  { key: 'fame', zh: '名利', en: 'Fame' },
  { key: 'separatist', zh: '割据', en: 'Separatist' },
  { key: 'reclusion', zh: '隐逸', en: 'Reclusion' },
  { key: 'neutral', zh: '中立', en: 'Neutral' },
]

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 } as const
const PAGE = 48

export function fakeInstance(def: CardDef): CardInstance {
  return {
    iid: -def.collectorNo,
    defId: def.id,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    keywords: def.keywords,
    exhausted: false,
    attacksUsed: 0,
    enchants: [],
  }
}

interface CollectionScreenProps {
  onBack: () => void
}

// 名将图鉴:全卡池浏览,主义筛选 + 搜索 + 拥有标记。
export function CollectionScreen({ onBack }: CollectionScreenProps) {
  const t = useT()
  const pick = usePickText()
  const owned = useCollection((s) => s.owned)
  const [tab, setTab] = useState<(typeof DOCTRINE_TABS)[number]['key']>('all')
  const [query, setQuery] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [limit, setLimit] = useState(PAGE)
  const [inspect, setInspect] = useState<CardDef | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim()
    return CARDS.filter((c) => {
      if (tab !== 'all' && c.doctrine !== tab) return false
      if (ownedOnly && !(owned[c.id] > 0)) return false
      if (q && !c.name.zh.includes(q) && !c.name.en.toLowerCase().includes(q.toLowerCase()))
        return false
      return true
    }).sort(
      (a, b) =>
        RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] ||
        a.cost - b.cost ||
        a.collectorNo - b.collectorNo,
    )
  }, [tab, query, ownedOnly, owned])

  const ownedCount = useMemo(() => Object.values(owned).filter((n) => n > 0).length, [owned])
  const shown = filtered.slice(0, limit)

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
        <h2 className={styles.title}>{t('名将图鉴', 'Collection')}</h2>
        <span className={styles.count}>
          {t(`已收 ${ownedCount} / ${CARDS.length}`, `${ownedCount} / ${CARDS.length}`)}
        </span>
      </header>

      <div className={styles.filters}>
        <div className={styles.tabs}>
          {DOCTRINE_TABS.map((d) => (
            <button
              key={d.key}
              className={tab === d.key ? styles.tabActive : styles.tab}
              style={
                d.key !== 'all'
                  ? ({ '--doctrine': DOCTRINE_COLORS[d.key] } as CSSProperties)
                  : undefined
              }
              onClick={() => {
                playSfx('buttonTap')
                setTab(d.key)
                setLimit(PAGE)
              }}
            >
              {pick({ zh: d.zh, en: d.en })}
            </button>
          ))}
        </div>
        <div className={styles.toolsRow}>
          <input
            className={styles.search}
            placeholder={t('搜索名将…', 'Search…')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
          />
          <button
            className={ownedOnly ? styles.toggleActive : styles.toggle}
            onClick={() => {
              playSfx('buttonTap')
              setOwnedOnly(!ownedOnly)
              setLimit(PAGE)
            }}
          >
            {t('仅看已拥有', 'Owned only')}
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {shown.map((def) => {
          const n = owned[def.id] ?? 0
          return (
            <div key={def.id} className={`${styles.cell} ${n === 0 ? styles.unowned : ''}`}>
              <CardFace inst={fakeInstance(def)} onClick={() => setInspect(def)} />
              {n > 0 && <span className={styles.ownedBadge}>×{n}</span>}
            </div>
          )
        })}
      </div>

      {shown.length < filtered.length && (
        <button
          className={styles.moreBtn}
          onClick={() => {
            playSfx('buttonTap')
            setLimit((l) => l + PAGE)
          }}
        >
          {t(`加载更多(${shown.length}/${filtered.length})`, `Load more (${shown.length}/${filtered.length})`)}
        </button>
      )}
      {filtered.length === 0 && <p className={styles.empty}>{t('没有符合条件的卡', 'No cards match')}</p>}

      {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
    </div>
  )
}
