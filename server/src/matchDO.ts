// 权威对局:一场对局一个 Durable Object。
// 真实 GameState 只存在服务器;每条命令过与客户端完全相同的 applyCommand 校验,
// 客户端只收 redact 后的视角状态与事件 —— 天然防作弊。
import { createGame } from '../../src/engine/init'
import { applyCommand } from '../../src/engine/reducer'
import { redactEvent, redactState } from '../../src/engine/redact'
import type { GameConfig, GameEvent, GameState, PlayerIdx } from '../../src/engine/types'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { validateDeck } from '../../src/content/decks'
import type { MatchClientMsg, MatchServerMsg } from '../../src/app/protocol'

interface Seat {
  socket: WebSocket | null
  heroId: string
  deckIds: string[]
  name: string
  joined: boolean
}

interface Persisted {
  cfg: GameConfig
  state: GameState
  names: [string, string]
}

export class MatchDO {
  private state: GameState | null = null
  private cfg: GameConfig | null = null
  private seats: [Seat, Seat] = [emptySeat(), emptySeat()]
  private loaded = false

  constructor(private ctx: DurableObjectState) {}

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    const saved = await this.ctx.storage.get<Persisted>('game')
    if (saved) {
      this.state = saved.state
      this.cfg = saved.cfg
      this.seats[0].name = saved.names[0]
      this.seats[1].name = saved.names[1]
      this.seats[0].joined = true
      this.seats[1].joined = true
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.load()
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const url = new URL(request.url)
    const seatIdx = Number(url.searchParams.get('seat'))
    if (seatIdx !== 0 && seatIdx !== 1) return new Response('bad seat', { status: 400 })

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]
    server.accept()
    const seat = this.seats[seatIdx]
    seat.socket = server

    server.addEventListener('message', (ev) => {
      void this.onMessage(seatIdx as PlayerIdx, String(ev.data))
    })
    server.addEventListener('close', () => {
      if (seat.socket === server) seat.socket = null
      this.sendTo(other(seatIdx as PlayerIdx), { type: 'opponent-left' })
    })

    // 重连:对局已在进行,直接补发当前视角状态
    if (this.state) {
      this.sendTo(seatIdx as PlayerIdx, {
        type: 'start',
        state: redactState(this.state, seatIdx as PlayerIdx),
        events: [],
        opponentName: this.seats[other(seatIdx as PlayerIdx)].name,
      })
    }

    return new Response(null, { status: 101, webSocket: client })
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
      seat.joined = true
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
        await this.ctx.storage.deleteAll()
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

  private async persist(): Promise<void> {
    if (!this.state || !this.cfg) return
    const data: Persisted = {
      cfg: this.cfg,
      state: this.state,
      names: [this.seats[0].name, this.seats[1].name],
    }
    await this.ctx.storage.put('game', data)
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

  private sendTo(seatIdx: PlayerIdx, msg: MatchServerMsg): void {
    const socket = this.seats[seatIdx].socket
    if (!socket) return
    try {
      socket.send(JSON.stringify(msg))
    } catch {
      /* 掉线由 close 处理 */
    }
  }
}

function emptySeat(): Seat {
  return { socket: null, heroId: '', deckIds: [], name: '', joined: false }
}

function other(p: PlayerIdx): PlayerIdx {
  return p === 0 ? 1 : 0
}
