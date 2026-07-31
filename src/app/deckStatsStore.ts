import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { deckKey } from '../content/decks'
import { safeStorage } from './safeStorage'

// 卡组胜率:每套构筑卡组的胜/负/和累计。按内容哈希(deckKey)归档 ——
// 改名延续、改牌另起。只记**你带着自己卡组打的普通对局**(随便打);
// 竞技场/冒险/远征/教学/演武用的不是「你的构筑」,不进这里。
export interface DeckRecord {
  wins: number
  losses: number
  draws: number
}

const EMPTY: DeckRecord = { wins: 0, losses: 0, draws: 0 }

interface DeckStatsState {
  records: Record<string, DeckRecord>
  record(key: string, result: 'win' | 'loss' | 'draw'): void
  forDeck(heroId: string, cardIds: string[]): DeckRecord
  reset(): void
}

export const useDeckStats = create<DeckStatsState>()(
  persist(
    (set, get) => ({
      records: {},

      record(key, result) {
        const cur = get().records[key] ?? EMPTY
        const next: DeckRecord = {
          wins: cur.wins + (result === 'win' ? 1 : 0),
          losses: cur.losses + (result === 'loss' ? 1 : 0),
          draws: cur.draws + (result === 'draw' ? 1 : 0),
        }
        set({ records: { ...get().records, [key]: next } })
      },

      forDeck(heroId, cardIds) {
        return get().records[deckKey(heroId, cardIds)] ?? EMPTY
      },

      reset() {
        set({ records: {} })
      },
    }),
    { name: 'qiangu-deckstats', storage: safeStorage },
  ),
)

// 胜率百分比(无对局返回 null,让 UI 显示「暂无」)
export function winRate(r: DeckRecord): number | null {
  const played = r.wins + r.losses + r.draws
  return played === 0 ? null : Math.round((r.wins / played) * 100)
}
