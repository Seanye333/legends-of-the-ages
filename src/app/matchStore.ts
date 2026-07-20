import { create } from 'zustand'
import type { Command, GameEvent, GameState } from '../engine/types'
import { DECK_SIZE, START_HP } from '../engine/types'
import type { CardDef, Doctrine } from '../engine/types'
import { CARDS, CARDS_BY_ID } from '../content/cards'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { LocalMatch } from './transport'
import { AI_LEVELS, AI_NORMAL } from '../ai/greedy'
import { useSettings } from './settingsStore'
import { useCollection } from './collectionStore'
import { useQuests } from './questStore'
import { useArena } from './arenaStore'
import { reportWin } from './leaderboard'
import type { EmoteId } from './protocol'
import {
  RemoteMatch,
  loadSession,
  type RemoteStatus,
} from './remoteMatch'
import {
  beginReplayRecording,
  discardReplayRecording,
  recordReplayFrame,
} from './replayStore'
import type { DeckList } from '../content/decks'

export interface StartMatchArgs {
  heroIds: [string, string]
  deckIds: [string[], string[]]
  seed?: number
  tutorial?: boolean // 教学对局:对战画面挂教鞭浮层
  arena?: boolean // 竞技场对局:胜负记进当前 run,而不是普通战绩
}

export interface StartRemoteArgs {
  server: string
  deck: DeckList
  playerName: string
  mode?: 'queue' | 'create-room' | 'join-room'
  code?: string
}

export interface RatingResult {
  rating: number
  delta: number
}

interface MatchStoreState {
  mode: 'local' | 'remote'
  tutorial: boolean
  arena: boolean
  match: LocalMatch | null
  remote: RemoteMatch | null
  remoteStatus: RemoteStatus | null
  opponentName: string | null
  roomCode: string | null
  ratingResult: RatingResult | null
  // 服务器的回合时限(epoch ms)。只有联机局有;本地局恒为 null。
  turnDeadline: number | null
  // 对手最近发来的表情(带序号,好让 UI 分辨「同一个表情又发了一次」)
  incomingEmote: { emote: EmoteId; seq: number } | null
  state: GameState | null
  lastEvents: GameEvent[]
  error: string | null
  startMatch(args: StartMatchArgs): void
  startRemoteMatch(args: StartRemoteArgs): void
  resumeRemoteMatch(): boolean
  send(cmd: Command): void
  sendEmote(emote: EmoteId): void
  reset(): void
}

// 表情序号:同一个表情连发两次,UI 也要能触发两次动画
let emoteSeq = 1

// 每批事件都记一次任务进度(计数类任务天然累加,不会重复计)
function settleQuests(events: GameEvent[], state: GameState | null): void {
  if (events.length === 0 || !state) return
  useQuests.getState().recordMatch(events, state.players[0].heroId)
}

// 终局统计:胜得卡包、负得安慰功勋、和局也给一点 —— 输了颗粒无收太劝退。
// 竞技场局走另一条账:胜负记进 run,奖励等整轮结束一次性结算。
function settleMatch(events: GameEvent[], arena: boolean): void {
  const ended = events.find((e) => e.type === 'GameEnded')
  if (!ended || ended.type !== 'GameEnded') return
  if (arena) {
    if (ended.winner !== 'draw') useArena.getState().recordResult(ended.winner === 0)
    return
  }
  if (ended.winner === 'draw') {
    useCollection.getState().recordDraw()
    return
  }
  useCollection.getState().recordResult(ended.winner === 0)
  if (ended.winner === 0) reportWin()
}

