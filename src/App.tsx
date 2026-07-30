import type { ReactNode } from 'react'
import { LESSONS_BY_ID } from './content/lessons'
import { HEROES_BY_ID } from './content/overrides/heroes'
import { launchMatch } from './ui/matchSetup'
import { Suspense, lazy, useState } from 'react'
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
  const [screen, setScreen] = useState<Screen>('title')
  const back = () => setScreen('title')
  // 竞技场对局打完要回竞技场,而不是回标题页 —— 一轮里要连打好几场
  const [afterMatch, setAfterMatch] = useState<Screen>('title')

  // 换屏转场。
  //
  // 【为什么之前一条都没有】
  // 这里是一个 switch,直接换组件 —— 旧屏在同一帧消失、新屏在同一帧出现,
  // 中间没有任何东西。硬切在**任何**导航里都读起来像页面重载:
  // 玩家分不出「我点到了别处」和「它卡了一下」。
  //
  // 【为什么用 key 而不是动画库】
  // 这个 switch 的每一个分支都返回一棵新树,而 React 只要 key 变了就会重挂 ——
  // 于是「进场动画」只需要一个带 key 的包一层,连状态都不用加。
  // 一个动画库(几十 KB)在这里能多做的只有**离场**动画,
  // 而离场需要把旧屏留在 DOM 里,那要改的是这个 switch 本身的形状。
  // 只做进场:0.22s 的淡入 + 极小的上移,足够把「换了一屏」说清楚。
  const wrap = (node: ReactNode) => (
    <div key={screen} className="screen-enter">
      {node}
    </div>
  )

  switch (screen) {
    case 'match':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <MatchScreen onExit={() => setScreen(afterMatch)} />
        </Suspense>
      )
    case 'collection':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <CollectionScreen onBack={back} />
        </Suspense>
      )
    case 'deckbuilder':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <DeckBuilderScreen onBack={back} />
        </Suspense>
      )
    case 'replays':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <ReplayScreen onBack={back} />
        </Suspense>
      )
    case 'settings':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <SettingsScreen onBack={back} />
        </Suspense>
      )
    case 'lore':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <LoreScreen onBack={back} />
        </Suspense>
      )
    case 'quiz':
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <QuizScreen onBack={back} />
        </Suspense>
      )
    case 'codex':
      return wrap(
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
      return wrap(
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
      return wrap(
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
      return wrap(
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
      return wrap(
        <Suspense fallback={<ScreenFallback />}>
          <StudyScreen onBack={back} />
        </Suspense>
      )
    case 'bossrush':
      return wrap(
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
      return wrap(
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
      return wrap(
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
      return wrap(
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
      return wrap(
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
      return wrap(
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
