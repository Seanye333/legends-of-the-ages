import { useEffect, useRef } from 'react'
import type { CSSProperties, MouseEvent } from 'react'
import type { PlayerState } from '../../engine/types'
import { MORALE_THRESHOLD } from '../../engine/types'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { CARDS_BY_ID } from '../../content/cards'
import { useSettings } from '../../app/settingsStore'
import { backCss } from '../../content/cardBacks'
import { useT } from '../i18n'
import type { FloatItem } from './floats'
import type { TokenFx } from '../useEventAnimations'
import { Portrait } from './Portrait'
import styles from './HeroPlate.module.css'
import { countOf } from '../plural'

const MOTION_CLASS = { lunge: 'fx-lunge', shake: 'fx-shake', shakeHard: 'fx-shake-hard' } as const

interface HeroPlateProps {
  ps: PlayerState
  enemy?: boolean
  targetable?: boolean
  floats?: FloatItem[]
  fx?: TokenFx // 受击震颤/闪光
  pulse?: boolean // 我方回合开始的金光脉动
  // 「现在轮到这一侧」。**敌方一侧此前没有任何标记** —— 对局里最基本的一件事
  // (现在该谁了)只能从「结束回合」按钮灰不灰去反推。
  // 我方那个 pulse 是回合开始时闪一下就没了,这个是**持续**的。
  acting?: boolean
  onClick?: (e: MouseEvent) => void
  // 主公技:可用时高亮可点。敌方一侧只展示不可点。
  powerUsable?: boolean
  onUsePower?: (e: MouseEvent) => void
  powerSelected?: boolean
  // 副将技(双将)。与主公技**共用**每回合一次的额度,所以两颗按钮同时变灰。
  onUseVicePower?: (e: MouseEvent) => void
  vicePowerSelected?: boolean
  // 升阶主公技(只给自己这一侧接)。不传则不画升阶按钮。
  onUpgradePower?: (e: MouseEvent) => void
}

