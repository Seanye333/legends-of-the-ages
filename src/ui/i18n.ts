import type { LocalizedText } from '../engine/types'
import { useSettings } from '../app/settingsStore'
import { toSimplified } from './zhVariant'

// 与姊妹项目相同的模式:zh 主、en 辅、both 双显
export type Language = 'zh' | 'en' | 'both'

export function pickText(text: LocalizedText, lang: Language): string {
  if (lang === 'zh') return text.zh
  if (lang === 'en') return text.en
  return `${text.zh} · ${text.en}`
}

// 紧凑位(徽章/铭牌/浮字/标题栏):'both' 下并排会撑破布局,统一跟随中文。
export function pickCompact(text: LocalizedText, lang: Language): string {
  return lang === 'en' ? text.en : text.zh
}

// 字形收口。
//
// **只对最终输出做一次**,不在各处调用点转 —— 卡池文案经过的路径太多
// (卡面、详情、战报、图鉴、列传、导出的图),漏掉一处就会在同一屏里
// 出现半繁半简。放在 pickText / pickCompact 里,所有读文案的地方自动覆盖。
//
// 界面文案(t() 的第一个参数)本来就是简体,转一遍是恒等的 ——
// 所以这里不必区分「这段文字是哪来的」,一律过一遍就好。
function variant(s: string, mode: 'trad' | 'simp'): string {
  return mode === 'simp' ? toSimplified(s) : s
}

export function useT(): (zh: string, en: string) => string {
  const lang = useSettings((s) => s.language)
  const zhv = useSettings((s) => s.zhVariant)
  return (zh, en) => variant(pickText({ zh, en }, lang), zhv)
}

export function usePickText(): (text: LocalizedText) => string {
  const lang = useSettings((s) => s.language)
  const zhv = useSettings((s) => s.zhVariant)
  return (text) => variant(pickText(text, lang), zhv)
}

export function usePickCompact(): (text: LocalizedText) => string {
  const lang = useSettings((s) => s.language)
  const zhv = useSettings((s) => s.zhVariant)
  return (text) => variant(pickCompact(text, lang), zhv)
}

export function useLang(): Language {
  return useSettings((s) => s.language)
}
