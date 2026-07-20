// 权威对局:一场对局一个 Durable Object。
// 真实 GameState 只存在服务器;每条命令过与客户端完全相同的 applyCommand 校验,
// 客户端只收 redact 后的视角状态与事件 —— 天然防作弊。
// 断线重连:状态持久化 + 座位令牌(首连认领,重连必须持同一令牌),
// 重新接入即补发当前视角全量状态。
//
// 使用 WebSocket Hibernation API:等待对手落子的空窗期 DO 可被驱逐而不计费,
// 消息到达时再唤醒。代价是内存态随时可能没了 —— 所以每个处理器都先 load(),
// 座位归属放在 socket 的 attachment 里,座位报名信息也必须落盘(不能只留内存,
// 否则两人 join 之间发生驱逐就丢了)。
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { redactEvent, redactState } from '../../src/engine/redact'
import type { GameConfig, GameEvent, GameState, PlayerIdx } from '../../src/engine/types'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { validateDeck } from '../../src/content/decks'
import type { MatchClientMsg, MatchServerMsg } from '../../src/app/protocol'
import type { ReportBody, ReportResult } from './ratingsDO'

interface SeatInfo {
  heroId: string
  deckIds: string[]
  name: string
  playerId: string
  token: string
  joined: boolean
}

interface Persisted {
  cfg: GameConfig
  state: GameState
}

// socket.serializeAttachment 存的东西:hibernation 唤醒后靠它认座位
interface SocketAttachment {
  seat: PlayerIdx
}

interface Env {
  RATINGS: DurableObjectNamespace
}

// 弃坑对局的清理时限:超过这么久没有任何命令,DO storage 自行销毁
const ABANDON_MS = 6 * 60 * 60 * 1000 // 6 小时

export class MatchDO {
  private state: GameState | null = null
  private cfg: GameConfig | null = null
  private seats: [SeatInfo, SeatInfo] = [emptySeat(), emptySeat()]
  private loaded = false

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  // hibernation 唤醒后内存是空的,每个入口都必须先补状态
  private async load(): Promise<void> {
    if (this.loaded) return
    const [game, seats] = await Promise.all([
      this.ctx.storage.get<Persisted>('game'),
      this.ctx.storage.get<[SeatInfo, SeatInfo]>('seats'),
    ])
    if (game) {
      this.state = game.state
      this.cfg = game.cfg
    }
    if (seats) this.seats = seats
    this.loaded = true
  }

  async fetch(request: Request): Promise<Response> {
    await this.load()
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const url = new URL(request.url)
    const seatIdx = Number(url.searchParams.get('seat'))
    if (seatIdx !== 0 && seatIdx !== 1) return new Response('bad seat', { status: 400 })
    const token = url.searchParams.get('token') ?? ''
    if (!token) return new Response('missing token', { status: 400 })

    const seat = this.seats[seatIdx]
    // 座位令牌:首连认领;之后持不同令牌者一律拒绝(防旁人抢座/看牌)
    if (seat.token && seat.token !== token) {
      return new Response('seat taken', { status: 403 })
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    // hibernation:交给 runtime 托管,而不是 server.accept()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ seat: seatIdx } satisfies SocketAttachment)

    if (seat.token !== token) {
      seat.token = token
      await this.persistSeats()
    }
    await this.ctx.storage.setAlarm(Date.now() + ABANDON_MS)

    const me = seatIdx as PlayerIdx
    // 重连:对局已在进行,直接补发当前视角状态,并告知对手已回归
    if (this.state) {
      this.sendTo(me, {
        type: 'start',
        state: redactState(this.state, me),
        events: [],
        opponentName: this.seats[other(me)].name,
      })
      if (this.state.phase !== 'ended') {
        this.sendTo(other(me), { type: 'opponent-back' })
      }
    }

    return new Response(null, { status: 101, webSocket: client })
  }

  // ---- hibernation 事件处理器(取代 addEventListener) ----

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.load()
    const att = ws.deserializeAttachment() as SocketAttachment | null
    if (!att) return
    await this.onMessage(att.seat, typeof message === 'string' ? message : '')
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.load()
    const att = ws.deserializeAttachment() as SocketAttachment | null
    if (!att) return
    // 对局进行中掉线只是暂离;终局后掉线无需通告
    if (this.state && this.state.phase !== 'ended') {
      this.sendTo(other(att.seat), { type: 'opponent-left' })
    }
  }

  async webSocketError(): Promise<void> {
    /* 断连统一由 webSocketClose 处理 */
  }

