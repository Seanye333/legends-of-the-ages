import { useState } from 'react'
import {
  BOSSES,
  bossDeck,
  bossHpFor,
  bossPersonality,
  LEGACY_HP_PER_CYCLE,
} from '../../content/campaign'
import { RELICS_BY_ID, combineRelics } from '../../content/relics'
import { CARDS_BY_ID } from '../../content/cards'
import { MODIFIERS_BY_ID } from '../../content/expeditionModifiers'
import { PRECON_DECKS } from '../../content/decks'
import { HEROES_BY_ID, withUpgrade } from '../../content/overrides/heroes'
import { START_HP } from '../../engine/types'
import { useCollection } from '../../app/collectionStore'
import { useExpedition } from '../../app/expeditionStore'
import { launchMatch } from '../matchSetup'
import { Portrait } from '../components/Portrait'
import { usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './ExpeditionScreen.module.css'

interface ExpeditionScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 远征:单人 roguelike。选一副牌,连打 8 关 Boss,每通一关三选一宝物。
export function ExpeditionScreen({ onBack, onEnterMatch }: ExpeditionScreenProps) {
  const t = useT()
  const pick = usePickText()
  const customDecks = useCollection((s) => s.customDecks)
  const { run, bestDepth, start, pickRelic, pickCard, skipCard, pickRoute, dropCard, abandon } =
    useExpedition()
  const [deckIndex, setDeckIndex] = useState(0)
  const myDecks = [...PRECON_DECKS, ...customDecks]

  const beginRun = (endless = false) => {
    const mine = myDecks[deckIndex % myDecks.length]
    if (!mine) return
    playSfx('buttonTap')
    start(mine.heroId, mine.cardIds.slice(), endless)
  }

  // 無盡:stage 不再封顶,绕圈复用同一批 Boss。lap = 绕了几圈,
  // 每圈敌将血量再涨一档 —— 曲线是连续的,而宝物是台阶式的,
  // 于是「什么时候扛不住」由这两条线交在哪儿决定,而不是某个写死的关数。
  const lap = Math.floor(run ? run.stage / BOSSES.length : 0)
  const bossOf = (stage: number) => BOSSES[stage % BOSSES.length]

  const fight = () => {
    if (!run) return
    const boss = bossOf(run.stage)
    if (!boss) return
    const myHero = HEROES_BY_ID[run.heroId]
    const { bonusHp, modifiers } = combineRelics(run.relics)
    // 战场态势修饰符:合进 Boss 侧修正 / 双方修正 / Boss 血量
    const mod = run.stageMod ? MODIFIERS_BY_ID[run.stageMod] : undefined
    const playerMods = { ...modifiers, ...(mod?.both ?? {}), ...(mod?.player ?? {}) }
    const bossMods = { ...(mod?.boss ?? {}), ...(mod?.both ?? {}) }
    playSfx('duel')
    haptic('impact')
    launchMatch({
      heroIds: [run.heroId, boss.heroId],
      deckIds: [run.deck.slice(), bossDeck(boss.doctrine, boss.deckTier)],
      expedition: true,
      bossId: boss.id,
      // 远征独有:主公技可以花 5 费升阶(天梯与冒险没有 —— 见 heroes.ts 那段实测说明)
      heroPowersOverride: [withUpgrade(myHero?.power), boss.power],
      heroHpsOverride: [
        (myHero?.hp ?? START_HP) + bonusHp,
        bossHpFor(boss.hp, lap) + (mod?.bossHpBonus ?? 0),
      ],
      modifiersOverride: [playerMods, bossMods],
      objective: mod?.objective,
      aiWeights: bossPersonality(boss.id),
    })
    onEnterMatch()
  }

  const header = (
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
      <h2 className={styles.title}>{t('远征 · 逐鹿中原', 'Expedition')}</h2>
      <span className={styles.best}>
        {t(`最深:${bestDepth}/8 关`, `Best: ${bestDepth}/8`)}
      </span>
    </header>
  )

  // ---- 选牌(宝物之后):卡组在一趟远征里真正成长 ----
  if (run && run.cardOffer) {
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.relicPrompt}>
          {t(
            `扩充军册 —— 择一入伍(现有 ${run.deck.length} 张)`,
            `Recruit one (deck: ${run.deck.length})`,
          )}
        </div>
        <div className={styles.relicRow}>
          {run.cardOffer.map((id) => {
            const c = CARDS_BY_ID[id]
            if (!c) return null
            return (
              <button
                key={id}
                className={`${styles.relicCard} ${styles[c.rarity] ?? ''}`}
                onClick={() => {
                  playSfx('cardPlay')
                  haptic('impact')
                  pickCard(id)
                }}
              >
                <div className={styles.relicName}>{pick(c.name)}</div>
                <div className={styles.relicRarity}>
                  {c.cost} {t('费', 'cost')} · {c.attack}/{c.health}
                </div>
                <div className={styles.relicText}>{c.text ? pick(c.text) : t('白板', 'Vanilla')}</div>
              </button>
            )
          })}
        </div>
        <div className={styles.relicRow} style={{ marginTop: 4 }}>
          <button
            className={styles.relicCard}
            onClick={() => {
              playSfx('buttonTap')
              skipCard()
            }}
          >
            <div className={styles.relicName}>{t('不必扩军', 'Take none')}</div>
            <div className={styles.relicText}>
              {t('保持军册精炼,直接进军下一关。', 'Keep the deck lean and march on.')}
            </div>
          </button>
        </div>
        {run.deck.length > 20 && (
          <details className={styles.trimBox}>
            <summary className={styles.trimSummary}>
              {t('精简军册(删一张)', 'Trim the roster (remove one)')}
            </summary>
            <div className={styles.trimList}>
              {[...new Set(run.deck)].map((id) => {
                const c = CARDS_BY_ID[id]
                if (!c) return null
                const n = run.deck.filter((x) => x === id).length
                return (
                  <button
                    key={id}
                    className={styles.trimItem}
                    onClick={() => {
                      playSfx('buttonTap')
                      dropCard(id)
                    }}
                  >
                    {pick(c.name)} · {c.cost}{t('费', '')}{n > 1 ? ` ×${n}` : ''}
                  </button>
                )
              })}
            </div>
          </details>
        )}
      </div>
    )
  }

  // ---- 选路(选完牌之后)----
  // 远征此前是「系统给你一个态势,接受它」—— 关间唯一的决策是选宝物与选牌,
  // 路本身没有分叉。而 roguelike 的核心恰恰是路线选择:
  // 「这一关我要不要为了多一件宝物去啃硬的那条」。
  // 两条候选足够产生这个决策,又不用画一整张节点图 —— 手机上那玩意既难点准也读不出通向哪。
  if (run && run.routeOffer && run.routeOffer.length > 0) {
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.relicPrompt}>
          {t(`前路有二 —— 擇一而行(下一关:第 ${run.stage + 2} 关)`, 'Two roads ahead — choose one')}
        </div>
        <div className={styles.relicRow}>
          {run.routeOffer.map((id) => {
            const m = MODIFIERS_BY_ID[id]
            if (!m) return null
            return (
              <button
                key={id}
                className={`${styles.relicCard} ${m.bonusRelic ? styles.legendary : ''}`}
                onClick={() => {
                  playSfx('buttonTap')
                  haptic('impact')
                  pickRoute(id)
                }}
              >
                <div className={styles.relicName}>{pick(m.name)}</div>
                {m.bonusRelic && (
                  <div className={styles.relicRarity}>{t('多得一件宝物', 'Extra relic')}</div>
                )}
                <div className={styles.relicText}>{pick(m.text)}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 选宝物 ----
  if (run && run.offered) {
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.relicPrompt}>
          {t(`第 ${run.stage + 1} 关已克 —— 择一宝物`, `Stage ${run.stage + 1} cleared — choose a relic`)}
        </div>
        <div className={styles.relicRow}>
          {run.offered.map((id) => {
            const r = RELICS_BY_ID[id]
            if (!r) return null
            return (
              <button
                key={id}
                className={`${styles.relicCard} ${styles[r.rarity]}`}
                onClick={() => {
                  playSfx('cardPlay')
                  haptic('impact')
                  pickRelic(id)
                }}
              >
                <div className={styles.relicName}>{pick(r.name)}</div>
                <div className={styles.relicRarity}>
                  {pick(
                    { rare: { zh: '稀有', en: 'Rare' }, epic: { zh: '史诗', en: 'Epic' }, legendary: { zh: '传说', en: 'Legendary' } }[
                      r.rarity
                    ],
                  )}
                </div>
                <div className={styles.relicText}>{pick(r.text)}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ---- 进行中的远征:关卡进度 + 已得宝物 + 开战 ----
  if (run) {
    const boss = bossOf(run.stage)
    // 無盡绕圈时地图只画**本圈**的进度:第 25 关在地图上还是第 1 格,
    // 圈数写在旁边。铺 48 个格子只会让每个格子都小到看不清。
    const stageInLap = run.stage % BOSSES.length
    return (
      <div className={styles.screen}>
        {header}
        {run.endless && (
          <div className={styles.lapBar}>
            {t(`無盡 · 第 ${lap + 1} 圈`, `Endless — lap ${lap + 1}`)}
            {lap > 0 && (
              <span className={styles.lapHp}>
                {t(
                  `敵將血量 +${Math.round(LEGACY_HP_PER_CYCLE * lap * 100)}%`,
                  `Bosses +${Math.round(LEGACY_HP_PER_CYCLE * lap * 100)}% HP`,
                )}
              </span>
            )}
          </div>
        )}
        <div className={styles.map}>
          {BOSSES.map((b, i) => (
            <div
              key={b.id}
              className={`${styles.node} ${i < stageInLap ? styles.cleared : i === stageInLap ? styles.current : ''}`}
              title={pick(b.name)}
            >
              {i < stageInLap ? '✓' : i + 1}
            </div>
          ))}
        </div>

        {boss && (
          <div className={styles.bossCard}>
            <div className={styles.bossPortrait}>
              <Portrait id={boss.heroId} nameZh={boss.name.zh} doctrine={boss.doctrine} />
            </div>
            <div className={styles.bossInfo}>
              <div className={styles.bossName}>
                {t(`第 ${run.stage + 1} 关`, `Stage ${run.stage + 1}`)} · {pick(boss.name)}
              </div>
              <div className={styles.bossTitle}>{pick(boss.title)}</div>
              <div className={styles.bossHp}>
                {(() => {
                  const hp =
                    bossHpFor(boss.hp, lap) +
                    (run.stageMod ? (MODIFIERS_BY_ID[run.stageMod]?.bossHpBonus ?? 0) : 0)
                  return t(`血量 ${hp}`, `${hp} HP`)
                })()}
              </div>
              {run.stageMod && MODIFIERS_BY_ID[run.stageMod] && (
                <div className={styles.modChip}>
                  ⚔ {pick(MODIFIERS_BY_ID[run.stageMod].name)} —— {pick(MODIFIERS_BY_ID[run.stageMod].text)}
                </div>
              )}
            </div>
            <button className={styles.fightBtn} onClick={fight}>
              {t('开战', 'Fight')}
            </button>
          </div>
        )}

        <div className={styles.relicsHeld}>
          <div className={styles.relicsHeldHead}>
            {t(`已得宝物(${run.relics.length})`, `Relics (${run.relics.length})`)}
          </div>
          {run.relics.length === 0 ? (
            <span className={styles.relicsEmpty}>{t('尚无 —— 通关即可择宝', 'None yet — clear a stage to choose one')}</span>
          ) : (
            <div className={styles.relicsList}>
              {run.relics.map((id) => {
                const r = RELICS_BY_ID[id]
                return (
                  <span key={id} className={`${styles.relicChip} ${styles[r?.rarity ?? 'rare']}`} title={r ? pick(r.text) : id}>
                    {r ? pick(r.name) : id}
                  </span>
                )
              })}
            </div>
          )}
        </div>

        <button
          className={styles.abandonBtn}
          onClick={() => {
            playSfx('buttonTap')
            abandon()
          }}
        >
          {t('放弃远征', 'Abandon expedition')}
        </button>
      </div>
    )
  }

  // ---- 没有进行中的远征:选牌开局 ----
  const mine = myDecks[deckIndex % myDecks.length]
  return (
    <div className={styles.screen}>
      {header}
      <p className={styles.intro}>
        {t(
          '选一副牌,连闯 8 关。每通一关择一宝物,越滚越强;败一场,远征即止。',
          'Pick a deck and fight through 8 stages. Choose a relic after each — but one defeat ends the run.',
        )}
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
              <div className={styles.deckHero}>
                {pick(HEROES_BY_ID[mine.heroId]?.name ?? { zh: mine.heroId, en: mine.heroId })}
              </div>
            </>
          )}
        </div>
        <button className={styles.arrow} onClick={() => setDeckIndex((i) => (i + 1) % myDecks.length)}>
          ›
        </button>
      </div>
      {/* 無盡:24 关打完就结束,是这个模式此前唯一的天花板 ——
          而通关一次之后玩家想要的恰恰是「再往前走一步会怎样」。
          两颗按钮并排而不是做成开关:开关得先被发现才会被用到,
          而这两种打法的差别值得在开始之前就说清楚。 */}
      <button className={styles.endlessBtn} onClick={() => beginRun(true)}>
        {t('無盡遠征 —— 走到走不动为止', 'Endless — until you fall')}
      </button>
      <button className={styles.startBtn} onClick={() => beginRun(false)}>
        {t('出征', 'Set Out')}
      </button>
    </div>
  )
}
