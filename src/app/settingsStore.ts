import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

interface SettingsState {
  language: Language
  setLanguage: (lang: Language) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'zh',
      setLanguage: (language) => set({ language }),
    }),
    { name: 'qiangu-settings' },
  ),
)
