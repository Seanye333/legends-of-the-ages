// DurableObjectState 的最小内存替身,供单元测试用。
//
// 用它而不是 @cloudflare/vitest-pool-workers 的取舍:
// 那个方案能跑真 workerd(更真实),但要引一整套 pool + 单独的 vitest 配置,
// 而我们要测的是**纯逻辑**——ELO 数学、赛季换算、TOFU 判定、闹钟取最早值。
// 这些逻辑不碰 workerd 的任何特有行为,一个 Map 就够了。
//
// 真正需要 workerd 语义的部分(hibernation、alarm 真的被调度、WebSocketPair)
// 仍然只能靠 server/drive-test.ts —— 那条防线不能撤。
export interface FakeCtx {
  // 计数器:用来断言「读榜单不再遍历全表」这类性能契约
  _listCalls: number
  storage: {
    get<T>(key: string): Promise<T | undefined>
    put(key: string, value: unknown): Promise<void>
    delete(key: string): Promise<boolean>
    deleteAll(): Promise<void>
    list<T>(opts?: { prefix?: string }): Promise<Map<string, T>>
    setAlarm(at: number): Promise<void>
    getAlarm(): Promise<number | null>
  }
  id: { name?: string }
  _alarm: number | null
  _map: Map<string, unknown>
}

export function fakeCtx(name?: string): FakeCtx {
  const map = new Map<string, unknown>()
  const ctx: FakeCtx = {
    _map: map,
    _alarm: null,
    _listCalls: 0,
    id: { name },
    storage: {
      async get<T>(key: string) {
        // 结构化克隆一份:真 DO 的 get 返回的是反序列化结果,
        // 直接返回同一个对象引用会让「改了没 put 也生效」这类 bug 测不出来
        const v = map.get(key)
        return (v === undefined ? undefined : structuredClone(v)) as T | undefined
      },
      async put(key: string, value: unknown) {
        map.set(key, structuredClone(value))
      },
      async delete(key: string) {
        return map.delete(key)
      },
      async deleteAll() {
        map.clear()
      },
      async list<T>(opts?: { prefix?: string }) {
        ctx._listCalls++
        const out = new Map<string, T>()
        for (const [k, v] of map) {
          if (opts?.prefix && !k.startsWith(opts.prefix)) continue
          out.set(k, structuredClone(v) as T)
        }
        return out
      },
      async setAlarm(at: number) {
        ctx._alarm = at
      },
      async getAlarm() {
        return ctx._alarm
      },
    },
  }
  return ctx
}

// ---------- WebSocket 替身 ----------
//
// 三个还没被单测覆盖的 DO(match / queue / room)全部走 **hibernation API**:
// 状态不放内存,而是 serializeAttachment 到 socket 上,名单靠 ctx.getWebSockets()
// 推导。也就是说**不模拟 socket 就一行都测不到** —— 这正是它们至今零单测的原因,
// 也是为什么它们的 bug 只有 drive-test 抓得到(而 drive-test 要手动起 wrangler)。
//
// 这里只做 hibernation 这一小块语义,不做真 workerd:
//   · attachment 结构化克隆(真 runtime 会序列化,直接存引用会让 bug 测不出来)
//   · readyState 随 close 变化(几个 DO 都靠它过滤失效连接)
//   · 收到的消息按序记下来,供断言
// 真正需要 workerd 的(真的 hibernate、alarm 真被调度、WebSocketPair 的配对语义)
// 仍然只能靠 server/drive-test.ts。
export interface FakeSocket {
  readyState: number
  sent: string[]
  closed: { code: number; reason: string } | null
  send(data: string): void
  close(code?: number, reason?: string): void
  serializeAttachment(v: unknown): void
  deserializeAttachment(): unknown
  // 便利读取:把收到的 JSON 消息解出来
  msgs<T = unknown>(): T[]
}

export const READY_STATE_OPEN = 1
export const READY_STATE_CLOSED = 3

