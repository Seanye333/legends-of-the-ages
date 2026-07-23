import type { LocalizedText } from '../../engine/types'
import type { PuzzleReward } from '../../app/lethalStore'
import { usePickText, useT } from '../i18n'
import styles from './PuzzleResultOverlay.module.css'

interface PuzzleResultOverlayProps {
  result: 'won' | 'lost'
  reward: PuzzleReward | null // 仅 won 时有意义
  title: LocalizedText
  hint: LocalizedText
  onRetry: () => void
  onExit: () => void
}

// 斩杀谜题专用结算:胜=斩杀成功(+奖励),负=本回合未能斩杀(给提示 + 重试)。
// 不复用 ResultOverlay —— 那个写死了「战利:卡包 ×1」、带战绩表,都不适合谜题。
export function PuzzleResultOverlay({
  result,
  reward,
  title,
  hint,
  onRetry,
  onExit,
}: PuzzleResultOverlayProps) {
  const t = useT()
  const pick = usePickText()
  const won = result === 'won'

  return (
    <div className={`${styles.overlay} ${won ? styles.bgWin : styles.bgLose}`}>
      <div className={`${styles.glyph} ${won ? styles.win : styles.lose}`}>{won ? '斬' : '惜'}</div>
      <div className={`${styles.word} ${won ? styles.win : styles.lose}`}>
        {won ? t('斩杀成功', 'Lethal Found') : t('未能斩杀', 'No Lethal')}
      </div>
      <div className={styles.sub}>{pick(title)}</div>

      {won && reward && (
        <div className={styles.loot}>
          {reward.firstSolve
            ? t(`首解 · 功勋 +${reward.merit}`, `First solve · +${reward.merit} Merit`)
            : t('此题已解开过', 'Already solved')}
          {reward.allComplete && (
            <div className={styles.bonus}>
              {t(`全部通关!卡包 +${reward.packs}`, `All puzzles cleared! +${reward.packs} pack`)}
            </div>
          )}
        </div>
      )}

      {!won && (
        <div className={styles.hint}>
          <span className={styles.hintLabel}>{t('提示', 'Hint')}</span>
          {pick(hint)}
        </div>
      )}

      <div className={styles.buttons}>
        {won ? (
          <>
            <button className={styles.primary} onClick={onExit}>
              {t('返回选题', 'Back to List')}
            </button>
            <button className={styles.secondary} onClick={onRetry}>
              {t('再来一遍', 'Play Again')}
            </button>
          </>
        ) : (
          <>
            <button className={styles.primary} onClick={onRetry}>
              {t('重试', 'Retry')}
            </button>
            <button className={styles.secondary} onClick={onExit}>
              {t('返回选题', 'Back to List')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
