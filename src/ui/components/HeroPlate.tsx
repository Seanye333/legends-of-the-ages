import type { MouseEvent } from 'react'
import type { PlayerState } from '../../engine/types'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { useSettings } from '../../app/settingsStore'
import { useT } from '../i18n'
import type { FloatItem } from './floats'
import type { TokenFx } from '../useEventAnimations'
import { Portrait } from './Portrait'
import styles from './HeroPlate.module.css'

const MOTION_CLASS = { lunge: 'fx-lunge', shake: 'fx-shake', shakeHard: 'fx-shake-hard' } as const

interface HeroPlateProps {
  ps: PlayerState
  enemy?: boolean
  targetable?: boolean
  floats?: FloatItem[]
  fx?: TokenFx // 受击震颤/闪光
  pulse?: boolean // 我方回合开始的金光脉动
  onClick?: (e: MouseEvent) => void
  // 主公技:可用时高亮可点。敌方一侧只展示不可点。
  powerUsable?: boolean
  onUsePower?: (e: MouseEvent) => void
  powerSelected?: boolean
}

// 主帅面板:头像 + 血量 + 法力水晶 + 主公技 + 牌库余量;敌方另显示手牌数(牌背)。
export function HeroPlate({
  ps,
  enemy,
  targetable,
  floats,
  fx,
  pulse,
  onClick,
  powerUsable,
  onUsePower,
  powerSelected,
}: HeroPlateProps) {
  const lang = useSettings((s) => s.language)
  const t = useT()
  const hero = HEROES_BY_ID[ps.heroId]
  const nameZh = hero?.name.zh ?? ps.heroId
  const name = hero ? (lang === 'en' ? hero.name.en : hero.name.zh) : ps.heroId
  const power = ps.heroPower
  const powerName = power ? (lang === 'en' ? power.name.en : power.name.zh) : ''
  const powerText = power ? (lang === 'en' ? power.text.en : power.text.zh) : ''

  return (
    <div
      className={`${styles.plate} ${enemy ? styles.enemy : ''} ${pulse ? styles.pulse : ''} ${
        fx?.motion ? MOTION_CLASS[fx.motion.kind] : ''
      }`}
      data-fxkey={`hero-${enemy ? 1 : 0}`}
    >
      <div
        className={`${styles.portraitWrap} ${targetable ? styles.targetable : ''}`}
        onClick={onClick}
      >
        {fx?.flash && (
          <span
            key={fx.flash.id}
            className={`fx-flash ${fx.flash.kind === 'clash' ? 'fx-flash-clash' : 'fx-flash-hit'}`}
          />
        )}
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
        <div className={styles.mana} title={t(`法力 ${ps.mana.current}/${ps.mana.max}`, `Mana ${ps.mana.current}/${ps.mana.max}`)}>
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
          <div className={styles.backs} title={t(`对方手牌 ${ps.hand.length} 张`, `Opponent hand: ${ps.hand.length}`)}>
            {Array.from({ length: Math.min(ps.hand.length, 10) }, (_, i) => (
              <span key={i} className={styles.back} />
            ))}
            <span className={styles.backCount}>{ps.hand.length}</span>
          </div>
        )}
        {/* 牌库余量 + 疲劳。以前完全看不到,牌库见底是突然死亡 —— 这是最基本的公开信息 */}
        <div
          className={styles.deckInfo}
          title={t(
            `牌库剩余 ${ps.deck.length} 张${ps.fatigue > 0 ? `,疲劳 ${ps.fatigue}` : ''}`,
            `${ps.deck.length} cards left in deck${ps.fatigue > 0 ? `, fatigue ${ps.fatigue}` : ''}`,
          )}
        >
          <span className={ps.deck.length <= 5 ? styles.deckLow : undefined}>
            ▤ {ps.deck.length}
          </span>
          {ps.fatigue > 0 && <span className={styles.fatigue}>☠ {ps.fatigue}</span>}
        </div>
      </div>
      {power && (
        <button
          type="button"
          className={`${styles.power} ${powerUsable ? styles.powerReady : ''} ${
            powerSelected ? styles.powerSelected : ''
          }`}
          disabled={!powerUsable}
          onClick={onUsePower}
          aria-label={`${powerName} — ${powerText}`}
          title={`${powerName}(${power.cost})\n${powerText}`}
        >
          <span className={styles.powerName}>{powerName}</span>
          <span className={styles.powerCost}>{power.cost}</span>
          {ps.heroPowerUsed && <span className={styles.powerUsed} aria-hidden="true" />}
        </button>
      )}
    </div>
  )
}
