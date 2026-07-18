import { useState } from 'react'
import { TitleScreen } from './ui/screens/TitleScreen'
import { MatchScreen } from './ui/screens/MatchScreen'

export default function App() {
  const [screen, setScreen] = useState<'title' | 'match'>('title')
  return screen === 'match' ? (
    <MatchScreen onExit={() => setScreen('title')} />
  ) : (
    <TitleScreen onStart={() => setScreen('match')} />
  )
}
