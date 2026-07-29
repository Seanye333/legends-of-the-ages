import { useEffect, useState } from 'react'
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
import { loadLore, loreNow } from '../../content/loreLazy'
import { bondsOf, bondRoster, cardName, rivalsOf, rivalLore } from '../../content/relations'
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
import styles from './CardInspect.module.css'

interface CardInspectProps {
  def: CardDef
  onClose: () => void
  // 图鉴里打开时额外挂功勋操作;对战中打开不传,详情页就是纯只读的
  forge?: boolean
}

// 卡牌详情:长按/点选打开 —— 全身立绘 + 数值 + 效果文本 + 关键词图例
// (+ 图鉴入口下的分解/合成)。
export function CardInspect({ def, onClose, forge = false }: CardInspectProps) {
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const t = useT()
  const lang = useSettings((s) => s.language)
  const merit = useCollection((s) => s.merit)
  const have = useCollection((s) => s.owned[def.id] ?? 0)
  const craft = useCollection((s) => s.craft)
  const disenchant = useCollection((s) => s.disenchant)
  const limit = copyLimit(def.id)
  const cost = craftCost(def.id)
  const dust = disenchantValue(def.id)
  const canCraft = forge && !def.token && have < limit && merit >= cost
  const canDust = forge && !def.token && have > 0
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      {/* 稀有度用**形状**区分,不只用颜色:史诗与传说加四角角饰。
          颜色是最弱的区分手段(对色觉障碍尤其如此),而这里本来就只靠边框颜色。 */}
      <div
        className={`${styles.card} ${
          def.rarity === 'legendary'
            ? styles.cardLegendary
            : def.rarity === 'epic'
              ? styles.cardEpic
              : ''
        }`}
        style={{ borderColor: DOCTRINE_COLORS[def.doctrine] }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.portrait}>
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
          {LORE[def.id] && (
            <div className={styles.lore}>
              {LORE[def.id].quote && (
                <blockquote className={styles.loreQuote}>「{pick(LORE[def.id].quote!)}」</blockquote>
              )}
              <p className={styles.loreBio}>{pick(LORE[def.id].bio)}</p>
              {LORE[def.id].line && (
                <p className={styles.loreLine}>
                  {t('单挑', 'Duel')} · {pick(LORE[def.id].line!)}
                </p>
              )}
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
  )
}
