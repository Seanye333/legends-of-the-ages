// 联机对局客户端:连接 QueueDO 匹配(或 RoomDO 房间码)→ MatchDO 对局。
// 三个职责:
// 1. 座位翻转 —— UI 恒定「我 = 0 号」,服务器座位可能是 1;所有玩家索引双向翻转。
// 2. 裁剪态重建 —— 服务器只发 RedactedState,这里重建成 GameState 形状
//    (对手手牌/双方牌库用占位实例),UI 与 legalCommands 无感知照常工作。
// 3. 断线重连 —— 座位令牌 + 本地会话持久化;连接意外断开自动指数退避重入,
//    刷新页面/杀进程后也能从标题页「回到对局」。
import type {
  CardInstance,
  Command,
  GameEvent,
  GameState,
  PlayerIdx,
  PlayerState,
  TargetRef,
} from '../engine/types'
import type { RedactedState } from '../engine/redact'
import type {
  MatchClientMsg,
  MatchServerMsg,
  QueueClientMsg,
  QueueServerMsg,
  RoomServerMsg,
} from './protocol'
import { wsScheme } from './protocol'
import type { DeckList } from '../content/decks'
import { getPlayerId } from './leaderboard'

export type RemoteStatus =
  | 'connecting'
  | 'queued'
  | 'room-waiting'
  | 'matched'
  | 'playing'
  | 'reconnecting'
  | 'opponent-left'
  | 'opponent-back'
  | 'closed'

export interface RemoteCallbacks {
  onStatus(status: RemoteStatus): void
  onUpdate(state: GameState, events: GameEvent[], opponentName?: string): void
  onError(error: string): void
  onRoomCode?(code: string): void
  onRated?(rating: number, delta: number): void
}

// ---- 会话持久化(断线/刷新后续局) ----

export interface RemoteSession {
  server: string
  matchId: string
  seat: PlayerIdx
  token: string
  name: string
  deck: DeckList
}

const SESSION_KEY = 'qiangu-remote-session'

export function loadSession(): RemoteSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as RemoteSession
    if (!s.matchId || !s.token || !s.deck) return null
    return s
  } catch {
    return null
  }
}

function saveSession(s: RemoteSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* node/隐私模式忽略 */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* 忽略 */
  }
}

function dummyInstance(iid: number): CardInstance {
  return {
    iid,
    defId: '',
    attack: 0,
    health: 0,
    maxHealth: 0,
    keywords: [],
    exhausted: false,
    attacksUsed: 0,
    enchants: [],
    damage: 0,
    silenced: false,
    frozen: false,
    shieldUsed: false,
    stealthBroken: false,
  }
}

// 裁剪态 → GameState 形状(我 = players[0])
export function inflateRedacted(rs: RedactedState, mySeat: PlayerIdx): GameState {
  const flip = (p: PlayerIdx): PlayerIdx => (mySeat === 0 ? p : p === 0 ? 1 : 0)
  const self: PlayerState = {
    heroId: rs.self.heroId,
    heroHp: rs.self.heroHp,
    heroMaxHp: rs.self.heroMaxHp,
    armor: rs.self.armor,
    fatigue: rs.self.fatigue,
    mana: rs.self.mana,
    deck: Array.from({ length: rs.self.deckCount }, (_, i) => dummyInstance(-(i + 1))),
    hand: rs.self.hand,
    board: rs.self.board,
    graveyard: rs.self.graveyard,
    mulliganDone: rs.self.mulliganDone,
    heroPowerUsed: rs.self.heroPowerUsed,
    heroPower: rs.self.heroPower,
  }
  const opponent: PlayerState = {
    heroId: rs.opponent.heroId,
    heroHp: rs.opponent.heroHp,
    heroMaxHp: rs.opponent.heroMaxHp,
    armor: rs.opponent.armor,
    fatigue: rs.opponent.fatigue,
    mana: rs.opponent.mana,
    deck: Array.from({ length: rs.opponent.deckCount }, (_, i) => dummyInstance(-(i + 1001))),
    hand: rs.opponent.handIids.map((iid) => dummyInstance(iid)),
    board: rs.opponent.board,
    graveyard: rs.opponent.graveyard,
    mulliganDone: rs.opponent.mulliganDone,
    heroPowerUsed: rs.opponent.heroPowerUsed,
    heroPower: rs.opponent.heroPower,
  }
  return {
    seed: 0,
    rng: 0,
    turn: rs.turn,
    activePlayer: flip(rs.activePlayer),
    phase: rs.phase,
    winner: rs.winner === 0 || rs.winner === 1 ? flip(rs.winner) : rs.winner,
    players: [self, opponent],
    nextIid: 0,
  }
}

