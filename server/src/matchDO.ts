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
import {
  redactEvent,
  redactEventForSpectator,
  redactForSpectator,
  redactState,
} from '../../src/engine/redact'
import type { GameConfig, GameEvent, GameState, PlayerIdx } from '../../src/engine/types'
import { START_HP } from '../../src/engine/types'
import { CARDS_BY_ID } from '../../src/content/cards'
import { HEROES_BY_ID } from '../../src/content/overrides/heroes'
import { validateDeck } from '../../src/content/decks'
import type { MatchClientMsg, MatchServerMsg } from '../../src/app/protocol'
import { EMOTES } from '../../src/app/protocol'
import type { ReportBody, ReportResult } from './ratingsDO'
import { verifyMatchId } from './matchId'
import { log } from './log'

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

// socket.serializeAttachment 存的东西:hibernation 唤醒后靠它认座位。
// 限流计数也放这里 —— hibernation 下没有常驻内存,只有 attachment 活得够久。
// seat 为 2 表示观战席(只收不发,且拿到的是抹掉双方手牌的视角)
type Seat = PlayerIdx | 2

interface SocketAttachment {
  seat: Seat
  windowStart: number
  msgCount: number
}

const SPECTATOR = 2 as const

interface Env {
  RATINGS: DurableObjectNamespace
  MATCH_SECRET?: string
}

const EMOTE_IDS = new Set(EMOTES.map((e) => e.id))

// 弃坑对局的清理时限:超过这么久没有任何命令,DO storage 自行销毁
const ABANDON_MS = 6 * 60 * 60 * 1000 // 6 小时

// 回合时限。到点由服务器代打 EndTurn ——
// 从前服务端**完全没有计时器**,一个玩家可以无限期攥着回合不放,
// 对手唯一的出路是等六小时的弃坑闹钟,而那个闹钟不判胜负、不结算分数。
const TURN_MS = 90 * 1000

// 掉线宽限。超时判负给对手。
// 从前 webSocketClose 只通知一声对手,没有任何计时 —— 于是**拔网线是免费的逃分手段**:
// 眼看要输就把网断掉,对局挂到弃坑闹钟自毁,双方都不结算 ELO。
const FORFEIT_MS = 90 * 1000

// 终局后保留 DO 的时长,供双方决定要不要再战。到点仍走弃坑清理。
const REMATCH_WINDOW_MS = 3 * 60 * 1000

// 单连接消息速率上限(滑动窗口)。此前服务端任何地方都没有限流。
const RATE_WINDOW_MS = 10 * 1000
const RATE_MAX_MSGS = 120

interface Deadlines {
  abandon: number
  // 当前回合的强制结束时限,连同它属于第几回合 —— 只在回合真正推进时重置,
  // 否则玩家可以靠反复出无关的牌把绳子无限续下去。
  turn: { at: number; forTurn: number } | null
  forfeit: { seat: PlayerIdx; at: number } | null
}

export class MatchDO {
  private state: GameState | null = null
  private cfg: GameConfig | null = null
  private seats: [SeatInfo, SeatInfo] = [emptySeat(), emptySeat()]
  private deadlines: Deadlines = { abandon: 0, turn: null, forfeit: null }
  // 表情限速只需活在内存里:hibernation 把它清掉最多是让对手多收一个表情,无所谓
  private lastEmoteAt: [number, number] = [0, 0]
  // 再战意向。只活在内存里:被驱逐意味着窗口期已过,重新点一次即可。
  private rematchWanted: [boolean, boolean] = [false, false]
  private loaded = false

  constructor(
    private ctx: DurableObjectState,
    private env: Env,
  ) {}

  // hibernation 唤醒后内存是空的,每个入口都必须先补状态
  private async load(): Promise<void> {
    if (this.loaded) return
    const [game, seats, deadlines] = await Promise.all([
      this.ctx.storage.get<Persisted>('game'),
      this.ctx.storage.get<[SeatInfo, SeatInfo]>('seats'),
      this.ctx.storage.get<Deadlines>('deadlines'),
    ])
    if (game) {
      this.state = game.state
      this.cfg = game.cfg
    }
    if (seats) this.seats = seats
    if (deadlines) this.deadlines = deadlines
    this.loaded = true
  }

