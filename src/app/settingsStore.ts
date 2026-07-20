import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

// 单机 AI 难度。名字取自兵法典故,对应 greedy.ts 的失误概率。
export type Difficulty = 'recruit' | 'veteran' | 'general'

interface SettingsState {
  language: Language
  soundEnabled: boolean
  // 音量原来只有开/关。合成音效的响度差别很大(斩杀的轰鸣 vs 出牌的木响),
  // 没有滑块就只能整体关掉。0~1,喂给 sound.ts 的 master gain。
  volume: number
  // 音乐与音效分开:很多人愿意留着出牌反馈但不想要背景乐
  musicEnabled: boolean
  musicVolume: number
  difficulty: Difficulty
  // 减少动效:跟随系统 prefers-reduced-motion,但允许手动覆盖 ——
  // 战斗特效是全站动效最猛的地方,晕动敏感的人需要一个明确的开关。
  reducedMotion: boolean
  setLanguage: (lang: Language) => void
  setSoundEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  setMusicEnabled: (on: boolean) => void
  setMusicVolume: (v: number) => void
  setDifficulty: (d: Difficulty) => void
  setReducedMotion: (on: boolean) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      language: 'zh',
      soundEnabled: true,
      volume: 0.85,
      musicEnabled: true,
      musicVolume: 0.6,
      difficulty: 'veteran',
      reducedMotion: false,
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume: Math.max(0, Math.min(1, musicVolume)) }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
    }),
    { name: 'qiangu-settings' },
  ),
)
