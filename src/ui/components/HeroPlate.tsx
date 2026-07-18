import type { MouseEvent } from 'react'
import type { PlayerState } from '../../engine/types'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { useSettings } from '../../app/settingsStore'
import type { FloatItem } from './floats'
import { Portrait } from './Portrait'
import styles from './HeroPlate.module.css'

interface HeroPlateProps {
  ps: PlayerState
  enemy?: boolean
  targetable?: boolean
  floats?: FloatItem[]
  onClick?: (e: MouseEvent) => void
}

// 主帅面板:头像 + 血量 + 法力水晶;敌方另显示手牌数(牌背)。
export function HeroPlate({ ps, enemy, targetable, floats, onClick }: HeroPlateProps) {
  const lang = useSettings((s) => s.language)
  const hero = HEROES_BY_ID[ps.heroId]
  const nameZh = hero?.name.zh ?? ps.heroId
  const name = hero ? (lang === 'en' ? hero.name.en : hero.name.zh) : ps.heroId

  return (
    <div className={`${styles.plate} ${enemy ? styles.enemy : ''}`}>
      <div
        className={`${styles.portraitWrap} ${targetable ? styles.targetable : ''}`}
        onClick={onClick}
      >
        <Portrait id={ps.heroId} nameZh={nameZh} doctrine={hero?.doctrine ?? 'neutral'} />
        <span className={styles.hp}>{ps.heroHp}</span>
        {ps.armor > 0 && <span className={styles.armor}>{ps.armor}</span>}
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
      <div className={styles.info}>
        <div className={styles.name}>{name}</div>
        <div className={styles.mana} title={`法力 ${ps.mana.current}/${ps.mana.max}`}>
          {Array.from({ length: ps.mana.max }, (_, i) => (
            <span key={i} className={i < ps.mana.current ? styles.gemFull : styles.gemEmpty}>
              ◆
            </span>
          ))}
          <span className={styles.manaText}>
            {ps.mana.current}/{ps.mana.max}
          </span>
        </div>
        {enemy && (
          <div className={styles.backs} title={`对方手牌 ${ps.hand.length} 张`}>
            {Array.from({ length: Math.min(ps.hand.length, 10) }, (_, i) => (
              <span key={i} className={styles.back} />
            ))}
            <span className={styles.backCount}>{ps.hand.length}</span>
          </div>
        )}
      </div>
    </div>
  )
}