  // 三个时限共用一个 alarm 槽:落盘全部时限,闹钟设在最早的那个,
  // 醒来后逐个判断是否到点。DO 只有一个 alarm,不这样就只能保留一种时限。
  private async armAlarm(): Promise<void> {
    await this.ctx.storage.put('deadlines', this.deadlines)
    const candidates = [
      this.deadlines.abandon,
      this.deadlines.turn?.at ?? Infinity,
      this.deadlines.forfeit?.at ?? Infinity,
    ].filter((n) => Number.isFinite(n) && n > 0)
    if (candidates.length === 0) return
    await this.ctx.storage.setAlarm(Math.min(...candidates))
  }

  // 回合时限只在回合号真正推进时重置
  private touchTurnDeadline(): void {
    if (!this.state || this.state.phase !== 'main') {
      this.deadlines.turn = null
      return
    }
    if (this.deadlines.turn?.forTurn !== this.state.turn) {
      this.deadlines.turn = { at: Date.now() + TURN_MS, forTurn: this.state.turn }
    }
  }

  async fetch(request: Request): Promise<Response> {
    await this.load()
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }
    const url = new URL(request.url)
    const seatIdx = Number(url.searchParams.get('seat')) as Seat
    if (seatIdx !== 0 && seatIdx !== 1 && seatIdx !== SPECTATOR) {
      return new Response('bad seat', { status: 400 })
    }
    const token = url.searchParams.get('token') ?? ''
    if (!token) return new Response('missing token', { status: 400 })

    // 观战席不占座、不需要令牌校验,只在对局已经开始后才允许接入
    if (seatIdx === SPECTATOR) {
      if (!this.state) return new Response('match not started', { status: 409 })
    } else {
      const seat = this.seats[seatIdx]
      // 座位令牌:首连认领;之后持不同令牌者一律拒绝(防旁人抢座/看牌)
      if (seat.token && seat.token !== token) {
        return new Response('seat taken', { status: 403 })
      }
    }

