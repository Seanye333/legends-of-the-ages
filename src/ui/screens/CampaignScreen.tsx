import { Fragment, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BOSSES,
  bossDeck,
  bossChapter,
  bossTrial,
  bossPersonality,
  bossField,
  bossHpFor,
  LEGACY_HP_PER_CYCLE,
  legacyModifiers,
  legacyName,
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
import { CampaignMap } from '../components/CampaignMap'
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
  const cycle = useCampaign((s) => s.cycle ?? 0)
  const canAscend = useCampaign((s) => s.canAscend)
  const ascend = useCampaign((s) => s.ascend)
  const customDecks = useCollection((s) => s.customDecks)
  const [selected, setSelected] = useState<BossDef | null>(null)
  // 舆图视图。默认关 —— 竖列表在手机上仍是更好用的那个(也是 e2e 依赖的结构)
  const [mapView, setMapView] = useState(false)
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
      // 傳承轮次:Boss 血按轮次涨,玩家带一份开局资本(见 content/campaign 的 legacyModifiers)。
      // cycle 为 0 时两条都退化成原样 —— 首轮一个数都没变。
      heroHpsOverride: [myHero?.hp ?? START_HP, bossHpFor(boss.hp, cycle)],
      objective: trial?.objective,
      // 试炼自带修正,和傳承撞车时以试炼为准:试炼的胜负条件依赖它摆上场的目标单位,
      // 换掉就直接没法判胜负了。傳承那点护甲让一让。
      modifiersOverride: trial
        ? [trial.playerModifiers, trial.bossModifiers]
        : cycle > 0
          ? [legacyModifiers(cycle), undefined]
          : undefined,
      // 性格:同一个难度档,不同的「什么叫局面好」
      aiWeights: bossPersonality(boss.id),
      // 地利:有些仗的地形本身就是那一仗(赤壁在烧、漠北利骑)
      field: bossField(boss.id),
    })
    onEnterMatch()
  }

  return (
    <div className={styles.screen} data-mode="campaign">
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
          {cycle > 0 && <span className={styles.cycleBadge}>{pickCompact(legacyName(cycle))}</span>}
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

      {/* 傳承:24 关打完之后,冒险模式此前就彻底没了 —— 而那恰恰是玩家卡池最全、
          最想再打一遍的时候。再启新局,关卡重置,但双方都变强了。
          按钮只在真的全通之后才出现,不做成一个常驻的灰按钮:
          没通关的人看见它只会疑惑,通了关的人看见它才是奖励。 */}
      {canAscend() && (
        <button
          className={styles.ascendBtn}
          onClick={() => {
            playSfx('duel')
            haptic('impact')
            ascend()
          }}
        >
          <span className={styles.ascendName}>
            {t('傳承 · 再啟新局', 'Legacy — Begin Again')}
          </span>
          <span className={styles.ascendHint}>
            {t(
              `關卡重置,敵將血量 +${Math.round(LEGACY_HP_PER_CYCLE * 100)}%,你帶著開局資本上路`,
              `Stages reset. Bosses gain ${Math.round(LEGACY_HP_PER_CYCLE * 100)}% HP; you start with capital in hand.`,
            )}
          </span>
        </button>
      )}

      {/* 舆图 / 列传两种读法。
          列表回答「这一关是谁、什么称号、多少血」,舆图回答「我走到哪了」——
          两个不同的问题,一屏塞不下但一个开关装得下。列表是默认。 */}
      <div className={styles.viewTabs}>
        {(
          [
            ['list', t('關卡', 'Stages')],
            ['map', t('輿圖', 'Map')],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={mapView === (key === 'map') ? styles.viewTabOn : styles.viewTab}
            onClick={() => {
              playSfx('buttonTap')
              setMapView(key === 'map')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mapView && (
        <CampaignMap
          bosses={BOSSES}
          isCleared={(id) => cleared.includes(id)}
          isUnlocked={isUnlocked}
          onPick={(b) => setSelected(b)}
        />
      )}

      {!mapView && (
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
              // `next` = 已解锁但还没通 —— 也就是**下一场该打的**。
              // 二十四行长得一模一样时,玩家进来第一件事是找「我打到哪了」,
              // 而这个信息此前只能靠「哪一行是亮的、且它下面全是灰的」倒推。
              className={`${styles.stage} ${done ? styles.done : ''} ${!open ? styles.locked : ''} ${
                open && !done ? styles.next : ''
              }`}
              style={{ '--doctrine': DOCTRINE_COLORS[b.doctrine] } as CSSProperties}
            >
              {/* 小旗只插在「下一场该打的」那一关行首:二十四行里滚到哪儿都能一眼找到它。
                  纯装饰,aria-hidden —— 按钮自带 aria-label,读屏不需要这面旗。 */}
              {open && !done && (
                <span className={styles.nextFlag} aria-hidden="true">
                  ⚑
                </span>
              )}
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
      )}

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
              {cleared.includes(selected.id) ? (
                t('已通关 —— 重打不再发放战利', 'Cleared — no further spoils')
              ) : (
                <>
                  {/* 纯 CSS 小卡包(画法照结算页的 packChip,本文件独立实现,不跨文件 composes):
                      「首通有包」在开打之前就看得见,而不只是一行字。 */}
                  <i className={styles.rewardPack} aria-hidden="true">
                    包
                  </i>
                  {t(
                    `首通战利:卡包 ×${selected.rewardPacks},功勋 +${selected.rewardMerit}`,
                    `First clear: ${selected.rewardPacks} packs, +${selected.rewardMerit} merit`,
                  )}
                </>
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
