import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type {
  CardDef,
  CardInstance,
  Doctrine,
  DynastyTag,
  Keyword,
  LocalizedText,
  Rarity,
} from '../../engine/types'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { useCollection } from '../../app/collectionStore'
import { DOCTRINE_COLORS, DYNASTY_NAME } from '../doctrineColors'
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

// 机制筛选。关键词与「有没有战吼/亡语/光环/伏兵/连击/过载」放在同一个下拉里 ——
// 玩家找牌时想的是「我要一张带守护的」或者「我要伏兵」,不会先在心里分类。
type MechKey = Keyword | 'battlecry' | 'deathrattle' | 'aura' | 'secret' | 'combo' | 'overload'

const MECH_FILTERS: { key: MechKey; label: LocalizedText }[] = [
  { key: 'charge', label: { zh: '冲锋', en: 'Charge' } },
  { key: 'rush', label: { zh: '突袭', en: 'Rush' } },
  { key: 'guard', label: { zh: '守护', en: 'Guard' } },
  { key: 'windfury', label: { zh: '连击(风怒)', en: 'Windfury' } },
  { key: 'duel', label: { zh: '单挑', en: 'Duel' } },
  { key: 'lifesteal', label: { zh: '吸血', en: 'Lifesteal' } },
  { key: 'poison', label: { zh: '剧毒', en: 'Poison' } },
  { key: 'divineShield', label: { zh: '铁壁', en: 'Divine Shield' } },
  { key: 'stealth', label: { zh: '潜行', en: 'Stealth' } },
  { key: 'battlecry', label: { zh: '战吼', en: 'Battlecry' } },
  { key: 'deathrattle', label: { zh: '亡语', en: 'Deathrattle' } },
  { key: 'aura', label: { zh: '光环', en: 'Aura' } },
  { key: 'secret', label: { zh: '伏兵', en: 'Secret' } },
  { key: 'combo', label: { zh: '连击', en: 'Combo' } },
  { key: 'overload', label: { zh: '过载', en: 'Overload' } },
]

function hasMechanic(c: CardDef, m: MechKey): boolean {
  switch (m) {
    case 'battlecry':
      return c.battlecry !== undefined
    case 'deathrattle':
      return c.deathrattle !== undefined
    case 'aura':
      return c.aura !== undefined
    case 'secret':
      return c.secret !== undefined
    case 'combo':
      return c.combo !== undefined
    case 'overload':
      return (c.overload ?? 0) > 0
    default:
      return c.keywords.includes(m)
  }
}

type SortKey = 'rarity' | 'cost' | 'attack' | 'health' | 'no'

const SORTS: { key: SortKey; label: LocalizedText }[] = [
  { key: 'rarity', label: { zh: '按稀有度', en: 'By rarity' } },
  { key: 'cost', label: { zh: '按费用', en: 'By cost' } },
  { key: 'attack', label: { zh: '按攻击', en: 'By attack' } },
  { key: 'health', label: { zh: '按生命', en: 'By health' } },
  { key: 'no', label: { zh: '按编号', en: 'By number' } },
]

