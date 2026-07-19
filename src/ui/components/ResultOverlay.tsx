import type { Winner } from '../../engine/types'
import { useT } from '../i18n'
import styles from './ResultOverlay.module.css'

interface ResultOverlayProps {
  winner: Winner | undefined
  canRematch?: boolean // 联机对局无法原地重开
  onRematch: () => void
  onExit: () => void
}

// 终局结算:胜/败战场画卷 + 书法大字 + 再来一局/返回标题。
export function ResultOverlay({ winner, canRematch = true, onRematch, onExit }: ResultOverlayProps) {
  const t = useT()
  const [glyph, word, verdictCls, bgCls] =
    winner === 0
      ? ['勝', t('凯旋而归', 'Victory'), styles.win, styles.bgWin]
      : winner === 1
        ? ['敗', t('卷土重来', 'Defeat'), styles.lose, styles.bgLose]
        : ['和', t('平分秋色', 'Draw'), styles.draw, styles.bgDraw]

  return (
    <div className={`${styles.overlay} ${bgCls}`}>
      <div className={`${styles.glyph} ${verdictCls}`}>{glyph}</div>
      <div className={`${styles.word} ${verdictCls}`}>{word}</div>
      {winner === 0 && <div className={styles.loot}>{t('战利:卡包 ×1', 'Spoils: 1 card pack')}</div>}
      <div className={styles.buttons}>
        {canRematch && (
          <button className={styles.primary} onClick={onRematch}>
            {t('再来一局', 'Rematch')}
          </button>
        )}
        <button className={styles.secondary} onClick={onExit}>
          {t('返回标题', 'Back to Title')}
        </button>
      </div>
    </div>
  )
}
