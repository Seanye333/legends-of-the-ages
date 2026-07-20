import { useMemo, useState } from 'react'
import type { CSSProperties } from 'react'
import type { CardDef } from '../../engine/types'
import { CARDS_BY_ID } from '../../content/cards'
import { HEROES_BY_ID } from '../../content/overrides/heroes'
import { PRECON_DECKS } from '../../content/decks'
import {
  ARENA_ENTRY_MERIT,
  ARENA_MAX_LOSSES,
  ARENA_MAX_WINS,
  ARENA_PICKS,
  arenaReward,
  useArena,
} from '../../app/arenaStore'
import { useCollection } from '../../app/collectionStore'
import { launchMatch } from '../matchSetup'
import { DOCTRINE_COLORS, DOCTRINE_NAME } from '../doctrineColors'
import { CardFace } from '../components/CardFace'
import { CardInspect } from '../components/CardInspect'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Portrait } from '../components/Portrait'
import { fakeInstance } from './CollectionScreen'
import { usePickCompact, usePickText, useT } from '../i18n'
import { playSfx } from '../sound'
import { haptic } from '../haptics'
import styles from './ArenaScreen.module.css'

interface ArenaScreenProps {
  onBack: () => void
  onEnterMatch: () => void
}

// 竞技场「校场点将」。全作第三种玩法,也是唯一一种**不依赖收藏**的模式:
// 三选一现抽三十张,新号和老号站同一条起跑线。
export function ArenaScreen({ onBack, onEnterMatch }: ArenaScreenProps) {
  const t = useT()
  const pick = usePickText()
  const pickCompact = usePickCompact()
  const arena = useArena()
  const merit = useCollection((s) => s.merit)
  const [inspect, setInspect] = useState<CardDef | null>(null)
  const [confirmAbandon, setConfirmAbandon] = useState(false)
  const [claimed, setClaimed] = useState<{ packs: number; merit: number } | null>(null)

  // 已抽卡组按费用排一下,让曲线一眼可见
  const pickedSorted = useMemo(
    () =>
      arena.picked
        .map((id) => CARDS_BY_ID[id])
        .filter((c): c is CardDef => Boolean(c))
        .sort((a, b) => a.cost - b.cost || a.collectorNo - b.collectorNo),
    [arena.picked],
  )

  const startRun = () => {
    playSfx('buttonTap')
    if (!arena.begin()) return
  }

  const fight = () => {
    const deck = arena.deck()
    if (!deck) return
    playSfx('buttonTap')
    // 对手:随机一套调校过的预组。现抽的卡组打预组难度偏高 ——
    // 这也是「12 胜」被设成一个够难的目标的原因。
    const foe = PRECON_DECKS[Math.floor(Math.random() * PRECON_DECKS.length)]
    launchMatch({
      heroIds: [deck.heroId, foe.heroId],
      deckIds: [deck.cardIds.slice(), foe.cardIds.slice()],
      arena: true,
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
      <h2 className={styles.title}>{t('校场点将', 'Arena')}</h2>
      <span className={styles.meritBadge}>✦ {merit}</span>
    </header>
  )

  // —— 未开始 ——
  if (arena.phase === 'idle') {
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.card}>
          <p className={styles.lead}>
            {t(
              '不看收藏,现抽现打。三选一凑满 30 张,一直打到 3 败或 12 胜。',
              'Collection-free. Draft 30 cards three at a time, then play until 3 losses or 12 wins.',
            )}
          </p>
          <ul className={styles.rules}>
            <li>{t(`报名费 ${ARENA_ENTRY_MERIT} 功勋`, `Entry: ${ARENA_ENTRY_MERIT} merit`)}</li>
            <li>{t('主公三选一,卡池只限本主义 + 中立', 'Pick 1 of 3 heroes; pool is your doctrine + neutral')}</li>
            <li>{t('份数不限 —— 抽到几张同名就能带几张', 'No copy limit — take every duplicate you draft')}</li>
            <li>
              {t(
                `奖励随胜场增长:0 胜 1 包,${ARENA_MAX_WINS} 胜 7 包 + 440 功勋`,
                `Rewards scale: 1 pack at 0 wins, 7 packs + 440 merit at ${ARENA_MAX_WINS}`,
              )}
            </li>
          </ul>
          <button className={styles.primary} disabled={merit < ARENA_ENTRY_MERIT} onClick={startRun}>
            {merit < ARENA_ENTRY_MERIT
              ? t(`还差 ${ARENA_ENTRY_MERIT - merit} 功勋`, `${ARENA_ENTRY_MERIT - merit} more merit`)
              : t('报名参战', 'Enter the Arena')}
          </button>
          {merit < ARENA_ENTRY_MERIT && (
            <p className={styles.hint}>
              {t(
                '功勋来自分解重复卡与对局失利的安慰奖。',
                'Merit comes from disenchanting duplicates and from losses.',
              )}
            </p>
          )}
        </div>
      </div>
    )
  }

  // —— 选主公 ——
  if (arena.phase === 'hero') {
    return (
      <div className={styles.screen}>
        {header}
        <p className={styles.step}>{t('第一步 · 择主', 'Step 1 · Choose your hero')}</p>
        <div className={styles.heroRow}>
          {arena.heroOffer.map((id) => {
            const h = HEROES_BY_ID[id]
            if (!h) return null
            return (
              <button
                key={id}
                className={styles.heroCard}
                style={{ '--doctrine': DOCTRINE_COLORS[h.doctrine] } as CSSProperties}
                onClick={() => {
                  playSfx('buttonTap')
                  haptic('tap')
                  arena.chooseHero(id)
                }}
              >
                <div className={styles.heroPortrait}>
                  <Portrait id={h.id} nameZh={h.name.zh} doctrine={h.doctrine} />
                </div>
                <div className={styles.heroName}>{pickCompact(h.name)}</div>
                <div className={styles.heroDoctrine}>{pickCompact(DOCTRINE_NAME[h.doctrine])}</div>
                <div className={styles.heroPowerName}>{pickCompact(h.power.name)}</div>
                <div className={styles.heroPowerText}>{pick(h.power.text)}</div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // —— 抽牌 ——
  if (arena.phase === 'draft') {
    return (
      <div className={styles.screen}>
        {header}
        <p className={styles.step}>
          {t(
            `第二步 · 点将 ${arena.picked.length + 1} / ${ARENA_PICKS}`,
            `Step 2 · Pick ${arena.picked.length + 1} / ${ARENA_PICKS}`,
          )}
        </p>
        <div className={styles.progress}>
          <div
            className={styles.progressFill}
            style={{ width: `${(arena.picked.length / ARENA_PICKS) * 100}%` }}
          />
        </div>
        <div className={styles.offerRow}>
          {arena.offer.map((id) => {
            const def = CARDS_BY_ID[id]
            if (!def) return null
            return (
              <div key={id} className={styles.offerCell}>
                <CardFace
                  inst={fakeInstance(def)}
                  large
                  onInspect={() => setInspect(def)}
                  onClick={() => {
                    playSfx('cardPlay')
                    haptic('play')
                    arena.choose(id)
                  }}
                />
              </div>
            )
          })}
        </div>
        {pickedSorted.length > 0 && (
          <div className={styles.pickedStrip}>
            {pickedSorted.map((def, i) => (
              <span key={`${def.id}-${i}`} className={styles.pickedChip} title={pick(def.name)}>
                <b>{def.cost}</b> {pickCompact(def.name)}
              </span>
            ))}
          </div>
        )}
        {inspect && <CardInspect def={inspect} onClose={() => setInspect(null)} />}
      </div>
    )
  }

  // —— 结算 ——
  if (arena.phase === 'done') {
    const reward = arenaReward(arena.wins)
    return (
      <div className={styles.screen}>
        {header}
        <div className={styles.card}>
          <p className={styles.step}>
            {arena.wins >= ARENA_MAX_WINS
              ? t('十二连捷 · 校场无敌手', 'Twelve wins — undefeated')
              : t('本轮结束', 'Run complete')}
          </p>
          <div className={styles.scoreRow}>
            <span className={styles.win}>{arena.wins}</span>
            <span className={styles.sep}>—</span>
            <span className={styles.loss}>{arena.losses}</span>
          </div>
          {claimed ? (
            <p className={styles.lead}>
              {t(
                `已领取:卡包 ×${claimed.packs},功勋 +${claimed.merit}`,
                `Claimed: ${claimed.packs} packs, +${claimed.merit} merit`,
              )}
            </p>
          ) : (
            <>
              <p className={styles.lead}>
                {t(
                  `战利:卡包 ×${reward.packs},功勋 +${reward.merit}`,
                  `Spoils: ${reward.packs} packs, +${reward.merit} merit`,
                )}
              </p>
              <button
                className={styles.primary}
                onClick={() => {
                  playSfx('victory')
                  haptic('reward')
                  setClaimed(arena.claim())
                }}
              >
                {t('领取战利', 'Claim spoils')}
              </button>
            </>
          )}
          {claimed && (
            <button
              className={styles.primary}
              onClick={() => {
                playSfx('buttonTap')
                onBack()
              }}
            >
              {t('返回', 'Back')}
            </button>
          )}
        </div>
      </div>
    )
  }

  // —— 备战 / 继续打 ——
  return (
    <div className={styles.screen}>
      {header}
      <div className={styles.card}>
        <div className={styles.scoreRow}>
          <span className={styles.win}>{arena.wins}</span>
          <span className={styles.sep}>—</span>
          <span className={styles.loss}>{arena.losses}</span>
        </div>
        <p className={styles.lead}>
          {t(
            `再胜 ${ARENA_MAX_WINS - arena.wins} 场登顶,再负 ${ARENA_MAX_LOSSES - arena.losses} 场出局。`,
            `${ARENA_MAX_WINS - arena.wins} more wins to top out; ${ARENA_MAX_LOSSES - arena.losses} more losses ends the run.`,
          )}
        </p>
        <button className={styles.primary} onClick={fight}>
          {t('出战', 'Fight')}
        </button>
        <button className={styles.danger} onClick={() => setConfirmAbandon(true)}>
          {t('放弃本轮', 'Abandon run')}
        </button>
      </div>

      <div className={styles.pickedStrip}>
        {pickedSorted.map((def, i) => (
          <span key={`${def.id}-${i}`} className={styles.pickedChip} title={pick(def.name)}>
            <b>{def.cost}</b> {pickCompact(def.name)}
          </span>
        ))}
      </div>

      {confirmAbandon && (
        <ConfirmDialog
          title={t('放弃本轮?', 'Abandon this run?')}
          body={t('已抽的卡组会作废,报名费不退,也拿不到战利。', 'The drafted deck is discarded. No refund, no spoils.')}
          confirmLabel={t('放弃', 'Abandon')}
          cancelLabel={t('继续', 'Keep going')}
          onConfirm={() => {
            arena.abandon()
            setConfirmAbandon(false)
          }}
          onCancel={() => setConfirmAbandon(false)}
        />
      )}
    </div>
  )
}
