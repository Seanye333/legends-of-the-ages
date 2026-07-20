// 好友房间:一个房间码一个实例。房主创建后等待,好友凭码加入即撮合。
// 房间对局的 matchId 带 room- 前缀 → MatchDO 据此不计天梯。
// 用 WebSocket Hibernation:房主可能挂着房间等很久,不该一直计费。
// 房主身份放 socket attachment,不留内存态(唤醒后内存必空)。
import type { RoomServerMsg } from '../../src/app/protocol'

interface RoomAttachment {
  role: 'host'
  name: string
}

// 空房自毁:房主开了房再也没人来,到点连同 storage 一起清掉
const ROOM_TTL_MS = 2 * 60 * 60 * 1000 // 2 小时

export class RoomDO {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    // 观战查询:凭房间码换 matchId(唯一一个非 WebSocket 入口)
    if (new URL(request.url).searchParams.get('mode') === 'watch') {
      const matchId = await this.ctx.storage.get<string>('matchId')
      return new Response(JSON.stringify(matchId ? { matchId } : { error: 'no-match' }), {
        status: matchId ? 200 : 404,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const url = new URL(request.url)
    const mode = url.searchParams.get('mode')
    const code = url.searchParams.get('code') ?? ''
    const name = (url.searchParams.get('name') ?? '').slice(0, 16)
    if ((mode !== 'create' && mode !== 'join') || !code) {
      return new Response('bad request', { status: 400 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    this.ctx.acceptWebSocket(server)

    const host = this.findHost()

    if (mode === 'create') {
      if (host) {
        send(server, { type: 'error', error: 'room-taken' })
        close(server)
      } else {
        server.serializeAttachment({ role: 'host', name } satisfies RoomAttachment)
        send(server, { type: 'room-created', code })
        await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL_MS)
      }
      return new Response(null, { status: 101, webSocket: client })
    }

    // join
    if (!host) {
      send(server, { type: 'error', error: 'room-not-found' })
      close(server)
      return new Response(null, { status: 101, webSocket: client })
    }
    const matchId = `room-${crypto.randomUUID()}`
    // 落盘 matchId,让观战能凭房间码找到这一局(见 index.ts 的 /room/watch)。
    // 与房间本身同寿命:房间 TTL 到点 deleteAll 时一起清掉。
    await this.ctx.storage.put('matchId', matchId)
    // 先摘掉房主身份,避免并发 join 撮合到同一个房主
    host.serializeAttachment(null)
    send(host, { type: 'matched', matchId, seat: 0 })
    send(server, { type: 'matched', matchId, seat: 1 })
    close(host)
    close(server)
    await this.ctx.storage.deleteAlarm()
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(): Promise<void> {
    /* 房间只靠连接参数撮合,不收消息 */
  }

  async webSocketClose(): Promise<void> {
    /* 房主断连即房间消失,findHost 自然找不到 */
  }

  async webSocketError(): Promise<void> {
    /* 同上 */
  }

  // 空房到期:关掉挂着的房主连接并清空 storage
  async alarm(): Promise<void> {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'room-expired')
      } catch {
        /* 忽略 */
      }
    }
    await this.ctx.storage.deleteAll()
  }

  private findHost(): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as RoomAttachment | null
      if (att?.role === 'host' && ws.readyState === WebSocket.READY_STATE_OPEN) return ws
    }
    return null
  }
}

function send(socket: WebSocket, msg: RoomServerMsg): void {
  try {
    socket.send(JSON.stringify(msg))
  } catch {
    /* 忽略 */
  }
}

function close(socket: WebSocket): void {
  try {
    socket.close(1000, 'done')
  } catch {
    /* 忽略 */
  }
}
