import type { MouseEvent } from 'react'
import type { PlayerState } from '../../engine/types'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { CARDS_BY_ID } from '../../content/cards'
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
          {/* 被过载锁住的水晶画成 ✕ 而不是空心 ——
              「没花掉」和「被锁了」在玩家眼里是两件完全不同的事 */}
          {Array.from({ length: ps.mana.max }, (_, i) => {
            const locked = i >= ps.mana.max - ps.overloadLocked
            const filled = i < ps.mana.current
            return (
              <span
                key={i}
                className={locked ? styles.gemLocked : filled ? styles.gemFull : styles.gemEmpty}
              >
                {locked ? '✕' : '◆'}
              </span>
            )
          })}
          <span className={styles.manaText}>
            {ps.mana.current}/{ps.mana.max}
          </span>
          {ps.overloadNext > 0 && (
            <span
              className={styles.overloadNext}
              title={t(
                `下回合将被锁 ${ps.overloadNext} 点水晶`,
                `${ps.overloadNext} crystals will be locked next turn`,
              )}
            >
              ⧗{ps.overloadNext}
            </span>
          )}
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
      {/* 伏兵区。对手的伏兵 defId 是空串(裁剪层保证),渲染成「?」——
          玩家能看到有几个、但不知道是什么,这正是这个机制的全部价值。 */}
      {ps.secrets.length > 0 && (
        <div
          className={styles.secrets}
          aria-label={t(`伏兵 ${ps.secrets.length} 处`, `${ps.secrets.length} Secrets`)}
        >
          {ps.secrets.map((sec) => {
            const card = sec.defId ? CARDS_BY_ID[sec.defId] : undefined
            const label = card ? (lang === 'en' ? card.name.en : card.name.zh) : '?'
            const desc = card
              ? `${label}\n${lang === 'en' ? (card.text?.en ?? '') : (card.text?.zh ?? '')}`
              : t('对手的伏兵 —— 内容未知', 'An enemy Secret — contents unknown')
            return (
              <span
                key={sec.iid}
                className={`${styles.secret} ${card ? styles.secretKnown : ''}`}
                title={desc}
              >
                {card ? label.slice(0, 2) : '?'}
              </span>
            )
          })}
        </div>
      )}
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
