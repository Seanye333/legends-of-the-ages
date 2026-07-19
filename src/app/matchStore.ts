import { create } from 'zustand'
import type { Command, GameEvent, GameState } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import type { CardDef, Doctrine } from '../engine/types'
import { CARDS, CARDS_BY_ID } from '../content/cards'
import { LocalMatch } from './transport'
import { AI_NORMAL } from '../ai/greedy'
import { useCollection } from './collectionStore'
import { reportWin } from './leaderboard'
import { RemoteMatch, type RemoteStatus } from './remoteMatch'
import type { DeckList } from '../content/decks'

export interface StartMatchArgs {
  heroIds: [string, string]
  deckIds: [string[], string[]]
  seed?: number
}

export interface StartRemoteArgs {
  server: string
  deck: DeckList
  playerName: string
}

interface MatchStoreState {
  mode: 'local' | 'remote'
  match: LocalMatch | null
  remote: RemoteMatch | null
  remoteStatus: RemoteStatus | null
  opponentName: string | null
  state: GameState | null
  lastEvents: GameEvent[]
  error: string | null
  startMatch(args: StartMatchArgs): void
  startRemoteMatch(args: StartRemoteArgs): void
  send(cmd: Command): void
  reset(): void
}

// 终局统计:胜得卡包 + 上报排行;平局不计胜负
function settleMatch(events: GameEvent[]): void {
  const ended = events.find((e) => e.type === 'GameEnded')
  if (!ended || ended.type !== 'GameEnded' || ended.winner === 'draw') return
  useCollection.getState().recordResult(ended.winner === 0)
  if (ended.winner === 0) reportWin()
}

export const useMatch = create<MatchStoreState>()((set, get) => ({
  mode: 'local',
  match: null,
  remote: null,
  remoteStatus: null,
  opponentName: null,
  state: null,
  lastEvents: [],
  error: null,

  startMatch(args) {
    get().reset()
    // 应用层允许非确定性;引擎内部只吃这里传进去的种子
    const seed = args.seed ?? Math.floor(Math.random() * 0x7fffffff)
    const first = (seed & 1) as 0 | 1
    const match = new LocalMatch(
      { seed, heroIds: args.heroIds, deckIds: args.deckIds, first },
      CARDS_BY_ID,
      AI_NORMAL,
    )
    const { state, events } = match.start()
    set({ mode: 'local', match, state, lastEvents: events, error: null })
  },

  startRemoteMatch(args) {
    get().reset()
    const remote = new RemoteMatch(args.server, args.deck, args.playerName, {
      onStatus: (remoteStatus) => set({ remoteStatus }),
      onUpdate: (state, events, opponentName) => {
        settleMatch(events)
        set({ state, lastEvents: events, opponentName: opponentName ?? null, error: null })
      },
      onError: (error) => set({ error }),
    })
    set({ mode: 'remote', remote, remoteStatus: 'connecting', state: null, lastEvents: [], error: null })
    remote.start()
  },

  send(cmd) {
    const { mode, match, remote } = get()
    if (mode === 'remote') {
      remote?.send(cmd)
      return
    }
    if (!match) return
    const r = match.sendCommand(cmd)
    if ('error' in r) {
      set({ error: r.error })
      return
    }
    const events = r.updates.flatMap((u) => u.events)
    const last = r.updates[r.updates.length - 1]
    settleMatch(events)
    set({ state: last.state, lastEvents: events, error: null })
  },

  reset() {
    get().remote?.close()
    set({
      mode: 'local',
      match: null,
      remote: null,
      remoteStatus: null,
      opponentName: null,
      state: null,
      lastEvents: [],
      error: null,
    })
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
