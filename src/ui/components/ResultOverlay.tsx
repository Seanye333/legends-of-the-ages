import type { Winner } from '../../engine/types'
import type { RatingResult } from '../../app/matchStore'
import { rankOf } from '../../app/protocol'
import { useT } from '../i18n'
import styles from './ResultOverlay.module.css'

interface ResultOverlayProps {
  winner: Winner | undefined
  canRematch?: boolean // 本地局:原地重开
  // 联机再战:双方都点了才重开,所以要区分「我已请求」和「对手在等我」
  remoteRematch?: 'none' | 'offered' | 'sent' | null
  onRemoteRematch?: () => void
  ratingResult?: RatingResult | null // 天梯局:结算后的分数变化
  onRematch: () => void
  onExit: () => void
}

// 终局结算:胜/败战场画卷 + 书法大字 + 再来一局/返回标题。
export function ResultOverlay({
  winner,
  canRematch = true,
  remoteRematch = null,
  onRemoteRematch,
  ratingResult = null,
  onRematch,
  onExit,
}: ResultOverlayProps) {
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
      {remoteRematch === 'offered' && (
        <div className={styles.loot}>{t('对手想再打一局', 'Your opponent wants a rematch')}</div>
      )}
      {ratingResult && (
        <div className={styles.loot}>
          {t(
            `天梯:${rankOf(ratingResult.rating).zh} ${ratingResult.rating} 分(${ratingResult.delta >= 0 ? '+' : ''}${ratingResult.delta})`,
            `Ladder: ${rankOf(ratingResult.rating).en} ${ratingResult.rating} (${ratingResult.delta >= 0 ? '+' : ''}${ratingResult.delta})`,
          )}
        </div>
      )}
      <div className={styles.buttons}>
        {canRematch && (
          <button className={styles.primary} onClick={onRematch}>
            {t('再来一局', 'Rematch')}
          </button>
        )}
        {/* 联机再战:此前联机局打完只能各回各家,而联机恰恰最想立刻打第二把 */}
        {remoteRematch !== null && (
          <button
            className={remoteRematch === 'offered' ? styles.primary : styles.secondary}
            disabled={remoteRematch === 'sent'}
            onClick={onRemoteRematch}
          >
            {remoteRematch === 'sent'
              ? t('等待对手…', 'Waiting…')
              : remoteRematch === 'offered'
                ? t('接受再战', 'Accept rematch')
                : t('请求再战', 'Request rematch')}
          </button>
        )}
        <button className={styles.secondary} onClick={onExit}>
          {t('返回标题', 'Back to Title')}
        </button>
      </div>
    </div>
  )
}
