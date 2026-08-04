import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { QueueDO } from './queueDO'
import { fakeSocketCtx, installWorkerdGlobals, type FakeSocket } from './testStorage'
import { DEFAULT_RATING, PROTOCOL_VERSION } from '../../src/app/protocol'

// 匹配队列。此前**零单测**,理由和 RoomDO 一样:等待者名单不在内存里,
// 而是 ctx.getWebSockets() + attachment 推出来的(hibernation 唤醒后内存必空)。
//
// 这一层的逻辑全是**只在特定时序下才错**的那种:分段撮合、久等放宽、
// 查分期间掉线、并发 join 撞同一个对手。跑一遍主流程一条都碰不到。

let lastServer: () => FakeSocket
beforeAll(() => {
  lastServer = installWorkerdGlobals().lastServer
})
afterEach(() => vi.useRealTimers())

/* eslint-disable @typescript-eslint/no-explicit-any */

// RATINGS 命名空间打桩:按 playerId 返回预设分数
function ratingsStub(table: Record<string, number>) {
  return {
    idFromName: () => 'global',
    get: () => ({
      fetch: async (url: string) => {
        const id = decodeURIComponent(new URL(url).searchParams.get('playerId') ?? '')
        return { json: async () => ({ rating: table[id] ?? DEFAULT_RATING }) }
      },
    }),
  }
}

const make = (table: Record<string, number> = {}, secret = 'test-secret') => {
  const ctx = fakeSocketCtx('QUEUE')
  return { ctx, queue: new QueueDO(ctx as any, { RATINGS: ratingsStub(table), MATCH_SECRET: secret } as any) }
}

// 一个人进队。返回它的 socket
async function join(
  queue: QueueDO,
  playerId: string,
  v: number = PROTOCOL_VERSION,
): Promise<FakeSocket> {
  await queue.fetch(new Request('https://q/', { headers: { Upgrade: 'websocket' } }) as any)
  const ws = lastServer()
  await queue.webSocketMessage(ws as any, JSON.stringify({ type: 'join', name: playerId, playerId, v }))
  return ws
}

describe('QueueDO · 撮合', () => {
  it('一个人排队 → waiting', async () => {
    const { queue } = make()
    const a = await join(queue, 'alice')
    expect(a.msgs()).toEqual([{ type: 'waiting' }])
  })

  it('分差在段内 → 双方拿到同一个 matchId 与对立座次,并被断开', async () => {
    const { queue } = make({ alice: 1200, bob: 1300 })
    const a = await join(queue, 'alice')
    const b = await join(queue, 'bob')
    const am = a.msgs<{ type: string; matchId: string; seat: number }>()
    const bm = b.msgs<{ type: string; matchId: string; seat: number }>()
    expect(am[0]).toEqual({ type: 'waiting' })
    expect(am[1].type).toBe('matched')
    expect(bm[0].type).toBe('matched')
    expect(am[1].matchId).toBe(bm[0].matchId)
    expect([am[1].seat, bm[0].seat].sort()).toEqual([0, 1])
    // 撮合完必须断开 —— 留在队列里会被下一个人再撮合一次
    expect(a.closed?.reason).toBe('matched')
    expect(b.closed?.reason).toBe('matched')
  })

  it('天梯对局 id 由队列签发(不带 room- 前缀,MatchDO 会验签)', async () => {
    const { queue } = make()
    const a = await join(queue, 'alice')
    await join(queue, 'bob')
    const m = a.msgs<{ matchId?: string }>()[1].matchId!
    expect(m.startsWith('room-')).toBe(false)
    // 签名格式:uuid~签名 —— 没有签名的话谁都能自选 id 连上去秒投刷分
    expect(m).toContain('~')
    expect(m.split('~')[1]).toHaveLength(16)
  })

  it('分差超段且都是新来的 → 不撮合,各自等着', async () => {
    const { queue } = make({ alice: 1000, bob: 1600 })
    const a = await join(queue, 'alice')
    const b = await join(queue, 'bob')
    expect(a.msgs()).toEqual([{ type: 'waiting' }])
    expect(b.msgs()).toEqual([{ type: 'waiting' }])
  })

  it('对方久等超过 15 秒 → 放宽到任意分差', async () => {
    // 不放宽的话,分数在两端的玩家会永远匹配不上 ——
    // 而天梯人少的时候「两端」就是绝大多数人。
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { queue } = make({ alice: 1000, bob: 1600 })
    const a = await join(queue, 'alice')
    vi.advanceTimersByTime(16_000)
    const b = await join(queue, 'bob')
    expect(a.msgs<{ type: string }>()[1].type).toBe('matched')
    expect(b.msgs<{ type: string }>()[0].type).toBe('matched')
  })

  it('多个等待者时挑分数最接近的那个', async () => {
    // 分数要挑得让 far 和 near 彼此**不在段内**(否则它俩先自己配掉了),
    // 但两个都在 me 的段内 —— 这样才真的在考「挑最近的」而不是「挑第一个」。
    // far 940 / near 1250:相差 310 > 300;对 me(1200)分别是 260 和 50。
    const { queue } = make({ far: 940, near: 1250, me: 1200 })
    const far = await join(queue, 'far')
    const near = await join(queue, 'near')
    const me = await join(queue, 'me')
    expect(me.msgs<{ type: string }>()[0].type).toBe('matched')
    expect(near.msgs<{ type: string }>()[1].type).toBe('matched')
    // 分差 250 也在段内,但 near 更接近 —— far 必须还在等
    expect(far.msgs()).toEqual([{ type: 'waiting' }])
  })
})

