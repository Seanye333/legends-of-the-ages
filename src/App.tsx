import { Suspense, lazy, useState } from 'react'
import { TitleScreen } from './ui/screens/TitleScreen'
import { MatchScreen } from './ui/screens/MatchScreen'
import { ScreenFallback } from './ui/components/ScreenFallback'

// 标题与对战是主路径,随主包走;图鉴/构筑/回放体量大且不是每次都进,按需加载。
// 图鉴要渲染两千余张卡、构筑器带全套校验、回放自带播放器,都不该拖慢首屏。
const CollectionScreen = lazy(() =>
  import('./ui/screens/CollectionScreen').then((m) => ({ default: m.CollectionScreen })),
)
const DeckBuilderScreen = lazy(() =>
  import('./ui/screens/DeckBuilderScreen').then((m) => ({ default: m.DeckBuilderScreen })),
)
const ReplayScreen = lazy(() =>
  import('./ui/screens/ReplayScreen').then((m) => ({ default: m.ReplayScreen })),
)

export type Screen = 'title' | 'match' | 'collection' | 'deckbuilder' | 'replays'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  const back = () => setScreen('title')

  switch (screen) {
    case 'match':
      return <MatchScreen onExit={back} />
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
    default:
      return <TitleScreen onStart={() => setScreen('match')} onNavigate={setScreen} />
  }
}
