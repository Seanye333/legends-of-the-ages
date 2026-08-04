import { useMemo, useState } from 'react'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../../content/cards'
import { battlesNow, loreNow } from '../../content/loreLazy'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './LoreIndex.module.css'

// 名将索引:列传原本只能顺着**人**翻(关系 / 家族 / 同乡),翻不动**事**。
// 赤壁牵涉十几个人,而玩家得一个一个点进去才拼得出来。
//
// 三种归类,回答三个不同的问题:
//   战役 —— 这一仗都有谁?(索引从生平原文反查,见生成脚本的 BATTLES)
//   郡望 —— 这个地方出过哪些人?(籍贯取前两字归郡:潁川人 / 潁川潁陰人 / 潁川陽翟人 是一处)
//   家族 —— 这一族都有谁?(族谱本来就在卡面上,这里是**通览**那一份)
//
// 只列人数够的组:两个人的「同乡」不是同乡,是巧合。
type Group = { key: string; label: string; ids: string[] }

export function LoreIndex({ onPick }: { onPick: (id: string) => void }) {
  const t = useT()
  const pickCompact = usePickCompact()
  const [kind, setKind] = useState<'battle' | 'home' | 'clan'>('battle')
  const [open, setOpen] = useState<string | null>(null)

  const groups = useMemo((): Group[] => {
    if (kind === 'battle') {
      return battlesNow().map((b) => ({ key: b.name.zh, label: pickCompact(b.name), ids: b.ids }))
    }
    if (kind === 'home') {
      const LORE = loreNow()
      const by = new Map<string, string[]>()
      for (const c of COLLECTIBLE_CARDS) {
        const home = LORE[c.id]?.home?.zh
        if (!home) continue
        // 「潁川人」「潁川潁陰人」「潁川陽翟人」是同一个郡 —— 取前两字归堆。
        // 三字以下的原样用(「趙人」「楚國人」这种本来就是整体)。
        const jun = home.length > 3 ? home.slice(0, 2) : home.replace(/人$/, '')
        by.set(jun, [...(by.get(jun) ?? []), c.id])
      }
      return [...by.entries()]
        .filter(([, ids]) => ids.length >= 3)
        .map(([k, ids]) => ({ key: k, label: k, ids }))
        .sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key))
    }
    const by = new Map<string, { label: string; ids: string[] }>()
    for (const c of COLLECTIBLE_CARDS) {
      if (!c.clan) continue
      const row = by.get(c.clan.id)
      if (row) row.ids.push(c.id)
      else by.set(c.clan.id, { label: pickCompact(c.clan.name), ids: [c.id] })
    }
    return [...by.entries()]
      .filter(([, v]) => v.ids.length >= 3)
      .map(([k, v]) => ({ key: k, label: v.label, ids: v.ids }))
      .sort((a, b) => b.ids.length - a.ids.length || a.key.localeCompare(b.key))
  }, [kind, pickCompact])

  return (
    <div className={styles.wrap}>
      <div className={styles.kinds}>
        {(
          [
            ['battle', t('戰役', 'Battles')],
            ['home', t('郡望', 'Origins')],
            ['clan', t('家族', 'Houses')],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            className={kind === k ? styles.kindActive : styles.kindBtn}
            onClick={() => {
              playSfx('buttonTap')
              setKind(k)
              setOpen(null)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <p className={styles.lede}>
        {kind === 'battle'
          ? t('生平里点到这一仗的人。索引从原文反查,不是我们编的名单。', 'Everyone whose chronicle names this battle — read out of the sources, not assembled by us.')
          : kind === 'home'
            ? t('同郡出身的人。籍贯取自生平原文,按郡归堆。', 'Men of the same commandery, grouped from the birthplaces named in their chronicles.')
            : t('同族的人。族谱从生平里的亲属关系抠出来。', 'Kinsmen, read out of the family ties named in their chronicles.')}
      </p>
      <div className={styles.list}>
        {groups.map((g) => (
          <div key={g.key} className={styles.group}>
            <button
              className={styles.groupHead}
              onClick={() => {
                playSfx('buttonTap')
                setOpen((v) => (v === g.key ? null : g.key))
              }}
              aria-expanded={open === g.key}
            >
              <span className={styles.groupLabel}>{g.label}</span>
              <span className={styles.groupCount}>{g.ids.length}</span>
            </button>
            {open === g.key && (
              <div className={styles.members}>
                {g.ids.map((id) => (
                  <button key={id} className={styles.member} onClick={() => onPick(id)}>
                    {pickCompact(CARDS_BY_ID[id]?.name ?? { zh: id, en: id })}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