describe('QueueDO · 拒绝与容错', () => {
  it('协议版本过旧 → 报错并断开,不进队列', async () => {
    // 放旧客户端进来的话,撮合成功之后才会在对局里炸,
    // 而那时候两个人都已经离开匹配界面了。
    const { queue } = make()
    const old = await join(queue, 'alice', PROTOCOL_VERSION - 1)
    const msg = old.msgs<{ type: string; error: string }>()[0]
    expect(msg.type).toBe('error')
    expect(msg.error).toContain('outdated')
    expect(old.closed).not.toBeNull()
    // 后来的人不该被这个已断开的连接撮合到
    const b = await join(queue, 'bob')
    expect(b.msgs()).toEqual([{ type: 'waiting' }])
  })

  it('重复 join 被忽略,不会自己和自己配对', async () => {
    const { queue } = make()
    await queue.fetch(new Request('https://q/', { headers: { Upgrade: 'websocket' } }) as any)
    const ws = lastServer()
    const send = () =>
      queue.webSocketMessage(ws as any, JSON.stringify({ type: 'join', name: 'a', playerId: 'a', v: PROTOCOL_VERSION }))
    await send()
    await send()
    expect(ws.msgs()).toEqual([{ type: 'waiting' }])
  })

  it('非 join 消息与坏 JSON 一律安静忽略,不抛', async () => {
    const { queue } = make()
    await queue.fetch(new Request('https://q/', { headers: { Upgrade: 'websocket' } }) as any)
    const ws = lastServer()
    await expect(queue.webSocketMessage(ws as any, 'not json{')).resolves.toBeUndefined()
    await expect(
      queue.webSocketMessage(ws as any, JSON.stringify({ type: 'leave' })),
    ).resolves.toBeUndefined()
    expect(ws.sent).toEqual([])
  })

  it('查分失败也能进队列(回落默认分),不是把人卡在原地', async () => {
    const ctx = fakeSocketCtx('QUEUE')
    const boom = { idFromName: () => 'g', get: () => ({ fetch: async () => { throw new Error('down') } }) }
    const queue = new QueueDO(ctx as any, { RATINGS: boom } as any)
    const a = await join(queue, 'alice')
    expect(a.msgs()).toEqual([{ type: 'waiting' }])
  })

  it('查分期间掉线的人不会被撮合进去', async () => {
    // lookupRating 是 await 的,期间这个人可能已经关掉浏览器。
    // 不查这一下的话,对手会收到一个 matched 然后对着空座位等 90 秒判负。
    const ctx = fakeSocketCtx('QUEUE')
    let release: () => void = () => {}
    const slow = {
      idFromName: () => 'g',
      get: () => ({
        fetch: async () => {
          await new Promise<void>((r) => (release = r))
          return { json: async () => ({ rating: DEFAULT_RATING }) }
        },
      }),
    }
    const queue = new QueueDO(ctx as any, { RATINGS: slow } as any)
    await queue.fetch(new Request('https://q/', { headers: { Upgrade: 'websocket' } }) as any)
    const ws = lastServer()
    const pending = queue.webSocketMessage(
      ws as any,
      JSON.stringify({ type: 'join', name: 'a', playerId: 'a', v: PROTOCOL_VERSION }),
    )
    ws.close() // 查分还没回来,人已经走了
    release()
    await pending
    expect(ws.sent).toEqual([])
  })
})
