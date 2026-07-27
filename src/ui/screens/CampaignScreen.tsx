import { Fragment, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BOSSES,
  bossDeck,
  bossChapter,
  bossTrial,
  bossPersonality,
  CHAPTER_TITLES,
  type BossDef,
  type TrialDef,
} from '../../content/campaign'
import { PRECON_DECKS } from '../../content/decks'
import { useCampaign } from '../../app/campaignStore'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { Portrait } from '../components/Portrait'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './CampaignScreen.module.css'

interface CampaignScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 冒险模式「群雄逐鹿」。八场关底战按顺序解锁,首通发奖。
export function CampaignScreen({ onBack, onEnterMatch }: CampaignScreenProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const cleared = useCampaign((s) => s.cleared)
  const trialsCleared = useCampaign((s) => s.trialsCleared)
  const isUnlocked = useCampaign((s) => s.isUnlocked)
  const begin = useCampaign((s) => s.begin)
  const customDecks = useCollection((s) => s.customDecks)
  const [selected, setSelected] = useState<BossDef | null>(null)
  const [deckIndex, setDeckIndex] = useState(0)

  const myDecks = [...PRECON_DECKS, ...customDecks]

  // trial 给定时打的是**试炼版**:同一个 Boss、同样的血量与主公技,只换胜负条件
  // (守成 / 斩将 / 护送)。目标单位靠 modifiersOverride 的 startTokens 摆上场。
  const fight = (boss: BossDef, trial?: TrialDef) => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    if (!begin(boss.id, Boolean(trial))) return
    playSfx('duel')
    haptic('impact')
    const myHero = HEROES_BY_ID[mine.heroId]
    launchMatch({
      heroIds: [mine.heroId, boss.heroId],
      deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
      campaign: true,
      bossId: boss.id,
      // 关底战的不对称全在这两行:Boss 血更厚、主公技更强。
      // 玩家侧保持自己主公的正常配置 —— 不对称只加在对手身上。
      heroPowersOverride: [myHero?.power, boss.power],
      heroHpsOverride: [myHero?.hp ?? START_HP, boss.hp],
      objective: trial?.objective,
      modifiersOverride: trial ? [trial.playerModifiers, trial.bossModifiers] : undefined,
      // 性格:同一个难度档,不同的「什么叫局面好」
      aiWeights: bossPersonality(boss.id),
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
        <h2 className={styles.title}>{t('群雄逐鹿', 'Contenders')}</h2>
        <span className={styles.progress}>
          {cleared.length} / {BOSSES.length}
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
        {BOSSES.map((b, i) => {
          const done = cleared.includes(b.id)
          const open = isUnlocked(b.id)
          // 每章第一关前插一条分隔;第一关(i===0)也带上,让「第一章」有个抬头
          const newChapter = i === 0 || bossChapter(b) !== bossChapter(BOSSES[i - 1])
          const chapterTitle = CHAPTER_TITLES[bossChapter(b)]
          return (
            <Fragment key={b.id}>
            {newChapter && chapterTitle && (
              <li className={styles.chapterHead} aria-hidden>
                {pick(chapterTitle)}
              </li>
            )}
            <li
              key={b.id}
              className={`${styles.stage} ${done ? styles.done : ''} ${!open ? styles.locked : ''}`}
              style={{ '--doctrine': DOCTRINE_COLORS[b.doctrine] } as CSSProperties}
            >
              <button
                className={styles.stageBtn}
                disabled={!open}
                aria-label={`${pick(b.name)} — ${pick(b.title)}`}
                onClick={() => {
                  playSfx('buttonTap')
                  setSelected(b)
                }}
              >
                <span className={styles.stageNo}>{i + 1}</span>
                <span className={styles.stagePortrait}>
                  <Portrait id={b.heroId} nameZh={b.name.zh} doctrine={b.doctrine} />
                </span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>{pickCompact(b.name)}</span>
                  <span className={styles.stageTitle}>{pick(b.title)}</span>
                </span>
                <span className={styles.stageMeta}>
                  {done && trialsCleared.includes(b.id) ? (
                    <span className={styles.trialTag}>{t('試煉已成', 'Trial done')}</span>
                  ) : done ? (
                    <span className={styles.clearedTag}>{t('已破', 'Cleared')}</span>
                  ) : open ? (
                    <span className={styles.hp}>{b.hp} HP</span>
                  ) : (
                    <span className={styles.lockTag}>{t('未解锁', 'Locked')}</span>
                  )}
                </span>
              </button>
            </li>
            </Fragment>
          )
        })}
      </ol>

      {selected && (
        <div className={styles.overlay} onClick={() => setSelected(null)}>
          <div
            className={styles.brief}
            role="dialog"
            aria-modal="true"
            aria-label={pick(selected.name)}
            style={{ '--doctrine': DOCTRINE_COLORS[selected.doctrine] } as CSSProperties}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.briefPortrait}>
              <Portrait
                id={selected.heroId}
                nameZh={selected.name.zh}
                doctrine={selected.doctrine}
                full
              />
            </div>
            <h3 className={styles.briefName}>
              {pick(selected.name)}
              <span className={styles.briefTitle}>{pick(selected.title)}</span>
            </h3>
            <p className={styles.briefIntro}>{pick(selected.intro)}</p>
            <div className={styles.briefStats}>
              <span>
                {t('血量', 'Health')} <b>{selected.hp}</b>
              </span>
              <span>
                {t('主义', 'Doctrine')} <b>{pickCompact(DOCTRINE_NAME[selected.doctrine])}</b>
              </span>
            </div>
            <div className={styles.briefPower}>
              <span className={styles.briefPowerName}>{pickCompact(selected.power.name)}</span>
              <span className={styles.briefPowerText}>{pick(selected.power.text)}</span>
            </div>
            <p className={styles.briefReward}>
              {cleared.includes(selected.id)
                ? t('已通关 —— 重打不再发放战利', 'Cleared — no further spoils')
                : t(
                    `首通战利:卡包 ×${selected.rewardPacks},功勋 +${selected.rewardMerit}`,
                    `First clear: ${selected.rewardPacks} packs, +${selected.rewardMerit} merit`,
                  )}
            </p>
            {/* 试炼:首通之后解锁的第二种打法 —— 同一个 Boss,换一个赢法 */}
            {cleared.includes(selected.id) &&
              (() => {
                const trial = bossTrial(selected.id)
                if (!trial) return null
                const trialDone = trialsCleared.includes(selected.id)
                return (
                  <div className={styles.trialBox}>
                    <span className={styles.trialName}>
                      {t('試煉 · ', 'Trial · ')}
                      {pick(trial.name)}
                      {trialDone && <span className={styles.trialDone}>{t(' ✓', ' ✓')}</span>}
                    </span>
                    <span className={styles.trialText}>{pick(trial.text)}</span>
                    <span className={styles.trialReward}>
                      {trialDone
                        ? t('已成 —— 重打不再发放战利', 'Complete — no further spoils')
                        : t(`首成战利:功勋 +${trial.rewardMerit}`, `First clear: +${trial.rewardMerit} merit`)}
                    </span>
                  </div>
                )
              })()}
            <div className={styles.briefActions}>
              <button className={styles.primary} onClick={() => fight(selected)}>
                {t('出战', 'Fight')}
              </button>
              {cleared.includes(selected.id) && bossTrial(selected.id) && (
                <button
                  className={styles.trialBtn}
                  onClick={() => fight(selected, bossTrial(selected.id))}
                >
                  {t('挑战试炼', 'Take the Trial')}
                </button>
              )}
              <button className={styles.plain} onClick={() => setSelected(null)}>
                {t('再看看', 'Not yet')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
