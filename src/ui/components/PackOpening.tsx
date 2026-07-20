import { haptic } from '../haptics'
import { useState } from 'react'
import type { CSSProperties } from 'react'
import { CARDS_BY_ID } from '../../content/cards'
import { useCollection, type PackResult } from '../../app/collectionStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { FoilLayer } from './FoilLayer'
import { Portrait } from './Portrait'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import styles from './PackOpening.module.css'

interface PackOpeningProps {
  onClose: () => void
}

// 开包典礼:点封泥启封 → 五张依次翻面 → 稀有度辉光 + NEW 标记。
export function PackOpening({ onClose }: PackOpeningProps) {
  const t = useT()
  const pickCompact = usePickCompact()
  const packs = useCollection((s) => s.packs)
  const openPack = useCollection((s) => s.openPack)
  const [result, setResult] = useState<PackResult | null>(null)
  const [revealed, setRevealed] = useState<number>(0)

  const onOpen = () => {
    const r = openPack()
    if (!r) return
    playSfx('stratagemCast')
    setResult(r)
    setRevealed(0)
  }

  const onReveal = (index: number) => {
    if (!result || index !== revealed) return
    const def = CARDS_BY_ID[result.cardIds[index]]
    playSfx(def?.rarity === 'legendary' ? 'victory' : def?.rarity === 'epic' ? 'heal' : 'cardPlay')
    // 传说/史诗给一记明显的触感 —— 开包的高光时刻本来就该有手感
    haptic(def?.rarity === 'legendary' ? 'reward' : def?.rarity === 'epic' ? 'impact' : 'tap')
    setRevealed(index + 1)
  }

  const allRevealed = result !== null && revealed >= result.cardIds.length

  return (
    <div className={styles.overlay} onClick={(e) => e.stopPropagation()}>
      <div className={styles.titleLine}>
        {t(`卡包 ×${packs}`, `Packs ×${packs}`)}
      </div>

      {!result && (
        <button className={styles.sealBtn} disabled={packs <= 0} onClick={onOpen}>
          <span className={styles.sealGlyph}>啟</span>
          <span className={styles.sealText}>
            {packs > 0 ? t('启封', 'Open Pack') : t('暂无卡包 · 胜场获取', 'Win matches to earn packs')}
          </span>
        </button>
      )}

      {result && (
        <div className={styles.cards}>
          {result.cardIds.map((id, i) => {
            const def = CARDS_BY_ID[id]
            const isNew = result.newCardIds.includes(id)
            const shown = i < revealed
            const burst =
              def?.rarity === 'legendary'
                ? styles.slotLegendary
                : def?.rarity === 'epic'
                  ? styles.slotEpic
                  : ''
            return (
              <div
                key={`${id}-${i}`}
                className={`${styles.slot} ${burst} ${shown ? styles.shown : ''} ${i === revealed ? styles.next : ''}`}
                style={{ '--doctrine': DOCTRINE_COLORS[def?.doctrine ?? 'neutral'] } as CSSProperties}
                onClick={() => onReveal(i)}
              >
                <div className={styles.back}>
                  <span className={styles.backGlyph}>将</span>
                </div>
                <div className={`${styles.front} ${styles[def?.rarity ?? 'common']}`}>
                  <div className={styles.portrait}>
                    <Portrait
                      id={id}
                      nameZh={def?.name.zh ?? id}
                      doctrine={def?.doctrine ?? 'neutral'}
                    />
                  </div>
                  <div className={styles.cardName}>
                    {def ? pickCompact(def.name) : id}
                  </div>
                  {shown && def && <FoilLayer rarity={def.rarity} intense />}
                  {shown && isNew && <span className={styles.newTag}>NEW</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 重复卡折算的功勋:以前这些卡直接蒸发,界面还只标一个「不是新的」*/}
      {allRevealed && result && result.meritGained > 0 && (
        <div className={styles.meritLine} role="status">
          {t(
            `重复卡折算 功勋 +${result.meritGained}`,
            `Duplicates converted — +${result.meritGained} merit`,
          )}
        </div>
      )}

      <div className={styles.buttons}>
        {allRevealed && packs > 0 && (
          <button className={styles.goldBtn} onClick={onOpen}>
            {t('再开一包', 'Open Another')}
          </button>
        )}
        <button
          className={styles.plainBtn}
          onClick={() => {
            playSfx('buttonTap')
            onClose()
          }}
        >
          {t('关闭', 'Close')}
        </button>
      </div>
    </div>
  )
}
