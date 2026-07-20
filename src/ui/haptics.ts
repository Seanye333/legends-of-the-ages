import { useSettings } from '../app/settingsStore'

// 触感反馈。此前全库零 navigator.vibrate、零 Tauri haptics —— 对一个手机上玩的
// 卡牌游戏来说是很可惜的缺失:出牌落子、斩杀、开出传说这些时刻本来就该有手感。
//
// 三个现实约束:
// 1. iOS Safari **不支持** navigator.vibrate。所以这在 iOS 网页版上是静默无效的,
//    只有 Android 与桌面 Chrome 会震。Tauri 原生的触感要装插件,留待以后。
// 2. 必须跟随「音效开关」——玩家关掉音效多半是在安静场合,这时候震动同样不合时宜。
// 3. 一切调用都吞异常:某些浏览器会在非用户手势里抛。
export type HapticKind = 'tap' | 'play' | 'impact' | 'lethal' | 'reward'

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 8,
  play: 14,
  impact: [0, 18, 26, 18],
  lethal: [0, 30, 40, 60],
  reward: [0, 12, 30, 12, 30, 24],
}

export function haptic(kind: HapticKind): void {
  try {
    if (!useSettings.getState().soundEnabled) return
    const nav = navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }
    nav.vibrate?.(PATTERNS[kind])
  } catch {
    /* 不支持或被策略拦截 —— 静默 */
  }
}
