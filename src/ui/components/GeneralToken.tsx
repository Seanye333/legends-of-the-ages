import type { MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { DOCTRINE_COLORS, KEYWORD_BADGE, KEYWORD_ZH } from '../doctrineColors'
import { Portrait } from './Portrait'
import type { FloatItem } from './floats'
import styles from './GeneralToken.module.css'

interface GeneralTokenProps {
  inst: CardInstance
  ready?: boolean // 可发起攻击:绿光
  selected?: boolean // 已选为攻击者
  targetable?: boolean // 当前选择模式下的合法目标:红圈
  floats?: FloatItem[]
  onClick?: (e: MouseEvent) => void
}

// 战场上的武将圆形令牌。
export function GeneralToken({ inst, ready, selected, targetable, floats, onClick }: GeneralTokenProps) {
  const def = CARDS_BY_ID[inst.defId]
  const nameZh = def?.name.zh ?? inst.defId
  const doctrine = def?.doctrine ?? 'neutral'
  const hasGuard = inst.keywords.includes('guard')

  const cls = [
    styles.token,
    inst.exhausted ? styles.exhausted : '',
    ready ? styles.ready : '',
    selected ? styles.selected : '',
    targetable ? styles.targetable : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={cls} onClick={onClick} title={nameZh}>
      <div
        className={`${styles.circle} ${hasGuard ? styles.guardRing : ''}`}
        style={hasGuard ? undefined : { borderColor: `${DOCTRINE_COLORS[doctrine]}aa` }}
      >
        <Portrait id={inst.defId} nameZh={nameZh} doctrine={doctrine} />
      </div>
      {hasGuard && <span className={styles.guardMark}>盾</span>}
      <span className={styles.atk}>{inst.attack}</span>
      <span className={`${styles.hp} ${inst.health < inst.maxHealth ? styles.hurt : ''}`}>
        {inst.health}
      </span>
      {inst.keywords.length > 0 && (
        <div className={styles.badges}>
          {inst.keywords.map((k) => (
            <span key={k} className={styles.badge} title={KEYWORD_ZH[k]}>
              {KEYWORD_BADGE[k]}
            </span>
          ))}
        </div>
      )}
      {floats?.map((f) => (
        <span
          key={f.id}
          className={`${styles.float} ${styles[f.kind]}`}
          style={{ marginLeft: `${f.offset * 16}px` }}
        >
          {f.text}
        </span>
      ))}
    </div>
  )
}