  // 弃坑清理:到点还没打完就把这局彻底销毁,不留 storage 残渣
  async alarm(): Promise<void> {
    await this.load()
    if (this.state && this.state.phase !== 'ended') {
      for (const seat of [0, 1] as const) {
        this.sendTo(seat, { type: 'error', error: 'match-abandoned' })
      }
    }
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1000, 'abandoned')
      } catch {
        /* 忽略 */
      }
    }
    await this.ctx.storage.deleteAll()
  }

  private async onMessage(seatIdx: PlayerIdx, raw: string): Promise<void> {
    let msg: MatchClientMsg
    try {
      msg = JSON.parse(raw)
    } catch {
      return
    }

    if (msg.type === 'join') {
      const seat = this.seats[seatIdx]
      if (this.state) return // 已开局,join 只用于重连(fetch 已补发)
      // 服务器侧卡组校验:防非法卡组
      const errors = validateDeck(
        { heroId: msg.heroId, name: { zh: '', en: '' }, cardIds: msg.deckIds },
        CARDS_BY_ID,
        HEROES_BY_ID,
      )
      if (errors.length > 0) {
        this.sendTo(seatIdx, { type: 'error', error: `illegal-deck: ${errors[0]}` })
        return
      }
      seat.heroId = msg.heroId
      seat.deckIds = msg.deckIds
      seat.name = msg.name
      seat.playerId = msg.playerId ?? ''
      seat.joined = true
      await this.persistSeats()
      if (this.seats[0].joined && this.seats[1].joined && !this.state) {
        await this.startGame()
      }
      return
    }

    if (msg.type === 'cmd') {
      if (!this.state) {
        this.sendTo(seatIdx, { type: 'error', error: 'match-not-started' })
        return
      }
      const r = applyCommand(this.state, seatIdx, msg.cmd, CARDS_BY_ID)
      if (!r.ok) {
        this.sendTo(seatIdx, { type: 'error', error: r.error })
        return
      }
      this.state = r.state
      await this.persist()
      this.broadcast('update', r.events)
      if (this.state.phase === 'ended') {
        await this.reportRatings()
        await this.ctx.storage.deleteAll()
      } else {
        // 活跃对局:把弃坑清理的闹钟往后推
        await this.ctx.storage.setAlarm(Date.now() + ABANDON_MS)
      }
    }
  }

  private async startGame(): Promise<void> {
    // 种子在引擎之外生成(服务器层允许非确定性);引擎内只吃种子
    const seed = Math.floor(Math.random() * 0x7fffffff)
    this.cfg = {
      seed,
      heroIds: [this.seats[0].heroId, this.seats[1].heroId],
      deckIds: [this.seats[0].deckIds.slice(), this.seats[1].deckIds.slice()],
      first: (seed & 1) as PlayerIdx,
    }
    this.state = createGame(this.cfg, CARDS_BY_ID)
    await this.persist()
    this.broadcast('start', [])
  }

  // 天梯结算:房间局(room- 前缀)与缺 playerId 的对局不计分
  private async reportRatings(): Promise<void> {
    if (!this.state || this.state.phase !== 'ended') return
    const matchName = this.ctx.id.name ?? ''
    if (matchName.startsWith('room-')) return
    const [a, b] = this.seats
    if (!a.playerId || !b.playerId || a.playerId === b.playerId) return
    const winner = this.state.winner
    const result: ReportBody['result'] = winner === 0 ? 1 : winner === 1 ? 0 : 0.5
    try {
      const id = this.env.RATINGS.idFromName('global')
      const res = await this.env.RATINGS.get(id).fetch('https://ratings/report', {
        method: 'POST',
        body: JSON.stringify({
          a: { id: a.playerId, name: a.name },
          b: { id: b.playerId, name: b.name },
          result,
        } satisfies ReportBody),
      })
      const rated = (await res.json()) as ReportResult
      this.sendTo(0, { type: 'rated', rating: rated.a.rating, delta: rated.a.delta })
      this.sendTo(1, { type: 'rated', rating: rated.b.rating, delta: rated.b.delta })
    } catch {
      /* 天梯不可用不影响对局结束 */
    }
  }

  private async persist(): Promise<void> {
    if (!this.state || !this.cfg) return
    await this.ctx.storage.put('game', { cfg: this.cfg, state: this.state } satisfies Persisted)
  }

  private async persistSeats(): Promise<void> {
    await this.ctx.storage.put('seats', this.seats)
  }

  private broadcast(type: 'start' | 'update', events: GameEvent[]): void {
    if (!this.state) return
    for (const seatIdx of [0, 1] as const) {
      this.sendTo(seatIdx, {
        type,
        state: redactState(this.state, seatIdx),
        events: events.map((e) => redactEvent(e, seatIdx)),
        opponentName: this.seats[other(seatIdx)].name,
      })
    }
  }

  // hibernation 下没有常驻 socket 引用:每次按 attachment 现找
  private sendTo(seatIdx: PlayerIdx, msg: MatchServerMsg): void {
    const payload = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null
      if (att?.seat !== seatIdx) continue
      try {
        ws.send(payload)
      } catch {
        /* 掉线由 webSocketClose 处理 */
      }
    }
  }
}

function emptySeat(): SeatInfo {
  return { heroId: '', deckIds: [], name: '', playerId: '', token: '', joined: false }
}

function other(p: PlayerIdx): PlayerIdx {
  return p === 0 ? 1 : 0
}
