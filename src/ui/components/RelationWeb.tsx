import { useMemo } from 'react'
import { CARDS_BY_ID } from '../../content/cards'
import { bondsOf, bondRoster, cardName, rivalsOf } from '../../content/relations'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { Portrait } from './Portrait'
import { usePickCompact, useT } from '../i18n'
import styles from './RelationWeb.module.css'

interface RelationWebProps {
  centerId: string
  onPick?: (cardId: string) => void
}

// 一个人的关系网:轮辐图。
//
// 【为什么不是力导向图】
// 全卡池 31 条羁绊 + 29 对宿敌铺成一张网,在手机上既点不准也读不出「谁和谁」——
// 那张图看着很像回事,但回答不了玩家真正在问的问题。所以「通览」那一层留给列表
// (LoreScreen 的關係圖譜页),**这里回答的是另一个问题**:
// 我点开的这一位,他跟谁有关系?
//
// 一个中心 + 二到六根辐条,是这个问题的准确形状:节点少、位置固定、每个都够大能点。
//
// 【布局是纯计算,没有物理】
// 角度按 i/n 均分,半径固定。于是同一个人每次打开的图**完全一样** ——
// 力导向图每次跑出来都不同,玩家记不住「张飞在左上角」这种空间记忆,
// 而空间记忆恰恰是图相对列表唯一的优势。
const R = 78 // 辐条半径(px,SVG 用户坐标)
const NODE = 30 // 节点直径
const BOX = (R + NODE / 2 + 4) * 2

interface Spoke {
  id: string
  kind: 'bond' | 'rival'
  label: string
}

export function RelationWeb({ centerId, onPick }: RelationWebProps) {
  const t = useT()
  const pickCompact = usePickCompact()

  const spokes = useMemo<Spoke[]>(() => {
    const out: Spoke[] = []
    const seen = new Set([centerId])
    for (const ref of bondsOf(centerId)) {
      for (const id of bondRoster(ref)) {
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ id, kind: 'bond', label: ref.bond.name.zh })
      }
    }
    for (const ref of rivalsOf(centerId)) {
      // 宿敌是一对,取对面那个(锚点可能是自己也可能是对方 —— 反向索引两头都登记了)
      const foe = ref.anchor.id === centerId ? ref.rival.foe : ref.anchor.id
      if (seen.has(foe)) continue
      seen.add(foe)
      out.push({ id: foe, kind: 'rival', label: ref.rival.name.zh })
    }
    return out
  }, [centerId])

  if (spokes.length === 0) return null

  const c = BOX / 2
  const center = CARDS_BY_ID[centerId]
  const pos = (i: number) => {
    // 从正上方开始顺时针 —— 第一条关系落在头顶,是最容易被先看到的位置
    const a = (i / spokes.length) * Math.PI * 2 - Math.PI / 2
    return { x: c + Math.cos(a) * R, y: c + Math.sin(a) * R }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.caption}>{t('關係', 'Relations')}</div>
      <div className={styles.stage} style={{ width: BOX, height: BOX }}>
        {/* 连线画在 SVG 里,节点画成 HTML —— 立绘是 <img>,塞进 SVG 要用
            foreignObject,而那玩意儿在 Safari 上的裁剪行为一直不老实。
            两层叠着放最省事,反正它们共用同一套坐标。 */}
        <svg className={styles.edges} viewBox={`0 0 ${BOX} ${BOX}`} aria-hidden="true">
          {spokes.map((s, i) => {
            const p = pos(i)
            return (
              <line
                key={s.id}
                className={s.kind === 'bond' ? styles.bondEdge : styles.rivalEdge}
                x1={c}
                y1={c}
                x2={p.x}
                y2={p.y}
              />
            )
          })}
        </svg>
        <button
          type="button"
          className={`${styles.node} ${styles.centerNode}`}
          style={{
            left: c,
            top: c,
            '--doctrine': DOCTRINE_COLORS[center?.doctrine ?? 'neutral'],
          } as React.CSSProperties}
          onClick={() => onPick?.(centerId)}
          aria-label={pickCompact(cardName(centerId))}
        >
          <Portrait
            id={centerId}
            nameZh={center?.name.zh ?? centerId}
            doctrine={center?.doctrine ?? 'neutral'}
          />
        </button>
        {spokes.map((s, i) => {
          const p = pos(i)
          const card = CARDS_BY_ID[s.id]
          return (
            <button
              key={s.id}
              type="button"
              className={`${styles.node} ${s.kind === 'rival' ? styles.rivalNode : styles.bondNode}`}
              style={{ left: p.x, top: p.y } as React.CSSProperties}
              onClick={() => onPick?.(s.id)}
              title={`${s.label} — ${cardName(s.id).zh}`}
              aria-label={`${s.label} — ${pickCompact(cardName(s.id))}`}
            >
              <Portrait
                id={s.id}
                nameZh={card?.name.zh ?? s.id}
                doctrine={card?.doctrine ?? 'neutral'}
              />
              <span className={styles.nodeName}>{pickCompact(cardName(s.id))}</span>
            </button>
          )
        })}
      </div>
      {/* 图例:金线是羁绊(同侧凑齐才生效),朱线是宿敌(在对面才生效)。
          两者的方向完全相反,只靠颜色区分不够 —— 写出来。 */}
      <div className={styles.legend}>
        <span className={styles.legendBond}>{t('— 羈絆(同側)', '— Bond (same side)')}</span>
        <span className={styles.legendRival}>{t('— 宿敵(敵方)', '— Rival (opposite)')}</span>
      </div>
    </div>
  )
}
