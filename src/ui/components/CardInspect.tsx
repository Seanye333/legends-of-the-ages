import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import type { CardDef } from '../../engine/types'
import { useSettings } from '../../app/settingsStore'
import {
  CARD_TYPE_NAME,
  DOCTRINE_COLORS,
  DOCTRINE_NAME,
  KEYWORD_NAME,
  KEYWORD_RULE,
  RARITY_NAME,
  dynastyName,
} from '../doctrineColors'
import { exportCardImage, probeCardArt } from '../cardExport'
import { loadLore, loreNow, relationsNow, traitNamesNow } from '../../content/loreLazy'
import type { RelEdge } from '../../content/generated/lore.gen'
import { bondsOf, bondRoster, cardName, clanRoster, rivalsOf, rivalLore } from '../../content/relations'
import { TROOP_NAME } from '../../content/troops'
import { Portrait } from './Portrait'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import {
  copyLimit,
  craftCost,
  disenchantValue,
  useCollection,
} from '../../app/collectionStore'
import { useDialog } from '../useDialog'
import styles from './CardInspect.module.css'

interface CardInspectProps {
  def: CardDef
  onClose: () => void
  // 图鉴里打开时额外挂功勋操作;对战中打开不传,详情页就是纯只读的
  forge?: boolean
}

// 卡牌详情:长按/点选打开 —— 全身立绘 + 数值 + 效果文本 + 关键词图例
// (+ 图鉴入口下的分解/合成)。
// 关系类型的译名。era = 「同時」:生平里同框出现,但看不出更具体的关系。
// **类型钉成 RelEdge['kind']** —— 从前是 Record<string,…>,
// 加一种关系忘了补译名不报错,界面上直接渲染 undefined。
const REL_KIND: Record<RelEdge['kind'], { zh: string; en: string }> = {
  kin: { zh: '親族', en: 'Kin' },
  mentor: { zh: '師承', en: 'Taught' },
  liege: { zh: '君臣', en: 'Served' },
  foe: { zh: '敵對', en: 'Foe' },
  friend: { zh: '交好', en: 'Friend' },
  era: { zh: '同時', en: 'Contemporary' },
}

// 有没有值得单独摆一行的「事实」。全空时整块不渲染 —— 少数武将确实什么都查不到。
function hasDossier(l: {
  courtesy?: unknown
  home?: unknown
  life?: unknown
  office?: unknown
  traits?: string[]
}): boolean {
  return Boolean(l.courtesy || l.home || l.life || l.office || l.traits?.length)
}

