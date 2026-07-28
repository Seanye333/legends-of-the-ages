import type { LocalizedText } from '../engine/types'

// 卡背 —— 最便宜的一种「看得见的成就」。
//
// 【为什么值得做】
// 这个游戏的奖励目前只有两种:功勋(变成卡)与卡包(变成卡)。
// 两者都最终落回**卡池**,于是「我打通了第三章」这件事在牌桌上是**不可见的**。
// 卡背是唯一一样**对手也看得见**的东西 —— 它把成就从数字变成了一句可以被看到的话。
//
// 【为什么全部程序生成】
// 六张手绘卡背是六张图,而包体红线 150MB 里立绘已经占了 65MB。
// CSS 渐变 + 图案能做出足够体面的东西,而且**零字节**。
// 与音乐转调、战场色温同一个思路:用一行换掉一整套素材。
//
// 【解锁条件用「已经在记的东西」】
// 不新开统计:军衔(战功)、冒险通关数、连斩最远、收藏数 —— 全是既有的。
// 加一个新统计意味着又要在 achievement.test 那道闸门里登记一次,不值当。
export interface CardBack {
  id: string
  name: LocalizedText
  css: string // 直接塞进 style.background
  unlock: {
    kind: 'default' | 'rank' | 'campaign' | 'gauntlet' | 'collection'
    at: number
  }
  hint: LocalizedText
}

export const CARD_BACKS: CardBack[] = [
  {
    id: 'back-default',
    name: { zh: '素麻', en: 'Plain Hemp' },
    css: 'linear-gradient(150deg, #3a2f1c, #1d1710)',
    unlock: { kind: 'default', at: 0 },
    hint: { zh: '初始卡背', en: 'Available from the start' },
  },
  {
    id: 'back-vermilion',
    name: { zh: '朱漆', en: 'Vermilion Lacquer' },
    css: 'radial-gradient(circle at 30% 25%, #8a2f24, #4a1610 70%)',
    unlock: { kind: 'rank', at: 3 },
    hint: { zh: '軍銜達校尉', en: 'Reach the rank of Colonel' },
  },
  {
    id: 'back-bronze',
    name: { zh: '青銅', en: 'Bronze' },
    css: 'linear-gradient(135deg, #4a5f4a 0%, #2b3a2e 50%, #3f5245 100%)',
    unlock: { kind: 'campaign', at: 8 },
    hint: { zh: '通关冒险第一章', en: 'Clear the first chapter' },
  },
  {
    id: 'back-ink',
    name: { zh: '水墨', en: 'Ink Wash' },
    css: 'linear-gradient(200deg, #2a2a30 0%, #14141a 60%, #23232b 100%)',
    unlock: { kind: 'collection', at: 600 },
    hint: { zh: '收藏 600 张', en: 'Own 600 different cards' },
  },
  {
    id: 'back-gold',
    name: { zh: '鎏金', en: 'Gilt' },
    css: 'linear-gradient(140deg, #6b5220 0%, #d4a84a 45%, #6b5220 100%)',
    unlock: { kind: 'campaign', at: 24 },
    hint: { zh: '通关冒险全部三章', en: 'Clear all three chapters' },
  },
  {
    id: 'back-obsidian',
    name: { zh: '玄鐵', en: 'Obsidian Iron' },
    css: 'linear-gradient(160deg, #16181d 0%, #2c3138 40%, #0d0e11 100%)',
    unlock: { kind: 'gauntlet', at: 16 },
    hint: { zh: '群雄連斬走通一次', en: 'Walk the Gauntlet end to end' },
  },
]

export const CARD_BACKS_BY_ID: Record<string, CardBack> = Object.fromEntries(
  CARD_BACKS.map((b) => [b.id, b]),
)

export interface BackProgress {
  rankIndex: number
  campaignCleared: number
  gauntletBest: number
  collectionSize: number
}

export function isBackUnlocked(back: CardBack, p: BackProgress): boolean {
  switch (back.unlock.kind) {
    case 'default':
      return true
    case 'rank':
      return p.rankIndex >= back.unlock.at
    case 'campaign':
      return p.campaignCleared >= back.unlock.at
    case 'gauntlet':
      return p.gauntletBest >= back.unlock.at
    case 'collection':
      return p.collectionSize >= back.unlock.at
  }
}

export function backCss(id: string | undefined): string {
  return CARD_BACKS_BY_ID[id ?? 'back-default']?.css ?? CARD_BACKS[0].css
}
