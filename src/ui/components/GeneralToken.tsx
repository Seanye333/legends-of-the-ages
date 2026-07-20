import type { CSSProperties, MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { DOCTRINE_COLORS, KEYWORD_BADGE, KEYWORD_NAME } from '../doctrineColors'
import { Portrait } from './Portrait'
import type { FloatItem } from './floats'
import type { TokenFx } from '../useEventAnimations'
import { useLongPress } from '../useLongPress'
import { usePickCompact, useLang } from '../i18n'
import styles from './GeneralToken.module.css'

const MOTION_CLASS = { lunge: 'fx-lunge', shake: 'fx-shake', shakeHard: 'fx-shake-hard' } as const

interface GeneralTokenProps {
  inst: CardInstance
  ready?: boolean // 可发起攻击:绿光
  selected?: boolean // 已选为攻击者
  targetable?: boolean // 当前选择模式下的合法目标:红圈
  floats?: FloatItem[]
  fx?: TokenFx // 战斗动效(突进/震颤/闪光)
  onClick?: (e: MouseEvent) => void
  onInspect?: () => void // 长按查看详情
}

// 战场上的武将勋章令牌:鎏金外环 + 主义色内圈。
export function GeneralToken({ inst, ready, selected, targetable, floats, fx, onClick, onInspect }: GeneralTokenProps) {
  const longPress = useLongPress(() => onInspect?.())
  const pickCompact = usePickCompact()
  const def = CARDS_BY_ID[inst.defId]
  const nameZh = def?.name.zh ?? inst.defId
  const name = def ? pickCompact(def.name) : inst.defId
  const doctrine = def?.doctrine ?? 'neutral'
  const hasGuard = inst.keywords.includes('guard')
  const zhLabels = useLang() !== 'en'

  // 状态一眼可辨:铁壁描金环 / 潜行半透虚边 / 冰封蓝罩 / 沉默灰化
  const cls = [
    styles.token,
    hasGuard ? styles.guard : '',
    inst.keywords.includes('divineShield') ? styles.shielded : '',
    inst.keywords.includes('stealth') ? styles.stealthed : '',
    inst.frozen ? styles.frozen : '',
    inst.silenced ? styles.silenced : '',
    inst.exhausted ? styles.exhausted : '',
    ready ? styles.ready : '',
    selected ? styles.selected : '',
    targetable ? styles.targetable : '',
    fx?.motion ? MOTION_CLASS[fx.motion.kind] : '',
  ]
    .filter(Boolean)
    .join(' ')

  const fxVars: CSSProperties = fx?.motion
    ? ({
        '--fx-x': `${fx.motion.x ?? 0}px`,
        '--fx-y': `${fx.motion.y ?? 0}px`,
        '--fx-delay': `${fx.motion.delayMs ?? 0}ms`,
      } as CSSProperties)
    : {}

  // 与 CardFace 同理:场上单位原来是纯 <div onClick>,键盘与读屏器都够不到。
  // 状态(守护/铁壁/潜行/冰封/沉默)也一并读出来 —— 这些信息此前只靠颜色和小徽章传达。
  const interactive = Boolean(onClick || onInspect)
  const stateWords = [
    hasGuard ? (zhLabels ? '守护' : 'Guard') : '',
    inst.keywords.includes('divineShield') ? (zhLabels ? '铁壁' : 'Divine Shield') : '',
    inst.keywords.includes('stealth') ? (zhLabels ? '潜行' : 'Stealth') : '',
    inst.frozen ? (zhLabels ? '冰封' : 'Frozen') : '',
    inst.silenced ? (zhLabels ? '沉默' : 'Silenced') : '',
    ready ? (zhLabels ? '可攻击' : 'ready to attack') : '',
  ].filter(Boolean)
  const a11yLabel = [`${name} ${inst.attack}/${inst.health}`, ...stateWords].join(' · ')

  return (
    <div
      className={cls}
      data-fxkey={`gen-${inst.iid}`}
      style={{ '--doctrine': DOCTRINE_COLORS[doctrine], ...fxVars } as CSSProperties}
      {...(onInspect ? longPress.handlers : {})}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? a11yLabel : undefined}
      onKeyDown={(e) => {
        if (!interactive) return
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        if (e.shiftKey && onInspect) onInspect()
        else onClick?.(e as unknown as MouseEvent)
      }}
      onClick={(e) => {
        if (onInspect && longPress.consumed()) {
          e.stopPropagation()
          return
        }
        onClick?.(e)
      }}
      title={name}
    >
      {fx?.flash && (
        <span
          key={fx.flash.id}
          className={`fx-flash ${fx.flash.kind === 'clash' ? 'fx-flash-clash' : 'fx-flash-hit'}`}
        />
      )}
      <div className={styles.circle}>
        <Portrait id={inst.defId} nameZh={nameZh} doctrine={doctrine} />
      </div>
      {hasGuard && (
        <span className={styles.guardMark}>{pickCompact({ zh: '盾', en: 'G' })}</span>
      )}
      <span className={styles.atk}>{inst.attack}</span>
      <span className={`${styles.hp} ${inst.health < inst.maxHealth ? styles.hurt : ''}`}>
        {inst.health}
      </span>
      {inst.keywords.length > 0 && (
        <div className={styles.badges}>
          {inst.keywords.map((k) => (
            <span key={k} className={styles.badge} title={pickCompact(KEYWORD_NAME[k])}>
              {pickCompact(KEYWORD_BADGE[k])}
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