function flipTarget(t: TargetRef, mySeat: PlayerIdx): TargetRef {
  if (t.kind !== 'hero' || mySeat === 0) return t
  return { kind: 'hero', player: t.player === 0 ? 1 : 0 }
}

// 本地帧命令 → 服务器帧
export function flipCommand(cmd: Command, mySeat: PlayerIdx): Command {
  if (mySeat === 0) return cmd
  if (cmd.type === 'PlayCard' && cmd.target) {
    return { ...cmd, target: flipTarget(cmd.target, mySeat) }
  }
  if (cmd.type === 'Attack') {
    return { ...cmd, target: flipTarget(cmd.target, mySeat) }
  }
  return cmd
}

// 服务器帧事件 → 本地帧
export function flipEvent(ev: GameEvent, mySeat: PlayerIdx): GameEvent {
  if (mySeat === 0) return ev
  const flip = (p: PlayerIdx): PlayerIdx => (p === 0 ? 1 : 0)
  const e = { ...ev } as GameEvent & { player?: PlayerIdx }
  if ('player' in e && e.player !== undefined) e.player = flip(e.player)
  if (e.type === 'AttackResolved') {
    return { ...e, attacker: flip(e.attacker), target: flipTarget(e.target, mySeat) }
  }
  if (e.type === 'DuelFought') {
    return { ...e, challenger: flip(e.challenger) }
  }
  if (e.type === 'GameEnded') {
    return {
      type: 'GameEnded',
      winner: e.winner === 0 || e.winner === 1 ? flip(e.winner) : e.winner,
    }
  }
  return e
}

function wsUrl(server: string, path: string): string {
  if (server.startsWith('ws://') || server.startsWith('wss://')) return `${server}${path}`
  // 只填了主机名:本地/内网走明文,其余一律加密(见 protocol.ts 的 wsScheme)
  return `${wsScheme(server)}${server}${path}`
}

const MAX_RECONNECT_TRIES = 6

