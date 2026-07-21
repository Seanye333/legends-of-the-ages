import type { Winner } from '../../engine/types'
import type { RatingResult } from '../../app/matchStore'
import type { MatchStats } from '../../app/matchStats'
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
  stats?: MatchStats | null // 战绩回顾
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
  stats = null,
  onRematch,
  onExit,
}: ResultOverlayProps) {
  const t = useT()
  // 只列**这一局真的发生过**的项。零值全列出来会把一场三回合的速攻
  // 显示成一整屏 0,那比不显示更糟。伤害与回合数恒显示(它们必然非零)。
  const rows: [string, string, number][] = stats
    ? [
        ['造成伤害', 'Damage dealt', stats.damageDealt],
        ['打脸伤害', 'To the enemy hero', stats.damageToFace],
        ['承受伤害', 'Damage taken', stats.damageTaken],
        ['斩将', 'Generals slain', stats.enemyGeneralsSlain],
        ['登场武将', 'Generals fielded', stats.generalsPlayed],
        ['最大场面', 'Peak board', stats.peakBoard],
        ['抽牌', 'Cards drawn', stats.cardsDrawn],
        ['耗费法力', 'Mana spent', stats.manaSpent],
        ['伏兵触发', 'Secrets sprung', stats.secretsRevealed],
        ['连击', 'Combos', stats.combosTriggered],
        ['回合数', 'Turns', stats.turns],
      ]
    : []
  const shownRows = rows.filter(([, , v], i) => v > 0 || i < 3)
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
      {shownRows.length > 0 && (
        <dl className={styles.stats}>
          {shownRows.map(([zh, en, v]) => (
            <div key={en} className={styles.statRow}>
              <dt>{t(zh, en)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
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
