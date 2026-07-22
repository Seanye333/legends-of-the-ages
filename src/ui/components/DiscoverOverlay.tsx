import type { PendingChoice } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { fakeInstance } from '../screens/CollectionScreen'
import { CardFace } from './CardFace'
import { useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './DiscoverOverlay.module.css'

interface DiscoverOverlayProps {
  choice: PendingChoice
  mySeat: 0 // 本地帧恒为 0 号玩家
  onPick: (index: number) => void
}

// 发现浮层:亮出候选,点一张 → ResolveChoice。
//
// 分两种视角(和伏兵、对手手牌是同一套「空 defId = 未知」的路径):
//   - 我在发现:options 是真的 defId,渲染成可点的卡,选一张。
//   - 对手在发现:options 是一串空串(裁剪层只给了数量),渲染成牌背,不可点,
//     只告诉我「对手正在从 N 张里挑」—— 这本身就是有用的信息。
export function DiscoverOverlay({ choice, mySeat, onPick }: DiscoverOverlayProps) {
  const t = useT()
  const mine = choice.player === mySeat

  if (!mine) {
    return (
      <div className={styles.overlay}>
        <div className={styles.enemyBanner}>
          {t(`对手正在发现(${choice.options.length} 选 1)…`, `Opponent is discovering (1 of ${choice.options.length})…`)}
        </div>
        <div className={styles.row}>
          {choice.options.map((_, i) => (
            <div key={i} className={styles.cardBack} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={styles.overlay}>
      <h2 className={styles.title}>{t('发现', 'Discover')}</h2>
      <p className={styles.hint}>{t('挑一张加入手牌', 'Choose a card to add to your hand')}</p>
      <div className={styles.row}>
        {choice.options.map((defId, i) => {
          const def = CARDS_BY_ID[defId]
          if (!def) return <div key={i} className={styles.cardBack} />
          return (
            <button
              key={i}
              className={styles.pick}
              onClick={() => {
                playSfx('cardPlay')
                onPick(i)
              }}
            >
              <CardFace inst={fakeInstance(def)} />
            </button>
          )
        })}
      </div>
    </div>
  )
}
