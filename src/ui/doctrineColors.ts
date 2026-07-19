import type { CardDef, Keyword } from '../engine/types'

// 六主义 + 中立的主题色。标题画面与对战画面共用。
export const DOCTRINE_COLORS: Record<CardDef['doctrine'], string> = {
  royal: '#d4a84a',
  hegemonic: '#b8442e',
  ritual: '#88b7e8',
  fame: '#c19a3b',
  separatist: '#7a5a3a',
  reclusion: '#7a9a5a',
  neutral: '#8a8a8a',
}

// 词条徽章(单字)与全称
export const KEYWORD_BADGE: Record<Keyword, string> = {
  charge: '冲',
  rush: '突',
  guard: '守',
  windfury: '连',
  duel: '单',
}

export const KEYWORD_ZH: Record<Keyword, string> = {
  charge: '冲锋',
  rush: '突袭',
  guard: '守护',
  windfury: '连击',
  duel: '单挑',
}

export const DOCTRINE_ZH: Record<CardDef['doctrine'], string> = {
  royal: '王道',
  hegemonic: '霸道',
  ritual: '礼教',
  fame: '名利',
  separatist: '割据',
  reclusion: '隐逸',
  neutral: '中立',
}