// 图鉴里出现过的朝代(按卡数排序,空的不列)
const DYNASTIES_IN_POOL: DynastyTag[] = (() => {
  const count = new Map<DynastyTag, number>()
  for (const c of COLLECTIBLE_CARDS) count.set(c.dynasty, (count.get(c.dynasty) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d)
})()

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
  const [dynasty, setDynasty] = useState<DynastyTag | 'all'>('all')
  const [mech, setMech] = useState<MechKey | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('rarity')
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
      if (dynasty !== 'all' && c.dynasty !== dynasty) return false
      if (mech !== 'all' && !hasMechanic(c, mech)) return false
      if (q && !c.name.zh.includes(deferredQuery.trim()) && !c.name.en.toLowerCase().includes(q))
        return false
      return true
    }).sort((a, b) => {
      // 每种排序都以「稀有度 → 编号」收尾,保证结果稳定 ——
      // 不然同攻击力的卡每次筛选顺序都不一样,看起来像列表在乱跳。
      const tail =
        RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.collectorNo - b.collectorNo
      switch (sortKey) {
        case 'cost':
          return a.cost - b.cost || tail
        case 'attack':
          return (b.attack ?? -1) - (a.attack ?? -1) || tail
        case 'health':
          return (b.health ?? -1) - (a.health ?? -1) || tail
        case 'no':
          return a.collectorNo - b.collectorNo
        default:
          return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || a.cost - b.cost || tail
      }
    })
  }, [tab, deferredQuery, ownedOnly, rarity, costBand, dynasty, mech, sortKey, owned])

  const ownedCount = useMemo(() => Object.values(owned).filter((n) => n > 0).length, [owned])
  const shown = filtered.slice(0, limit)

  // 无限滚动。仍然只渲染 limit 张(DOM 有界,所以不需要虚拟列表),
  // 但不用玩家每 48 张点一次按钮 —— 2200 张卡意味着点 46 次才能翻到底。
  //
  // 分成「记录是否可见」和「可见就继续加载」两个 effect,不在 IO 回调里直接加页。
  // 原因是 IntersectionObserver **只在相交状态发生变化时**回调:
  // 加载一页之后哨兵往往还留在视口里(尤其筛选结果本来就不足一屏时),
  // 状态没变 → 不再回调 → 加载卡死在第二页。第一版就是这么写的,
  // e2e 因此断续地红,而且是真 bug 不是测试抖动:玩家会看到「滚到底了却不再加载」。
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [sentinelVisible, setSentinelVisible] = useState(false)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => setSentinelVisible(!!entries[0]?.isIntersecting), {
      rootMargin: '400px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!sentinelVisible || limit >= filtered.length) return
    // 让一帧再加下一页:一次性把 2200 张全挂上去会把主线程钉死
    const timer = window.setTimeout(() => setLimit((l) => l + PAGE), 60)
    return () => window.clearTimeout(timer)
  }, [sentinelVisible, limit, filtered.length])

  // 任一筛选条件变化就回到第一页。放在这里而不是散在每个 onClick 里 ——
  // 之前每加一个筛选器就要记得补一次 setLimit(PAGE),漏一个就是「换了筛选却还停在第 5 页」。
  useEffect(() => {
    setLimit(PAGE)
  }, [tab, deferredQuery, ownedOnly, rarity, costBand, dynasty, mech, sortKey])

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
            }}
          />
          <button
            className={ownedOnly ? styles.toggleActive : styles.toggle}
            onClick={() => {
              playSfx('buttonTap')
              setOwnedOnly(!ownedOnly)
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
              }}
            >
              {pick(c.label)}
            </button>
          ))}
        </div>
        {/* 朝代与机制是 16 / 15 个选项,做成按钮会把筛选区撑满一屏 —— 用下拉 */}
        <div className={styles.toolsRow}>
          <select
            className={styles.select}
            value={dynasty}
            aria-label={t('按朝代筛选', 'Filter by dynasty')}
            onChange={(e) => setDynasty(e.target.value as DynastyTag | 'all')}
          >
            <option value="all">{t('全部朝代', 'All dynasties')}</option>
            {DYNASTIES_IN_POOL.map((d) => (
              <option key={d} value={d}>
                {pick(DYNASTY_NAME[d] ?? { zh: d, en: d })}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={mech}
            aria-label={t('按机制筛选', 'Filter by mechanic')}
            onChange={(e) => setMech(e.target.value as MechKey | 'all')}
          >
            <option value="all">{t('全部机制', 'All mechanics')}</option>
            {MECH_FILTERS.map((m) => (
              <option key={m.key} value={m.key}>
                {pick(m.label)}
              </option>
            ))}
          </select>
          <select
            className={styles.select}
            value={sortKey}
            aria-label={t('排序方式', 'Sort order')}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORTS.map((o) => (
              <option key={o.key} value={o.key}>
                {pick(o.label)}
              </option>
            ))}
          </select>
          <span className={styles.resultCount}>
            {t(`${filtered.length} 张`, `${filtered.length} cards`)}
          </span>
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

      {/* 滚到这里就自动加载下一页;同时兼作「还有多少」的进度提示 */}
      <div ref={sentinelRef} className={styles.sentinel}>
        {shown.length < filtered.length &&
          t(`载入中… ${shown.length}/${filtered.length}`, `Loading… ${shown.length}/${filtered.length}`)}
      </div>
      {filtered.length === 0 && <p className={styles.empty}>{t('没有符合条件的卡', 'No cards match')}</p>}

      {inspect && <CardInspect def={inspect} forge onClose={() => setInspect(null)} />}
    </div>
  )
}
