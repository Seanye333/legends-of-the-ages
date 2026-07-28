import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Language } from '../ui/i18n'

// 单机 AI 难度。名字取自兵法典故,对应 greedy.ts 的失误概率。
// 四档:新兵 / 宿将 / 名将 / 军神。
// 军神在名将之上多一层**整回合规划**(ai/planner.ts)——
// 实测 120 局对打 71.7% 胜率,不是换皮。
export type Difficulty = 'recruit' | 'veteran' | 'general' | 'marshal'

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
  // 卡背:唯一一样**对手也看得见**的成就展示(见 content/cardBacks.ts)
  cardBack: string
  setLanguage: (lang: Language) => void
  setSoundEnabled: (on: boolean) => void
  setVolume: (v: number) => void
  setMusicEnabled: (on: boolean) => void
  setMusicVolume: (v: number) => void
  setDifficulty: (d: Difficulty) => void
  setReducedMotion: (on: boolean) => void
  setCardBack: (id: string) => void
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
      cardBack: 'back-default',
      setLanguage: (language) => set({ language }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),
      setMusicEnabled: (musicEnabled) => set({ musicEnabled }),
      setMusicVolume: (musicVolume) => set({ musicVolume: Math.max(0, Math.min(1, musicVolume)) }),
      setDifficulty: (difficulty) => set({ difficulty }),
      setReducedMotion: (reducedMotion) => set({ reducedMotion }),
      setCardBack: (cardBack) => set({ cardBack }),
    }),
    { name: 'qiangu-settings' },
  ),
)
