import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

interface SettingsState {
  language: Language
  soundEnabled: boolean
  setLanguage: (lang: Language) => void
  setSoundEnabled: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'zh',
      soundEnabled: true,
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: 'qiangu-settings' },
  ),
)
