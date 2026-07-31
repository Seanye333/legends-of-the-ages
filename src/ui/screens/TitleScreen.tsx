import { Suspense, lazy, useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CARDS, CARDS_BY_ID, SIGNATURE_IDS } from '../../content/cards'
import { PRECON_DECKS, deckKey } from '../../content/decks'
import { useDeckStats, winRate } from '../../app/deckStatsStore'
import { HEROES } from '../../content/overrides/heroes'
import type { CardDef, LocalizedText } from '../../engine/types'
import { quickDeck, useMatch, type StartMatchArgs } from '../../app/matchStore'
import type { Difficulty } from '../../app/settingsStore'
import { loadSession } from '../../app/remoteMatch'
import { countMode, type ModeKey } from '../../app/telemetry'
import { usePickText, useT } from '../i18n'
import { useSettings } from '../../app/settingsStore'
import { DOCTRINE_COLORS } from '../doctrineColors'
import { portraitCandidates } from '../portraitSource'
import { launchMatch } from '../matchSetup'
import { initSound, playSfx, startMusic, stopMusic } from '../sound'
import { useCollection } from '../../app/collectionStore'
import { InstallPrompt } from '../components/InstallPrompt'
import { StarPanel } from '../components/StarPanel'
import { useArena } from '../../app/arenaStore'
import { useCampaign } from '../../app/campaignStore'
import { BOSSES } from '../../content/campaign'
import { useHistory } from '../../app/historyStore'
import { useTower } from '../../app/towerStore'
import { useStreak } from '../../app/streakStore'
import { useWarMerit } from '../../app/useWarMerit'
import { HISTORY_BATTLES } from '../../content/historyBattles'
import { ACHIEVEMENTS, useAchievements } from '../../app/achievementStore'
import type { DeckList } from '../../content/decks'

// 标题页的七个面板全部懒加载。它们都在按钮后面(条件渲染),但静态 import
// 会把它们连同**传递依赖**一起钉进首屏 chunk —— 其中 DailyGeneralPanel 拖着
// 144KB 的 lore.gen(2,211 条列传台词),而首屏根本不需要一个字。
// 这是首屏体积里最划算的一刀:七个面板都是「点了才看」,加载延迟藏在点击动作里。
const AchievementPanel = lazy(() =>
  import('../components/AchievementPanel').then((m) => ({ default: m.AchievementPanel })),
)
const StatsPanel = lazy(() =>
  import('../components/StatsPanel').then((m) => ({ default: m.StatsPanel })),
)
const PackOpening = lazy(() =>
  import('../components/PackOpening').then((m) => ({ default: m.PackOpening })),
)
const LeaderboardPanel = lazy(() =>
  import('../components/LeaderboardPanel').then((m) => ({ default: m.LeaderboardPanel })),
)
const RemoteMatchPanel = lazy(() =>
  import('../components/RemoteMatchPanel').then((m) => ({ default: m.RemoteMatchPanel })),
)
const QuestPanel = lazy(() =>
  import('../components/QuestPanel').then((m) => ({ default: m.QuestPanel })),
)
const DailyGeneralPanel = lazy(() =>
  import('../components/DailyGeneralPanel').then((m) => ({ default: m.DailyGeneralPanel })),
)
import { useDailyGeneral } from '../../app/dailyGeneralStore'
import { dayKey } from '../../content/dayKey'
import { useQuests } from '../../app/questStore'
import { shouldOfferTutorial, tutorialMatchArgs } from '../tutorial'
import { unlockHint, type UnlockProgress } from '../../content/unlocks'
import styles from './TitleScreen.module.css'

