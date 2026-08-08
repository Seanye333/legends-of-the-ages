import { useMemo } from 'react'
import { cardName, clanRoster } from '../../content/relations'
// 直接读生成层的关系表,**不走 `loreLazy` 的同步访问器**。
//
// 第一版用的是 `relationsNow()`,画出来每个族都只有一个人 —— 因为
// 那个缓存要 `loadLore()` 之后才有内容,而**列传屏从来不调它**
// (它是静态 import `lore.gen` 的)。于是 `relationsNow` 恒返回空数组,
// 组件一声不吭地退化成「全族都没有明文亲缘」。
// 那正是这个仓库最贵的那类 bug:不崩、不红,只是把 274 条族内亲缘全说成了 0。
//
// 静态 import 在这里**不额外花钱**:唯一用到这个组件的 LoreScreen
// 本来就静态 import 同一个模块。别把它搬到别的屏上用(perf-budget 会红)。
import { RELATION_EDGES } from '../../content/generated/lore.gen'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './ClanTree.module.css'

interface ClanTreeProps {
  clanId: string
  focusId: string
  onPick: (id: string) => void
}

// 家族图 —— 把「二十七个曹」从一串名字变成一张有结构的图。
//
// 【为什么它比名单更**诚实**,而不只是更好看】
// 名单把同族的每个人并排摆着,读起来像「这些人彼此都有关系」。
// 而史料只记明了其中一部分:曹操—曹丕 有明文,曹操—曹霖 之间隔着几层没人写。
// 这张图画的正是**有明文的那些连线** —— 剩下的人仍然列出来,但明确标成
// 「同族,史料未记明与谁的关系」。
//
// 家族增益本来就是「同族 ≥2 人在场」,不管谁和谁 —— 所以这张图不影响对局,
// 它影响的是**你以为你知道什么**。
//
// 【为什么不画成上下分层的族谱树】
// `kin` 边**没有方向**:关系网只记「这两个人是亲属」和那句原文,
// 不记谁是父谁是子。硬要分层就得靠猜(按生卒年?名字?),
// 而猜错的族谱比没有族谱更糟 —— 它看起来像是查过的。
// 所以画成**无向的连线图**:它说的就是它知道的那么多。
export function ClanTree({ clanId, focusId, onPick }: ClanTreeProps) {
  const t = useT()
  const pickCompact = usePickCompact()

  const { nodes, edges, pos, loners } = useMemo(() => {
    const roster = clanRoster(clanId)
    const inClan = new Set(roster)
    // 族内的亲缘边。两端都得在族里 —— 关系网里一个人可能和族外的人也有 kin
    // (母族、妻族),那不是这张图要回答的问题。
    const seen = new Set<string>()
    const edges: { a: string; b: string; quote: string }[] = []
    for (const e of RELATION_EDGES) {
      if (e.kind !== 'kin') continue
      if (!inClan.has(e.a) || !inClan.has(e.b)) continue
      const key = [e.a, e.b].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ a: e.a, b: e.b, quote: e.quote })
    }
    // 【布局:自我中心图 —— 本人居中,亲缘绕环】
    //
    // 第一版是把所有人平摊在一个圆周上(照抄了关系图谱那张弦图)。
    // 画出来是**一把扇子**:曹操 在圆周的一个点上,二十五条线从他那里扇出去,
    // 名字全叠在一起。弦图适合「整张网络谁是中心」,而这里的中心是**已知的** ——
    // 就是你正在看的这个人。中心已知的时候,自我中心图才是对的形状。
    const kinOfFocus = new Set(
      edges.filter((e) => e.a === focusId || e.b === focusId).map((e) => (e.a === focusId ? e.b : e.a)),
    )
    const ring = roster.filter((id) => kinOfFocus.has(id))
    const nodes = [focusId, ...ring]
    // 同族但和**这个人**没有明文亲缘的。措辞要精确:不是「没有亲缘记载」,
    // 是「没有与他的亲缘记载」—— 曹丕 与 曹植 之间有明文,但那不在这张图上。
    const loners = roster.filter((id) => id !== focusId && !kinOfFocus.has(id))

    const R = 92
    const CX = 120
    const CY = 120
    const pos = new Map<string, { x: number; y: number }>()
    pos.set(focusId, { x: CX, y: CY })
    ring.forEach((id, i) => {
      const a = (i / Math.max(1, ring.length)) * Math.PI * 2 - Math.PI / 2
      pos.set(id, { x: CX + Math.cos(a) * R, y: CY + Math.sin(a) * R })
    })
    // 环上的人之间也可能有明文(兄弟之间),那几条一并画 —— 但只画两端都在环上的
    const shown = edges.filter((e) => pos.has(e.a) && pos.has(e.b))
    return { nodes, edges: shown, pos, loners }
  }, [clanId, focusId])

  if (nodes.length === 0) return null

  return (
    <div className={styles.wrap}>
      <svg
        className={styles.svg}
        viewBox="-32 -14 304 268"
        role="img"
        aria-label={t(
          `家族圖:${nodes.length} 人有明文親緣、${edges.length} 條`,
          `Family graph: ${nodes.length} members with documented kinship, ${edges.length} links`,
        )}
      >
        <g>
          {edges.map((e) => {
            const p = pos.get(e.a)
            const q = pos.get(e.b)
            if (!p || !q) return null
            const lit = e.a === focusId || e.b === focusId
            return (
              <line
                key={`${e.a}|${e.b}`}
                x1={p.x}
                y1={p.y}
                x2={q.x}
                y2={q.y}
                className={lit ? styles.edgeLit : styles.edge}
              >
                <title>{e.quote}</title>
              </line>
            )
          })}
        </g>
        <g>
          {nodes.map((id) => {
            const p = pos.get(id)!
            const on = id === focusId
            // 标签摆到**环外**,并按左右半圆翻转锚点 —— 名字才不会压到圆里去。
            // 本人在正中,标签摆在他下方(上方是环上第一个人的位置)。
            const dx = p.x - 120
            const dy = p.y - 120
            const len = Math.hypot(dx, dy) || 1
            const lx = on ? p.x : p.x + (dx / len) * 11
            const ly = on ? p.y + 13 : p.y + (dy / len) * 11 + 3
            // 中心那个人**不画名字**:二十条线正好从他脚下扇出去,名字必然被压住;
            // 而弹层的标题就在这张图正上方,那个金色亮点是谁没有任何歧义。
            if (on) {
              return (
                <circle key={id} cx={p.x} cy={p.y} r={6} className={styles.nodeOn}>
                  <title>{pickCompact(cardName(id))}</title>
                </circle>
              )
            }
            return (
              <g key={id}>
                <circle cx={p.x} cy={p.y} r={4} className={styles.node} />
                <text
                  x={lx}
                  y={ly}
                  textAnchor={on || Math.abs(dx) < 12 ? 'middle' : dx < 0 ? 'end' : 'start'}
                  className={styles.label}
                  onClick={() => {
                    playSfx('buttonTap')
                    onPick(id)
                  }}
                >
                  {pickCompact(cardName(id))}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      {/* 没有明文亲缘的那些人。**必须列出来** —— 图里没有他们,
          而族人名册上有,不解释一句就成了「这个人怎么不见了」。 */}
      {loners.length > 0 && (
        <div className={styles.loners}>
          <span className={styles.lonerHint}>
            {t('同族,史料未記明與此人的親緣:', 'Same house; no documented kinship to this person:')}
          </span>
          {loners.map((id) => (
            <button
              key={id}
              type="button"
              className={styles.loner}
              onClick={() => {
                playSfx('buttonTap')
                onPick(id)
              }}
            >
              {pickCompact(cardName(id))}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
