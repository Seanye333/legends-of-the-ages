import type { Winner } from '../../engine/types'
import { useT } from '../i18n'
import styles from './ResultOverlay.module.css'

interface ResultOverlayProps {
  winner: Winner | undefined
  onRematch: () => void
  onExit: () => void
}

// 终局结算:胜利/败北/平局 + 再来一局/返回标题。
export function ResultOverlay({ winner, onRematch, onExit }: ResultOverlayProps) {
  const t = useT()
  const [text, cls] =
    winner === 0
      ? [t('胜利!', 'Victory!'), styles.win]
      : winner === 1
        ? [t('败北', 'Defeat'), styles.lose]
        : [t('平局', 'Draw'), styles.draw]

  return (
    <div className={styles.overlay}>
      <div className={`${styles.verdict} ${cls}`}>{text}</div>
      <div className={styles.buttons}>
        <button className={styles.primary} onClick={onRematch}>
          {t('再来一局', 'Rematch')}
        </button>
        <button className={styles.secondary} onClick={onExit}>
          {t('返回标题', 'Back to Title')}
        </button>
      </div>
    </div>
  )
}
