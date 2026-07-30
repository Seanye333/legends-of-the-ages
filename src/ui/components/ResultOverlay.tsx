import { useEffect, useState } from 'react'
import type { Winner } from '../../engine/types'
import type { RatingResult } from '../../app/matchStore'
import type { MatchStats } from '../../app/matchStats'
import { rankOf } from '../../app/protocol'
import { useT } from '../i18n'
import styles from './ResultOverlay.module.css'

// 战绩数字滚上去,不是印上去。十二个数一次性全出的时候,
// 没有一个会被真的读到 —— 逐行入场(CSS)+ 数字滚动(这里)给每个数一拍。
function RollNum({ value, delay }: { value: number; delay: number }) {
  const reduced =
    typeof document !== 'undefined' && document.documentElement.dataset.reducedMotion === 'true'
  const [shown, setShown] = useState(reduced ? value : 0)
  useEffect(() => {
    if (reduced || value <= 0) {
      setShown(value)
      return
    }
    let raf = 0
    const timer = window.setTimeout(() => {
      const start = performance.now()
      const dur = 650
      const tick = (now: number) => {
        const k = Math.min(1, (now - start) / dur)
        setShown(Math.round(value * (1 - Math.pow(1 - k, 3))))
        if (k < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [value, delay, reduced])
  return <>{shown}</>
}

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
  // 战报海报:一局打完之后能发出去的那张图。不传则不画按钮。
  onShare?: () => void
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
  onShare,
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
        ['发现', 'Discovers', stats.discoveries],
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
      {winner === 0 && (
        <div className={styles.loot}>
          {/* 战利不再只是一行字:一只小卡包(纯 CSS 牌背)先落进来 */}
          <span className={styles.packChip} aria-hidden="true">
            <i>名</i>
          </span>
          {t('战利:卡包 ×1', 'Spoils: 1 card pack')}
        </div>
      )}
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
          {shownRows.map(([zh, en, v], i) => (
            <div
              key={en}
              className={styles.statRow}
              style={{ animationDelay: `${0.55 + i * 0.07}s` }}
            >
              <dt>{t(zh, en)}</dt>
              <dd>
                <RollNum value={v} delay={550 + i * 70} />
              </dd>
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
        {/* 分享的是**结果**不是重放:一份战报是每一帧的完整 GameState(上限 2.5MB),
            编成码长度以兆计,而没有服务器就没有短链接。 */}
        {onShare && (
          <button className={styles.secondary} onClick={onShare}>
            {t('保存戰報圖', 'Save recap')}
          </button>
        )}
        <button className={styles.secondary} onClick={onExit}>
          {t('返回标题', 'Back to Title')}
        </button>
      </div>
    </div>
  )
}
