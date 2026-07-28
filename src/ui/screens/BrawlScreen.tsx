import { useState } from 'react'
import { BRAWLS } from '../../content/brawls'
import { WEEKLY_BRAWL_MERIT, weekKey, weeklyBrawlIndexFor } from '../../content/weeklyBrawl'
import { useWeeklyBrawl } from '../../app/weeklyBrawlStore'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import type { LocalizedText, RunModifiers } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './BrawlScreen.module.css'

// 自订乱斗的四个旋钮。刻意只开四个:再多就变成一张配置表,
// 而乱斗要的是「一句话说得清」。数值取现成乱斗里最有代表性的那一档。
const CUSTOM_KNOBS: { key: string; label: LocalizedText }[] = [
  { key: 'hand', label: { zh: '起手多抽三張', en: 'Draw 3 extra' } },
  { key: 'armor', label: { zh: '開局 8 護甲', en: 'Start with 8 Armor' } },
  { key: 'cheap', label: { zh: '起手手牌 -2 費', en: 'Opening hand costs 2 less' } },
  { key: 'power', label: { zh: '主公技免費', en: 'Free Hero Power' } },
]

interface BrawlScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 乱斗:选一副牌 + 一个乱斗规则,和一个随机预组 AI 打一场怪规则的对局(规则双方同吃)。
export function BrawlScreen({ onBack, onEnterMatch }: BrawlScreenProps) {
  const t = useT()
  const pick = usePickText()
  const customDecks = useCollection((s) => s.customDecks)
  const [deckIndex, setDeckIndex] = useState(0)
  const [custom, setCustom] = useState<Record<string, boolean>>({})
  const myDecks = [...PRECON_DECKS, ...customDecks]
  // 本周当值乱斗:首胜给一次功勋(每周一换,给回访一个理由)
  const thisWeek = weekKey()
  const weeklyIndex = weeklyBrawlIndexFor(thisWeek)
  const weeklyWon = useWeeklyBrawl((s) => s.wonWeek) === thisWeek

  // 自订乱斗:四个旋钮拼出一条规则,双方同吃。不计每周首胜 ——
  // 那份奖励是给「当值那条」的,自己拼的规则想多松就多松。
  const fightCustom = () => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    const mods: RunModifiers = {}
    if (custom.hand) mods.bonusHandSize = 3
    if (custom.armor) mods.startArmor = 8
    if (custom.cheap) mods.handCostDelta = -2
    if (custom.power) mods.heroPowerCostDelta = -2
    const oppSeed = Math.floor(Math.random() * PRECON_DECKS.length)
    const opp = PRECON_DECKS[oppSeed]
    const myHero = HEROES_BY_ID[mine.heroId]
    const oppHero = HEROES_BY_ID[opp.heroId]
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [mine.heroId, opp.heroId],
      deckIds: [mine.cardIds.slice(), opp.cardIds.slice()],
      heroPowersOverride: [myHero?.power, oppHero?.power],
      heroHpsOverride: [START_HP, START_HP],
      modifiersOverride: [mods, mods],
    })
    onEnterMatch()
  }

  const fight = (brawlIndex: number) => {
    const brawl = BRAWLS[brawlIndex]
    const mine = myDecks[deckIndex % myDecks.length]
    if (!brawl || !mine) return
    // 对手:随机一套预组(用 seed 派生,避免 Math.random 在渲染期的不确定)
    const oppSeed = Math.floor(Math.random() * PRECON_DECKS.length)
    const opp = PRECON_DECKS[oppSeed]
    const myHero = HEROES_BY_ID[mine.heroId]
    const oppHero = HEROES_BY_ID[opp.heroId]
    const hp = START_HP + (brawl.hpDelta ?? 0)
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [mine.heroId, opp.heroId],
      deckIds: [mine.cardIds.slice(), opp.cardIds.slice()],
      heroPowersOverride: [myHero?.power, oppHero?.power],
      heroHpsOverride: [hp, hp],
      // 规则双方同吃;带目标的乱斗另有单侧修正(护送的车在我方、斩将的目标在敌方)
      modifiersOverride: [
        { ...brawl.modifiers, ...(brawl.playerOnly ?? {}) },
        { ...brawl.modifiers, ...(brawl.oppOnly ?? {}) },
      ],
      objective: brawl.objective,
      // 只有当值那条算「本周乱斗」,胜了才发一次首胜功勋
      weeklyBrawlWeek: brawlIndex === weeklyIndex ? thisWeek : undefined,
    })
    onEnterMatch()
  }

  const mine = myDecks[deckIndex % myDecks.length]

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
        <h2 className={styles.title}>{t('乱斗 · 群雄混战', 'Brawl')}</h2>
      </header>

      <p className={styles.intro}>
        {t('选一副牌,挑一个乱斗规则 —— 规则双方同吃,图个痛快。', 'Pick a deck and a wild ruleset. The rules hit both sides — just for fun.')}
      </p>

      <div className={styles.deckPick}>
        <button
          className={styles.arrow}
          onClick={() => setDeckIndex((i) => (i - 1 + myDecks.length) % myDecks.length)}
        >
          ‹
        </button>
        <div className={styles.deckCard}>
          {mine && (
            <>
              <div className={styles.deckPortrait}>
                <Portrait
                  id={mine.heroId}
                  nameZh={HEROES_BY_ID[mine.heroId]?.name.zh ?? mine.heroId}
                  doctrine={HEROES_BY_ID[mine.heroId]?.doctrine ?? 'neutral'}
                />
              </div>
              <div className={styles.deckName}>{pick(mine.name)}</div>
            </>
          )}
        </div>
        <button className={styles.arrow} onClick={() => setDeckIndex((i) => (i + 1) % myDecks.length)}>
          ›
        </button>
      </div>

      {/* 自定义乱斗:十四条现成规则之外,让玩家自己拼一条。
          规则**双方同吃**,所以它天然是公平的 —— 这也是唯一一处能把
          RunModifiers 这套词汇直接交给玩家的地方(远征宝物/关卡态势/兵书都由系统发)。
          刻意只开四个旋钮:再多就变成一张配置表,而乱斗要的是「一句话说得清」。 */}
      <details className={styles.customBox}>
        <summary className={styles.customSummary}>{t('自訂亂鬥', 'Custom brawl')}</summary>
        <div className={styles.customRow}>
          {CUSTOM_KNOBS.map((k) => (
            <button
              key={k.key}
              className={custom[k.key] ? styles.knobOn : styles.knob}
              onClick={() => {
                playSfx('buttonTap')
                setCustom((c) => ({ ...c, [k.key]: !c[k.key] }))
              }}
            >
              {pick(k.label)}
            </button>
          ))}
        </div>
        <button
          className={styles.customGo}
          disabled={!CUSTOM_KNOBS.some((k) => custom[k.key])}
          onClick={() => fightCustom()}
        >
          {t('开战 › (自訂局不計每周首勝)', 'Fight › (custom: no weekly bonus)')}
        </button>
      </details>

      <div className={styles.brawlList}>
        {BRAWLS.map((b, i) => {
          const isWeekly = i === weeklyIndex
          return (
            <button
              key={b.id}
              className={`${styles.brawlCard} ${isWeekly ? styles.weeklyCard : ''}`}
              onClick={() => fight(i)}
            >
              <div className={styles.brawlName}>
                {pick(b.name)}
                {isWeekly && (
                  <span className={styles.weeklyTag}>{t('本周', 'This week')}</span>
                )}
              </div>
              <div className={styles.brawlText}>{pick(b.text)}</div>
              <div className={styles.brawlGo}>
                {isWeekly
                  ? weeklyWon
                    ? t('开战 › (本周首胜已领)', 'Fight › (weekly bonus claimed)')
                    : t(`开战 › 首胜 +${WEEKLY_BRAWL_MERIT} 功勋`, `Fight › +${WEEKLY_BRAWL_MERIT} merit`)
                  : t('开战 ›', 'Fight ›')}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
