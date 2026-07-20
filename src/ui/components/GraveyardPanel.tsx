import { useEffect, useMemo, useRef } from 'react'
import type { CardDef } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './GraveyardPanel.module.css'

interface GraveyardPanelProps {
  mine: string[]
  theirs: string[]
  onInspect: (def: CardDef) => void
  onClose: () => void
}

// 同名卡合并计数,免得一长串重复
function groupCards(ids: string[]): { def: CardDef; n: number }[] {
  const counts = new Map<string, number>()
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .map(([id, n]) => ({ def: CARDS_BY_ID[id], n }))
    .filter((x): x is { def: CardDef; n: number } => Boolean(x.def))
    .sort((a, b) => a.def.cost - b.def.cost || a.def.collectorNo - b.def.collectorNo)
}

// 墓地查看。此前**完全看不到**已经打出/阵亡的牌 ——
// 而「对手的火計是不是已经用掉了」在中后期是最影响决策的一条信息,
// 靠脑子记三十回合并不合理。
export function GraveyardPanel({ mine, theirs, onInspect, onClose }: GraveyardPanelProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    // 捕获阶段:抢在对战画面的「Esc 取消选目标」之前
    window.addEventListener('keydown', onKey, true)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const cols = useMemo(
    () => [
      { key: 'mine', label: t('我方墓地', 'Your graveyard'), rows: groupCards(mine) },
      { key: 'theirs', label: t('对方墓地', 'Their graveyard'), rows: groupCards(theirs) },
    ],
    [mine, theirs, t],
  )

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        tabIndex={-1}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('墓地', 'Graveyards')}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2 className={styles.title}>{t('墓地', 'Graveyards')}</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label={t('关闭', 'Close')}>
            ✕
          </button>
        </header>
        <div className={styles.cols}>
          {cols.map((c) => (
            <section key={c.key} className={styles.col}>
              <h3 className={styles.colTitle}>
                {c.label}
                <span className={styles.colCount}>
                  {c.key === 'mine' ? mine.length : theirs.length}
                </span>
              </h3>
              {c.rows.length === 0 ? (
                <p className={styles.empty}>{t('空', 'Empty')}</p>
              ) : (
                <ul className={styles.list}>
                  {c.rows.map(({ def, n }) => (
                    <li key={def.id}>
                      <button
                        className={styles.row}
                        style={{ borderLeftColor: DOCTRINE_COLORS[def.doctrine] }}
                        onClick={() => {
                          playSfx('buttonTap')
                          onInspect(def)
                        }}
                      >
                        <span className={styles.cost}>{def.cost}</span>
                        <span className={styles.name}>{pickCompact(def.name)}</span>
                        {n > 1 && <span className={styles.dup}>×{n}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
