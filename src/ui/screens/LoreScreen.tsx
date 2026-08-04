import { useCallback, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import { LORE, TRAIT_NAMES } from '../../content/generated/lore.gen'
import { useCollection } from '../../app/collectionStore'
import { Portrait } from '../components/Portrait'
import { DOCTRINE_COLORS, dynastyName } from '../doctrineColors'
import { usePickCompact, usePickText, useT } from '../i18n'
import { ALL_BONDS, ALL_RIVALS, bondRoster, cardName, clanRoster, rivalLore } from '../../content/relations'
import { RelationGraph } from '../components/RelationGraph'
import { EraScroll } from '../components/EraScroll'
import { ERA_OF, type Era } from '../../content/eras'
import { RelationWeb } from '../components/RelationWeb'
import { StatRadar } from '../components/StatRadar'
import { LoreIndex } from '../components/LoreIndex'
import { playSfx } from '../sound'
import { useDialog } from '../useDialog'
import styles from './LoreScreen.module.css'

interface Props {
  onBack: () => void
}

// 详情弹层单独成一个组件,而不是直接写在 LoreScreen 的 JSX 里。
//
// 【为什么必须拆】useDialog 的 effect 在**调用它的组件挂载时**跑一次:写在 LoreScreen
// 里的话,那一刻是整屏挂载、弹层还没开,ref 是空的 —— 焦点环一个元素也抓不到,
// 而捕获阶段的 Esc 却已经全局生效了(列传屏没开弹层时按 Esc 也会被吃掉)。
// 拆成组件后它随 selected 挂载/卸载,hook 的生命周期正好等于弹层的生命周期。
function DetailDialog({
  label,
  style,
  onClose,
  children,
}: {
  label: string
  style: CSSProperties
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useDialog(onClose)
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.detail}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

// 名将列传:把「收藏」从仓库变成博物馆。
//
// 别家 CCG 得编世界观,这套卡池是**真历史** —— 传记/名言/时代都在 lore.gen.ts 里躺着,
// 此前只当卡面风味用。这一屏把它翻出来:按朝代分组,拥有即解锁,未拥有显示剪影。
export function LoreScreen({ onBack }: Props) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const owned = useCollection((s) => s.owned)
  const [selected, setSelected] = useState<string | null>(null)
  // 稳定引用:它是 DetailDialog 里 useDialog 的 effect 依赖,
  // 写成内联的 () => setSelected(null) 的话每渲染一次焦点环就重挂一遍。
  const closeDetail = useCallback(() => setSelected(null), [])
  const [dynFilter, setDynFilter] = useState<string>('all')
  // 三种读法:列传(按人)/ 關係圖譜(按关系)/ 時代長卷(按时间)。
  // 同一批内容,三个不同的问题 —— 一屏塞不下,但一个 tab 装得下。
  const [view, setView] = useState<'lives' | 'graph' | 'era' | 'index'>('lives')
  // 默认落在长卷的**第一块**:横滚容器初始位置在最左,
  // 选中块要是落在视野外,「哪一块是选中的」就成了看不见的信息。
  const [eraFilter, setEraFilter] = useState<Era>('pre-qin')

  // 有列传的签名卡,按朝代分组
  const entries = useMemo(
    () => SIGNATURE_IDS.filter((id) => CARDS_BY_ID[id] && LORE[id]?.bio?.zh),
    [],
  )
  const dynasties = useMemo(() => {
    const seen: string[] = []
    for (const id of entries) {
      const d = CARDS_BY_ID[id].dynasty
      if (!seen.includes(d)) seen.push(d)
    }
    return seen
  }, [entries])

  // 列传页按朝代筛,长卷页按时代块筛 —— 两个视图问的是不同粒度的问题,
  // 共用一个筛选器会互相踩(选了「魏」再切到长卷,长卷该高亮哪一块?)。
  const shown =
    view === 'era'
      ? entries.filter((id) => ERA_OF[CARDS_BY_ID[id].dynasty] === eraFilter)
      : dynFilter === 'all'
        ? entries
        : entries.filter((id) => CARDS_BY_ID[id].dynasty === dynFilter)
  const unlocked = entries.filter((id) => (owned[id] ?? 0) > 0).length
  const sel = selected ? CARDS_BY_ID[selected] : null
  const selLore = selected ? LORE[selected] : null
  const selOwned = selected ? (owned[selected] ?? 0) > 0 : false

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
        <h2 className={styles.title}>{t('名将列传', 'Chronicles')}</h2>
        <span className={styles.progress}>
          {unlocked} / {entries.length}
        </span>
      </header>

      <p className={styles.lede}>
        {t(
          '得其人,方得其传。收入麾下的名将,其生平事迹即录于此。',
          'Win the general, and you win their story. Every commander in your collection has their life recorded here.',
        )}
      </p>

      {/* 关系图谱:31 条羁绊 + 29 对宿敌本来就是一张网络图。
          此前它们只在结算里存在,玩家没有任何地方能**通览**这些历史关系 ——
          而「通览」正是这个模式(名将列传 = 博物馆)该干的事。
          图用弦图不用力导向:98 个节点力导向必糊成毛线,而且要迭代(不确定);
          弦图的布局是确定的,同一份数据每次画出来一模一样。见 RelationGraph。 */}
      <div className={styles.filters}>
        {(
          [
            ['lives', t('列传', 'Lives')],
            ['graph', t('關係圖譜', 'Relations')],
            ['era', t('時代長卷', 'The Scroll')],
            ['index', t('索引', 'Index')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={view === key ? styles.filterActive : styles.filterBtn}
            onClick={() => {
              playSfx('buttonTap')
              setView(key)
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {view === 'era' && (
        <EraScroll
          selected={eraFilter}
          onSelectEra={(era) => {
            playSfx('buttonTap')
            setEraFilter(era)
          }}
          onPickCard={(id) => setSelected(id)}
        />
      )}

      {/* 索引:列传原本只能顺着人翻,翻不动事 —— 赤壁牵涉十几个人,
          此前得一个一个点进去才拼得出来。 */}
      {view === 'index' && (
        <LoreIndex
          onPick={(id) => {
            setSelected(id)
            setView('lives')
          }}
        />
      )}

      {view === 'graph' && (
        <div className={styles.relationList}>
          {/* 先给一张真的图。下面那两段列表保留 ——
              它既是图例(哪条羁绊叫什么),也是读屏器唯一读得懂的那条路。 */}
          <RelationGraph
            onPick={(id) => {
              setSelected(id)
              setView('lives')
            }}
          />
          <div className={styles.relationHead}>
            {t(`羈絆 · ${ALL_BONDS.length} 條`, `Bonds · ${ALL_BONDS.length}`)}
          </div>
          {ALL_BONDS.map((ref) => (
            <button
              key={ref.bond.id}
              className={styles.relationRow}
              onClick={() => {
                playSfx('buttonTap')
                setSelected(ref.anchor.id)
                setView('lives')
              }}
            >
              <span className={styles.relationName}>{pickCompact(ref.bond.name)}</span>
              <span className={styles.relationMembers}>
                {bondRoster(ref)
                  .map((id) => pickCompact(cardName(id)))
                  .join(' · ')}
              </span>
            </button>
          ))}
          <div className={styles.relationHead}>
            {t(`宿敵 · ${ALL_RIVALS.length} 對`, `Rivals · ${ALL_RIVALS.length}`)}
          </div>
          {ALL_RIVALS.map((ref) => (
            <button
              key={ref.rival.id}
              className={`${styles.relationRow} ${styles.rivalRow}`}
              onClick={() => {
                playSfx('buttonTap')
                setSelected(ref.anchor.id)
                setView('lives')
              }}
            >
              <span className={styles.relationName}>{pickCompact(ref.rival.name)}</span>
              <span className={styles.relationMembers}>
                {pickCompact(cardName(ref.anchor.id))} ⇄ {pickCompact(cardName(ref.rival.foe))}
              </span>
              {rivalLore(ref.rival.id) && (
                <span className={styles.relationLore}>{pick(rivalLore(ref.rival.id)!)}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {view === 'lives' && (
      <div className={styles.filters}>
        <button
          className={dynFilter === 'all' ? styles.filterActive : styles.filterBtn}
          onClick={() => {
            playSfx('buttonTap')
            setDynFilter('all')
          }}
        >
          {t('全部', 'All')}
        </button>
        {dynasties.map((d) => (
          <button
            key={d}
            className={dynFilter === d ? styles.filterActive : styles.filterBtn}
            onClick={() => {
              playSfx('buttonTap')
              setDynFilter(d)
            }}
          >
            {pickCompact(dynastyName(d))}
          </button>
        ))}
      </div>

      )}

      {(view === 'lives' || view === 'era') && (
      <div className={styles.grid}>
        {shown.map((id) => {
          const card = CARDS_BY_ID[id]
          const has = (owned[id] ?? 0) > 0
          return (
            <button
              key={id}
              className={`${styles.entry} ${has ? '' : styles.locked}`}
              style={{ '--doctrine': DOCTRINE_COLORS[card.doctrine] } as CSSProperties}
              onClick={() => {
                playSfx('buttonTap')
                setSelected(id)
              }}
            >
              <span className={styles.portrait}>
                <Portrait id={id} nameZh={card.name.zh} doctrine={card.doctrine} />
              </span>
              <span className={styles.entryName}>{has ? pickCompact(card.name) : '？'}</span>
              <span className={styles.entryEra}>
                {has && LORE[id]?.era ? pick(LORE[id].era!) : pickCompact(dynastyName(card.dynasty))}
              </span>
            </button>
          )
        })}
      </div>
      )}

      {sel && selLore && (
        <DetailDialog
          label={selOwned ? pick(sel.name) : t('尚未入列', 'Not yet in your ranks')}
          style={{ '--doctrine': DOCTRINE_COLORS[sel.doctrine] } as CSSProperties}
          onClose={closeDetail}
        >
          <div className={styles.detailPortrait}>
            <Portrait id={sel.id} nameZh={sel.name.zh} doctrine={sel.doctrine} full />
          </div>
          <h3 className={styles.detailName}>
            {selOwned ? pick(sel.name) : t('尚未入列', 'Not yet in your ranks')}
          </h3>
          {selLore.era && selOwned && <div className={styles.detailEra}>{pick(selLore.era)}</div>}
          {selOwned ? (
            <>
              {/* 档案:字 / 籍贯 / 生卒 / 性格 / 五维。
                  **这一屏是专门看人的**,却一直只显示尊号与生平四行 ——
                  而卡牌详情页(长按卡面)反倒把档案摆全了。位置颠倒了:
                  牌桌上要的是快速判断,列传页要的才是这个人的全部。 */}
              {(selLore.courtesy || selLore.home || selLore.life || selLore.office || selLore.alias) && (
                <div className={styles.dossier}>
                  {selLore.courtesy && (
                    <span>{t('字', 'Courtesy')} {pickCompact(selLore.courtesy)}</span>
                  )}
                  {selLore.home && <span>{t('籍', 'From')} {pickCompact(selLore.home)}</span>}
                  {selLore.life && <span>{pickCompact(selLore.life)}</span>}
                  {selLore.office && <span>{pickCompact(selLore.office)}</span>}
                  {selLore.alias && <span>「{pickCompact(selLore.alias)}」</span>}
                </div>
              )}
              {/* 族人名册。列传是**顺着人往下翻**的地方,家族正好是一条现成的线索:
                  点开曹操看见二十七个曹,再点进去就是另一段传。 */}
              {sel.clan && (
                <div className={styles.clan}>
                  <span className={styles.clanName}>{pick(sel.clan.name)}</span>
                  {clanRoster(sel.clan.id)
                    .filter((id) => id !== sel.id)
                    .map((id) => (
                      <button key={id} className={styles.clanKin} onClick={() => setSelected(id)}>
                        {pickCompact(cardName(id))}
                      </button>
                    ))}
                </div>
              )}
              {(selLore.traits ?? []).length > 0 && (
                <div className={styles.traits}>
                  {selLore.traits!.slice(0, 6).map((tr) => (
                    <span key={tr} className={styles.trait}>
                      {TRAIT_NAMES[tr] ? pickCompact(TRAIT_NAMES[tr]) : tr}
                    </span>
                  ))}
                </div>
              )}
              {/* 五维从条形换成雷达:条形回答「统率多少」,雷达回答
                  「这是个什么样的人」—— 后者才是列传要说的话。 */}
              {selLore.stats && (
                <StatRadar
                  stats={selLore.stats}
                  color={DOCTRINE_COLORS[sel.doctrine]}
                />
              )}
              {selLore.bio && <p className={styles.bio}>{pick(selLore.bio)}</p>}
              {selLore.quote && <p className={styles.quote}>「{pick(selLore.quote)}」</p>}
              {selLore.line && <p className={styles.line}>{pick(selLore.line)}</p>}
              {selLore.poem && (
                <p className={styles.poem}>
                  {t('絕命', 'Last words')} · {pick(selLore.poem)}
                </p>
              )}
              {/* 这一位的关系网。通览那张表在「關係圖譜」页;这里回答的是
                  另一个问题 —— **我点开的这个人跟谁有关系**。
                  点节点直接跳过去,列传于是能一路顺着关系翻下去。 */}
              <RelationWeb centerId={sel.id} onPick={(id) => setSelected(id)} />
            </>
          ) : (
            <p className={styles.bio}>
              {t(
                '此人尚未归你麾下。收入此将,方可阅其列传。',
                'This general has not yet joined you. Add them to your collection to read their chronicle.',
              )}
            </p>
          )}
          <button className={styles.closeBtn} onClick={closeDetail}>
            {t('合卷', 'Close')}
          </button>
        </DetailDialog>
      )}
    </div>
  )
}
