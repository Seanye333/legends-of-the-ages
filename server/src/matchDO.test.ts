import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { MatchDO } from './matchDO'
import { fakeSocketCtx, installWorkerdGlobals, type FakeSocket, type FakeSocketCtx } from './testStorage'
import { PROTOCOL_VERSION } from '../../src/app/protocol'
import { PRECON_DECKS } from '../../src/content/decks'

// 对局 DO —— server/ 里最大的一个文件(617 行),此前**零单测**。
//
// 它管的全是**跨会话状态**:座位令牌、断线判负倒计时、回合钟、弃坑清理、
// 重赛窗口、限流、观战裁剪。这些的共同点是「只在第二次连接时才出错」,
// 而 drive-test 跑的是一遍顺流程,并且要手动起 wrangler ——
// 也就是说这一整类问题此前**没有任何自动防线**。
//
// 这一轮上线前补的重点是三条会被真人立刻踩到的:
//   · 旁人拿着别人的房间码连过来能不能看到手牌(座位令牌)
//   · 拔网线是不是免费逃分(判负倒计时)
//   · 观战席能不能看到双方手牌(裁剪)

let lastServer: () => FakeSocket
beforeAll(() => {
  lastServer = installWorkerdGlobals().lastServer
})
afterEach(() => vi.useRealTimers())

/* eslint-disable @typescript-eslint/no-explicit-any */

const ratingsStub = {
  idFromName: () => 'global',
  get: () => ({ fetch: async () => ({ json: async () => ({ rating: 1200 }) }) }),
}

function make(name = 'room-test-match') {
  const ctx = fakeSocketCtx(name)
  return { ctx, match: new MatchDO(ctx as any, { RATINGS: ratingsStub } as any) }
}

// 接一条连接进来(不发 join)
async function connect(
  match: MatchDO,
  seat: number,
  token: string,
): Promise<{ ws: FakeSocket | null; status: number }> {
  const res = await match.fetch(
    new Request(`https://m/?seat=${seat}&token=${token}`, {
      headers: { Upgrade: 'websocket' },
    }) as any,
  )
  return { ws: res.status === 101 ? lastServer() : null, status: res.status }
}

// 坐下并报卡组。两边都坐满就会开局。
async function sit(match: MatchDO, seat: 0 | 1, token: string): Promise<FakeSocket> {
  const { ws } = await connect(match, seat, token)
  const deck = PRECON_DECKS[seat]
  await match.webSocketMessage(
    ws! as any,
    JSON.stringify({
      type: 'join',
      v: PROTOCOL_VERSION,
      name: `p${seat}`,
      playerId: `p${seat}`,
      heroId: deck.heroId,
      deckIds: deck.cardIds,
    }),
  )
  return ws!
}

// 开一局,返回两边的 socket
async function startMatch(match: MatchDO): Promise<[FakeSocket, FakeSocket]> {
  const a = await sit(match, 0, 'tok-a')
  const b = await sit(match, 1, 'tok-b')
  return [a, b]
}

describe('MatchDO · 座位令牌', () => {
  it('首连认领座位;拿着别的令牌来的人被挡在外面', async () => {
    // 房间码是四个字符,猜中并不难。没有这道闸门的话,
    // 猜中码的人可以直接连 seat=0 顶掉房主,**并且看到他的手牌**。
    const { match } = make()
    const first = await connect(match, 0, 'mine')
    expect(first.status).toBe(101)
    const impostor = await connect(match, 0, 'theirs')
    expect(impostor.status).toBe(403)
  })

  it('同一个令牌可以重连(换设备/刷新页面)', async () => {
    const { match } = make()
    await connect(match, 0, 'mine')
    const again = await connect(match, 0, 'mine')
    expect(again.status).toBe(101)
  })

  it('两个座位互不影响', async () => {
    const { match } = make()
    expect((await connect(match, 0, 'a')).status).toBe(101)
    expect((await connect(match, 1, 'b')).status).toBe(101)
  })

  it('座位号非法 / 缺令牌 → 400,不是静默接受', async () => {
    const { match } = make()
    expect((await connect(match, 7, 'x')).status).toBe(400)
    const noToken = await match.fetch(
      new Request('https://m/?seat=0', { headers: { Upgrade: 'websocket' } }) as any,
    )
    expect(noToken.status).toBe(400)
  })

  it('非 websocket 请求 → 426', async () => {
    const { match } = make()
    const res = await match.fetch(new Request('https://m/?seat=0&token=t') as any)
    expect(res.status).toBe(426)
  })
})

