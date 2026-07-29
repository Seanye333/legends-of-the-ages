import { useMemo } from 'react'
import { CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import { ERA_BLURB, ERA_NAME, ERA_OF, ERA_SPAN, type Era } from '../../content/eras'
import { ERA_ORDER } from '../../content/collectionGoals'
import { useCollection } from '../../app/collectionStore'
import { usePickCompact, usePickText, useT } from '../i18n'
import { Portrait } from './Portrait'
import styles from './EraScroll.module.css'

interface EraScrollProps {
  onPickCard?: (cardId: string) => void
  // 选中的时代块。给了它长卷就从「一段展墙」变成「一条导航」——
  // 点哪一块,下面的列传就翻到哪一段。
  selected?: Era | null
  onSelectEra?: (era: Era) => void
}

// 時代長卷 —— 把两千六百年摆成一条从右往左展开的路。
//
// 【它和「書房」里那条时代进度条不是一回事】
// 书房那条回答的是**收集度**(这一块我收了几张),是一根进度条。
// 长卷回答的是**这是个什么时代**:年代、战争形态、以及这一块里站着谁。
// 前者是仓库清单,后者是博物馆的展墙 —— 名将列传该有的是后者。
//
// 【为什么是横向滚动而不是纵向堆叠】
// 时间本来就是一条线。竖着堆六块,读起来是「六个分类」;
// 横着排一条,读起来才是「先秦之后是秦汉」。
// 而且横向天然能容下每块的一整段画像文字,不用折叠。
export function EraScroll({ onPickCard, selected, onSelectEra }: EraScrollProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const owned = useCollection((s) => s.owned)

  // 每块时代的「门面」:优先已拥有的传奇,其次已拥有的任意签名卡,
  // 一个都没有就取该时代第一位(灰着放)—— 空展位比锁着的展位更没信息。
  const faces = useMemo(() => {
    const byEra = new Map<Era, string[]>()
    for (const id of SIGNATURE_IDS) {
      const card = CARDS_BY_ID[id]
      if (!card) continue
      const era = ERA_OF[card.dynasty]
      const list = byEra.get(era) ?? []
      list.push(id)
      byEra.set(era, list)
    }
    const out = new Map<Era, string[]>()
    for (const era of ERA_ORDER) {
      const list = byEra.get(era) ?? []
      const has = (id: string) => (owned[id] ?? 0) > 0
      const ranked = [
        ...list.filter((id) => has(id) && CARDS_BY_ID[id].rarity === 'legendary'),
        ...list.filter((id) => has(id) && CARDS_BY_ID[id].rarity !== 'legendary'),
        ...list.filter((id) => !has(id)),
      ]
      out.set(era, ranked.slice(0, 4))
    }
    return out
  }, [owned])

  const counts = useMemo(() => {
    const out = new Map<Era, { have: number; total: number }>()
    for (const era of ERA_ORDER) out.set(era, { have: 0, total: 0 })
    for (const id of SIGNATURE_IDS) {
      const card = CARDS_BY_ID[id]
      if (!card) continue
      const e = out.get(ERA_OF[card.dynasty])
      if (!e) continue
      e.total += 1
      if ((owned[id] ?? 0) > 0) e.have += 1
    }
    return out
  }, [owned])

  return (
    <div className={styles.scroll}>
      {ERA_ORDER.map((era, i) => {
        const c = counts.get(era) ?? { have: 0, total: 0 }
        return (
          <section
            key={era}
            className={`${styles.panel} ${selected === era ? styles.panelActive : ''}`}
            onClick={() => onSelectEra?.(era)}
          >
            {/* 卷与卷之间的接缝。第一块不画 —— 长卷的开头没有接缝。 */}
            {i > 0 && <span className={styles.seam} aria-hidden="true" />}
            <div className={styles.span}>{pick(ERA_SPAN[era])}</div>
            <h3 className={styles.eraName}>{pick(ERA_NAME[era])}</h3>
            <p className={styles.blurb}>{pick(ERA_BLURB[era])}</p>
            <div className={styles.faces}>
              {(faces.get(era) ?? []).map((id) => {
                const card = CARDS_BY_ID[id]
                const has = (owned[id] ?? 0) > 0
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${styles.face} ${has ? '' : styles.faceLocked}`}
                    onClick={(e) => {
                      // 点头像是「看这个人」,点面板别处是「翻到这个时代」——
                      // 不拦住冒泡的话点头像会同时干两件事。
                      e.stopPropagation()
                      if (has) onPickCard?.(id)
                      else onSelectEra?.(era)
                    }}
                    title={has ? card.name.zh : t('尚未入列', 'Not yet in your ranks')}
                    aria-label={has ? pickCompact(card.name) : t('尚未入列', 'Not yet in your ranks')}
                  >
                    <Portrait id={id} nameZh={card.name.zh} doctrine={card.doctrine} />
                  </button>
                )
              })}
            </div>
            <div className={styles.count}>
              {c.have} / {c.total}
            </div>
          </section>
        )
      })}
    </div>
  )
}
