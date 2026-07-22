import { create } from 'zustand'
import type { Command, GameEvent, GameState } from '../engine/types'
import { DECK_SIZE, START_HP } from '../engine/types'
import type { CardDef, Doctrine, HeroPowerDef, RunModifiers } from '../engine/types'
import { CARDS, CARDS_BY_ID } from '../content/cards'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { LocalMatch } from './transport'
import { AI_LEVELS, AI_NORMAL } from '../ai/greedy'
import { useSettings } from './settingsStore'
import { useCollection } from './collectionStore'
import { useQuests } from './questStore'
import { useArena } from './arenaStore'
import { useAchievements } from './achievementStore'
import { useCampaign } from './campaignStore'
import { useExpedition } from './expeditionStore'
import { reportWin } from './leaderboard'
import type { EmoteId } from './protocol'
import { EMPTY_STATS, foldStats, type MatchStats } from './matchStats'
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
  campaign?: boolean // 关底战:胜负记进冒险进度,首通发奖
  // 关底战的不对称配置(Boss 血量与主公技由内容层给)
  heroPowersOverride?: [HeroPowerDef | undefined, HeroPowerDef | undefined]
  heroHpsOverride?: [number, number]
  // 远征(单人 roguelike):关间宝物合成的开局修正;胜负记进远征进度
  expedition?: boolean
  modifiersOverride?: [RunModifiers | undefined, RunModifiers | undefined]
}

export interface StartRemoteArgs {
  server: string
  deck: DeckList
  playerName: string
  mode?: 'queue' | 'create-room' | 'join-room' | 'watch-room'
  code?: string
}

export interface RatingResult {
  rating: number
  delta: number
}

interface MatchStoreState {
  mode: 'local' | 'remote'
  spectating: boolean
  tutorial: boolean
  arena: boolean
  campaign: boolean
  expedition: boolean
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
  // 联机再战:'none' 无人请求 / 'offered' 对手已请求 / 'sent' 我已请求等对手
  rematchState: 'none' | 'offered' | 'sent'
  state: GameState | null
  lastEvents: GameEvent[]
  // 终局战绩:边打边折,打完给结算画面看(状态里推不出「总共造成多少伤害」)
  stats: MatchStats
  error: string | null
  startMatch(args: StartMatchArgs): void
  startRemoteMatch(args: StartRemoteArgs): void
  resumeRemoteMatch(): boolean
  send(cmd: Command): void
  sendEmote(emote: EmoteId): void
  requestRematch(): void
  retryConnection(): void
  reset(): void
}

// 表情序号:同一个表情连发两次,UI 也要能触发两次动画
let emoteSeq = 1

// 每批事件都记一次任务与成就进度(计数类天然累加,不会重复计)
function settleQuests(events: GameEvent[], state: GameState | null): void {
  if (events.length === 0 || !state) return
  const heroId = state.players[0].heroId
  useQuests.getState().recordMatch(events, heroId)
  useAchievements.getState().recordMatch(events, heroId)
}

// 整局口径的成就:tallyStats 每批调用一次,看不到「整局」。
// 这些只能在终局那一刻、拿着累计好的 MatchStats 来判。
function settleWholeMatchAchievements(
  events: GameEvent[],
  stats: MatchStats,
  online: boolean,
): void {
  const ended = events.find((e) => e.type === 'GameEnded')
  if (!ended || ended.type !== 'GameEnded' || ended.winner !== 0) return
  const ach = useAchievements.getState()
  if (online) ach.bump('onlineWins')
  // 护甲挡下的不算掉血 —— HeroDamaged 只在真扣血时才发,所以看 damageTaken 就够
  if (stats.damageTaken === 0) ach.bump('flawlessWins')
}

