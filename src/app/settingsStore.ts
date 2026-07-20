import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

// 单机 AI 难度。名字取自兵法典故,对应 greedy.ts 的失误概率。
export type Difficulty = 'recruit' | 'veteran' | 'general'

interface SettingsState {
  language: Language
  soundEnabled: boolean
  difficulty: Difficulty
  setLanguage: (lang: Language) => void
  setSoundEnabled: (on: boolean) => void
  setDifficulty: (d: Difficulty) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'zh',
      soundEnabled: true,
      difficulty: 'veteran',
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setDifficulty: (difficulty) => set({ difficulty }),
    }),
    { name: 'qiangu-settings' },
  ),
)