// 主帅面板:头像 + 血量 + 法力水晶 + 主公技 + 牌库余量;敌方另显示手牌数(牌背)。
export function HeroPlate({
  ps,
  enemy,
  targetable,
  floats,
  fx,
  pulse,
  acting,
  onClick,
  powerUsable,
  onUsePower,
  powerSelected,
  onUseVicePower,
  vicePowerSelected,
  onUpgradePower,
}: HeroPlateProps) {
  const lang = useSettings((s) => s.language)
  const cardBack = useSettings((s) => s.cardBack)
  const t = useT()
  const hero = HEROES_BY_ID[ps.heroId]
  // 关底 Boss / 远征 / 爬塔的对手是**武将卡 id**,不在 HEROES_BY_ID 里 ——
  // 不回落到花名册的话,面板上写的就是 `zhang-jiao` 这样的原始 id。
  const heroCard = CARDS_BY_ID[ps.heroId]
  const label = hero?.name ?? heroCard?.name
  const nameZh = label?.zh ?? ps.heroId
  const name = label ? (lang === 'en' ? label.en : label.zh) : ps.heroId
  const power = ps.heroPower
  const pickLocal = (x: { zh: string; en: string }) => (lang === 'en' ? x.en : x.zh)
  const upgradeAffordable =
    power?.upgrade !== undefined && ps.mana.current >= Math.max(0, power.upgradeCost ?? 0)
  const powerName = power ? (lang === 'en' ? power.name.en : power.name.zh) : ''
  const powerText = power ? (lang === 'en' ? power.text.en : power.text.zh) : ''

  // 士气 / 粮道:两条**全队**状态,不属于任何一个单位,所以挂在帅案上。
  // 只在非零时画 —— 绝大多数回合它们都是 0,常驻两个「0」会把已经很挤的
  // 帅案再占掉一行,而且天天见的零值等于没有信息。
  // 上一帧的法力值。用 ref 而不是 state:它只是用来给「刚花掉」加个类名,
  // 存进 state 会为每一次法力变化多触发一轮渲染。
  const prevManaRef = useRef(ps.mana.current)
  useEffect(() => {
    prevManaRef.current = ps.mana.current
  }, [ps.mana.current])

  const morale = ps.morale ?? 0
  const supply = ps.supply ?? 0

  return (
    <div
      className={`${styles.plate} ${enemy ? styles.enemy : ''} ${pulse ? styles.pulse : ''} ${
        acting ? styles.acting : ''
      } ${fx?.motion ? MOTION_CLASS[fx.motion.kind] : ''}`}
      data-fxkey={`hero-${enemy ? 1 : 0}`}
      style={{ '--fx-power': `${fx?.motion?.power ?? 1}` } as CSSProperties}
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
        <Portrait id={ps.heroId} nameZh={nameZh} doctrine={hero?.doctrine ?? heroCard?.doctrine ?? 'neutral'} />
        <span className={styles.hp}>{ps.heroHp}</span>
        {ps.armor > 0 && <span className={styles.armor}>{ps.armor}</span>}
        {floats?.map((f) => (
          <span
            key={f.id}
            className={`${styles.float} ${styles[f.kind]} ${f.weight ? styles[`w${f.weight}`] : ''}`}
            style={{ marginLeft: `${f.offset * 16}px` }}
          >
            {f.text}
            {(f.count ?? 1) > 1 && <em className={styles.multi}>×{f.count}</em>}
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
            // 刚刚被花掉的那几颗:上一帧还亮着、这一帧灭了。
            // 法力此前只是「变暗」—— 出一张牌最直接的代价在画面上是**没有事件**的,
            // 玩家看到的只是一排图标换了颜色。给它一个碎裂。
            const justSpent = !filled && !locked && i < prevManaRef.current
            return (
              <span
                key={i}
                className={`${locked ? styles.gemLocked : filled ? styles.gemFull : styles.gemEmpty} ${
                  justSpent ? styles.gemSpent : ''
                }`}
                // 逐颗点亮:第 i 颗晚 i×45ms 亮。
                // 回合开始时水晶是整排瞬间刷新的,读起来像「数字变了」;
                // 一颗一颗亮起来读起来像「资源到账了」—— 同样的信息,后者有分量。
                // 延迟挂在 CSS 变量上,动画本身在 module.css 里(只用 transform/opacity)。
                style={{ '--gem-delay': `${i * 45}ms` } as CSSProperties}
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
              <span key={i} className={styles.back} style={{ background: backCss(cardBack) }} />
            ))}
            <span className={styles.backCount}>{ps.hand.length}</span>
          </div>
        )}
        {/* 牌库余量 + 疲劳。以前完全看不到,牌库见底是突然死亡 —— 这是最基本的公开信息 */}
        <div
          className={styles.deckInfo}
          title={t(
            `牌库剩余 ${ps.deck.length} 张${ps.fatigue > 0 ? `,疲劳 ${ps.fatigue}` : ''}`,
            `${countOf(ps.deck.length, 'card')} left in deck${ps.fatigue > 0 ? `, fatigue ${ps.fatigue}` : ''}`,
          )}
        >
          {/* 牌库画成一叠牌背。
              对手手牌那一排早就画着牌背,而**自己的牌库只有一个「▤ 20」** ——
              牌桌上最有实体感的一样东西(那叠还没摸的牌)在画面上是一个字符。
              叠数按余量分四档,不是逐张画:三十张画三十层只会糊成一块。 */}
          <span
            className={`${styles.deckPile} ${ps.deck.length <= 5 ? styles.deckLow : ''}`}
            style={{ background: backCss(cardBack) }}
            data-thin={ps.deck.length <= 10 ? 'true' : undefined}
            aria-hidden="true"
          />
          <span className={ps.deck.length <= 5 ? styles.deckLow : undefined}>{ps.deck.length}</span>
          {ps.fatigue > 0 && <span className={styles.fatigue}>☠ {ps.fatigue}</span>}
        </div>
        {(morale !== 0 || supply > 0) && (
          <div className={styles.corps}>
            {morale !== 0 && (
              <span
                className={`${styles.morale} ${morale > 0 ? styles.moraleUp : styles.moraleDown}`}
                title={t(
                  `士气 ${morale > 0 ? '+' : ''}${morale}${
                    Math.abs(morale) >= MORALE_THRESHOLD
                      ? `,全场攻击 ${morale > 0 ? '+1' : '-1'}`
                      : ''
                  }`,
                  `Morale ${morale > 0 ? '+' : ''}${morale}${
                    Math.abs(morale) >= MORALE_THRESHOLD
                      ? ` — all generals ${morale > 0 ? '+1' : '-1'} attack`
                      : ''
                  }`,
                )}
              >
                {/* 旗帜的朝向就是士气的方向,不必读数字也知道好坏 */}
                {morale > 0 ? '⚑' : '⚐'} {morale > 0 ? '+' : ''}
                {morale}
              </span>
            )}
            {supply > 0 && (
              <span
                className={styles.supply}
                title={t(`粮道 ${supply}(军需牌要花它)`, `Supply ${supply} — spent by Provision cards`)}
              >
                ▦ {supply}
              </span>
            )}
          </div>
        )}
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
      {/* 军令状与伏笔。两者都**对双方公开**(见 PlayerState 上的说明),所以
          和伏兵区不同,这里连内容一起显示 —— 对手看得见你在攒什么,
          才有「抢在他攒满之前打完」这个决策。
          没有它们的时候整块不渲染:大多数对局一条都不会出现。 */}
      {((ps.quests?.length ?? 0) > 0 || (ps.delayed?.length ?? 0) > 0) && (
        <div className={styles.quests}>
          {(ps.quests ?? []).map((q) => (
            <span
              key={q.defId}
              className={styles.quest}
              title={t(
                `军令 · ${q.name.zh}:${q.progress}/${q.goal.count}`,
                `Quest · ${q.name.en}: ${q.progress}/${q.goal.count}`,
              )}
            >
              ⚔ {q.progress}/{q.goal.count}
            </span>
          ))}
          {(ps.delayed ?? []).map((d, i) => {
            const card = CARDS_BY_ID[d.sourceDefId]
            const name = card ? (lang === 'en' ? card.name.en : card.name.zh) : d.sourceDefId
            return (
              <span
                key={`${d.sourceDefId}-${i}`}
                className={styles.fuse}
                title={t(
                  `伏笔 · ${name}:还有 ${d.turnsLeft} 个回合应验`,
                  `Fuse · ${name}: ${d.turnsLeft} turn${d.turnsLeft === 1 ? '' : 's'} to go`,
                )}
              >
                ⧗ {d.turnsLeft}
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
      {/* 副将技(双将)。画成和主公技一样的按钮、并排放 ——
          它们抢的是**同一次**每回合额度,长得一样才说得清「二选一」;
          做成另一种样子玩家会以为这回合两个都能点。 */}
      {ps.vicePower && (
        <button
          type="button"
          className={`${styles.power} ${styles.vice} ${powerUsable ? styles.powerReady : ''} ${
            vicePowerSelected ? styles.powerSelected : ''
          }`}
          disabled={!powerUsable || !onUseVicePower}
          onClick={onUseVicePower}
          aria-label={`${t('副将', 'Vice')} ${pickLocal(ps.vicePower.name)} — ${pickLocal(ps.vicePower.text)}`}
          title={`${t('副将', 'Vice')}:${pickLocal(ps.vicePower.name)}(${ps.vicePower.cost})\n${pickLocal(ps.vicePower.text)}`}
        >
          <span className={styles.powerName}>{pickLocal(ps.vicePower.name)}</span>
          <span className={styles.powerCost}>{ps.vicePower.cost}</span>
          {ps.heroPowerUsed && <span className={styles.powerUsed} aria-hidden="true" />}
        </button>
      )}
      {/* 升阶按钮:一局一次,不占「每回合一次」的使用额度 ——
          升完这回合还能照常用一次技能,否则升级那一轮等于白扔一个回合。
          只画在自己这一侧(enemy 侧没有 onUpgradePower)。 */}
      {power?.upgrade && onUpgradePower && (
        <button
          type="button"
          className={styles.upgrade}
          disabled={!upgradeAffordable}
          onClick={onUpgradePower}
          aria-label={`${t('升階主公技', 'Upgrade Hero Power')} — ${pickLocal(power.upgrade.name)}`}
          title={`${pickLocal(power.upgrade.name)}(${power.upgradeCost ?? 0})\n${pickLocal(power.upgrade.text)}`}
        >
          ⇧ {power.upgradeCost ?? 0}
        </button>
      )}
    </div>
  )
}
