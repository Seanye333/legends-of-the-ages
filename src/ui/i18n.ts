import type { LocalizedText } from '../engine/types'
import { useSettings } from '../app/settingsStore'

// 与姊妹项目相同的模式:zh 主、en 辅、both 双显
export type Language = 'zh' | 'en' | 'both'

export function pickText(text: LocalizedText, lang: Language): string {
  if (lang === 'zh') return text.zh
  if (lang === 'en') return text.en
  return `${text.zh} · ${text.en}`
}

export function useT(): (zh: string, en: string) => string {
  const lang = useSettings((s) => s.language)
  return (zh, en) => pickText({ zh, en }, lang)
}

export function usePickText(): (text: LocalizedText) => string {
  const lang = useSettings((s) => s.language)
  return (text) => pickText(text, lang)
}
