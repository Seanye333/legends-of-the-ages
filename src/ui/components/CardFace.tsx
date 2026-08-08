import type { CSSProperties, MouseEvent } from 'react'
import type { CardInstance } from '../../engine/types'
import { CARDS_BY_ID, needsDynastyTag } from '../../content/cards'
import { faceAlias } from '../../content/overrides/aliases'
import { useSettings } from '../../app/settingsStore'
import { CARD_TYPE_NAME, DOCTRINE_COLORS, DOCTRINE_GLYPH, dynastyName } from '../doctrineColors'
import { Portrait } from './Portrait'
import { useLongPress } from '../useLongPress'
import styles from './CardFace.module.css'

interface CardFaceProps {
  inst: CardInstance
  playable?: boolean
  selected?: boolean
  large?: boolean
  onClick?: (e: MouseEvent) => void
  onInspect?: () => void // 长按查看详情
}

// 手牌卡面:多层描金卡框、费用宝石、立绘、名字铭牌、攻血宝石、稀有度玉印。
export function CardFace({ inst, playable, selected, large, onClick, onInspect }: CardFaceProps) {
  const lang = useSettings((s) => s.language)
  const longPress = useLongPress(() => onInspect?.())
  const def = CARDS_BY_ID[inst.defId]
  if (!def) {
    return (
      <div className={styles.face} onClick={onClick}>
        <div className={styles.nameBox}>
          <div className={styles.name}>{inst.defId}</div>
        </div>
      </div>
    )
  }

  // 有效费用:被费用消减的手牌显示折后价并变色(和炉石一致)
  const effCost = Math.max(0, def.cost + (inst.costDelta ?? 0))
  const discounted = effCost < def.cost
  const mainName = lang === 'en' ? def.name.en : def.name.zh
  // 副名那一行:双语模式给英文名,否则给**绰号**。
  //
  // 【为什么是「否则」而不是「都给」】
  // 卡面是小尺寸三行布局(名字 / 副名 / 身材),那一行只有一个位置。
  // 双语模式下英文名是刚需(没有它就读不出这是谁),绰号是锦上添花 —— 让位。
  // 而中文模式下那一行**本来是空的**,37 张卡因此白白少了一句最好记的东西:
  // 「三姓家奴」「獨眼龍」「常十萬」比本名更像一个人物。
  const alias = faceAlias(def.id)
  // 英文一律回落到中文(见 aliases.ts):「三姓家奴」翻过去既失典故也失节奏。
  const subName = lang === 'both' ? def.name.en : (alias ? (lang === 'en' ? alias.en : alias.zh) : null)
  const isSpell = def.type !== 'general'
  const frameRarity = {
    common: '',
    rare: styles.frameRare,
    epic: styles.frameEpic,
    legendary: styles.frameLegendary,
  }[def.rarity]
  const cls = [
    styles.face,
    large ? styles.large : '',
    frameRarity,
    isSpell ? styles.stratagem : '',
    def.token ? styles.tokenCard : '',
    playable ? styles.playable : '',
    selected ? styles.selected : '',
  ]
    .filter(Boolean)
    .join(' ')

  // 卡牌以前是纯 <div onClick>:不可键盘聚焦,读屏器什么都读不出来。
  // 这里不改成 <button>(卡面里有嵌套结构与长按手势,button 的默认行为会打架),
  // 而是补齐 button 的语义契约:role + tabIndex + 键盘激活 + 可读的标签。
  const interactive = Boolean(onClick || onInspect)
  const a11yLabel = [
    mainName,
    `${effCost} ${lang === 'en' ? 'mana' : '费'}`,
    def.type === 'general' ? `${def.attack ?? 0}/${def.health ?? 0}` : '',
    def.supplyCost ? `${def.supplyCost} ${lang === 'en' ? 'supply' : '粮'}` : '',
    def.text ? (lang === 'en' ? def.text.en : def.text.zh) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div
      className={cls}
      style={
        {
          '--doctrine': DOCTRINE_COLORS[def.doctrine],
          // 纸纹角度按收藏号算 —— **不是随机**:同一张卡每次打开都长得一样,
          // 它是这张卡的一部分。乘一个和 180 互质的数再取模,
          // 相邻收藏号(图鉴里挨着排)的角度才不会连成一片。
          '--grain': `${(def.collectorNo * 37) % 180}deg`,
        } as CSSProperties
      }
      {...(onInspect ? longPress.handlers : {})}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? a11yLabel : undefined}
      aria-disabled={onClick && playable === false ? true : undefined}
      onKeyDown={(e) => {
        if (!interactive) return
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        // 键盘上没有「长按」:回车出牌,Shift+回车看详情
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
      title={def.text ? (lang === 'en' ? def.text.en : def.text.zh) : undefined}
    >
      <span className={`${styles.cost} ${discounted ? styles.costDown : ''}`}>{effCost}</span>
      {/* 军需:除法力外还要花粮道。画成**第二颗宝石**、贴在费用宝石正下方 ——
          它和费用是同一类东西(打出这张牌的门槛),写进卡面文字里的话
          玩家要读完一整句才知道自己打不起,而费用是一眼就该看见的。 */}
      {def.supplyCost !== undefined && def.supplyCost > 0 && (
        <span className={styles.supplyCost} title={`${def.supplyCost} 粮`}>
          {def.supplyCost}
        </span>
      )}
      <div className={styles.art}>
        <Portrait id={def.id} nameZh={def.name.zh} doctrine={def.doctrine} />
      </div>
      <div className={styles.nameBox}>
        <div className={styles.name}>
          {mainName}
          {/* 重名卡才标朝代:光看卡面「杜預」和「杜預」分不出是两张不同的牌。
              只有 40 张卡会走到这里,不会给正常卡面添噪。 */}
          {needsDynastyTag(def) && (
            <span className={styles.dynastyTag}>
              {lang === 'en' ? dynastyName(def.dynasty).en : dynastyName(def.dynasty).zh}
            </span>
          )}
        </div>
        {subName && <div className={styles.sub}>{subName}</div>}
      </div>
      <span className={`${styles.rarity} ${styles[def.rarity]}`} />
      {/* 主义符号:六个主义原来只靠颜色区分,金与名利本来就近,
          红绿色觉异常的人还要再丢掉霸道与隐逸的对比。形状 + 颜色双编码。 */}
      <span className={styles.doctrineGlyph} aria-hidden="true">
        {DOCTRINE_GLYPH[def.doctrine]}
      </span>
      {def.type === 'general' ? (
        <>
          <span className={styles.atk}>{inst.attack}</span>
          <span className={styles.hp}>{inst.health}</span>
        </>
      ) : (
        <span className={styles.spellMark}>
          {/* 卡面的类型角标必须用**术语表里的那个词**,不能就地另造。
              此前英文写死 PLOT / GEAR —— 这两个词全站再无第二处出现:
              图鉴、筛选器、牌库构筑、成就文案一律叫 Stratagem / Equipment,
              于是卡面上的词和玩家能搜到的词对不上。
              中文一侧更直接是个 bug:装备牌也被标成「锦囊」。 */}
          {lang === 'en' ? CARD_TYPE_NAME[def.type].en : CARD_TYPE_NAME[def.type].zh}
        </span>
      )}
    </div>
  )
}
