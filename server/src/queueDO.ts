// 匹配队列:全局单例。两名玩家到齐即撮合,发 matchId + 座位。
// MVP:先到先配,无段位;掉线自动出队。
import type { QueueClientMsg, QueueServerMsg } from '../../src/app/protocol'

interface Waiting {
  socket: WebSocket
  name: string
}

export class QueueDO {
  private waiting: Waiting | null = null

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    server.accept()

    server.addEventListener('message', (ev) => {
      let msg: QueueClientMsg
      try {
        msg = JSON.parse(String(ev.data))
      } catch {
        return
      }
      if (msg.type !== 'join') return

      // 清理已死的等待者
      if (this.waiting && this.waiting.socket.readyState !== WebSocket.READY_STATE_OPEN) {
        this.waiting = null
      }

      if (!this.waiting) {
        this.waiting = { socket: server, name: msg.name }
        send(server, { type: 'waiting' })
        return
      }
      if (this.waiting.socket === server) return

      // 撮合
      const matchId = crypto.randomUUID()
      const first = this.waiting
      this.waiting = null
      send(first.socket, { type: 'matched', matchId, seat: 0 })
      send(server, { type: 'matched', matchId, seat: 1 })
      try {
        first.socket.close(1000, 'matched')
      } catch {
        /* 忽略 */
      }
      try {
        server.close(1000, 'matched')
      } catch {
        /* 忽略 */
      }
    })

    server.addEventListener('close', () => {
      if (this.waiting?.socket === server) this.waiting = null
    })

    return new Response(null, { status: 101, webSocket: client })
  }
}

function send(socket: WebSocket, msg: QueueServerMsg): void {
  try {
    socket.send(JSON.stringify(msg))
  } catch {
    /* 忽略 */
  }
}
