import { useState } from 'react'
import type { CardInstance } from '../../engine/types'
import { usePickText, useT } from '../i18n'
import { proclamation } from '../../content/proclamation'
import { CardFace } from './CardFace'
import styles from './MulliganOverlay.module.css'

interface MulliganOverlayProps {
  hand: CardInstance[]
  waiting: boolean // 我已确认,等待对手
  onConfirm: (keepIids: number[]) => void
  // 战前檄文:每一局的开场此前是同一屏调度界面,而曹操打岳飞和曹操打刘备
  // 是隔了九百年的两件事,界面上一个字都不提。
  heroIds?: [string, string]
  // 我是后手吗 —— 决定要不要把后手补偿说清楚(见下)
  second?: boolean
}

// 调度(换牌)界面:点击卡牌标记换掉,确认后发送 Mulligan。
export function MulliganOverlay({ hand, waiting, onConfirm, heroIds, second }: MulliganOverlayProps) {
  const t = useT()
  const pick = usePickText()
  const proc = heroIds ? proclamation(heroIds[0], heroIds[1]) : null
  const [replaced, setReplaced] = useState<ReadonlySet<number>>(new Set())
  // 联机时服务器确认前 waiting 尚未翻转,防双击重复提交
  const [submitted, setSubmitted] = useState(false)

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
      {proc && <p className={styles.proclamation}>{pick(proc)}</p>}
      {/* 【后手补偿必须在这里说清楚】
          后手方开局凭空多一张牌、手牌各便宜 1 费、主公多 3 点护甲
          (见 engine/types.ts 的 SECOND_PLAYER_COMP)。
          不写出来的话玩家只会看到「这张 3 费的牌怎么标着 2 费」,
          第一反应是 bug 而不是规则 —— 一条看不见的规则等于没有规则。
          调度屏是唯一合适的位置:它正好是手牌第一次露面的那一刻。 */}
      {second && (
        <p className={styles.comp}>
          {t(
            '後手補償 · 手牌多一張、起手牌各 −1 費、主公 +3 護甲',
            'Second-player compensation — one extra card, opening hand costs 1 less, +3 Armor',
          )}
        </p>
      )}
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
        disabled={submitted}
        onClick={() => {
          setSubmitted(true)
          onConfirm(hand.filter((c) => !replaced.has(c.iid)).map((c) => c.iid))
        }}
      >
        {replaced.size > 0
          ? t(`确认(换 ${replaced.size} 张)`, `Confirm (replace ${replaced.size})`)
          : t('全部保留', 'Keep all')}
      </button>
    </div>
  )
}
