import { useMemo, useState } from 'react'
import { ALL_BONDS, ALL_RIVALS, bondRoster, cardName, rivalPair } from '../../content/relations'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './RelationGraph.module.css'

interface RelationGraphProps {
  onPick: (defId: string) => void
}

// 关系图谱。
//
// 【为什么之前不是图】
// 这一页叫「关系图谱」,实际是羁绊 31 条 + 宿敌 29 对的两段文字列表 ——
// 名字对名字地读,读完也不知道谁在网络的中心。
//
// 【为什么是弦图,不是节点散布图】
// 涉及 98 位武将。任何「按力导向散开」的画法在这个数量上都会糊成一团毛线,
// 而且力导向要迭代(不确定、每次不一样)。弦图把所有人钉在圆周上、
// 连线一律走圆内,于是:
//   · 布局完全确定(按 id 排序后均分角度)—— 同一份数据每次画出来一模一样;
//   · 线全部朝心,视觉上收敛,不会互相穿插成噪音;
//   · 谁的线多一眼可见 —— 那就是这张网络的中心人物。
//
// 【为什么不给每个点都写名字】
// 98 个名字在 400px 的圆上必然叠字。名字只在悬停/聚焦时出现一个 ——
// 图给的是**结构**,名字由下面那两段列表负责(它同时是读屏器的通路)。
export function RelationGraph({ onPick }: RelationGraphProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const [active, setActive] = useState<string | null>(null)

  const { nodes, pos, edges } = useMemo(() => {
    // 节点集合:出现在任意一条羁绊或宿敌里的人。排序保证布局确定。
    const set = new Set<string>()
    for (const b of ALL_BONDS) for (const id of bondRoster(b)) set.add(id)
    for (const r of ALL_RIVALS) for (const id of rivalPair(r)) set.add(id)
    const nodes = [...set].sort()

    const R = 168
    const CX = 200
    const CY = 200
    const pos = new Map<string, { x: number; y: number; a: number }>()
    nodes.forEach((id, i) => {
      const a = (i / nodes.length) * Math.PI * 2 - Math.PI / 2
      pos.set(id, { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R, a })
    })

    // 边:羁绊按「锚点 → 各成员」的星形连(与数据形状一致,线也最少);
    // 宿敌是一对一。同一对人可能既有羁绊又是宿敌 —— 两条都画,颜色不同。
    const edges: { a: string; b: string; kind: 'bond' | 'rival' }[] = []
    for (const ref of ALL_BONDS) {
      for (const m of ref.bond.members) edges.push({ a: ref.anchor.id, b: m, kind: 'bond' })
    }
    for (const ref of ALL_RIVALS) {
      edges.push({ a: ref.anchor.id, b: ref.rival.foe, kind: 'rival' })
    }
    return { nodes, pos, edges }
  }, [])

  // 二次贝塞尔的控制点取圆心:所有弦都朝心弯,网络自然收敛。
  const path = (a: string, b: string) => {
    const p = pos.get(a)
    const q = pos.get(b)
    if (!p || !q) return ''
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} Q 200 200 ${q.x.toFixed(1)} ${q.y.toFixed(1)}`
  }

  const activePos = active ? pos.get(active) : null

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox="0 0 400 400"
        role="img"
        aria-label={t(
          `关系图谱:${nodes.length} 位武将、${ALL_BONDS.length} 条羁绊、${ALL_RIVALS.length} 对宿敌`,
          `Relation graph: ${nodes.length} generals, ${ALL_BONDS.length} bonds, ${ALL_RIVALS.length} rivalries`,
        )}
      >
        {/* 边先画,点压在上面 */}
        <g className={styles.edges}>
          {edges.map((e, i) => {
            const lit = active !== null && (e.a === active || e.b === active)
            return (
              <path
                key={`${e.kind}-${i}`}
                d={path(e.a, e.b)}
                className={`${e.kind === 'bond' ? styles.bond : styles.rival} ${
                  lit ? styles.lit : ''
                } ${active !== null && !lit ? styles.dim : ''}`}
              />
            )
          })}
        </g>
        <g>
          {nodes.map((id) => {
            const p = pos.get(id)!
            const on = active === id
            return (
              <circle
                key={id}
                cx={p.x}
                cy={p.y}
                r={on ? 5.5 : 3.2}
                className={`${styles.node} ${on ? styles.nodeOn : ''}`}
                tabIndex={0}
                role="button"
                aria-label={pickCompact(cardName(id))}
                onMouseEnter={() => setActive(id)}
                onMouseLeave={() => setActive((a) => (a === id ? null : a))}
                onFocus={() => setActive(id)}
                onBlur={() => setActive((a) => (a === id ? null : a))}
                onClick={() => {
                  playSfx('buttonTap')
                  onPick(id)
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  e.preventDefault()
                  onPick(id)
                }}
              >
                <title>{pickCompact(cardName(id))}</title>
              </circle>
            )
          })}
        </g>
        {/* 名字只给当前这一个。文字锚点按左右半圆翻转,免得名字压到圆外面去 */}
        {active && activePos && (
          <text
            className={styles.label}
            x={200 + (activePos.x - 200) * 1.13}
            y={200 + (activePos.y - 200) * 1.13}
            textAnchor={activePos.x < 200 ? 'end' : 'start'}
            dominantBaseline="middle"
          >
            {pickCompact(cardName(active))}
          </text>
        )}
      </svg>
      <div className={styles.legend}>
        <span className={styles.legendBond}>
          {t(`羈絆 ${ALL_BONDS.length}`, `Bonds ${ALL_BONDS.length}`)}
        </span>
        <span className={styles.legendRival}>
          {t(`宿敵 ${ALL_RIVALS.length}`, `Rivals ${ALL_RIVALS.length}`)}
        </span>
        <span className={styles.legendHint}>
          {t('点一个人看他的列传', 'Tap anyone to open their chronicle')}
        </span>
      </div>
    </div>
  )
}
