import { useEffect, useRef, useState } from 'react'
import type { LocalizedText } from '../../engine/types'
import { useLang, useT } from '../i18n'
import styles from './BattleLog.module.css'

interface BattleLogProps {
  entries: LocalizedText[]
}

// 右侧可折叠战报面板。双语模式下中文在上、英文小一号在下,避免长句挤成一坨。
export function BattleLog({ entries }: BattleLogProps) {
  const t = useT()
  const lang = useLang()
  const [open, setOpen] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [entries, open])

  return (
    <div className={`${styles.panel} ${open ? styles.open : ''}`}>
      <button
        className={styles.toggle}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((v) => !v)
        }}
      >
        {open ? '✕' : t('战报', 'Log')}
      </button>
      {open && (
        <div role="log" aria-live="polite" aria-label="战报 Battle log" className={styles.list} ref={listRef} onClick={(e) => e.stopPropagation()}>
          {entries.length === 0 ? (
            <div className={styles.empty}>{t('暂无战报', 'No entries yet')}</div>
          ) : (
            entries.map((line, i) => (
              <div key={i} className={styles.line}>
                {lang === 'en' ? line.en : line.zh}
                {lang === 'both' && <span className={styles.sub}>{line.en}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
