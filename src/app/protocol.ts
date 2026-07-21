// 联机协议:客户端 ↔ 服务器(Cloudflare Durable Objects)。
// 服务器是权威:客户端只发意图(Command),状态永远由服务器 redact 后下发。
import type { Command, GameEvent, PlayerIdx } from '../engine/types'
import type { RedactedState } from '../engine/redact'

// ---- 协议版本 ----
//
// 此前协议**完全没有版本号**。而客户端是 PWA:Service Worker 会把旧构建缓存住,
// 玩家可能连着好几天跑的都是旧代码。一旦服务端改了消息结构,
// 旧客户端不会报错 —— 它会静默地按旧字段解析新消息,表现为
// 「牌打不出去」「状态对不上」这种没法归因的诡异 bug。
//
// 规则:**任何改动 MatchClientMsg / MatchServerMsg / QueueClientMsg 结构的提交,
// 都要 bump PROTOCOL_VERSION,并同步 server 的 MIN_CLIENT_VERSION。**
// 老客户端会收到一条明确的 `protocol-outdated`,UI 直接请玩家刷新 ——
// 刷新会让 PWA 的 autoUpdate 拉到新构建,这条路是通的。
//
// 只加可选字段(不改已有字段含义)不需要 bump:老客户端忽略它即可。
export const PROTOCOL_VERSION = 1

// ---- 队列 ----

export interface QueueJoinMsg {
  type: 'join'
  name: string
  playerId?: string // 匿名设备 ID:天梯积分与分段匹配的键
  v?: number // 协议版本;缺省视为 0(版本机制上线前的老客户端)
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
  v?: number // 协议版本;缺省视为 0
}

export interface MatchCmdMsg {
  type: 'cmd'
  cmd: Command
}

// 表情:唯一的社交通道。刻意做成**固定六句**而不是自由聊天 ——
// 没有举报/封禁系统的前提下开自由文本,等于给骚扰开一扇没锁的门。
export type EmoteId = 'greet' | 'well-played' | 'thanks' | 'oops' | 'threaten' | 'hurry'

export const EMOTES: { id: EmoteId; zh: string; en: string }[] = [
  { id: 'greet', zh: '幸会', en: 'Well met' },
  { id: 'well-played', zh: '好手段', en: 'Well played' },
  { id: 'thanks', zh: '承让', en: 'Thanks' },
  { id: 'oops', zh: '失算', en: 'Oops' },
  { id: 'threaten', zh: '看招', en: 'Have at you' },
  { id: 'hurry', zh: '请', en: 'Your move' },
]

export interface MatchEmoteMsg {
  type: 'emote'
  emote: EmoteId
}

// 再战:双方都点了才重开。此前联机局打完只能各回各家 ——
// 本地局有「再战」,联机局没有,而联机恰恰是最想立刻打第二把的场景。
export interface MatchRematchMsg {
  type: 'rematch'
}

export type MatchClientMsg = MatchJoinMsg | MatchCmdMsg | MatchEmoteMsg | MatchRematchMsg

export interface MatchUpdateMsg {
  type: 'start' | 'update'
  state: RedactedState
  events: GameEvent[]
  opponentName?: string
  // 本回合的强制结束时刻(epoch ms)。服务器有 90 秒回合时限,
  // 不把它推给客户端的话,玩家会被一个看不见的计时器判掉回合。
  turnDeadline?: number
}

export type MatchServerMsg =
  | MatchUpdateMsg
  | { type: 'error'; error: string }
  | { type: 'opponent-left' }
  | { type: 'opponent-back' }
  | { type: 'rated'; rating: number; delta: number }
  | { type: 'emote'; emote: EmoteId; from: 'opponent' }
  // 对手已请求再战(等你点);双方都点后服务器直接推新的 start
  | { type: 'rematch-offered' }
  | { type: 'rematch-declined' }

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

// 联机服务器默认地址。
// 从前这里写死 'localhost:8787' —— 意味着任何一个真实玩家点开「联机对战」
// 看到的都是一个连不上的地址,必须自己手打服务器域名。等于联机功能没上线。
// 现在优先读构建期注入的 VITE_MATCH_SERVER;没配才回落到本地开发地址。
// 注:这里不能直接写 import.meta.env —— protocol.ts 同时被 app、测试与
// Cloudflare Worker 三套 tsconfig 编译,只有 app 那套带 vite/client 类型。
const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
export const DEFAULT_SERVER = viteEnv?.VITE_MATCH_SERVER || 'localhost:8787'

// ws(s):// 地址 → http(s):// REST 根(天梯查询用)
// 用户只填主机名(不带 scheme)时该用加密还是明文。
// 三种运行环境要同时照顾到,所以不能只看页面协议:
// - 网页部署在 HTTPS:ws:// 和 http:// 会被浏览器按混合内容拦掉,必须加密
// - Tauri iOS/桌面:页面来自自定义协议不是 https,但远端 Workers 只收 wss://
// - 本地开发 / 局域网真机联调:localhost 与内网地址没有证书,必须明文
// 判断顺序:页面是 HTTPS 就必须加密;否则看目标主机是不是本地/内网。
function pageIsSecure(): boolean {
  const loc = (globalThis as { location?: { protocol?: string } }).location
  return loc?.protocol === 'https:'
}

function hostOf(server: string): string {
  return server
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .toLowerCase()
}

// 本地或内网地址:没有可用证书,只能明文
function isLocalTarget(server: string): boolean {
  const host = hostOf(server)
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  )
}

function useSecure(server: string): boolean {
  if (pageIsSecure()) return true
  return !isLocalTarget(server)
}

export function wsScheme(server: string): 'ws://' | 'wss://' {
  return useSecure(server) ? 'wss://' : 'ws://'
}

export function httpBase(server: string): string {
  if (server.startsWith('wss://')) return `https://${server.slice(6)}`
  if (server.startsWith('ws://')) return `http://${server.slice(5)}`
  if (server.startsWith('https://') || server.startsWith('http://')) return server
  return `${useSecure(server) ? 'https://' : 'http://'}${server}`
}
