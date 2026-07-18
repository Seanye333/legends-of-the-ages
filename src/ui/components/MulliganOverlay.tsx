import { useState } from 'react'
import type { CardInstance } from '../../engine/types'
import { useT } from '../i18n'
import { CardFace } from './CardFace'
import styles from './MulliganOverlay.module.css'

interface MulliganOverlayProps {
  hand: CardInstance[]
  waiting: boolean // 我已确认,等待对手
  onConfirm: (keepIids: number[]) => void
}

// 调度(换牌)界面:点击卡牌标记换掉,确认后发送 Mulligan。
export function MulliganOverlay({ hand, waiting, onConfirm }: MulliganOverlayProps) {
  const t = useT()
  const [replaced, setReplaced] = useState<ReadonlySet<number>>(new Set())

  const toggle = (iid: number) => {
    setReplaced((prev) => {
      const next = new Set(prev)
      if (next.has(iid)) next.delete(iid)
      else next.add(iid)
      return next
    })
  }

  if (waiting) {
    return (
      <div className={styles.overlay}>
        <div className={styles.waiting}>{t('等待对手调度…', 'Waiting for opponent…')}</div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <h2 className={styles.title}>{t('调度', 'Mulligan')}</h2>
      <p className={styles.hint}>{t('点击要换掉的卡牌', 'Tap cards to replace them')}</p>
      <div className={styles.cards}>
        {hand.map((c) => (
          <div key={c.iid} className={styles.slot}>
            <CardFace inst={c} large onClick={() => toggle(c.iid)} />
            {replaced.has(c.iid) && (
              <div className={styles.cross} onClick={() => toggle(c.iid)}>
                ✕
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        className={styles.confirm}
        onClick={() => onConfirm(hand.filter((c) => !replaced.has(c.iid)).map((c) => c.iid))}
      >
        {replaced.size > 0
          ? t(`确认(换 ${replaced.size} 张)`, `Confirm (replace ${replaced.size})`)
          : t('全部保留', 'Keep all')}
      </button>
    </div>
  )
}