describe('MatchDO · 开局与重连', () => {
  it('两边都报了合法卡组才开局,双方各自收到自己的视角', async () => {
    const { match } = make()
    const [a, b] = await startMatch(match)
    const as = a.msgs<{ type: string }>().filter((m) => m.type === 'start')
    const bs = b.msgs<{ type: string }>().filter((m) => m.type === 'start')
    expect(as).toHaveLength(1)
    expect(bs).toHaveLength(1)
  })

  it('非法卡组被服务器挡下 —— 不能靠改客户端塞 40 张传说', async () => {
    const { match } = make()
    const { ws } = await connect(match, 0, 'tok-a')
    await match.webSocketMessage(
      ws! as any,
      JSON.stringify({
        type: 'join',
        v: PROTOCOL_VERSION,
        name: 'cheat',
        playerId: 'cheat',
        heroId: PRECON_DECKS[0].heroId,
        deckIds: PRECON_DECKS[0].cardIds.slice(0, 5),
      }),
    )
    const err = ws!.msgs<{ type: string; error: string }>().find((m) => m.type === 'error')
    expect(err?.error).toContain('illegal-deck')
  })

  it('协议版本过旧 → 明确报错,而不是开局后炸在半路', async () => {
    const { match } = make()
    const { ws } = await connect(match, 0, 'tok-a')
    await match.webSocketMessage(
      ws! as any,
      JSON.stringify({
        type: 'join',
        v: PROTOCOL_VERSION - 1,
        name: 'old',
        playerId: 'old',
        heroId: PRECON_DECKS[0].heroId,
        deckIds: PRECON_DECKS[0].cardIds,
      }),
    )
    const err = ws!.msgs<{ type: string; error: string }>().find((m) => m.type === 'error')
    expect(err?.error).toContain('outdated')
  })

  it('重连拿回当前状态,对手收到 opponent-back', async () => {
    const { match } = make()
    const [a, b] = await startMatch(match)
    a.close()
    await match.webSocketClose(a as any)
    const before = b.msgs().length
    const { ws: back } = await connect(match, 0, 'tok-a')
    expect(back!.msgs<{ type: string }>().some((m) => m.type === 'start')).toBe(true)
    const news = b.msgs<{ type: string }>().slice(before)
    expect(news.some((m) => m.type === 'opponent-back')).toBe(true)
  })
})

describe('MatchDO · 掉线判负', () => {
  it('掉线会挂上判负倒计时,对手收到 opponent-left', async () => {
    // 没有这个倒计时的话,拔网线就是免费的逃分手段 ——
    // 眼看要输就断线,天梯分永远不掉。
    const { ctx, match } = make()
    const [a, b] = await startMatch(match)
    a.close()
    await match.webSocketClose(a as any)
    expect(b.msgs<{ type: string }>().some((m) => m.type === 'opponent-left')).toBe(true)
    expect(ctx._alarm).not.toBeNull()
  })

  it('倒计时内回来就撤销 —— 地铁进隧道不该判负', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { match } = make()
    const [a, b] = await startMatch(match)
    a.close()
    await match.webSocketClose(a as any)
    vi.advanceTimersByTime(30_000) // 90 秒宽限里的 30 秒
    await connect(match, 0, 'tok-a')
    const before = b.msgs().length
    vi.advanceTimersByTime(120_000) // 再等到远超原判负点
    await match.alarm()
    // 回来了就不该判负 —— 对手这边不能收到任何「对局结束」的推送
    const after = b.msgs<{ type: string; state?: { phase: string } }>().slice(before)
    expect(after.some((m) => m.state?.phase === 'ended')).toBe(false)
  })

  it('倒计时烧完且人没回来 → 代为投降,对局结束', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { match } = make()
    const [a, b] = await startMatch(match)
    a.close()
    await match.webSocketClose(a as any)
    vi.advanceTimersByTime(91_000) // 超过 90 秒宽限
    await match.alarm()
    const ended = b.msgs<{ type: string; state?: { phase: string } }>().some(
      (m) => m.state?.phase === 'ended',
    )
    expect(ended).toBe(true)
  })

  it('重连竞态:同一座位还有别的连接活着就不算掉线', async () => {
    // 手机切后台再回来会先建新连接、旧连接稍后才 close。
    // 不查这一下的话,新连接刚接上就被旧连接的 close 判成掉线。
    const { ctx, match } = make()
    const [a] = await startMatch(match)
    await connect(match, 0, 'tok-a') // 新连接先上来
    const alarmBefore = ctx._alarm
    a.close() // 旧连接这才断
    await match.webSocketClose(a as any)
    expect(ctx._alarm).toBe(alarmBefore) // 没有新挂判负闹钟
  })
})

