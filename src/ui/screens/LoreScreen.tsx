import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import { CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import { LORE } from '../../content/generated/lore.gen'
import { useCollection } from '../../app/collectionStore'
import { Portrait } from '../components/Portrait'
import { DOCTRINE_COLORS, dynastyName } from '../doctrineColors'
import { usePickCompact, usePickText, useT } from '../i18n'
import { ALL_BONDS, ALL_RIVALS, bondRoster, cardName, rivalLore } from '../../content/relations'
import { RelationGraph } from '../components/RelationGraph'
import { EraScroll } from '../components/EraScroll'
import { ERA_OF, type Era } from '../../content/eras'
import { RelationWeb } from '../components/RelationWeb'
import { playSfx } from '../sound'
import styles from './LoreScreen.module.css'

interface Props {
  onBack: () => void
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
  const [dynFilter, setDynFilter] = useState<string>('all')
  // 三种读法:列传(按人)/ 關係圖譜(按关系)/ 時代長卷(按时间)。
  // 同一批内容,三个不同的问题 —— 一屏塞不下,但一个 tab 装得下。
  const [view, setView] = useState<'lives' | 'graph' | 'era'>('lives')
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
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div
            className={styles.detail}
            role="dialog"
            aria-modal="true"
            style={{ '--doctrine': DOCTRINE_COLORS[sel.doctrine] } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
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
                <p className={styles.bio}>{pick(selLore.bio)}</p>
                {selLore.quote && <p className={styles.quote}>「{pick(selLore.quote)}」</p>}
                {selLore.line && <p className={styles.line}>{pick(selLore.line)}</p>}
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
            <button className={styles.closeBtn} onClick={() => setSelected(null)}>
              {t('合卷', 'Close')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
