import type { ReactNode } from 'react'
import { LESSONS_BY_ID } from './content/lessons'
import { HEROES_BY_ID } from './content/overrides/heroes'
import { launchMatch } from './ui/matchSetup'
import { Suspense, lazy, useLayoutEffect, useRef, useState } from 'react'
import { TitleScreen } from './ui/screens/TitleScreen'
import { ScreenFallback } from './ui/components/ScreenFallback'

// 只有标题页随主包走。
//
// 对战画面从前也是「主路径」跟着主包一起下 —— 但它是全项目最大的一个组件
// (战场 + 手牌扇 + 事件动效 + 军师 + 六个覆盖层),而**首屏永远看不到它**:
// 任何一局都得先从标题页点进去。把它挪成懒加载,首屏少下的那部分是纯赚,
// 而点「开战」时的那一次加载被开场动画完全盖住。
// 图鉴/构筑/回放同理:体量大且不是每次都进。
const MatchScreen = lazy(() =>
  import('./ui/screens/MatchScreen').then((m) => ({ default: m.MatchScreen })),
)
const CollectionScreen = lazy(() =>
  import('./ui/screens/CollectionScreen').then((m) => ({ default: m.CollectionScreen })),
)
const DeckBuilderScreen = lazy(() =>
  import('./ui/screens/DeckBuilderScreen').then((m) => ({ default: m.DeckBuilderScreen })),
)
const ReplayScreen = lazy(() =>
  import('./ui/screens/ReplayScreen').then((m) => ({ default: m.ReplayScreen })),
)
const SettingsScreen = lazy(() =>
  import('./ui/screens/SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const ArenaScreen = lazy(() =>
  import('./ui/screens/ArenaScreen').then((m) => ({ default: m.ArenaScreen })),
)
const CampaignScreen = lazy(() =>
  import('./ui/screens/CampaignScreen').then((m) => ({ default: m.CampaignScreen })),
)
const HistoryScreen = lazy(() =>
  import('./ui/screens/HistoryScreen').then((m) => ({ default: m.HistoryScreen })),
)
const TowerScreen = lazy(() =>
  import('./ui/screens/TowerScreen').then((m) => ({ default: m.TowerScreen })),
)
const LoreScreen = lazy(() =>
  import('./ui/screens/LoreScreen').then((m) => ({ default: m.LoreScreen })),
)
const QuizScreen = lazy(() =>
  import('./ui/screens/QuizScreen').then((m) => ({ default: m.QuizScreen })),
)
const StudyScreen = lazy(() =>
  import('./ui/screens/StudyScreen').then((m) => ({ default: m.StudyScreen })),
)
const BossRushScreen = lazy(() =>
  import('./ui/screens/BossRushScreen').then((m) => ({ default: m.BossRushScreen })),
)
const CodexScreen = lazy(() =>
  import('./ui/screens/CodexScreen').then((m) => ({ default: m.CodexScreen })),
)
const ExpeditionScreen = lazy(() =>
  import('./ui/screens/ExpeditionScreen').then((m) => ({ default: m.ExpeditionScreen })),
)
const BrawlScreen = lazy(() =>
  import('./ui/screens/BrawlScreen').then((m) => ({ default: m.BrawlScreen })),
)
const LethalScreen = lazy(() =>
  import('./ui/screens/LethalScreen').then((m) => ({ default: m.LethalScreen })),
)
const PracticeScreen = lazy(() =>
  import('./ui/screens/PracticeScreen').then((m) => ({ default: m.PracticeScreen })),
)

export type Screen =
  | 'title'
  | 'match'
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
  | 'bossrush'
  | 'study'
  | 'practice'

// 讲堂实练走谜题通道:launchMatch 在这一层调,CodexScreen 只负责说「开哪一课」
export default function App() {
  const [screen, rawSetScreen] = useState<Screen>('title')
  // 离场淡出要用到「导航那一刻」的滚动位置:新屏一挂就会把 body 滚回顶部,
  // 事后再读 window.scrollY 拿到的是新屏的 0,不是旧屏离开时的位置。
  const exitScrollRef = useRef(0)
  const setScreen = (s: Screen) => {
    exitScrollRef.current = window.scrollY
    rawSetScreen(s)
  }
  const back = () => setScreen('title')
  // 竞技场对局打完要回竞技场,而不是回标题页 —— 一轮里要连打好几场
  const [afterMatch, setAfterMatch] = useState<Screen>('title')

  // 换屏转场:进场淡入 + 旧屏淡出,叠成 0.2s 的交叉淡化。
  //
  // 【进场】switch 的每个分支都返回一棵新树,key 一变 React 就重挂 ——
  // 「进场动画」只需要一个带 key 的包一层。
  //
  // 【离场】旧屏**保持原 key** 多活一拍:React 的 keyed 调和会把它认成
  // 同一个实例(状态不丢,渲染的还是玩家刚才看到的那一屏),只是换了
  // 个 fixed 的外壳在新屏上面淡出。0.19s 后卸载。
  // 三条纪律:只动 opacity(transform 会重锚 fixed 后代 —— 认输按钮的老坑);
  // pointer-events: none(一帧都不许拦点击);对局画面不做
  // (退出对局时 store 已重置,旧屏会闪一帧「没有进行中的对局」)。
  const [exiting, setExiting] = useState<Screen | null>(null)
  const prevScreenRef = useRef<Screen>(screen)
  const exitBoxRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const prev = prevScreenRef.current
    if (prev === screen) return
    prevScreenRef.current = screen
    const reduced = document.documentElement.dataset.reducedMotion === 'true'
    if (prev === 'match' || reduced) {
      setExiting(null)
      return
    }
    setExiting(prev)
    // 计时器要盖住**两者里更长的那个**:旧屏淡出 190ms,而墨扫要 420ms。
    // 按 200ms 收的话墨会被拦腰砍断。旧屏在淡出结束后 opacity 恒为 0
    // (animation-fill-mode: both),多挂这 240ms 完全看不见。
    const timer = window.setTimeout(() => setExiting(null), 440)
    return () => window.clearTimeout(timer)
  }, [screen])
  // 旧屏进了 overflow: hidden 的固定壳,把它滚回玩家离开时的位置
  useLayoutEffect(() => {
    if (exiting && exitBoxRef.current) exitBoxRef.current.scrollTop = exitScrollRef.current
  }, [exiting])

  const renderScreen = (s: Screen): ReactNode => {
    switch (s) {
      case 'match':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <MatchScreen onExit={() => setScreen(afterMatch)} />
          </Suspense>
        )
      case 'collection':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <CollectionScreen onBack={back} />
          </Suspense>
        )
      case 'deckbuilder':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <DeckBuilderScreen onBack={back} />
          </Suspense>
        )
      case 'replays':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <ReplayScreen onBack={back} />
          </Suspense>
        )
      case 'settings':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <SettingsScreen onBack={back} />
          </Suspense>
        )
      case 'lore':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <LoreScreen onBack={back} />
          </Suspense>
        )
      case 'quiz':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <QuizScreen onBack={back} />
          </Suspense>
        )
      case 'codex':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <CodexScreen
              onBack={back}
              onStartLesson={(lessonId) => {
                const lesson = LESSONS_BY_ID[lessonId]
                if (!lesson) return
                launchMatch({
                  heroIds: lesson.heroes,
                  deckIds: [[], []],
                  heroPowersOverride: [
                    HEROES_BY_ID[lesson.heroes[0]]?.power,
                    HEROES_BY_ID[lesson.heroes[1]]?.power,
                  ],
                  scenario: lesson.scenario,
                  puzzle: true,
                  puzzleId: lesson.id,
                })
                // 打完回讲堂,而不是回标题页 —— 玩家来这儿是在读手册
                setAfterMatch('codex')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'arena':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <ArenaScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('arena')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'expedition':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <ExpeditionScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('expedition')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'brawl':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <BrawlScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('brawl')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'study':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <StudyScreen onBack={back} />
          </Suspense>
        )
      case 'bossrush':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <BossRushScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('bossrush')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'lethal':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <LethalScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('lethal')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'practice':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <PracticeScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('practice')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'campaign':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <CampaignScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('campaign')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'history':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <HistoryScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('history')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      case 'tower':
        return (
          <Suspense fallback={<ScreenFallback />}>
            <TowerScreen
              onBack={back}
              onEnterMatch={() => {
                setAfterMatch('tower')
                setScreen('match')
              }}
            />
          </Suspense>
        )
      default:
        // 标题页从前不在转场里(唯一的例外)—— 回标题永远是硬切
        return (
          <TitleScreen
            onStart={() => {
              setAfterMatch('title')
              setScreen('match')
            }}
            onNavigate={setScreen}
          />
        )
    }
  }

  return (
    <>
      <div key={screen} className="screen-enter">
        {renderScreen(screen)}
      </div>
      {exiting !== null && exiting !== screen && (
        <div key={exiting} ref={exitBoxRef} className="screen-exit" aria-hidden="true">
          {renderScreen(exiting)}
        </div>
      )}
      {/* 湿墨:换屏时扫过的一道墨。**必须是没有子节点的叶子** ——
          filter 和 transform 一样会重锚 fixed 后代(见上面的转场注释),
          所以它自己在最上层扫过去,不包任何东西。 */}
      {exiting !== null && exiting !== screen && (
        <div key={`ink-${exiting}`} className="ink-wipe" aria-hidden="true" />
      )}
    </>
  )
}