export class RemoteMatch {
  private queueWs: WebSocket | null = null
  private matchWs: WebSocket | null = null
  private seat: PlayerIdx = 0
  private matchId: string | null = null
  private token: string
  private closed = false
  private ended = false
  private reconnectTries = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    private readonly server: string,
    private readonly deck: DeckList,
    private readonly playerName: string,
    private readonly cb: RemoteCallbacks,
    private readonly playerId: string = getPlayerId(),
  ) {
    this.token = crypto.randomUUID()
  }

  // 快速匹配(计天梯)
  start(): void {
    this.openLobby('/queue', (ws) => {
      const join: QueueClientMsg = { type: 'join', name: this.playerName, playerId: this.playerId }
      ws.send(JSON.stringify(join))
      this.cb.onStatus('queued')
    })
  }

  // 创建好友房间(不计天梯)
  createRoom(): void {
    this.openLobby(`/room/new?name=${encodeURIComponent(this.playerName)}`, () => {
      this.cb.onStatus('room-waiting')
    })
  }

  // 凭房间码加入
  joinRoom(code: string): void {
    const clean = code.trim().toUpperCase()
    this.openLobby(`/room/join/${encodeURIComponent(clean)}?name=${encodeURIComponent(this.playerName)}`, () => {
      this.cb.onStatus('connecting')
    })
  }

  // 恢复此前的对局(刷新/掉线后)
  resume(session: RemoteSession): void {
    this.seat = session.seat
    this.token = session.token
    this.matchId = session.matchId
    this.cb.onStatus('reconnecting')
    this.openMatch(session.matchId)
  }

  private openLobby(path: string, onOpen: (ws: WebSocket) => void): void {
    this.cb.onStatus('connecting')
    const ws = new WebSocket(wsUrl(this.server, path))
    this.queueWs = ws
    ws.onopen = () => onOpen(ws)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as QueueServerMsg | RoomServerMsg
      if (msg.type === 'matched') {
        this.seat = msg.seat
        this.cb.onStatus('matched')
        this.openMatch(msg.matchId)
        return
      }
      if (msg.type === 'room-created') {
        this.cb.onRoomCode?.(msg.code)
        return
      }
      if (msg.type === 'error') {
        this.cb.onError(msg.error)
      }
    }
    ws.onerror = () => {
      if (!this.closed && !this.matchWs) this.cb.onError('connect-failed')
    }
  }

  private openMatch(matchId: string): void {
    this.matchId = matchId
    saveSession({
      server: this.server,
      matchId,
      seat: this.seat,
      token: this.token,
      name: this.playerName,
      deck: this.deck,
    })
    const ws = new WebSocket(
      wsUrl(this.server, `/match/${matchId}?seat=${this.seat}&token=${this.token}`),
    )
    this.matchWs = ws
    ws.onopen = () => {
      // 开局前 join 用于注册卡组;开局后服务器忽略之并直接补发状态
      const join: MatchClientMsg = {
        type: 'join',
        heroId: this.deck.heroId,
        deckIds: this.deck.cardIds,
        name: this.playerName,
        playerId: this.playerId,
      }
      ws.send(JSON.stringify(join))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as MatchServerMsg
      if (msg.type === 'start' || msg.type === 'update') {
        this.reconnectTries = 0
        if (msg.type === 'start') this.cb.onStatus('playing')
        const state = inflateRedacted(msg.state, this.seat)
        if (state.phase === 'ended') {
          this.ended = true
          clearSession()
        }
        this.cb.onUpdate(
          state,
          msg.events.map((e) => flipEvent(e, this.seat)),
          msg.opponentName,
        )
        return
      }
      if (msg.type === 'rated') {
        this.cb.onRated?.(msg.rating, msg.delta)
        return
      }
      if (msg.type === 'error') {
        this.cb.onError(msg.error)
        return
      }
      if (msg.type === 'opponent-left') {
        this.cb.onStatus('opponent-left')
        return
      }
      if (msg.type === 'opponent-back') {
        this.cb.onStatus('opponent-back')
      }
    }
    ws.onclose = () => {
      if (this.closed || this.ended) return
      this.scheduleReconnect()
    }
    ws.onerror = () => {
      // 能重连就别吓唬玩家:闪断时 onerror 往往先于 onclose 到,
      // 此时 reconnectTries 还是 0,报错会盖过「重连中」的正常提示。
      // 只有压根没进过对局(无 matchId,重连无从谈起)才算真错误。
      if (!this.closed && !this.ended && !this.matchId) {
        this.cb.onError('connection-lost')
      }
    }
  }

  // 意外断开:1s/2s/4s/8s… 指数退避重连,超限才认输为 closed
  private scheduleReconnect(): void {
    if (!this.matchId || this.reconnectTimer) return
    if (this.reconnectTries >= MAX_RECONNECT_TRIES) {
      this.cb.onStatus('closed')
      return
    }
    this.reconnectTries++
    this.cb.onStatus('reconnecting')
    const delay = Math.min(8000, 1000 * 2 ** (this.reconnectTries - 1))
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.closed || this.ended || !this.matchId) return
      this.openMatch(this.matchId)
    }, delay)
  }

  // 测试钩子:模拟网络闪断(不置 closed,应触发自动重连)
  debugDropConnection(): void {
    try {
      this.matchWs?.close()
    } catch {
      /* 忽略 */
    }
  }

  send(cmd: Command): void {
    if (!this.matchWs || this.matchWs.readyState !== WebSocket.OPEN) return
    const msg: MatchClientMsg = { type: 'cmd', cmd: flipCommand(cmd, this.seat) }
    this.matchWs.send(JSON.stringify(msg))
  }

  close(): void {
    this.closed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    // 主动离开且对局未结束:保留会话,回来还能续
    if (this.ended) clearSession()
    try {
      this.queueWs?.close()
    } catch {
      /* 忽略 */
    }
    try {
      this.matchWs?.close()
    } catch {
      /* 忽略 */
    }
  }
}
