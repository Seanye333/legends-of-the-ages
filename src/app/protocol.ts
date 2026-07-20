// 联机协议:客户端 ↔ 服务器(Cloudflare Durable Objects)。
// 服务器是权威:客户端只发意图(Command),状态永远由服务器 redact 后下发。
import type { Command, GameEvent, PlayerIdx } from '../engine/types'
import type { RedactedState } from '../engine/redact'

// ---- 队列 ----

export interface QueueJoinMsg {
  type: 'join'
  name: string
  playerId?: string // 匿名设备 ID:天梯积分与分段匹配的键
}

export interface QueueMatchedMsg {
  type: 'matched'
  matchId: string
  seat: PlayerIdx
}

export type QueueClientMsg = QueueJoinMsg
export type QueueServerMsg = QueueMatchedMsg | { type: 'waiting' }

// ---- 好友房间(房间码约战,不计天梯) ----

export type RoomServerMsg =
  | { type: 'room-created'; code: string }
  | QueueMatchedMsg
  | { type: 'error'; error: string }

// ---- 对局 ----

export interface MatchJoinMsg {
  type: 'join'
  heroId: string
  deckIds: string[]
  name: string
  playerId?: string
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
  | { type: 'opponent-back' }
  | { type: 'rated'; rating: number; delta: number }

// ---- 天梯 ----

export interface RatingRow {
  playerId?: string
  name: string
  rating: number
  wins: number
  losses: number
}

export const DEFAULT_RATING = 1200

// 段位:按天梯分数取中国古代军职,低段快速通过、高段稀有
const RANKS: Array<[number, { zh: string; en: string }]> = [
  [1700, { zh: '大将军', en: 'Grand Marshal' }],
  [1600, { zh: '骠骑将军', en: 'General of Cavalry' }],
  [1500, { zh: '偏将军', en: 'Lieutenant General' }],
  [1400, { zh: '中郎将', en: 'Palace General' }],
  [1300, { zh: '校尉', en: 'Colonel' }],
  [1200, { zh: '都尉', en: 'Commandant' }],
  [1100, { zh: '什长', en: 'Sergeant' }],
]

export function rankOf(rating: number): { zh: string; en: string } {
  for (const [min, rank] of RANKS) {
    if (rating >= min) return rank
  }
  return { zh: '兵卒', en: 'Recruit' }
}

export const DEFAULT_SERVER = 'localhost:8787'

// ws(s):// 地址 → http(s):// REST 根(天梯查询用)
export function httpBase(server: string): string {
  if (server.startsWith('wss://')) return `https://${server.slice(6)}`
  if (server.startsWith('ws://')) return `http://${server.slice(5)}`
  return `http://${server}`
}
