// @vitest-environment jsdom
//
// 重连看门狗。
//
// 起因是 drive-test 断续复现的一个形态:客户端掉线之后**一条 reconnecting 都没有**,
// 服务端 90 秒后判负。根因没能钉死(加了日志之后连跑十二次都正常),
// 但重连的唯一触发点是 `ws.onclose` —— 只要那一次回调因为任何原因没跑到
// (浏览器切后台冻结、close 在 onmessage 里同步触发时被吞、移动端网络栈直接丢 socket),
// 客户端就会一直静静等下去。
//
// 所以这里测的**不是**「onclose 会触发重连」(那条路本来就有),
// 而是「**onclose 压根没来**的时候,看门狗照样把连接救回来」——
// 用一个不会派发 close 事件的假 socket 精确复现那个形态。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RemoteMatch, type RemoteSession } from './remoteMatch'
import { PRECON_DECKS } from '../content/decks'

class FakeSocket {
  static instances: FakeSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  readyState = 1 // 直接当作已连上
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []

  constructor(public url: string) {
    FakeSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  // 关键:只把状态改成 CLOSED,**不派发 close 事件** —— 复现那个卡死形态
  dieSilently(): void {
    this.readyState = 3
  }

  close(): void {
    this.readyState = 3
    this.onclose?.()
  }
}

const SESSION: RemoteSession = {
  server: 'localhost:8787',
  matchId: 'm-1',
  seat: 0,
  token: 't',
  name: '刘备军',
  deck: PRECON_DECKS[0],
}

const noopCallbacks = () => ({
  onStatus: vi.fn(),
  onUpdate: vi.fn(),
  onError: vi.fn(),
})

describe('重连看门狗', () => {
  beforeEach(() => {
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
    vi.useFakeTimers()
    localStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('onclose 没来也能把死掉的连接救回来', () => {
    const cb = noopCallbacks()
    const rm = new RemoteMatch(SESSION.server, SESSION.deck, SESSION.name, cb, 'pid')
    rm.resume(SESSION)
    expect(FakeSocket.instances).toHaveLength(1)

    // 连接静默死亡:状态是 CLOSED,但没有任何事件通知客户端
    FakeSocket.instances[0].dieSilently()
    cb.onStatus.mockClear()

    // 看门狗周期 5s;发现之后还要走一次退避(首次 1s)才真的开新连接
    vi.advanceTimersByTime(5_100)
    expect(cb.onStatus).toHaveBeenCalledWith('reconnecting')
    vi.advanceTimersByTime(1_100)
    expect(FakeSocket.instances.length).toBeGreaterThan(1)
    expect(FakeSocket.instances[1].url).toContain('/match/m-1')

    rm.close()
  })

  it('连接活着的时候不打扰它', () => {
    const cb = noopCallbacks()
    const rm = new RemoteMatch(SESSION.server, SESSION.deck, SESSION.name, cb, 'pid')
    rm.resume(SESSION)
    cb.onStatus.mockClear()

    vi.advanceTimersByTime(60_000)
    expect(cb.onStatus).not.toHaveBeenCalledWith('reconnecting')
    expect(FakeSocket.instances).toHaveLength(1)

    rm.close()
  })

  it('主动离开之后看门狗必须停 —— 否则退出对局还在后台悄悄重连', () => {
    const cb = noopCallbacks()
    const rm = new RemoteMatch(SESSION.server, SESSION.deck, SESSION.name, cb, 'pid')
    rm.resume(SESSION)
    rm.close()
    FakeSocket.instances[0].dieSilently()
    cb.onStatus.mockClear()

    vi.advanceTimersByTime(60_000)
    expect(cb.onStatus).not.toHaveBeenCalledWith('reconnecting')
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
