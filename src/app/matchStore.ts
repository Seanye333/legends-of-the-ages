import { create } from 'zustand'
import type { Command, GameEvent, GameState } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import type { CardDef, Doctrine } from '../engine/types'
import { CARDS, CARDS_BY_ID } from '../content/cards'
import { LocalMatch } from './transport'
import { AI_NORMAL } from '../ai/greedy'

export interface StartMatchArgs {
  heroIds: [string, string]
  deckIds: [string[], string[]]
  seed?: number
}

interface MatchStoreState {
  match: LocalMatch | null
  state: GameState | null
  lastEvents: GameEvent[]
  error: string | null
  startMatch(args: StartMatchArgs): void
  send(cmd: Command): void
  reset(): void
}

export const useMatch = create<MatchStoreState>()((set, get) => ({
  match: null,
  state: null,
  lastEvents: [],
  error: null,

  startMatch(args) {
    // 应用层允许非确定性;引擎内部只吃这里传进去的种子
    const seed = args.seed ?? Math.floor(Math.random() * 0x7fffffff)
    const first = (seed & 1) as 0 | 1
    const match = new LocalMatch(
      { seed, heroIds: args.heroIds, deckIds: args.deckIds, first },
      CARDS_BY_ID,
      AI_NORMAL,
    )
    const { state, events } = match.start()
    set({ match, state, lastEvents: events, error: null })
  },

  send(cmd) {
    const { match } = get()
    if (!match) return
    const r = match.sendCommand(cmd)
    if ('error' in r) {
      set({ error: r.error })
      return
    }
    const events = r.updates.flatMap((u) => u.events)
    const last = r.updates[r.updates.length - 1]
    set({ state: last.state, lastEvents: events, error: null })
  },

  reset() {
    set({ match: null, state: null, lastEvents: [], error: null })
  },
}))

// 后备卡组:预组缺席时用生成池里的低费无效果卡凑一套合法卡组,
// 保证任何时候都能开一局(UI 优先用 content/decks.ts 的 PRECON_DECKS)。
export function quickDeck(doctrine: Doctrine | 'neutral' = 'neutral'): string[] {
  const usable = (c: CardDef) =>
    c.type === 'general' &&
    !c.battlecry &&
    !c.deathrattle &&
    (c.doctrine === doctrine || c.doctrine === 'neutral')
  const pool = CARDS.filter(usable).sort((a, b) => a.cost - b.cost || a.collectorNo - b.collectorNo)
  const deck: string[] = []
  const copies = new Map<string, number>()
  // 沿费用曲线取:1-5 费每档尽量凑 6 张
  for (let cost = 1; cost <= 10 && deck.length < DECK_SIZE; cost++) {
    for (const c of pool) {
      if (deck.length >= DECK_SIZE) break
      if (c.cost !== cost) continue
      const n = copies.get(c.id) ?? 0
      const limit = c.rarity === 'legendary' ? 1 : 2
      if (n >= limit) continue
      if (cost <= 5 && deck.filter((id) => CARDS_BY_ID[id].cost === cost).length >= 6) break
      copies.set(c.id, n + 1)
      deck.push(c.id)
    }
  }
  return deck.slice(0, DECK_SIZE)
}
