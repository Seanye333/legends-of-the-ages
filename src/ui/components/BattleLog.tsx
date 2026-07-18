import { useEffect, useRef, useState } from 'react'
import { useT } from '../i18n'
import styles from './BattleLog.module.css'

interface BattleLogProps {
  entries: string[]
}

// 右侧可折叠战报面板。
export function BattleLog({ entries }: BattleLogProps) {
  const t = useT()
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
        <div className={styles.list} ref={listRef} onClick={(e) => e.stopPropagation()}>
          {entries.length === 0 ? (
            <div className={styles.empty}>{t('暂无战报', 'No entries yet')}</div>
          ) : (
            entries.map((line, i) => (
              <div key={i} className={styles.line}>
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