// 终局统计:胜得卡包、负得安慰功勋、和局也给一点 —— 输了颗粒无收太劝退。
// 竞技场局走另一条账:胜负记进 run,奖励等整轮结束一次性结算。
function settleMatch(
  events: GameEvent[],
  arena: boolean,
  campaign: boolean,
  expedition: boolean,
): void {
  const ended = events.find((e) => e.type === 'GameEnded')
  if (!ended || ended.type !== 'GameEnded') return
  if (expedition) {
    if (ended.winner !== 'draw') useExpedition.getState().settle(ended.winner === 0)
    return
  }
  if (campaign) {
    useCampaign.getState().settle(ended.winner === 0)
    return
  }
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
// 联机回调只拿得到 set,而战绩要在旧值上累加 —— 所以额外传一个读取器进来
function remoteCallbacks(set: SetState, getStats: () => MatchStats) {
  return {
    onStatus: (remoteStatus: RemoteStatus) => set({ remoteStatus }),
    onUpdate: (
      state: GameState,
      events: GameEvent[],
      opponentName?: string,
      turnDeadline?: number,
    ) => {
      settleMatch(events, false, false, false)
      settleQuests(events, state)
      recordReplayFrame(state, events, opponentName)
      const nextStats = foldStats(getStats(), events, state)
      settleWholeMatchAchievements(events, nextStats, true)
      set({
        state,
        lastEvents: events,
        stats: nextStats,
        opponentName: opponentName ?? null,
        turnDeadline: turnDeadline ?? null,
        error: null,
        // 新一局开始 → 清掉上一局残留的再战状态。
        // 用条件展开而不是三元给 undefined:传 undefined 会真的把字段覆盖掉。
        ...(state.phase === 'ended' ? {} : { rematchState: 'none' as const }),
      })
    },
    onError: (error: string) => set({ error }),
    onRoomCode: (roomCode: string) => set({ roomCode }),
    onRated: (rating: number, delta: number) => set({ ratingResult: { rating, delta } }),
    onEmote: (emote: EmoteId) => set({ incomingEmote: { emote, seq: emoteSeq++ } }),
    onRematchOffered: () => set({ rematchState: 'offered' }),
  }
}

export const useMatch = create<MatchStoreState>()((set, get) => ({
  mode: 'local',
  spectating: false,
  tutorial: false,
  arena: false,
  campaign: false,
  expedition: false,
  match: null,
  remote: null,
  remoteStatus: null,
  opponentName: null,
  roomCode: null,
  ratingResult: null,
  turnDeadline: null,
  incomingEmote: null,
  rematchState: 'none',
  state: null,
  lastEvents: [],
  stats: EMPTY_STATS,
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
        // 关底战的对手不是普通主公:血量与主公技由 campaign.ts 指定
        heroPowers:
          args.heroPowersOverride ??
          (args.tutorial ? [undefined, undefined] : [heroDefs[0]?.power, heroDefs[1]?.power]),
        heroHps:
          args.heroHpsOverride ?? [heroDefs[0]?.hp ?? START_HP, heroDefs[1]?.hp ?? START_HP],
        modifiers: args.modifiersOverride,
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
      campaign: args.campaign === true,
      expedition: args.expedition === true,
      match,
      state,
      lastEvents: events,
      stats: foldStats(EMPTY_STATS, events, state),
      error: null,
    })
  },

  startRemoteMatch(args) {
    get().reset()
    const remote = new RemoteMatch(args.server, args.deck, args.playerName, remoteCallbacks(set, () => get().stats))
    set({
      mode: 'remote',
      spectating: args.mode === 'watch-room',
      remote,
      remoteStatus: 'connecting',
      state: null,
      lastEvents: [],
      error: null,
    })
    if (args.mode === 'create-room') remote.createRoom()
    else if (args.mode === 'join-room') remote.joinRoom(args.code ?? '')
    else if (args.mode === 'watch-room') void remote.watchRoom(args.code ?? '')
    else remote.start()
  },

  // 刷新/掉线后续上未完成的联机对局;无会话返回 false
  resumeRemoteMatch() {
    const session = loadSession()
    if (!session) return false
    get().reset()
    const remote = new RemoteMatch(session.server, session.deck, session.name, remoteCallbacks(set, () => get().stats))
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
    settleMatch(events, get().arena, get().campaign, get().expedition)
    settleQuests(events, last.state)
    recordReplayFrame(last.state, events)
    const nextStats = foldStats(get().stats, events, last.state)
    settleWholeMatchAchievements(events, nextStats, false)
    set({ state: last.state, lastEvents: events, stats: nextStats, error: null })
  },

  sendEmote(emote) {
    get().remote?.sendEmote(emote)
  },

  requestRematch() {
    const { remote, rematchState } = get()
    if (!remote || rematchState === 'sent') return
    remote.sendRematch()
    set({ rematchState: 'sent' })
  },

  // 自动重连放弃之后的手动出路
  retryConnection() {
    get().remote?.retryNow()
  },

  reset() {
    get().remote?.close()
    discardReplayRecording() // 未打完的对局不留战报
    set({
      mode: 'local',
      spectating: false,
      tutorial: false,
      arena: false,
      campaign: false,
      expedition: false,
      match: null,
      remote: null,
      remoteStatus: null,
      opponentName: null,
      roomCode: null,
      ratingResult: null,
      turnDeadline: null,
      incomingEmote: null,
      rematchState: 'none',
      state: null,
      lastEvents: [],
      stats: EMPTY_STATS,
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
