import { useState } from 'react'
import type { CSSProperties } from 'react'
import { towerDeck, towerFloor } from '../../content/tower'
import { PRECON_DECKS } from '../../content/decks'
import { useTower } from '../../app/towerStore'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { Portrait } from '../components/Portrait'
import { usePickCompact, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
// 与冒险/名局同为「选卡组 → 挑战 → 出战」的单人关卡页,沿用同一套版式
import styles from './CampaignScreen.module.css'

interface Props {
  onBack: () => void
  onEnterMatch: () => void
}

// 无尽爬塔「登樓」:没有终点,只有个人最高层。敌人由层数算出,一层比一层难。
export function TowerScreen({ onBack, onEnterMatch }: Props) {
  const t = useT()
  const pickCompact = usePickCompact()
  const floor = useTower((s) => s.floor)
  const best = useTower((s) => s.best)
  const begin = useTower((s) => s.begin)
  const customDecks = useCollection((s) => s.customDecks)
  const [deckIndex, setDeckIndex] = useState(0)
  const myDecks = [...PRECON_DECKS, ...customDecks]

  // 当前层 + 预览接下来几层,给「往上还有多高」一个体感
  const current = towerFloor(floor)
  const preview = [0, 1, 2, 3, 4].map((d) => towerFloor(floor + d))

  const fight = () => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    begin()
    playSfx('duel')
    haptic('impact')
    const myHero = HEROES_BY_ID[mine.heroId]
    launchMatch({
      heroIds: [mine.heroId, current.heroId],
      deckIds: [mine.cardIds.slice(), towerDeck(current)],
      tower: true,
      heroPowersOverride: [myHero?.power, current.power],
      heroHpsOverride: [myHero?.hp ?? START_HP, current.hp],
      modifiersOverride: [undefined, current.enemyModifiers],
    })
    onEnterMatch()
  }

  return (
    <div className={styles.screen}>
      <header className={styles.head}>
        <button
          className={styles.backBtn}
          onClick={() => {
            playSfx('buttonTap')
            onBack()
          }}
        >
          {t('← 返回', '← Back')}
        </button>
        <h2 className={styles.title}>{t('登楼', 'The Endless Tower')}</h2>
        <span className={styles.progress}>
          {t(`最高 ${best} 层`, `Best ${best}`)}
        </span>
      </header>

      <div className={styles.deckPicker}>
        <span className={styles.deckLabel}>{t('出征卡组', 'Your deck')}</span>
        {myDecks.map((d, i) => (
          <button
            key={`${d.heroId}-${d.name.zh}-${i}`}
            className={i === deckIndex ? styles.deckActive : styles.deckBtn}
            onClick={() => {
              playSfx('buttonTap')
              setDeckIndex(i)
            }}
          >
            {pickCompact(d.name)}
          </button>
        ))}
      </div>

      <ol className={styles.road}>
        {preview.map((spec, i) => {
          const isNow = i === 0
          const hero = HEROES_BY_ID[spec.heroId]
          return (
            <li
              key={spec.floor}
              className={`${styles.stage} ${isNow ? '' : styles.locked}`}
              style={{ '--doctrine': DOCTRINE_COLORS[spec.doctrine] } as CSSProperties}
            >
              <button className={styles.stageBtn} disabled={!isNow} onClick={isNow ? fight : undefined}>
                <span className={styles.stageNo}>{spec.floor}</span>
                <span className={styles.stagePortrait}>
                  <Portrait
                    id={spec.heroId}
                    nameZh={hero?.name.zh ?? spec.heroId}
                    doctrine={spec.doctrine}
                  />
                </span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>
                    {t(`第 ${spec.floor} 层`, `Floor ${spec.floor}`)}
                    {isNow ? '' : ' ·'} {hero ? pickCompact(hero.name) : ''}
                  </span>
                  <span className={styles.stageTitle}>
                    {pickCompact(DOCTRINE_NAME[spec.doctrine])} · {spec.hp} HP
                    {spec.enemyModifiers?.startArmor ? t(` · ${spec.enemyModifiers.startArmor} 甲`, ` · ${spec.enemyModifiers.startArmor} armor`) : ''}
                  </span>
                </span>
                <span className={styles.stageMeta}>
                  {isNow ? (
                    <span className={styles.clearedTag}>{t('挑战', 'Climb')}</span>
                  ) : (
                    <span className={styles.lockTag}>{t('更高处', 'Above')}</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      <p style={{ textAlign: 'center', opacity: 0.65, fontSize: 13, padding: '0 20px' }}>
        {t(
          `越往上敌人卡组越强、血越厚、开局阵仗越大。摔下来从第一层重爬 —— 最高层永远留在你名下。`,
          `Each floor brings a stronger deck, more health, and a bigger opening. Fall and you restart at floor 1 — your best floor is yours forever.`,
        )}
      </p>
    </div>
  )
}
