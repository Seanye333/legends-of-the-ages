// 联机协议:客户端 ↔ 服务器(Cloudflare Durable Objects)。
// 服务器是权威:客户端只发意图(Command),状态永远由服务器 redact 后下发。
import type { Command, GameEvent, PlayerIdx } from '../engine/types'
import type { RedactedState } from '../engine/redact'

// ---- 队列 ----

export interface QueueJoinMsg {
  type: 'join'
  name: string
}

export interface QueueMatchedMsg {
  type: 'matched'
  matchId: string
  seat: PlayerIdx
}

export type QueueClientMsg = QueueJoinMsg
export type QueueServerMsg = QueueMatchedMsg | { type: 'waiting' }

// ---- 对局 ----

export interface MatchJoinMsg {
  type: 'join'
  heroId: string
  deckIds: string[]
  name: string
}

export interface MatchCmdMsg {
  type: 'cmd'
  cmd: Command
}

export type MatchClientMsg = MatchJoinMsg | MatchCmdMsg

export interface MatchUpdateMsg {
  type: 'start' | 'update'
  state: RedactedState
  events: GameEvent[]
  opponentName?: string
}

export type MatchServerMsg =
  | MatchUpdateMsg
  | { type: 'error'; error: string }
  | { type: 'opponent-left' }

export const DEFAULT_SERVER = 'localhost:8787'
