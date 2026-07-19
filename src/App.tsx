import { useState } from 'react'
import { TitleScreen } from './ui/screens/TitleScreen'
import { MatchScreen } from './ui/screens/MatchScreen'
import { CollectionScreen } from './ui/screens/CollectionScreen'
import { DeckBuilderScreen } from './ui/screens/DeckBuilderScreen'

export type Screen = 'title' | 'match' | 'collection' | 'deckbuilder'

export default function App() {
  const [screen, setScreen] = useState<Screen>('title')
  switch (screen) {
    case 'match':
      return <MatchScreen onExit={() => setScreen('title')} />
    case 'collection':
      return <CollectionScreen onBack={() => setScreen('title')} />
    case 'deckbuilder':
      return <DeckBuilderScreen onBack={() => setScreen('title')} />
    default:
      return <TitleScreen onStart={() => setScreen('match')} onNavigate={setScreen} />
  }
}