// 联机回调统一在此落进 store;opponent-back 属瞬时提示,不覆盖 playing 状态
type SetState = (partial: Partial<MatchStoreState>) => void
function remoteCallbacks(set: SetState) {
  return {
    onStatus: (remoteStatus: RemoteStatus) => set({ remoteStatus }),
    onUpdate: (
      state: GameState,
      events: GameEvent[],
      opponentName?: string,
      turnDeadline?: number,
    ) => {
      settleMatch(events, false)
      settleQuests(events, state)
      recordReplayFrame(state, events, opponentName)
      set({
        state,
        lastEvents: events,
        opponentName: opponentName ?? null,
        turnDeadline: turnDeadline ?? null,
        error: null,
      })
    },
    onError: (error: string) => set({ error }),
    onRoomCode: (roomCode: string) => set({ roomCode }),
    onRated: (rating: number, delta: number) => set({ ratingResult: { rating, delta } }),
    onEmote: (emote: EmoteId) =>
      set({ incomingEmote: { emote, seq: emoteSeq++ } }),
  }
}

export const useMatch = create<MatchStoreState>()((set, get) => ({
  mode: 'local',
  tutorial: false,
  arena: false,
  match: null,
  remote: null,
  remoteStatus: null,
  opponentName: null,
  roomCode: null,
  ratingResult: null,
  turnDeadline: null,
  incomingEmote: null,
  state: null,
  lastEvents: [],
  error: null,

  startMatch(args) {
    get().reset()
    // 应用层允许非确定性;引擎内部只吃这里传进去的种子
    const seed = args.seed ?? Math.floor(Math.random() * 0x7fffffff)
    const first = (seed & 1) as 0 | 1
    // 教学局固定用最宽容的 AI,别让新手第一局就被打穿
    const ai = args.tutorial
      ? AI_LEVELS.recruit
      : (AI_LEVELS[useSettings.getState().difficulty] ?? AI_NORMAL)
    // 教学局不给主公技:第一局要先把「出牌—攻击—结束回合」讲明白,
    // 多一个每回合都亮的按钮只会分散注意力(教鞭也没有对应的步骤)。
    const heroDefs = args.heroIds.map((id) => HEROES_BY_ID[id])
    const match = new LocalMatch(
      {
        seed,
        heroIds: args.heroIds,
        deckIds: args.deckIds,
        first,
        heroPowers: args.tutorial
          ? [undefined, undefined]
          : [heroDefs[0]?.power, heroDefs[1]?.power],
        heroHps: [heroDefs[0]?.hp ?? START_HP, heroDefs[1]?.hp ?? START_HP],
      },
      CARDS_BY_ID,
      ai,
    )
    const { state, events } = match.start()
    beginReplayRecording('local')
    recordReplayFrame(state, events)
    set({
      mode: 'local',
      tutorial: args.tutorial === true,
      arena: args.arena === true,
      match,
      state,
      lastEvents: events,
      error: null,
    })
  },

  startRemoteMatch(args) {
    get().reset()
    const remote = new RemoteMatch(args.server, args.deck, args.playerName, remoteCallbacks(set))
    set({ mode: 'remote', remote, remoteStatus: 'connecting', state: null, lastEvents: [], error: null })
    if (args.mode === 'create-room') remote.createRoom()
    else if (args.mode === 'join-room') remote.joinRoom(args.code ?? '')
    else remote.start()
  },

  // 刷新/掉线后续上未完成的联机对局;无会话返回 false
  resumeRemoteMatch() {
    const session = loadSession()
    if (!session) return false
    get().reset()
    const remote = new RemoteMatch(session.server, session.deck, session.name, remoteCallbacks(set))
    set({ mode: 'remote', remote, remoteStatus: 'reconnecting', state: null, lastEvents: [], error: null })
    remote.resume(session)
    return true
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
    settleMatch(events, get().arena)
    settleQuests(events, last.state)
    recordReplayFrame(last.state, events)
    set({ state: last.state, lastEvents: events, error: null })
  },

  sendEmote(emote) {
    get().remote?.sendEmote(emote)
  },

  reset() {
    get().remote?.close()
    discardReplayRecording() // 未打完的对局不留战报
    set({
      mode: 'local',
      tutorial: false,
      arena: false,
      match: null,
      remote: null,
      remoteStatus: null,
      opponentName: null,
      roomCode: null,
      ratingResult: null,
      turnDeadline: null,
      incomingEmote: null,
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