describe('MatchDO · 观战席', () => {
  it('对局没开始时不让接入', async () => {
    const { match } = make()
    const res = await connect(match, 2, 'anything')
    expect(res.status).toBe(409)
  })

  it('接入后看不到任何一方的牌面 —— 只看得到手牌张数', async () => {
    // 观战最容易出的事故是「裁剪漏了一处」,而漏了不会报错,
    // 只是观战的人能读到双方底牌。这一条是它唯一的自动防线。
    const { match } = make()
    await startMatch(match)
    const { ws } = await connect(match, 2, 'watch')
    const start = ws!.msgs<{ type: string; state: any }>().find((m) => m.type === 'start')!
    const st = start.state
    // 观战视角复用「0 号玩家视角」的形状,再把 0 号的手牌抹成占位实例。
    // 所以两边要分别验:self 侧牌面被抹空,opponent 侧根本没有 hand 字段。
    expect(st.self.hand.length, '手牌张数仍然要可见').toBeGreaterThan(0)
    for (const card of st.self.hand) {
      expect(card.defId, '观战席看到了 0 号玩家的牌面').toBe('')
    }
    expect(st.opponent.hand, '观战席拿到了 1 号玩家的手牌数组').toBeUndefined()
    expect(st.opponent.handCount, '对手手牌张数仍然要可见').toBeGreaterThan(0)
    // 伏兵同理 —— 观众不能比对手多知道一半信息
    for (const sec of st.self.secrets) expect(sec.defId).toBe('')
  })

  it('观战席发来的任何指令一律丢弃', async () => {
    const { match } = make()
    const [a] = await startMatch(match)
    const { ws } = await connect(match, 2, 'watch')
    const before = a.msgs().length
    await match.webSocketMessage(
      ws! as any,
      JSON.stringify({ type: 'cmd', cmd: { type: 'Concede' } }),
    )
    // 没有任何广播 —— 观战席不能替人投降
    expect(a.msgs().length).toBe(before)
  })
})

describe('MatchDO · 限流', () => {
  it('10 秒内超过 120 条就断开这条连接', async () => {
    // 每条 cmd 都会把整个 GameState 落盘,不限流的话一个 while 循环
    // 就能把这一局的存储刷爆(而且是按次计费的)。
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { match } = make()
    const [a] = await startMatch(match)
    for (let i = 0; i < 130 && a.readyState === 1; i++) {
      await match.webSocketMessage(a as any, JSON.stringify({ type: 'ping' }))
    }
    expect(a.closed?.reason).toBe('rate-limited')
  })

  it('时钟冻结时依然限流 —— workerd 没有 I/O 就不推进 Date.now()', async () => {
    // 这一条钉的是刚修掉的 bug:原来用「窗口起点 === 此刻」判新窗口,
    // 而 Workers 在无 I/O 的执行块里时钟是冻的,垃圾消息一路走不到落盘,
    // 于是计数每条都被重置成 1,限流形同虚设。
    // 时间完全不推进 = 最坏情况,这时候更应该断开,而不是放行。
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { match } = make()
    const [a] = await startMatch(match)
    for (let i = 0; i < 200 && a.readyState === 1; i++) {
      await match.webSocketMessage(a as any, 'garbage{not-json')
    }
    expect(a.closed?.reason).toBe('rate-limited')
  })

  it('窗口滚过之后重新计数,不是永久封禁', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { match } = make()
    const [a] = await startMatch(match)
    for (let i = 0; i < 100; i++) {
      await match.webSocketMessage(a as any, JSON.stringify({ type: 'ping' }))
    }
    vi.advanceTimersByTime(11_000)
    for (let i = 0; i < 100; i++) {
      await match.webSocketMessage(a as any, JSON.stringify({ type: 'ping' }))
    }
    expect(a.readyState).toBe(1)
  })
})

describe('MatchDO · 弃坑清理', () => {
  it('超过弃坑时限 → 通知双方、断开、清空 storage', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00Z'))
    const { ctx, match } = make()
    const [a, b] = await startMatch(match)
    vi.advanceTimersByTime(7 * 60 * 60 * 1000) // 超过 6 小时
    await match.alarm()
    for (const ws of [a, b]) {
      expect(ws.msgs<{ type: string; error?: string }>().some((m) => m.error === 'match-abandoned')).toBe(true)
      expect(ws.closed?.reason).toBe('abandoned')
    }
    expect((ctx as FakeSocketCtx)._map.size).toBe(0)
  })
})