    const pair = new WebSocketPair()
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket]

    // hibernation:交给 runtime 托管,而不是 server.accept()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({
      seat: seatIdx,
      windowStart: Date.now(),
      msgCount: 0,
    } satisfies SocketAttachment)

    if (seatIdx !== SPECTATOR && this.seats[seatIdx].token !== token) {
      this.seats[seatIdx].token = token
      await this.persistSeats()
    }
    // 这一座回来了 → 撤销掉线判负的倒计时
    if (this.deadlines.forfeit?.seat === seatIdx) this.deadlines.forfeit = null
    this.deadlines.abandon = Date.now() + ABANDON_MS
    this.touchTurnDeadline()
    await this.armAlarm()

    if (seatIdx === SPECTATOR) {
      if (this.state) {
        this.sendToSocket(server, {
          type: 'start',
          state: redactForSpectator(this.state),
          events: [],
          opponentName: this.seats[1].name,
          turnDeadline: this.deadlines.turn?.at,
        })
      }
      return new Response(null, { status: 101, webSocket: client })
    }

    const me = seatIdx as PlayerIdx
    // 重连:对局已在进行,直接补发当前视角状态,并告知对手已回归
    if (this.state) {
      this.sendTo(me, {
        type: 'start',
        state: redactState(this.state, me),
        events: [],
        opponentName: this.seats[other(me)].name,
        turnDeadline: this.deadlines.turn?.at,
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
    // 限流:同一连接 10 秒内超过 120 条就直接断开。
    // 每条 cmd 都会 storage.put 整个 GameState,不限流的话一个循环就能把这局刷爆。
    const now = Date.now()
    const windowStart = now - att.windowStart > RATE_WINDOW_MS ? now : att.windowStart
    const msgCount = windowStart === now ? 1 : att.msgCount + 1
    ws.serializeAttachment({ seat: att.seat, windowStart, msgCount } satisfies SocketAttachment)
    if (msgCount > RATE_MAX_MSGS) {
      log.warn({ evt: 'match.rate_limited', match: this.ctx.id.name, seat: att.seat, msgCount })
      try {
        ws.close(1008, 'rate-limited')
      } catch {
        /* 忽略 */
      }
      return
    }
    // 观战席只收不发 —— 它连座位令牌都没有,任何指令一律丢弃
    if (att.seat === SPECTATOR) return
    await this.onMessage(att.seat, typeof message === 'string' ? message : '')
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    await this.load()
    const att = ws.deserializeAttachment() as SocketAttachment | null
    if (!att || att.seat === SPECTATOR) return
    if (!this.state || this.state.phase === 'ended') return
    // 同一座位可能还有别的连接活着(重连竞态),那就不算掉线
    if (this.socketsFor(att.seat).length > 0) return
    this.sendTo(other(att.seat), { type: 'opponent-left' })
    // 掉线判负倒计时:不设这个的话,拔网线就是免费的逃分手段
    this.deadlines.forfeit = { seat: att.seat, at: Date.now() + FORFEIT_MS }
    await this.armAlarm()
  }

  async webSocketError(): Promise<void> {
    /* 断连统一由 webSocketClose 处理 */
  }

  // 三种时限共用这一个闹钟:掉线判负 → 回合超时 → 弃坑清理,按紧急程度依次判断。
  async alarm(): Promise<void> {
    await this.load()
    const now = Date.now()

    // 1) 掉线判负:代替掉线方投降,胜负与 ELO 正常结算
    const forfeit = this.deadlines.forfeit
    if (forfeit && forfeit.at <= now && this.state && this.state.phase !== 'ended') {
      if (this.socketsFor(forfeit.seat).length === 0) {
        this.deadlines.forfeit = null
        log.info({ evt: 'match.forfeit', match: this.ctx.id.name, seat: forfeit.seat })
        await this.applyServerCommand(forfeit.seat, { type: 'Concede' }, 'opponent-forfeited')
        return
      }
      this.deadlines.forfeit = null
    }

    // 2) 回合超时:服务器代打 EndTurn(绳子烧完)
    const turn = this.deadlines.turn
    if (turn && turn.at <= now && this.state && this.state.phase === 'main') {
      const active = this.state.activePlayer
      log.info({ evt: 'match.turn_timeout', match: this.ctx.id.name, seat: active, turn: turn.forTurn })
      await this.applyServerCommand(active, { type: 'EndTurn' }, 'turn-timeout')
      return
    }

    // 3) 弃坑清理:彻底销毁,不留 storage 残渣
    if (this.deadlines.abandon && this.deadlines.abandon <= now) {
      if (this.state && this.state.phase !== 'ended') {
        log.warn({ evt: 'match.abandoned', match: this.ctx.id.name, turn: this.state.turn })
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
      return
    }

    await this.armAlarm()
  }

  // 服务器代玩家执行一条命令(超时/判负),之后走与正常出牌完全相同的落盘与广播路径
  private async applyServerCommand(
    seat: PlayerIdx,
    cmd: Parameters<typeof applyCommand>[2],
    reason: string,
  ): Promise<void> {
    if (!this.state) return
    const r = applyCommand(this.state, seat, cmd, CARDS_BY_ID)
    if (!r.ok) {
      await this.armAlarm()
      return
    }
    this.state = r.state
    for (const s of [0, 1] as const) this.sendTo(s, { type: 'error', error: reason })
    await this.afterStateChange(r.events)
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

    if (msg.type === 'emote') {
      // 表情只在对局进行中转发,且**只有固定的六个 id** —— 客户端塞别的一律丢弃。
      // 这是唯一的社交通道,做成封闭集合是为了在没有举报/封禁系统时不给骚扰留口子。
      if (!this.state || this.state.phase === 'ended') return
      if (!EMOTE_IDS.has(msg.emote)) return
      // 限速另算一层:同一座位 3 秒内最多一个表情,防刷屏
      const last = this.lastEmoteAt[seatIdx] ?? 0
      const now = Date.now()
      if (now - last < 3000) return
      this.lastEmoteAt[seatIdx] = now
      this.sendTo(other(seatIdx), { type: 'emote', emote: msg.emote, from: 'opponent' })
      return
    }

    if (msg.type === 'rematch') {
      // 只在终局后的窗口期内有效
      if (!this.state || this.state.phase !== 'ended') return
      this.rematchWanted[seatIdx] = true
      if (!this.rematchWanted[other(seatIdx)]) {
        this.sendTo(other(seatIdx), { type: 'rematch-offered' })
        return
      }
      // 双方都点了 → 用同一副牌、同样的座位重开一局
      this.rematchWanted = [false, false]
      this.isRematch = true
      await this.startGame()
      return
    }

    if (msg.type === 'cmd') {
      if (!this.state) {
        this.sendTo(seatIdx, { type: 'error', error: 'match-not-started' })
        return
      }
      const r = applyCommand(this.state, seatIdx, msg.cmd, CARDS_BY_ID)
      if (!r.ok) {
        // 正常客户端不会发非法命令 —— 要么是 UI 有 bug,要么有人在试探
        log.warn({
          evt: 'match.illegal_command',
          match: this.ctx.id.name,
          seat: seatIdx,
          reason: r.error,
          cmd: msg.cmd.type,
        })
        this.sendTo(seatIdx, { type: 'error', error: r.error })
        return
      }
      this.state = r.state
      await this.afterStateChange(r.events)
    }
  }

  // 状态推进后的统一收尾:落盘 → 广播 → 终局结算 / 续时限
  private async afterStateChange(events: GameEvent[]): Promise<void> {
    if (!this.state) return
    await this.persist()
    this.broadcast('update', events)
    if (this.state.phase === 'ended') {
      await this.reportRatings()
      // 终局后不立刻销毁:留一个再战窗口。
      // 从前这里直接 deleteAll(),所以「联机再战」在服务端是没有落点的。
      this.deadlines.abandon = Date.now() + REMATCH_WINDOW_MS
      this.deadlines.turn = null
      this.deadlines.forfeit = null
      this.rematchWanted = [false, false]
      await this.persist()
      await this.armAlarm()
      return
    }
    this.deadlines.abandon = Date.now() + ABANDON_MS
    this.touchTurnDeadline()
    await this.armAlarm()
  }

  // 再战局不计天梯分。同一对玩家反复再战是经典的刷分路径,
  // 而排队撮合的那一局已经计过分了。
  private isRematch = false

  private async startGame(): Promise<void> {
    // 种子在引擎之外生成(服务器层允许非确定性);引擎内只吃种子
    const seed = Math.floor(Math.random() * 0x7fffffff)
    const heroes = [HEROES_BY_ID[this.seats[0].heroId], HEROES_BY_ID[this.seats[1].heroId]]
    this.cfg = {
      seed,
      heroIds: [this.seats[0].heroId, this.seats[1].heroId],
      deckIds: [this.seats[0].deckIds.slice(), this.seats[1].deckIds.slice()],
      first: (seed & 1) as PlayerIdx,
      // 主公技由服务器发放,客户端说了不算
      heroPowers: [heroes[0]?.power, heroes[1]?.power],
      heroHps: [heroes[0]?.hp ?? START_HP, heroes[1]?.hp ?? START_HP],
    }
    this.state = createGame(this.cfg, CARDS_BY_ID)
    this.deadlines.abandon = Date.now() + ABANDON_MS
    this.touchTurnDeadline()
    await this.armAlarm()
    await this.persist()
    this.broadcast('start', [])
  }

  // 天梯结算。三道门:
  // 1. 房间局(room- 前缀)不计分
  // 2. 缺 playerId 或两边同人不计分
  // 3. **matchId 必须由 QueueDO 签发** —— /match/:id 接受任意 8~64 字符的 id,
  //    从前两个串通的客户端可以自己编一个 id 连上、一方秒投,ELO 照常结算。
  //    一个人开两个浏览器就能把分刷到任意高度。现在要求 id 带 QueueDO 的 HMAC。
  private async reportRatings(): Promise<void> {
    if (!this.state || this.state.phase !== 'ended') return
    const matchName = this.ctx.id.name ?? ''
    if (matchName.startsWith('room-')) return
    if (this.isRematch) return
    if (!(await verifyMatchId(matchName, this.env.MATCH_SECRET))) return
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
      log.info({ evt: 'ratings.reported', match: matchName, result })
    } catch (e) {
      // 天梯不可用不影响对局结束 —— 但必须留下痕迹,否则「分没加」永远查不出原因
      log.error({ evt: 'ratings.report.failed', match: matchName }, e)
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
        turnDeadline: this.deadlines.turn?.at,
      })
    }
    // 观战席拿抹掉双方手牌的视角
    const spectators = this.socketsForSeat(SPECTATOR)
    if (spectators.length > 0) {
      const payload = JSON.stringify({
        type,
        state: redactForSpectator(this.state),
        events: events.map(redactEventForSpectator),
        opponentName: this.seats[1].name,
        turnDeadline: this.deadlines.turn?.at,
      } satisfies MatchServerMsg)
      for (const ws of spectators) {
        try {
          ws.send(payload)
        } catch {
          /* 掉线由 webSocketClose 处理 */
        }
      }
    }
  }

  private sendToSocket(ws: WebSocket, msg: MatchServerMsg): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      /* 刚建立就断开 —— 忽略 */
    }
  }

  private socketsForSeat(seat: Seat): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      const att = ws.deserializeAttachment() as SocketAttachment | null
      return att?.seat === seat
    })
  }

  // 某一座位当前还活着的连接。判断「真的掉线了」而不是「重连竞态里旧连接先关」要靠它。
  private socketsFor(seatIdx: PlayerIdx): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => {
      const att = ws.deserializeAttachment() as SocketAttachment | null
      return att?.seat === seatIdx && ws.readyState === WebSocket.READY_STATE_OPEN
    })
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
