// 匹配队列:全局单例。按天梯分段撮合:分差 ≤300 立即配,
// 等待超 15 秒放宽为任意对手;掉线自动出队。
// 用 WebSocket Hibernation:排队等待期(可能几分钟)DO 不常驻计费。
// 等待者名单不放内存,直接由 ctx.getWebSockets() + attachment 推导 ——
// 唤醒后内存必然是空的,socket 才是唯一可靠的真相来源。
import type { QueueClientMsg, QueueServerMsg } from '../../src/app/protocol'
import { DEFAULT_RATING } from '../../src/app/protocol'

interface QueueAttachment {
  joined: boolean
  matched: boolean
  name: string
  playerId: string
  rating: number
  since: number
}

interface Env {
  RATINGS: DurableObjectNamespace
}

const BAND = 300
const WIDEN_AFTER_MS = 15_000

export class QueueDO {
  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    let msg: QueueClientMsg
    try {
      msg = JSON.parse(typeof message === 'string' ? message : '')
    } catch {
      return
    }
    if (msg.type !== 'join') return
    if (attachmentOf(ws)?.joined) return // 重复 join 忽略

    const rating = await this.lookupRating(msg.playerId)
    // 查分是异步的:期间此人可能已被并发 join 撮合或掉线
    if (ws.readyState !== WebSocket.READY_STATE_OPEN || attachmentOf(ws)?.matched) return

    const me: QueueAttachment = {
      joined: true,
      matched: false,
      name: msg.name,
      playerId: msg.playerId ?? '',
      rating,
      since: Date.now(),
    }
    ws.serializeAttachment(me)

    // 最接近分数的等待者;分差在段内、或对方已久等 → 撮合
    let best: { ws: WebSocket; att: QueueAttachment } | null = null
    for (const other of this.ctx.getWebSockets()) {
      if (other === ws) continue
      const att = attachmentOf(other)
      if (!att?.joined || att.matched) continue
      if (other.readyState !== WebSocket.READY_STATE_OPEN) continue
      if (!best || Math.abs(att.rating - rating) < Math.abs(best.att.rating - rating)) {
        best = { ws: other, att }
      }
    }
    const acceptable =
      best !== null &&
      (Math.abs(best.att.rating - rating) <= BAND || Date.now() - best.att.since > WIDEN_AFTER_MS)

    if (!best || !acceptable) {
      send(ws, { type: 'waiting' })
      return
    }

    best.ws.serializeAttachment({ ...best.att, matched: true })
    ws.serializeAttachment({ ...me, matched: true })
    const matchId = crypto.randomUUID()
    send(best.ws, { type: 'matched', matchId, seat: 0 })
    send(ws, { type: 'matched', matchId, seat: 1 })
    close(best.ws)
    close(ws)
  }

  async webSocketClose(): Promise<void> {
    /* 出队即断连,getWebSockets 自然不再包含它 */
  }

  async webSocketError(): Promise<void> {
    /* 同上 */
  }

  private async lookupRating(playerId: string | undefined): Promise<number> {
    if (!playerId) return DEFAULT_RATING
    try {
      const id = this.env.RATINGS.idFromName('global')
      const res = await this.env.RATINGS.get(id).fetch(
        `https://ratings/rating?playerId=${encodeURIComponent(playerId)}`,
      )
      const json = (await res.json()) as { rating?: number }
      return json.rating ?? DEFAULT_RATING
    } catch {
      return DEFAULT_RATING
    }
  }
}

function attachmentOf(ws: WebSocket): QueueAttachment | null {
  return (ws.deserializeAttachment() as QueueAttachment | null) ?? null
}

function send(socket: WebSocket, msg: QueueServerMsg): void {
  try {
    socket.send(JSON.stringify(msg))
  } catch {
    /* 忽略 */
  }
}

function close(socket: WebSocket): void {
  try {
    socket.close(1000, 'matched')
  } catch {
    /* 忽略 */
  }
}