// 大厅里带解锁门槛的模式入口。没解锁时**照样渲染**,只是灰着并把条件写在按钮上 ——
// 藏起来的话游戏看着空,而内容量恰恰是这游戏最大的卖点。见 content/unlocks.ts。
function ModeBtn({
  mode,
  progress,
  onNavigate,
  glow,
  children,
}: {
  mode: string
  progress: UnlockProgress
  onNavigate?: (s: NavTarget) => void
  glow?: boolean
  children: React.ReactNode
}) {
  const pick = usePickText()
  const hint = unlockHint(mode, progress)
  if (hint) {
    // 提示文字标 aria-hidden,并把同样的内容挂到 title 上。
    // 不这么做的话,按钮的**可及名称**会变成「校场点将 群雄逐鹿通 6 关解锁(还差 5)」——
    // 屏幕阅读器把门槛说明当成按钮名字念是一;二是这个名字里含着别的模式的名字,
    // 于是「找名叫『群雄逐鹿』的按钮」会同时命中三个灰按钮
    // (实测:这条直接打挂了三个既有的端到端用例)。
    return (
      <button
        className={`${styles.navBtn} ${styles.navLocked}`}
        disabled
        title={pick(hint)}
      >
        <span className={styles.navLockedName}>{children}</span>
        <span className={styles.navLockedHint} aria-hidden="true">
          {pick(hint)}
        </span>
      </button>
    )
  }
  return (
    <button
      className={`${styles.navBtn} ${glow ? styles.navGlow : ''}`}
      onClick={() => {
        playSfx('buttonTap')
        countMode(mode as ModeKey)
        onNavigate?.(mode as NavTarget)
      }}
    >
      {children}
    </button>
  )
}

function MiniCard({ card }: { card: CardDef }) {
  const pick = usePickText()
  const frameRarity = {
    common: '',
    rare: styles.frameRare,
    epic: styles.frameEpic,
    legendary: styles.frameLegendary,
  }[card.rarity]
  return (
    <div
      className={`${styles.card} ${frameRarity}`}
      style={{ '--doctrine': DOCTRINE_COLORS[card.doctrine] } as CSSProperties}
    >
      <span className={styles.cost}>{card.cost}</span>
      <div className={styles.portraitBox}>
        {/* 名将墙只取签名卡 → 恒为随包立绘;仍走统一解析器,以便配了 CDN 时口径一致 */}
        <img
          className={styles.portrait}
          src={portraitCandidates(card.id)[0]}
          alt={card.name.zh}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className={styles.cardName}>{pick(card.name)}</div>
      <div className={styles.statsRow}>
        <span className={styles.attack}>{card.attack}</span>
        <span className={`${styles.rarity} ${styles[card.rarity]}`} />
        <span className={styles.health}>{card.health}</span>
      </div>
    </div>
  )
}

// 可选卡组 = 预组 + 自组;AI 恒拿一套预组。
function buildMatchArgs(decks: DeckList[], myDeckIndex: number): StartMatchArgs {
  if (decks.length >= 1 && PRECON_DECKS.length >= 1) {
    const mine = decks[myDeckIndex % decks.length]
    const ai = PRECON_DECKS[(myDeckIndex + 1) % PRECON_DECKS.length]
    return {
      heroIds: [mine.heroId, ai.heroId],
      deckIds: [mine.cardIds.slice(), ai.cardIds.slice()],
      deckKey: deckKey(mine.heroId, mine.cardIds),
    }
  }
  return {
    heroIds: [HEROES[0]?.id ?? 'liu-bei', HEROES[1]?.id ?? 'cao-cao'],
    deckIds: [quickDeck(), quickDeck()],
  }
}

// 单机 AI 四档,称谓取自军中资历。
// 天機(MCTS)已下架 —— 三次实测对军神都是 52-53%(z<1),而慢 3 倍。
// 理由与数据见 settingsStore 的 Difficulty 与 ai/greedy.ts 的 AI_LEVELS.oracle。
// 军神多一层整回合规划,能看见「先亏一步再赚回来」的组合 —— 对名将实测 71.7%。
// 天機换的不是深度而是**预算怎么分配**:军神的最好优先排序会把
// 「第一步最差、三步后最好」的线永久饿死,UCT 不会 —— 对军神实测 58.3%。
const DIFFICULTIES: { key: Difficulty; name: LocalizedText }[] = [
  { key: 'recruit', name: { zh: '新兵', en: 'Recruit' } },
  { key: 'veteran', name: { zh: '宿将', en: 'Veteran' } },
  { key: 'general', name: { zh: '名将', en: 'Legend' } },
  { key: 'marshal', name: { zh: '军神', en: 'Marshal' } },
]

