import { Fragment, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  HISTORY_BATTLES,
  battleDeck,
  battleModifiers,
  REVERSE_BY_BATTLE,
  DIVERGENCE_BY_BATTLE,
  type HistoryBattle,
} from '../../content/historyBattles'
import { PRECON_DECKS } from '../../content/decks'
import { useHistory } from '../../app/historyStore'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { BOSSES, bossDeck, bossPersonality } from '../../content/campaign'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { Portrait } from '../components/Portrait'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
// 复用「群雄逐鹿」的版式:同为「选卡组 → 挑一关 → 出战」的单人关卡列表,
// 沿用同一套样式,视觉与冒险模式保持一致,也省得再复刻一整份 CSS。
import styles from './CampaignScreen.module.css'

interface HistoryScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 历史名战「名局重现」。可自由重打的设定局,靠开局态势重现历史战场;首通发奖。
export function HistoryScreen({ onBack, onEnterMatch }: HistoryScreenProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const cleared = useHistory((s) => s.cleared)
  const begin = useHistory((s) => s.begin)
  const customDecks = useCollection((s) => s.customDecks)
  const [selected, setSelected] = useState<HistoryBattle | null>(null)
  const [deckIndex, setDeckIndex] = useState(0)

  const myDecks = [...PRECON_DECKS, ...customDecks]
  const reversed = useHistory((s) => s.reversed)
  const reverseOf = (id: string) => REVERSE_BY_BATTLE[id]
  const diverged = useHistory((s) => s.diverged)
  const divergeOf = (id: string) => DIVERGENCE_BY_BATTLE[id]

  const fight = (battle: HistoryBattle) => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    if (!begin(battle.id)) return
    playSfx('duel')
    haptic('impact')
    const myHero = HEROES_BY_ID[mine.heroId]
    launchMatch({
      heroIds: [mine.heroId, battle.heroId],
      deckIds: [mine.cardIds.slice(), battleDeck(battle)],
      history: true,
      // 历史名战的不对称:敌方血更厚、主公技更强、卡组更好 —— 与 campaign 同;
      // 额外再叠一层双方开局态势(座位 0=我方 / 座位 1=敌方),这是设定局的灵魂。
      heroPowersOverride: [myHero?.power, battle.power],
      heroHpsOverride: [myHero?.hp ?? START_HP, battle.hp],
      modifiersOverride: battleModifiers(battle),
      objective: battle.objective,
    })
    onEnterMatch()
  }

  // 逆位:你**就是**史上的败方 —— 拿他的主公技与开局态势,
  // 对手换成历史胜方(复用冒险的关底定义,一个新对手都不用编)。
  // 卡组仍然是你自己的,这是名局一贯的口径:历史给你处境,牌你自己带。
  const fightReverse = (battle: HistoryBattle) => {
    const rev = REVERSE_BY_BATTLE[battle.id]
    const boss = BOSSES.find((b) => b.id === rev?.bossId)
    const mine = myDecks[deckIndex % myDecks.length]
    if (!rev || !boss || !mine) return
    if (!begin(battle.id, true)) return
    playSfx('duel')
    haptic('impact')
    const mods = battleModifiers(battle)
    launchMatch({
      heroIds: [battle.heroId, boss.heroId],
      deckIds: [mine.cardIds.slice(), bossDeck(boss.doctrine, boss.deckTier)],
      history: true,
      bossId: boss.id,
      // 你拿败方的主公技与血量,对手拿关底那一套
      heroPowersOverride: [battle.power, boss.power],
      heroHpsOverride: [battle.hp, boss.hp],
      // 态势也跟着换边:原本压在你头上的那些,现在是你的
      modifiersOverride: [mods[1], mods[0]],
      aiWeights: bossPersonality(boss.id),
    })
    onEnterMatch()
  }

  // 史实分歧点:**不换边**,换的是战场的条件 —— 东风没来、许攸没叛。
  // 实现上就是把那一场的字段按分歧点覆盖一遍,引擎一行不动。
  // 逐字段覆盖(而不是整份替换):分歧点只写它改动的那几项,
  // 没写的一律沿用史实那一版 —— 「如果」改的从来只是一件事。
  const fightDiverge = (battle: HistoryBattle) => {
    const div = DIVERGENCE_BY_BATTLE[battle.id]
    const mine = myDecks[deckIndex % myDecks.length]
    if (!div || !mine) return
    if (!begin(battle.id, false, true)) return
    playSfx('duel')
    haptic('impact')
    const myHero = HEROES_BY_ID[mine.heroId]
    const base = battleModifiers(battle)
    launchMatch({
      heroIds: [mine.heroId, battle.heroId],
      deckIds: [mine.cardIds.slice(), battleDeck({ ...battle, deckTier: div.deckTier ?? battle.deckTier })],
      history: true,
      heroPowersOverride: [myHero?.power, battle.power],
      heroHpsOverride: [myHero?.hp ?? START_HP, div.hp ?? battle.hp],
      modifiersOverride: [div.playerModifiers ?? base[0], div.enemyModifiers ?? base[1]],
      // 睢阳的分歧点要把「守成」换回普通判定,所以这里**取分歧点的值而不是回落** ——
      // 回落的话「援军来了」还得继续守十六个回合,那正好是它想推翻的东西。
      objective: div.objective,
    })
    onEnterMatch()
  }

  return (
    <div className={styles.screen} data-mode="history">
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
        <h2 className={styles.title}>{t('名局重现', 'Great Battles')}</h2>
        <span className={styles.progress}>
          {cleared.length} / {HISTORY_BATTLES.length}
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

      {/* 戰役簿:十四场名局本来就是按年代排的,但界面上它们只是十四行并列的按钮 ——
          读不出「从春秋一路打到明」这条线。按年代插分隔之后,这个模式才像一本战役簿,
          而不是一张关卡列表。年代取 era 里 ` · ` 之前那一段(「三國 · 建安五年」→「三國」)。 */}
      <ol className={styles.road}>
        {HISTORY_BATTLES.map((b, i) => {
          const done = cleared.includes(b.id)
          const eraOf = (x: (typeof HISTORY_BATTLES)[number]) => pick(x.era).split(' · ')[0]
          const newEra = i === 0 || eraOf(b) !== eraOf(HISTORY_BATTLES[i - 1])
          return (
            <Fragment key={`era-${b.id}`}>
            {newEra && (
              <li className={styles.eraHead} aria-hidden>
                {eraOf(b)}
              </li>
            )}
            <li
              key={b.id}
              className={`${styles.stage} ${done ? styles.done : ''}`}
              style={{ '--doctrine': DOCTRINE_COLORS[b.doctrine] } as CSSProperties}
            >
              <button
                className={styles.stageBtn}
                aria-label={`${pick(b.name)} — ${pick(b.foeName)}`}
                onClick={() => {
                  playSfx('buttonTap')
                  setSelected(b)
                }}
              >
                <span className={styles.stageNo}>{i + 1}</span>
                <span className={styles.stagePortrait}>
                  <Portrait id={b.heroId} nameZh={b.foeName.zh} doctrine={b.doctrine} />
                </span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>{pickCompact(b.name)}</span>
                  <span className={styles.stageTitle}>{pick(b.era)}</span>
                </span>
                <span className={styles.stageMeta}>
                  {done ? (
                    <span className={styles.clearedTag}>{t('已破', 'Cleared')}</span>
                  ) : (
                    <span className={styles.hp}>{pickCompact(b.foeName)}</span>
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
                nameZh={selected.foeName.zh}
                doctrine={selected.doctrine}
                full
              />
            </div>
            <h3 className={styles.briefName}>
              {pick(selected.name)}
              <span className={styles.briefTitle}>{pick(selected.era)}</span>
            </h3>
            <p className={styles.briefIntro}>{pick(selected.intro)}</p>
            <div className={styles.briefStats}>
              <span>
                {t('对手', 'Foe')}{' '}
                <b>
                  {pickCompact(selected.foeName)} · {pick(selected.foeTitle)}
                </b>
              </span>
              <span>
                {t('血量', 'Health')} <b>{selected.hp}</b>
              </span>
              <span>
                {t('主义', 'Doctrine')} <b>{pickCompact(DOCTRINE_NAME[selected.doctrine])}</b>
              </span>
            </div>
            <p className={styles.briefIntro}>{pick(selected.situation)}</p>
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
            {/* 逆位:正位通关后才解锁 —— 先把这一仗按史实打赢一次,再来问「反过来呢」 */}
            {reverseOf(selected.id) && cleared.includes(selected.id) && (
              <div className={styles.trialBox}>
                <span className={styles.trialName}>
                  {pick(reverseOf(selected.id)!.name)}
                  {reversed.includes(selected.id) && <span className={styles.trialDone}> ✓</span>}
                </span>
                <span className={styles.trialText}>{pick(reverseOf(selected.id)!.intro)}</span>
                <span className={styles.trialReward}>
                  {reversed.includes(selected.id)
                    ? t('已成 —— 重打不再发放战利', 'Complete — no further spoils')
                    : t(
                        `首成战利:功勋 +${reverseOf(selected.id)!.rewardMerit}`,
                        `First clear: +${reverseOf(selected.id)!.rewardMerit} merit`,
                      )}
                </span>
              </div>
            )}
            {/* 史实分歧点:同样要先按史实赢一次 ——
                「如果没有东风」这句话,只有在你已经靠东风赢过之后才有意思。 */}
            {divergeOf(selected.id) && cleared.includes(selected.id) && (
              <div className={`${styles.trialBox} ${styles.divergeBox}`}>
                <span className={styles.trialName}>
                  {pick(divergeOf(selected.id)!.name)}
                  {(diverged ?? []).includes(selected.id) && (
                    <span className={styles.trialDone}> ✓</span>
                  )}
                </span>
                <span className={styles.trialText}>{pick(divergeOf(selected.id)!.premise)}</span>
                <span className={styles.trialText}>{pick(divergeOf(selected.id)!.situation)}</span>
                <span className={styles.trialReward}>
                  {(diverged ?? []).includes(selected.id)
                    ? t('已成 —— 重打不再发放战利', 'Complete — no further spoils')
                    : t(
                        `首成战利:功勋 +${divergeOf(selected.id)!.rewardMerit}`,
                        `First clear: +${divergeOf(selected.id)!.rewardMerit} merit`,
                      )}
                </span>
              </div>
            )}
            <div className={styles.briefActions}>
              <button className={styles.primary} onClick={() => fight(selected)}>
                {t('出战', 'Fight')}
              </button>
              {reverseOf(selected.id) && cleared.includes(selected.id) && (
                <button className={styles.trialBtn} onClick={() => fightReverse(selected)}>
                  {t('逆位而战', 'Fight Reversed')}
                </button>
              )}
              {divergeOf(selected.id) && cleared.includes(selected.id) && (
                <button className={styles.divergeBtn} onClick={() => fightDiverge(selected)}>
                  {t('走另一条路', 'Take the Other Path')}
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