export function fakeSocket(): FakeSocket {
  let attachment: unknown = null
  const ws: FakeSocket = {
    readyState: READY_STATE_OPEN,
    sent: [],
    closed: null,
    send(data: string) {
      if (ws.readyState !== READY_STATE_OPEN) throw new Error('socket closed')
      ws.sent.push(data)
    },
    close(code = 1000, reason = '') {
      ws.readyState = READY_STATE_CLOSED
      ws.closed = { code, reason }
    },
    serializeAttachment(v: unknown) {
      attachment = v === null || v === undefined ? null : structuredClone(v)
    },
    deserializeAttachment() {
      return attachment === null ? null : structuredClone(attachment)
    },
    msgs<T = unknown>() {
      return ws.sent.map((s) => JSON.parse(s) as T)
    },
  }
  return ws
}

export interface FakeSocketCtx extends FakeCtx {
  _sockets: FakeSocket[]
  acceptWebSocket(ws: unknown): void
  getWebSockets(): unknown[]
}

// 带 socket 的 ctx。DO 内部调 acceptWebSocket 时会拿到 WebSocketPair 造出来的
// server 端;测试里我们自己造 socket 传进 DO 的 fetch —— 见各 DO 测试里的
// connect() 辅助函数(它替 WebSocketPair 打桩)。
export function fakeSocketCtx(name?: string): FakeSocketCtx {
  const base = fakeCtx(name) as FakeSocketCtx
  base._sockets = []
  base.acceptWebSocket = (ws: unknown) => {
    base._sockets.push(ws as FakeSocket)
  }
  base.getWebSockets = () => base._sockets.filter((s) => s.readyState === READY_STATE_OPEN)
  // deleteAlarm:RoomDO 撮合成功后会撤掉空房自毁闹钟
  ;(base.storage as unknown as { deleteAlarm(): Promise<void> }).deleteAlarm = async () => {
    base._alarm = null
  }
  return base
}

// workerd 的全局打桩。三个走 hibernation 的 DO 都要它,所以收在这里。
//
// 【为什么必须换掉 Response】
// DO 的 WebSocket 入口一律 `return new Response(null, { status: 101, webSocket })`。
// **node 的 Response 直接拒绝 101**(fetch 规范里 101 是保留给协议切换的,
// 只有 workerd 这类实现才允许构造),于是测试里每一次连接都会抛
// 「init["status"] must be in the range of 200 to 599」。
// 换一个最小实现,把 101 放行,其余语义(status / json / text)照旧。
export function installWorkerdGlobals(): { lastServer: () => FakeSocket } {
  let last: FakeSocket
  const g = globalThis as Record<string, unknown>
  g.WebSocketPair = class {
    constructor() {
      last = fakeSocket()
      // DO 里写的是 `const [client, server] = Object.values(pair)` —— client 在前
      return { 0: {}, 1: last }
    }
  }
  g.WebSocket = { READY_STATE_OPEN }
  const RealResponse = g.Response as typeof Response
  class WorkerdResponse {
    status: number
    private body: string | null
    constructor(body?: BodyInit | null, init?: ResponseInit) {
      this.status = init?.status ?? 200
      this.body = typeof body === 'string' ? body : null
    }
    async json(): Promise<unknown> {
      return this.body === null ? null : JSON.parse(this.body)
    }
    async text(): Promise<string> {
      return this.body ?? ''
    }
    static json(data: unknown, init?: ResponseInit): WorkerdResponse {
      return new WorkerdResponse(JSON.stringify(data), init)
    }
  }
  // 只在 101 上偏离标准;其余交回真实现,免得顺手改坏了别的语义
  g.Response = new Proxy(WorkerdResponse, {
    construct(target, args: [BodyInit | null | undefined, ResponseInit | undefined]) {
      const status = args[1]?.status ?? 200
      if (status >= 200 && status <= 599) return new RealResponse(args[0], args[1])
      return new target(...args)
    },
  })
  return { lastServer: () => last }
}