type NavTarget =
  | 'collection'
  | 'deckbuilder'
  | 'replays'
  | 'settings'
  | 'arena'
  | 'campaign'
  | 'history'
  | 'tower'
  | 'lore'
  | 'quiz'
  | 'codex'
  | 'expedition'
  | 'brawl'
  | 'lethal'
  | 'practice'
  | 'bossrush'
  | 'study'

interface TitleScreenProps {
  onStart?: () => void
  onNavigate?: (screen: NavTarget) => void
}

export function TitleScreen({ onStart, onNavigate }: TitleScreenProps) {
  const t = useT()
  const pick = usePickText()
  const { language, setLanguage, soundEnabled, setSoundEnabled, difficulty, setDifficulty } =
    useSettings()
  const customDecks = useCollection((s) => s.customDecks)
  const packs = useCollection((s) => s.packs)
  const deckRecords = useDeckStats((s) => s.records)
  const arenaLive = useArena((s) => s.phase !== 'idle')
  const campaignDone = useCampaign((s) => s.cleared.length)
  const historyDone = useHistory((s) => s.cleared.length)
  const towerBest = useTower((s) => s.best)
  const campaignAllCleared = useCampaign((s) => s.cleared.length >= BOSSES.length)
  const wins = useCollection((s) => s.wins)
  const losses = useCollection((s) => s.losses)
  const { merit, rank, next: nextRank } = useWarMerit()

  // 连日到营:今天第一次打开时签到。放在标题页而不是某个面板里 ——
  // 它奖励的是「回来」这件事本身,不该要求玩家再点一下才生效。
  const [streakToast, setStreakToast] = useState<string | null>(null)
  useEffect(() => {
    const r = useStreak.getState().checkIn()
    if (!r.isNew || r.merit <= 0) return
    setStreakToast(
      t(`連日到營 ${r.streak} 天 —— 功勳 +${r.merit}`, `${r.streak} days running — +${r.merit} merit`),
    )
    const timer = window.setTimeout(() => setStreakToast(null), 4200)
    return () => window.clearTimeout(timer)
    // 只在挂载时签一次
  }, [t])

  // 订阅 stats/claimed 而不是调 claimableCount() —— 后者不是响应式的
  const achStats = useAchievements((s) => s.stats)
  const achClaimed = useAchievements((s) => s.claimed)
  const achClaimable = ACHIEVEMENTS.filter(
    (a) => !achClaimed.includes(a.id) && (achStats[a.stat] ?? 0) >= a.goal,
  ).length
  const [deckIndex, setDeckIndex] = useState(0)
  const [startError, setStartError] = useState<string | null>(null)
  const [packsOpen, setPacksOpen] = useState(false)
  const [ladderOpen, setLadderOpen] = useState(false)
  const [remoteOpen, setRemoteOpen] = useState(false)
  const [pendingSession] = useState(() => loadSession() !== null)
  const [questsOpen, setQuestsOpen] = useState(false)
  const [dailyGenOpen, setDailyGenOpen] = useState(false)
  const dailyGenSeen = useDailyGeneral((s) => s.lastSeen)
  const dailyGenNew = dailyGenSeen !== dayKey()
  const [achOpen, setAchOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [offerTutorial, setOfferTutorial] = useState(() => shouldOfferTutorial())
  const resumeRemoteMatch = useMatch((s) => s.resumeRemoteMatch)
  const quests = useQuests((s) => s.quests)
  const claimable = quests.filter((q) => !q.claimed && q.progress >= q.goal).length
  const dynastyCount = new Set(CARDS.map((c) => c.dynasty)).size
  const gallery = SIGNATURE_IDS.map((id) => CARDS_BY_ID[id]).filter(Boolean)
  // 渐进解锁的两个计数(见 content/unlocks.ts)。两个都是玩家自然会累积的量,
  // 不需要他知道解锁条件存在 —— 顺着最显眼的「群雄逐鹿」打,模式会依次自己亮。
  const unlockProgress = useMemo(
    () => ({ matches: wins + losses, campaignCleared: campaignDone }),
    [wins, losses, campaignDone],
  )
  // 微视差。精确指针设备跟指针;触屏(pointermove 只在按住拖动时才有,
  // 那时玩家正在点按钮)改跟**滚动**:标题页够长,滚到长廊时底图缓缓退后,
  // 一样能读出「布景在牌匾后面」的层次。两条通道喂同一对 --par 变量。
  const [par, setPar] = useState({ x: 0, y: 0 })
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (matchMedia('(pointer: fine)').matches) {
      const onMove = (e: PointerEvent) => {
        setPar({
          x: (e.clientX / window.innerWidth - 0.5) * -20,
          y: (e.clientY / window.innerHeight - 0.5) * -14,
        })
      }
      window.addEventListener('pointermove', onMove)
      return () => window.removeEventListener('pointermove', onMove)
    }
    // 触屏:滚动视差(rAF 节流 —— scroll 事件密,直接 setState 会抖)
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        setPar({ x: 0, y: Math.min(28, window.scrollY * 0.05) })
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const selectableDecks = useMemo(
    () => [...PRECON_DECKS, ...customDecks],
    [customDecks],
  )
  const hasPrecons = selectableDecks.length >= 2

  useEffect(() => {
    initSound()
    // 音乐要等一次用户手势才能真正出声(iOS 的 AudioContext 规则)——
    // startMusic 内部会 resume,首次点击任意按钮时自然就响了。
    startMusic('title')
    return () => stopMusic()
  }, [])

  const onPlay = () => {
    playSfx('buttonTap')
    try {
      launchMatch(buildMatchArgs(selectableDecks, deckIndex))
      setStartError(null)
      onStart?.()
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e))
    }
  }

  const onTutorial = () => {
    playSfx('buttonTap')
    setOfferTutorial(false)
    try {
      launchMatch({ ...tutorialMatchArgs(), tutorial: true })
      setStartError(null)
      onStart?.()
    } catch (e) {
      setStartError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={styles.screen}>
      {/* 英雄图微视差:指针在屏幕上移动时,底图朝**反方向**微移。
          幅度只有 ±10px —— 它不该被注意到,只该让这一屏不像一张贴纸。
          用 CSS 变量喂给已有的 bgDrift 动画所在的元素,不新增图层。 */}
      <div
        className={styles.bg}
        aria-hidden="true"
        style={{ '--par-x': `${par.x}px`, '--par-y': `${par.y}px` } as CSSProperties}
      />
      <div className={styles.bgVignette} aria-hidden="true" />

      <header className={styles.masthead}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>千古名将</h1>
          <span className={styles.seal} aria-hidden="true">
            <span>名</span>
            <span>将</span>
          </span>
        </div>
        <p className={styles.subtitle}>Legends of the Ages</p>
        {/* 军衔:标题页有二十几个入口,每个都发自己的进度,
            而没有任何一样东西回答「我在这个游戏里走到哪儿了」。
            战功把每一种胜利都折进来,权重按**这一局有多难**给。 */}
        {streakToast && <div className={styles.streakToast}>{streakToast}</div>}
        <div className={styles.rankRow} title={t(`累计战功 ${merit}`, `${merit} war merit`)}>
          <span className={styles.rankName}>{pick(rank.rank.name)}</span>
          {nextRank && (
            <span className={styles.rankBar}>
              <span className={styles.rankFill} style={{ width: `${Math.round(nextRank.ratio * 100)}%` }} />
            </span>
          )}
          <span className={styles.rankNext}>
            {nextRank
              ? t(`距${pick(rank.next!.name)}还差 ${nextRank.need}`, `${nextRank.need} to ${pick(rank.next!.name)}`)
              : t('已至極位', 'At the summit')}
          </span>
        </div>
        <div className={styles.rule} aria-hidden="true">
          <span className={styles.ruleDiamond} />
        </div>
        <p className={styles.tagline}>
          {t(
            `全卡池 ${CARDS.length} 张 · 横跨 ${dynastyCount} 个朝代阵营`,
            `${CARDS.length} cards across ${dynastyCount} dynasties`,
          )}
        </p>
      </header>

      {hasPrecons && (
        <div className={styles.deckRow}>
          {selectableDecks.map((deck, i) => (
            <button
              key={`${deck.heroId}-${deck.name.zh}-${i}`}
              className={i === deckIndex ? styles.deckActive : styles.deckBtn}
              onClick={() => {
                playSfx('buttonTap')
                setDeckIndex(i)
              }}
            >
              {pick(deck.name)}
            </button>
          ))}
        </div>
      )}

      {hasPrecons &&
        (() => {
          const sel = selectableDecks[deckIndex]
          if (!sel) return null
          const rec = deckRecords[deckKey(sel.heroId, sel.cardIds)] ?? { wins: 0, losses: 0, draws: 0 }
          const wr = winRate(rec)
          return (
            <div className={styles.deckRecord}>
              {wr === null
                ? t('本套卡组:暂无战绩', 'This deck: no record yet')
                : t(
                    `本套卡组:${rec.wins} 胜 ${rec.losses} 负${rec.draws ? ` ${rec.draws} 平` : ''} · 胜率 ${wr}%`,
                    `This deck: ${rec.wins}W ${rec.losses}L${rec.draws ? ` ${rec.draws}D` : ''} · ${wr}% win rate`,
                  )}
            </div>
          )
        })()}

      {offerTutorial && (
        <div className={styles.tutorialInvite}>
          <span className={styles.inviteText}>
            {t('初次执掌兵符?先走一遍教学对局。', 'First time? Take the guided match first.')}
          </span>
          <button className={styles.inviteBtn} onClick={onTutorial}>
            {t('开始教学', 'Start Tutorial')}
          </button>
          <button className={styles.inviteDismiss} onClick={() => setOfferTutorial(false)}>
            {t('不必', 'No thanks')}
          </button>
        </div>
      )}

      <div className={styles.playRow}>
        <button className={styles.playButton} onClick={onPlay}>
          {t('开始对战', 'Play')}
        </button>
        <button className={styles.remoteButton} onClick={onTutorial}>
          {t('新手教程', 'Tutorial')}
        </button>
        <button
          className={styles.remoteButton}
          onClick={() => {
            playSfx('buttonTap')
            setRemoteOpen(true)
          }}
        >
          {t('联机对战', 'Online')}
        </button>
        {pendingSession && (
          <button
            className={styles.remoteButton}
            onClick={() => {
              playSfx('buttonTap')
              if (resumeRemoteMatch()) onStart?.()
            }}
          >
            {t('回到对局', 'Rejoin Match')}
          </button>
        )}
      </div>

      {/* 大厅分组:标题页此前是一面**二十来个按钮的墙**,平铺在一个 flex 里 ——
          新玩家读不出「哪个是主线、哪个是每日、哪个只是查东西」,
          老玩家每次要找某个入口都得整片扫一遍。
          按「征战 / 较技 / 典藏 / 日常」四组分开,顺序也是新玩家该走的顺序。 */}
      <div className={styles.navGroup}>{t('征戰', 'Campaigns')}</div>
      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('campaign' as ModeKey)
            onNavigate?.('campaign')
          }}
        >
          {campaignDone < BOSSES.length
            ? t(`群雄逐鹿 ${campaignDone}/${BOSSES.length}`, `Contenders ${campaignDone}/${BOSSES.length}`)
            : t('群雄逐鹿 ✦', 'Contenders ✦')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('history' as ModeKey)
            onNavigate?.('history')
          }}
        >
          {historyDone < HISTORY_BATTLES.length
            ? t(`名局重现 ${historyDone}/${HISTORY_BATTLES.length}`, `Great Battles ${historyDone}/${HISTORY_BATTLES.length}`)
            : t('名局重现 ✦', 'Great Battles ✦')}
        </button>
      </div>

      <div className={styles.navGroup}>{t('對局', 'Ways to Play')}</div>
      <div className={styles.navRow}>
        <ModeBtn mode="arena" progress={unlockProgress} onNavigate={onNavigate} glow={arenaLive}>
          {arenaLive ? t('校场 · 进行中', 'Arena · in progress') : t('校场点将', 'Arena')}
        </ModeBtn>
        <ModeBtn mode="tower" progress={unlockProgress} onNavigate={onNavigate}>
          {towerBest > 0 ? t(`登楼 · ${towerBest} 层`, `Tower · ${towerBest}`) : t('登楼', 'Tower')}
        </ModeBtn>
        {/* 群雄连斩:冒险全通之后才露出来 —— 它问的是「你的卡组撑不撑得住十六场」,
            在还没走完一遍十六关之前问这个没有意义。 */}
        {campaignAllCleared && (
          <button
            className={styles.navBtn}
            onClick={() => {
              playSfx('buttonTap')
              countMode('bossrush' as ModeKey)
              onNavigate?.('bossrush')
            }}
          >
            {t('群雄连斩', 'Gauntlet')}
          </button>
        )}
        <ModeBtn mode="expedition" progress={unlockProgress} onNavigate={onNavigate}>
          {t('远征逐鹿', 'Expedition')}
        </ModeBtn>
        <ModeBtn mode="brawl" progress={unlockProgress} onNavigate={onNavigate}>
          {t('群雄乱斗', 'Brawl')}
        </ModeBtn>
        <ModeBtn mode="lethal" progress={unlockProgress} onNavigate={onNavigate}>
          {t('斩杀谜题', 'Lethal Puzzles')}
        </ModeBtn>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('practice' as ModeKey)
            onNavigate?.('practice')
          }}
        >
          {t('演武场', 'Training')}
        </button>
      </div>

      <div className={styles.navGroup}>{t('典藏', 'Collection')}</div>
      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('lore' as ModeKey)
            onNavigate?.('lore')
          }}
        >
          {t('名将列传', 'Chronicles')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('quiz' as ModeKey)
            onNavigate?.('quiz')
          }}
        >
          {t('稽古', 'Quiz')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('codex' as ModeKey)
            onNavigate?.('codex')
          }}
        >
          {t('兵法讲堂', 'Codex')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('collection' as ModeKey)
            onNavigate?.('collection')
          }}
        >
          {t('名将图鉴', 'Collection')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('deckbuilder' as ModeKey)
            onNavigate?.('deckbuilder')
          }}
        >
          {t('组建卡组', 'Deck Builder')}
        </button>
        <button
          className={`${styles.navBtn} ${packs > 0 ? styles.navGlow : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setPacksOpen(true)
          }}
        >
          {t(`卡包 ×${packs}`, `Packs ×${packs}`)}
        </button>
      </div>

      <div className={styles.navGroup}>{t('日常', 'Daily')}</div>
      <div className={styles.navRow}>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            setLadderOpen(true)
          }}
        >
          {t('群雄榜', 'Ladder')}
        </button>
        {/* 书房:进度散落在八个 store 里,每个只在自己那一屏露出 ——
            没有任何一屏能回答「我玩了多少」。军衔给总分,书房给明细。 */}
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            onNavigate?.('study')
          }}
        >
          {t('書房', 'The Study')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            countMode('replays' as ModeKey)
            onNavigate?.('replays')
          }}
        >
          {t('战报回放', 'Replays')}
        </button>
        <button
          className={`${styles.navBtn} ${dailyGenNew ? styles.navGlow : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setDailyGenOpen(true)
          }}
        >
          {dailyGenNew ? t('每日一将 ●', 'Daily General ●') : t('每日一将', 'Daily General')}
        </button>
        <button
          className={`${styles.navBtn} ${claimable > 0 ? styles.navGlow : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setQuestsOpen(true)
          }}
        >
          {claimable > 0 ? t(`军令 ●${claimable}`, `Orders ●${claimable}`) : t('每日军令', 'Daily Orders')}
        </button>
        <button
          className={`${styles.navBtn} ${achClaimable > 0 ? styles.navGlow : ''}`}
          onClick={() => {
            playSfx('buttonTap')
            setAchOpen(true)
          }}
        >
          {achClaimable > 0
            ? t(`功名簿 ●${achClaimable}`, `Feats ●${achClaimable}`)
            : t('功名簿', 'Achievements')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            setStatsOpen(true)
          }}
        >
          {t('战绩簿', 'Record')}
        </button>
        <button
          className={styles.navBtn}
          onClick={() => {
            playSfx('buttonTap')
            onNavigate?.('settings')
          }}
        >
          {t('设置', 'Settings')}
        </button>
      </div>
      {startError && (
        <p className={styles.errorLine} role="alert">
          {t('开局失败:', 'Failed to start: ')}
          {startError}
        </p>
      )}

      <div className={styles.langSwitch}>
        {(['zh', 'en', 'both'] as const).map((lang) => (
          <button
            key={lang}
            className={lang === language ? styles.langActive : styles.lang}
            onClick={() => setLanguage(lang)}
          >
            {lang === 'zh' ? '中' : lang === 'en' ? 'EN' : '双'}
          </button>
        ))}
        <button
          className={soundEnabled ? styles.langActive : styles.lang}
          onClick={() => {
            setSoundEnabled(!soundEnabled)
            playSfx('buttonTap')
          }}
          title={t('音效开关', 'Sound on/off')}
        >
          {soundEnabled ? '音' : '静'}
        </button>
      </div>

      {/* 单机 AI 难度:只影响本地对局,联机永远是真人 */}
      <div className={styles.difficultyRow}>
        <span className={styles.difficultyLabel}>{t('敌手', 'Opponent')}</span>
        {DIFFICULTIES.map(({ key, name }) => (
          <button
            key={key}
            className={key === difficulty ? styles.difficultyActive : styles.difficultyBtn}
            onClick={() => {
              playSfx('buttonTap')
              setDifficulty(key)
            }}
          >
            {pick(name)}
          </button>
        ))}
      </div>

      {/* 觀星臺:今夜的天象。放在图鉴长廊**之前** —— 那条长廊是「随便看看」,
          而天象是「今天的情况」,该在往下逛之前先说。 */}
      <div className={styles.starRow}>
        <StarPanel />
      </div>

      <div className={styles.galleryHead} aria-hidden="true">
        <span className={styles.galleryHeadLine} />
        <span className={styles.galleryHeadText}>
          {t(`名将长廊 · ${gallery.length} 位`, `Gallery of Legends · ${gallery.length}`)}
        </span>
        <span className={styles.galleryHeadLine} />
      </div>

      <div
        className={styles.gallery}
        role="region"
        aria-label={t('名将长廊', 'Gallery of legends')}
      >
        {gallery.map((card) => (
          <MiniCard key={card.id} card={card} />
        ))}
      </div>

      {/* 懒加载面板统一挂在一个 Suspense 下:fallback 是 null 而不是转圈 ——
          这些 chunk 都在几十 KB 量级,同源加载通常一帧就到,转圈反而更闪。 */}
      {/* 面板懒加载的等待帧。fallback={null} 意味着点了按钮之后
          有一拍什么都不发生 —— 慢网络上这一拍长到会让人再点一次。 */}
      <Suspense
        fallback={
          <div className={styles.panelWait} aria-hidden="true">
            <span>將</span>
          </div>
        }
      >
        {questsOpen && <QuestPanel onClose={() => setQuestsOpen(false)} />}
        {dailyGenOpen && <DailyGeneralPanel onClose={() => setDailyGenOpen(false)} />}
        {achOpen && <AchievementPanel onClose={() => setAchOpen(false)} />}
        {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}
        {packsOpen && <PackOpening onClose={() => setPacksOpen(false)} />}
        {ladderOpen && <LeaderboardPanel onClose={() => setLadderOpen(false)} />}
        {remoteOpen && selectableDecks.length > 0 && (
          <RemoteMatchPanel
            deck={selectableDecks[deckIndex % selectableDecks.length]}
            onStart={() => {
              setRemoteOpen(false)
              onStart?.()
            }}
            onClose={() => setRemoteOpen(false)}
          />
        )}
      </Suspense>

      {/* 装到主屏。**打过至少一局才问** —— 第一次打开就被要求安装,答案基本
          一定是「不」,而 beforeinstallprompt 一局只给一次机会,浪费掉就没了。 */}
      <InstallPrompt ready={wins + losses >= 1} />
    </div>
  )
}
