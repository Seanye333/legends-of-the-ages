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
  TroopType,
} from '../../engine/types'
import { COLLECTIBLE_CARDS } from '../../content/cards'
import { TROOP_NAME } from '../../content/troops'
import { claimableGoals, eraProgress } from '../../content/collectionGoals'
import { adviceTotal, disenchantAdvice } from '../../content/disenchantAdvice'
import { disenchantValue, useCollection } from '../../app/collectionStore'
import { DOCTRINE_COLORS, DYNASTY_NAME } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { FoilLayer } from '../components/FoilLayer'
import { useT, usePickText } from '../i18n'
import { playSfx } from '../sound'
import { EmptyState } from '../components/EmptyState'
import { useClaimPulse } from '../useClaimPulse'
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

// 已拥有的 rare 以上按稀有度给格子外壳一圈静态边框光(蓝/紫/金)。
// 用显式映射而不是 styles[`rim_${rarity}`]:拼字符串查样式表,类名改了没人报错。
const RIM_CLASS: Partial<Record<Rarity, string>> = {
  rare: styles.rimRare,
  epic: styles.rimEpic,
  legendary: styles.rimLegendary,
}

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
    costDelta: 0,
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
  const [troop, setTroop] = useState<TroopType | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('rarity')

  // 抽屉收起时,把「正在生效的筛选」写在标题上。
  // 不写的话「为什么只剩 6 张」就是一个找不到原因的谜 ——
  // 收纳的代价永远是可见性,补偿它的办法是把状态提到收纳口。
  const activeFilterNames = useMemo(() => {
    const names: string[] = []
    const label = <T extends string>(list: { key: T; label: LocalizedText }[], v: T) =>
      list.find((x) => x.key === v)?.label
    if (rarity !== 'all') names.push(pick(label(RARITY_FILTERS, rarity) ?? { zh: '', en: '' }))
    if (costBand !== 'all') names.push(pick(label(COST_FILTERS, costBand) ?? { zh: '', en: '' }))
    // 朝代与兵种没有 FILTERS 常量表 —— 它们直接从内容层的名称表渲染下拉
    if (dynasty !== 'all') names.push(pick(DYNASTY_NAME[dynasty] ?? { zh: dynasty, en: dynasty }))
    if (troop !== 'all') names.push(pick(TROOP_NAME[troop] ?? { zh: troop, en: troop }))
    if (mech !== 'all') names.push(pick(label(MECH_FILTERS, mech) ?? { zh: '', en: '' }))
    return names.filter(Boolean)
  }, [rarity, costBand, dynasty, troop, mech, pick])
  const [limit, setLimit] = useState(PAGE)
  const [inspect, setInspect] = useState<CardDef | null>(null)
  const customDecks = useCollection((s) => s.customDecks)
  const collectionClaimed = useCollection((s) => s.collectionClaimed)
  const claimGoal = useCollection((s) => s.claimCollectionGoal)
  const [goalPulseCls, fireGoalPulse] = useClaimPulse()
  const progress = useMemo(() => eraProgress(owned), [owned])
  const claimable = useMemo(
    () => claimableGoals(owned, collectionClaimed),
    [owned, collectionClaimed],
  )
  const advice = useMemo(() => disenchantAdvice(owned, customDecks), [owned, customDecks])
  const adviceMerit = useMemo(
    () => adviceTotal(advice, (id) => disenchantValue(id)),
    [advice],
  )

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
      if (troop !== 'all' && c.troop !== troop) return false
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

      {/* 收藏度:卡池有两千三百张,而收藏系统此前只回答「这张你有没有」——
          没有任何东西回答「你收了多少」。于是开包的唯一价值是「能不能组出更强的牌」,
          而绝大多数卡永远进不了任何一副牌组,对玩家等于不存在。
          按时代块(6 块,每块二百到六百张)而不是朝代(18 个,太细)或主义(6 个,太粗)。 */}
      {/* 领取的仪式挂在整个盒子上 —— 领取按钮领完就从列表里消失了 */}
      <details className={`${styles.goalBox} ${goalPulseCls}`}>
        <summary className={styles.goalSummary}>
          {t('收藏度', 'Collection progress')}
          {claimable.length > 0 && (
            <span className={styles.goalDot}>●{claimable.length}</span>
          )}
        </summary>
        <div className={styles.goalList}>
          {progress.map((p) => (
            <div key={p.era} className={styles.goalRow}>
              <span className={styles.goalName}>{pick(p.name)}</span>
              <span className={styles.goalBar}>
                <span
                  className={styles.goalFill}
                  style={{ width: `${Math.round(p.ratio * 100)}%` }}
                />
              </span>
              <span className={styles.goalNum}>
                {p.owned}/{p.total}
              </span>
              {/* 集齐一个时代该有一次仪式 —— 进度条走到头之后原来什么都不发生 */}
              {p.ratio >= 1 && (
                <span className={styles.eraSeal} aria-hidden="true">
                  成
                </span>
              )}
            </div>
          ))}
          {/* 分解建议:功勋入口只有三个,而收藏里通常躺着几百张从没进过任何牌组的卡 ——
              既不会被用到,也不会被想起来分解。只列**真正安全**的:
              不在任何预组/自组卡组里,且不是史诗与传说(收藏价值,合回来要四倍功勋)。 */}
          {advice.length > 0 && (
            <div className={styles.goalRow}>
              <span className={styles.goalName}>{t('可分解', 'Spare')}</span>
              <span className={styles.goalNum} style={{ width: 'auto', flex: 1 }}>
                {t(
                  `${advice.length} 种从没进过任何牌组 · 约可换 ${adviceMerit} 功勋`,
                  `${advice.length} kinds never used in a deck · about ${adviceMerit} merit`,
                )}
              </span>
            </div>
          )}
          {claimable.map((g) => (
            <button
              key={g.id}
              className={styles.goalClaim}
              onClick={() => {
                playSfx('stratagemCast')
                fireGoalPulse()
                claimGoal(g.id)
              }}
            >
              {t(
                `${pick(g.name)} ${pick(g.tierLabel)} —— 领 ${g.merit} 功勋`,
                `${pick(g.name)} ${pick(g.tierLabel)} — claim ${g.merit} merit`,
              )}
            </button>
          ))}
        </div>
      </details>

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
        {/* 稀有度/费用/朝代/兵种/机制/排序收进抽屉。
            展开状态下这四行控件在**看到第一张卡之前**就占掉 270px ——
            而图鉴要卖的是那两千多张立绘,不是筛选器。
            主义标签和搜索框留在外面:那两个是最常用的入口。
            默认收起,但**用到的筛选会写在标题上**,否则「为什么只剩 6 张」
            会变成一个找不到原因的谜。 */}
        <details className={styles.moreBox}>
          <summary className={styles.moreSummary}>
            {t('更多筛选', 'More filters')}
            {activeFilterNames.length > 0 && (
              <span className={styles.moreActive}>{activeFilterNames.join(' · ')}</span>
            )}
          </summary>
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
          {/* 兵种筛选:「我要一队骑兵」是构筑兵种流的第一个动作,
              没有这个下拉就只能一张张翻 2000 多张卡 */}
          <select
            className={styles.select}
            value={troop}
            aria-label={t('按兵种筛选', 'Filter by troop')}
            onChange={(e) => setTroop(e.target.value as TroopType | 'all')}
          >
            <option value="all">{t('全部兵种', 'All troops')}</option>
            {(Object.keys(TROOP_NAME) as TroopType[]).map((k) => (
              <option key={k} value={k}>
                {pick(TROOP_NAME[k])}
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
        </div>
        </details>
        <span className={styles.resultCount}>
          {t(`${filtered.length} 张`, `${filtered.length} cards`)}
        </span>
      </div>

      <div className={styles.grid}>
        {shown.map((def) => {
          const n = owned[def.id] ?? 0
          const rim = n > 0 ? RIM_CLASS[def.rarity] : undefined
          return (
            <div
              key={def.id}
              className={`${styles.cell} ${n === 0 ? styles.unowned : ''}`}
              // 拓印格子悬停时给一句获取途径 —— 「未得」章只说了没有,没说怎么得
              title={
                n === 0
                  ? t(
                      '尚未收录 —— 开包可得,亦可用功勋定向合成。',
                      'Not collected yet — open packs, or craft it with merit.',
                    )
                  : undefined
              }
            >
              <div className={`${styles.cardWrap} ${rim ?? ''}`}>
                <CardFace inst={fakeInstance(def)} onClick={() => setInspect(def)} />
                {/* 闪卡层:只给已拥有的 epic/legendary 挂载(FoilLayer 对低稀有返回 null) */}
                {n > 0 && <FoilLayer rarity={def.rarity} />}
              </div>
              {n > 0 && <span className={styles.ownedBadge}>×{n}</span>}
            </div>
          )
        })}
      </div>

      {/* 滚到这里就自动加载下一页。原来是一行「载入中…」灰字 ——
          骨架卡让「下面还有」这件事长得就像下面还有,而不是像出了错 */}
      <div ref={sentinelRef} className={styles.sentinel}>
        {shown.length < filtered.length && (
          <>
            <div className={styles.skelRow} aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={styles.skelCard} />
              ))}
            </div>
            <span className={styles.pageCount}>
              {t(`${shown.length}/${filtered.length}`, `${shown.length}/${filtered.length}`)}
            </span>
          </>
        )}
      </div>
      {filtered.length === 0 && (
        <EmptyState
          glyph="空"
          title={t('没有符合条件的卡', 'Nothing matches')}
          hint={t(
            '把筛选放宽一点 —— 或者换个词搜:卡名、势力、关键词都能搜到。',
            'Loosen the filters, or search by another term — names, factions and keywords all work.',
          )}
        />
      )}

      {inspect && <CardInspect def={inspect} forge onClose={() => setInspect(null)} />}
    </div>
  )
}