export function CardInspect({ def, onClose, forge = false }: CardInspectProps) {
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const t = useT()
  const lang = useSettings((s) => s.language)
  // 设置页的手动开关。系统偏好(prefers-reduced-motion)由 CSS 那一层接住 ——
  // 但视差是 JS 算出来的内联 transform,CSS 关不掉它,所以这里必须自己判一次。
  const reducedMotion = useSettings((s) => s.reducedMotion)
  const merit = useCollection((s) => s.merit)
  const have = useCollection((s) => s.owned[def.id] ?? 0)
  const craft = useCollection((s) => s.craft)
  const disenchant = useCollection((s) => s.disenchant)
  const limit = copyLimit(def.id)
  const cost = craftCost(def.id)
  const dust = disenchantValue(def.id)
  const canCraft = forge && !def.token && have < limit && merit >= cost
  const canDust = forge && !def.token && have > 0

  // 弹层键盘契约(Esc / 焦点环 / 焦点还原)。ref 挂在 .cardWrap 而不是 .card 上 ——
  // .card 那个 ref 位子已经被视差倾斜的 tiltRef 占了,而 .cardWrap 正好整层包住卡面,
  // 焦点环照样能扫到里面全部按钮(保存卡面 / 合成 / 分解)。
  //
  // onClose 由各屏以内联箭头传入(setInspect(null)),每次那一屏渲染都是新引用,
  // 而它是 useDialog 的 effect 依赖:不稳住的话合成/分解一改功勋、上层跟着重渲染,
  // 焦点环就整个重挂一遍。用 ref 存最新的一份,对外恒定同一个函数。
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const stableClose = useCallback(() => closeRef.current(), [])
  const panelRef = useDialog(stableClose)

  // 只有真正带立绘的签名卡才展示「保存卡面」(探测图片加载成功)
  const [hasArt, setHasArt] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setHasArt(false)
    let live = true
    probeCardArt(def.id).then((img) => {
      if (live) setHasArt(img !== null)
    })
    return () => {
      live = false
    }
  }, [def.id])

  // 列传是 144KB 的独立 chunk,进详情页才拉(见 content/loreLazy.ts)。
  // 加载完再 setState 一次触发重渲染;已缓存时 loreNow() 首帧就是满的,不闪。
  const [LORE, setLore] = useState(loreNow)
  // 特质译名与列传同一个 chunk,所以跟着 LORE 一起重渲染即可
  const TRAIT_NAMES = traitNamesNow()
  // 史料关系:生平里互相点到名的人。**只做展示不给增益** ——
  // 几百条羁绊一次性上线等于给预组白送强度(见生成脚本里的说明)。
  const relEdges = LORE[def.id] ? relationsNow(def.id).slice(0, 6) : []
  useEffect(() => {
    let live = true
    loadLore().then((l) => {
      if (live) setLore(l)
    })
    return () => {
      live = false
    }
  }, [])

  const onSave = async () => {
    if (busy) return
    playSfx('buttonTap')
    setBusy(true)
    try {
      await exportCardImage(def, lang)
    } finally {
      setBusy(false)
    }
  }

  // 分层:指针在卡面上移动时,卡整体倾斜、立绘朝**反方向**微移。
  //
  // 一张卡此前是完全平的一块 —— 立绘、边框、宝石、文字都贴在同一个平面上。
  // 反向视差是最省的一招「有厚度」:两层往相反方向动,大脑立刻读成
  // 「立绘在框的后面」。位移量刻意压得很小(±6px / ±7°),
  // 大了会从「有厚度」变成「在晃」,那反而更假。
  //
  // 入场动画在**外层**(.cardWrap)、倾斜在内层(.card):
  // animation-fill-mode: both 会把 to 帧的 transform 一直按着,
  // 两者放在同一个元素上的话内联的倾斜永远生效不了 —— 动画声明优先级更高。
  const tiltRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const onTiltMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (reducedMotion) return
    const r = tiltRef.current?.getBoundingClientRect()
    if (!r) return
    setTilt({
      x: ((e.clientY - r.top) / r.height - 0.5) * -2,
      y: ((e.clientX - r.left) / r.width - 0.5) * 2,
    })
  }

  // 手机上把卡举起来转手腕,卡面跟着反光 —— 手上有实体卡的那种感觉。
  //
  // 【为什么值得接】倾斜与闪卡层早就做好了,但它们全靠 pointermove 驱动,
  // 而触屏上 pointermove 只在**按住拖动**时才有 —— 也就是说这套效果
  // 在手机上几乎不存在。设备朝向是同一件事的另一个输入通道,喂同一对变量。
  //
  // 【为什么不请求 iOS 权限】DeviceOrientationEvent.requestPermission 必须
  // 由用户手势触发,而这里没有一个自然的「请允许读取朝向」时机 ——
  // 为一个装饰效果弹系统权限框是本末倒置。iOS 上没有授权就静默不生效
  // (Android 与已授权的 iOS 照常),这正是渐进增强该有的样子。
  useEffect(() => {
    if (reducedMotion) return
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) return
    // 有精确指针的设备(桌面)已经有 pointermove,不必再听朝向
    if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) return
    let raf = 0
    let pending: { x: number; y: number } | null = null
    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = e.beta ?? 0 // 前后倾,°
      const gamma = e.gamma ?? 0 // 左右倾,°
      // 以「举在面前约 45° 」为中位,±22° 打满;超出就夹住,免得转成筋斗
      const clamp = (v: number) => Math.max(-1, Math.min(1, v))
      pending = { x: clamp((beta - 45) / 22), y: clamp(gamma / 22) }
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (pending) setTilt(pending)
      })
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      cancelAnimationFrame(raf)
    }
  }, [reducedMotion])

  const living = def.rarity === 'legendary' || def.rarity === 'epic'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={panelRef}
        className={styles.cardWrap}
        role="dialog"
        aria-modal="true"
        aria-label={pick(def.name)}
        tabIndex={-1}
      >
      {/* 稀有度用**形状**区分,不只用颜色:史诗与传说加四角角饰。
          颜色是最弱的区分手段(对色觉障碍尤其如此),而这里本来就只靠边框颜色。 */}
      <div
        ref={tiltRef}
        className={`${styles.card} ${
          def.rarity === 'legendary'
            ? styles.cardLegendary
            : def.rarity === 'epic'
              ? styles.cardEpic
              : ''
        }`}
        style={
          {
            borderColor: DOCTRINE_COLORS[def.doctrine],
            '--tilt-x': `${tilt.x * 7}deg`,
            '--tilt-y': `${tilt.y * 7}deg`,
            '--art-x': `${tilt.y * -6}px`,
            '--art-y': `${tilt.x * 6}px`,
          } as CSSProperties
        }
        onPointerMove={onTiltMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.portrait} ${living && !reducedMotion ? styles.living : ''}`}>
          <Portrait id={def.id} nameZh={def.name.zh} doctrine={def.doctrine} full />
          <span className={styles.cost}>{def.cost}</span>
          {def.type === 'general' && (
            <>
              <span className={styles.atk}>{def.attack}</span>
              <span className={styles.hp}>{def.health}</span>
            </>
          )}
        </div>
        <div className={styles.info}>
          <div className={styles.name}>
            {pick(def.name)}
            {LORE[def.id]?.era && <span className={styles.eraBadge}>{pick(LORE[def.id].era!)}</span>}
          </div>
          <div className={styles.metaLine}>
            <span className={`${styles.rarity} ${styles[def.rarity]}`}>
              {pickCompact(RARITY_NAME[def.rarity])}
            </span>
            <span style={{ color: DOCTRINE_COLORS[def.doctrine] }}>
              {pickCompact(DOCTRINE_NAME[def.doctrine])}
            </span>
            <span>
              {pickCompact({
                zh: `${dynastyName(def.dynasty).zh}势力`,
                en: dynastyName(def.dynasty).en,
              })}
            </span>
            <span>
              {pickCompact(
                CARD_TYPE_NAME[
                  def.type === 'general' && def.archetype === 'strategist' ? 'strategist' : def.type
                ],
              )}
            </span>
            {def.troop && <span>{pickCompact(TROOP_NAME[def.troop])}</span>}
            <span className={styles.collector}>№{def.collectorNo}</span>
          </div>
          {def.text && <p className={styles.text}>{pick(def.text)}</p>}
          {def.keywords.length > 0 && (
            <div className={styles.keywords}>
              {def.keywords.map((k) => (
                <div key={k} className={styles.keywordRow}>
                  <span className={styles.keywordName}>{pickCompact(KEYWORD_NAME[k])}</span>
                  <span className={styles.keywordRule}>{pick(KEYWORD_RULE[k])}</span>
                </div>
              ))}
            </div>
          )}
          {/* 关系:羁绊与宿敌是**反向**看不见的 —— 卡面只写在锚点身上,
              点开关羽看不出他属于桃园结义。这里把索引翻过来一起列出。 */}
          {(bondsOf(def.id).length > 0 || rivalsOf(def.id).length > 0) && (
            <div className={styles.relations}>
              {bondsOf(def.id).map((ref) => (
                <div key={ref.bond.id} className={styles.bondRow}>
                  <span className={styles.bondName}>
                    {t('羈絆 · ', 'Bond · ')}
                    {pick(ref.bond.name)}
                  </span>
                  <span className={styles.bondMembers}>
                    {bondRoster(ref)
                      .map((id) => pickCompact(cardName(id)))
                      .join(' · ')}
                  </span>
                </div>
              ))}
              {rivalsOf(def.id).map((ref) => (
                <div key={ref.rival.id} className={styles.rivalRow}>
                  <span className={styles.rivalName}>
                    {t('宿敵 · ', 'Rival · ')}
                    {pick(ref.rival.name)}
                  </span>
                  <span className={styles.bondMembers}>
                    {pickCompact(cardName(ref.anchor.id))} ⇄ {pickCompact(cardName(ref.rival.foe))}
                  </span>
                  {rivalLore(ref.rival.id) && (
                    <span className={styles.rivalLore}>{pick(rivalLore(ref.rival.id)!)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
          {/* 家族名册:卡面只写得下人数,谁是族人得在这里查 ——
              「同姓不等于同族」这件事,只有摆出名单才说得清楚。 */}
          {def.clan && (
            <div className={styles.relations}>
              <div className={styles.bondRow}>
                <span className={styles.bondName}>
                  {t('家族 · ', 'Clan · ')}
                  {pick(def.clan.name)}
                </span>
                <span className={styles.bondMembers}>
                  {clanRoster(def.clan.id)
                    .map((id) => pickCompact(cardName(id)))
                    .join(' · ')}
                </span>
              </div>
            </div>
          )}
          {/* 武将档案:字 / 籍贯 / 生卒 / 性格 / 五维。
              这些全是**事实**而不是叙述,来自姊妹仓库的名册与史料表 ——
              此前一项都没显示,于是 2,258 名武将在图鉴里只有一张脸和一句
              程序生成的卡面文案。先摆事实,再讲故事(下面那块)。 */}
          {LORE[def.id] && hasDossier(LORE[def.id]) && (
            <div className={styles.dossier}>
              {LORE[def.id].courtesy && (
                <span className={styles.dossierItem}>
                  {t('字', 'Courtesy')} {pickCompact(LORE[def.id].courtesy!)}
                </span>
              )}
              {LORE[def.id].home && (
                <span className={styles.dossierItem}>
                  {t('籍', 'From')} {pickCompact(LORE[def.id].home!)}
                </span>
              )}
              {LORE[def.id].life && (
                <span className={styles.dossierItem}>{pickCompact(LORE[def.id].life!)}</span>
              )}
              {LORE[def.id].office && (
                <span className={styles.dossierItem}>{pickCompact(LORE[def.id].office!)}</span>
              )}
              {(LORE[def.id].traits ?? []).slice(0, 4).map((tr) => (
                <span key={tr} className={styles.dossierTrait}>
                  {TRAIT_NAMES[tr] ? pickCompact(TRAIT_NAMES[tr]) : tr}
                </span>
              ))}
            </div>
          )}
          {LORE[def.id]?.stats && (
            <div className={styles.stats5}>
              {(
                [
                  ['統', 'LD', LORE[def.id].stats!.ld],
                  ['武', 'WAR', LORE[def.id].stats!.war],
                  ['智', 'INT', LORE[def.id].stats!.int],
                  ['政', 'POL', LORE[def.id].stats!.pol],
                  ['魅', 'CHA', LORE[def.id].stats!.cha],
                ] as const
              ).map(([zh, en, v]) => (
                <span key={en} className={styles.stat5} title={`${zh} ${v}`}>
                  <span className={styles.stat5Label}>{t(zh, en)}</span>
                  {/* 条形比数字好读:一眼看出这个人是猛将还是文官 */}
                  <span className={styles.stat5Bar}>
                    <i style={{ width: `${v}%` }} />
                  </span>
                  <span className={styles.stat5Num}>{v}</span>
                </span>
              ))}
            </div>
          )}
          {LORE[def.id] && (
            <div className={styles.lore}>
              {LORE[def.id].quote && (
                <blockquote className={styles.loreQuote}>「{pick(LORE[def.id].quote!)}」</blockquote>
              )}
              {LORE[def.id].bio && <p className={styles.loreBio}>{pick(LORE[def.id].bio!)}</p>}
              {LORE[def.id].line && (
                <p className={styles.loreLine}>
                  {t('单挑', 'Duel')} · {pick(LORE[def.id].line!)}
                </p>
              )}
              {LORE[def.id].poem && (
                <p className={styles.lorePoem}>
                  {t('絕命', 'Last words')} · {pick(LORE[def.id].poem!)}
                </p>
              )}
            </div>
          )}
          {relEdges.length > 0 && (
            <div className={styles.relations}>
              <div className={styles.relationsTitle}>{t('史料關係', 'Attested Ties')}</div>
              {relEdges.map((e) => {
                const otherId = e.a === def.id ? e.b : e.a
                const kindText = REL_KIND[e.kind]
                return (
                  <div key={`${e.a}-${e.b}`} className={styles.relationRow}>
                    <span className={`${styles.relationKind} ${styles[`rel_${e.kind}`]}`}>
                      {pickCompact(kindText)}
                    </span>
                    <span className={styles.relationWho}>{pickCompact(cardName(otherId))}</span>
                    {/* 出处原文 —— 关系是从这句话里抽出来的,把它摆出来,
                        玩家自己就能判断这条关系可不可信 */}
                    <span className={styles.relationQuote}>{e.quote}</span>
                  </div>
                )
              })}
            </div>
          )}
          {/* 底部动作区整体 sticky —— 保存卡面原来单独 position:sticky,
              会把锻造块盖住(合成/分解按钮整个看不见) */}
          <div className={styles.footer}>
            {hasArt && (
              <button className={styles.saveBtn} disabled={busy} onClick={onSave}>
                {busy ? t('生成中…', 'Rendering…') : t('保存卡面', 'Save Card Image')}
              </button>
            )}
          {forge && !def.token && (
              <div className={styles.forge}>
                <div className={styles.forgeOwned}>
                  {t(`持有 ${have} / ${limit}`, `Owned ${have} / ${limit}`)}
                  <span className={styles.forgeMerit}>
                    {t(`功勋 ${merit}`, `${merit} Merit`)}
                  </span>
                </div>
                <div className={styles.forgeRow}>
                  <button
                    className={styles.craftBtn}
                    disabled={!canCraft}
                    title={t(`合成需 ${cost} 功勋`, `Craft for ${cost} merit`)}
                    onClick={() => {
                      playSfx('stratagemCast')
                      craft(def.id)
                    }}
                  >
                    {t(`合成 · ${cost}`, `Craft · ${cost}`)}
                  </button>
                  <button
                    className={styles.dustBtn}
                    disabled={!canDust}
                    title={t(`分解得 ${dust} 功勋`, `Disenchant for ${dust} merit`)}
                    onClick={() => {
                      playSfx('cardPlay')
                      disenchant(def.id)
                    }}
                  >
                    {t(`分解 · +${dust}`, `Disenchant · +${dust}`)}
                  </button>
                </div>
                {!canCraft && have >= limit && (
                  <p className={styles.forgeHint}>{t('已达持有上限', 'At copy limit')}</p>
                )}
                {!canCraft && have < limit && merit < cost && (
                  <p className={styles.forgeHint}>
                    {t(`还差 ${cost - merit} 功勋`, `${cost - merit} more merit needed`)}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
