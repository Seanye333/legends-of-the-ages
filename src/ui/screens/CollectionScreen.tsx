import { useDeferredValue, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef, CardInstance, Doctrine, LocalizedText, Rarity } from '../../engine/types'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { useCollection } from '../../app/collectionStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { FoilLayer } from '../components/FoilLayer'
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

const RARITY_FILTERS: { key: Rarity | 'all'; label: LocalizedText }[] = [
  { key: 'all', label: { zh: '全稀有', en: 'All rarities' } },
  { key: 'legendary', label: { zh: '传说', en: 'Legendary' } },
  { key: 'epic', label: { zh: '史诗', en: 'Epic' } },
  { key: 'rare', label: { zh: '稀有', en: 'Rare' } },
  { key: 'common', label: { zh: '普通', en: 'Common' } },
]

const COST_FILTERS: { key: 'all' | '0-3' | '4-6' | '7+'; label: LocalizedText }[] = [
  { key: 'all', label: { zh: '全费用', en: 'All costs' } },
  { key: '0-3', label: { zh: '≤3 费', en: '≤3' } },
  { key: '4-6', label: { zh: '4-6 费', en: '4-6' } },
  { key: '7+', label: { zh: '≥7 费', en: '≥7' } },
]

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
    damage: 0,
    silenced: false,
    frozen: false,
    shieldUsed: false,
    stealthBroken: false,
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
  const merit = useCollection((s) => s.merit)
  const [tab, setTab] = useState<(typeof DOCTRINE_TABS)[number]['key']>('all')
  const [query, setQuery] = useState('')
  const [ownedOnly, setOwnedOnly] = useState(false)
  const [rarity, setRarity] = useState<Rarity | 'all'>('all')
  const [costBand, setCostBand] = useState<'all' | '0-3' | '4-6' | '7+'>('all')
  const [limit, setLimit] = useState(PAGE)
  const [inspect, setInspect] = useState<CardDef | null>(null)

  // 搜索防抖:每次按键都全量过滤 2000+ 张卡会明显掉帧
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return COLLECTIBLE_CARDS.filter((c) => {
      if (tab !== 'all' && c.doctrine !== tab) return false
      if (ownedOnly && !(owned[c.id] > 0)) return false
      if (rarity !== 'all' && c.rarity !== rarity) return false
      if (costBand === '0-3' && c.cost > 3) return false
      if (costBand === '4-6' && (c.cost < 4 || c.cost > 6)) return false
      if (costBand === '7+' && c.cost < 7) return false
      if (q && !c.name.zh.includes(deferredQuery.trim()) && !c.name.en.toLowerCase().includes(q))
        return false
      return true
    }).sort(
      (a, b) =>
        RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] ||
        a.cost - b.cost ||
        a.collectorNo - b.collectorNo,
    )
  }, [tab, deferredQuery, ownedOnly, rarity, costBand, owned])

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
          <span className={styles.meritBadge} title={t('功勋:分解重复卡获得,可定向合成任意卡', 'Merit: from disenchanting duplicates; spend it to craft any card')}>
            ✦ {merit}
          </span>
          {t(
            `已收 ${ownedCount} / ${COLLECTIBLE_CARDS.length}`,
            `${ownedCount} / ${COLLECTIBLE_CARDS.length}`,
          )}
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
        <div className={styles.toolsRow}>
          {RARITY_FILTERS.map((r) => (
            <button
              key={r.key}
              className={rarity === r.key ? styles.toggleActive : styles.toggle}
              onClick={() => {
                playSfx('buttonTap')
                setRarity(r.key)
                setLimit(PAGE)
              }}
            >
              {pick(r.label)}
            </button>
          ))}
          {COST_FILTERS.map((c) => (
            <button
              key={c.key}
              className={costBand === c.key ? styles.toggleActive : styles.toggle}
              onClick={() => {
                playSfx('buttonTap')
                setCostBand(c.key)
                setLimit(PAGE)
              }}
            >
              {pick(c.label)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.grid}>
        {shown.map((def) => {
          const n = owned[def.id] ?? 0
          return (
            <div key={def.id} className={`${styles.cell} ${n === 0 ? styles.unowned : ''}`}>
              <div className={styles.cardWrap}>
                <CardFace inst={fakeInstance(def)} onClick={() => setInspect(def)} />
                {/* 闪卡层:只给已拥有的 epic/legendary 挂载(FoilLayer 对低稀有返回 null) */}
                {n > 0 && <FoilLayer rarity={def.rarity} />}
              </div>
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

      {inspect && <CardInspect def={inspect} forge onClose={() => setInspect(null)} />}
    </div>
  )
}
