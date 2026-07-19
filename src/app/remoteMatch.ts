// 联机对局客户端:连接 QueueDO 匹配 → MatchDO 对局。
// 两个职责:
// 1. 座位翻转 —— UI 恒定「我 = 0 号」,服务器座位可能是 1;所有玩家索引双向翻转。
// 2. 裁剪态重建 —— 服务器只发 RedactedState,这里重建成 GameState 形状
//    (对手手牌/双方牌库用占位实例),UI 与 legalCommands 无感知照常工作。
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
} from './protocol'
import type { DeckList } from '../content/decks'

export type RemoteStatus =
  | 'connecting'
  | 'queued'
  | 'matched'
  | 'playing'
  | 'opponent-left'
  | 'closed'

export interface RemoteCallbacks {
  onStatus(status: RemoteStatus): void
  onUpdate(state: GameState, events: GameEvent[], opponentName?: string): void
  onError(error: string): void
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
  }
}

// 裁剪态 → GameState 形状(我 = players[0])
export function inflateRedacted(rs: RedactedState, mySeat: PlayerIdx): GameState {
  const flip = (p: PlayerIdx): PlayerIdx => (mySeat === 0 ? p : p === 0 ? 1 : 0)
  const self: PlayerState = {
    heroId: rs.self.heroId,
    heroHp: rs.self.heroHp,
    armor: rs.self.armor,
    fatigue: rs.self.fatigue,
    mana: rs.self.mana,
    deck: Array.from({ length: rs.self.deckCount }, (_, i) => dummyInstance(-(i + 1))),
    hand: rs.self.hand,
    board: rs.self.board,
    graveyard: rs.self.graveyard,
    mulliganDone: rs.self.mulliganDone,
  }
  const opponent: PlayerState = {
    heroId: rs.opponent.heroId,
    heroHp: rs.opponent.heroHp,
    armor: rs.opponent.armor,
    fatigue: rs.opponent.fatigue,
    mana: rs.opponent.mana,
    deck: Array.from({ length: rs.opponent.deckCount }, (_, i) => dummyInstance(-(i + 1001))),
    hand: rs.opponent.handIids.map((iid) => dummyInstance(iid)),
    board: rs.opponent.board,
    graveyard: rs.opponent.graveyard,
    mulliganDone: rs.opponent.mulliganDone,
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
  return `ws://${server}${path}`
}

export class RemoteMatch {
  private queueWs: WebSocket | null = null
  private matchWs: WebSocket | null = null
  private seat: PlayerIdx = 0
  private closed = false

  constructor(
    private readonly server: string,
    private readonly deck: DeckList,
    private readonly playerName: string,
    private readonly cb: RemoteCallbacks,
  ) {}

  start(): void {
    this.cb.onStatus('connecting')
    const ws = new WebSocket(wsUrl(this.server, '/queue'))
    this.queueWs = ws
    ws.onopen = () => {
      this.cb.onStatus('queued')
      const join: QueueClientMsg = { type: 'join', name: this.playerName }
      ws.send(JSON.stringify(join))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as QueueServerMsg
      if (msg.type === 'matched') {
        this.seat = msg.seat
        this.cb.onStatus('matched')
        this.openMatch(msg.matchId)
      }
    }
    ws.onerror = () => {
      if (!this.closed && !this.matchWs) this.cb.onError('connect-failed')
    }
  }

  private openMatch(matchId: string): void {
    const ws = new WebSocket(wsUrl(this.server, `/match/${matchId}?seat=${this.seat}`))
    this.matchWs = ws
    ws.onopen = () => {
      const join: MatchClientMsg = {
        type: 'join',
        heroId: this.deck.heroId,
        deckIds: this.deck.cardIds,
        name: this.playerName,
      }
      ws.send(JSON.stringify(join))
    }
    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data)) as MatchServerMsg
      if (msg.type === 'start' || msg.type === 'update') {
        if (msg.type === 'start') this.cb.onStatus('playing')
        this.cb.onUpdate(
          inflateRedacted(msg.state, this.seat),
          msg.events.map((e) => flipEvent(e, this.seat)),
          msg.opponentName,
        )
        return
      }
      if (msg.type === 'error') {
        this.cb.onError(msg.error)
        return
      }
      if (msg.type === 'opponent-left') {
        this.cb.onStatus('opponent-left')
      }
    }
    ws.onclose = () => {
      if (!this.closed) this.cb.onStatus('closed')
    }
    ws.onerror = () => {
      if (!this.closed) this.cb.onError('connection-lost')
    }
  }

  send(cmd: Command): void {
    if (!this.matchWs || this.matchWs.readyState !== WebSocket.OPEN) return
    const msg: MatchClientMsg = { type: 'cmd', cmd: flipCommand(cmd, this.seat) }
    this.matchWs.send(JSON.stringify(msg))
  }

  close(): void {
    this.closed = true
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
