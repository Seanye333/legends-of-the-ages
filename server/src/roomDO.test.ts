import { beforeAll, describe, expect, it } from 'vitest'
import { RoomDO } from './roomDO'
import {
  READY_STATE_OPEN,
  fakeSocketCtx,
  installWorkerdGlobals,
  type FakeSocket,
} from './testStorage'

// 好友房间。此前**零单测** —— 它的全部状态都挂在 socket 的 attachment 上
// (hibernation 要求),所以不打桩 socket 就一行也测不到,只能靠手动起 wrangler
// 的 drive-test。而房间码约战恰恰是最容易被玩家踩出边界的地方:
// 同一个码被两个人同时创建、房主挂着房间走开、好友晚到两小时、
// 观战的人凭码来问 matchId —— 这些都不是「跑一遍主流程」能覆盖的。

let lastServer: () => FakeSocket
beforeAll(() => {
  lastServer = installWorkerdGlobals().lastServer
})

/* eslint-disable @typescript-eslint/no-explicit-any */
const make = () => {
  const ctx = fakeSocketCtx('ROOM')
  return { ctx, room: new RoomDO(ctx as any) }
}

// 连一个人进来,返回它的 server 端 socket
async function connect(
  room: RoomDO,
  mode: 'create' | 'join',
  code = 'ABCD',
  name = 'p',
): Promise<FakeSocket> {
  await room.fetch(
    new Request(`https://room/?mode=${mode}&code=${code}&name=${name}`, {
      headers: { Upgrade: 'websocket' },
    }) as any,
  )
  return lastServer()
}

describe('RoomDO · 开房与加入', () => {
  it('房主创建后收到房间码,并挂上空房自毁闹钟', async () => {
    const { ctx, room } = make()
    const host = await connect(room, 'create')
    expect(host.msgs()).toEqual([{ type: 'room-created', code: 'ABCD' }])
    // 房主开了房再也没人来的话,两小时后连同 storage 一起清掉
    expect(ctx._alarm).toBeGreaterThan(Date.now())
  })

  it('同一个码被第二个人创建 → room-taken,而且不会顶掉原房主', async () => {
    const { room } = make()
    const host = await connect(room, 'create')
    const squatter = await connect(room, 'create')
    expect(squatter.msgs()).toEqual([{ type: 'error', error: 'room-taken' }])
    expect(squatter.closed).not.toBeNull()
    // 原房主必须毫发无损 —— 否则输错房间码的人能把别人的房挤掉
    expect(host.readyState).toBe(READY_STATE_OPEN)
    expect(host.msgs()).toHaveLength(1)
  })

  it('房间不存在时加入 → room-not-found', async () => {
    const { room } = make()
    const guest = await connect(room, 'join')
    expect(guest.msgs()).toEqual([{ type: 'error', error: 'room-not-found' }])
    expect(guest.closed).not.toBeNull()
  })

  it('撮合成功:双方拿到同一个 matchId、座次 0/1,且带 room- 前缀', async () => {
    const { ctx, room } = make()
    const host = await connect(room, 'create')
    const guest = await connect(room, 'join')
    const h = host.msgs<{ type: string; matchId: string; seat: number }>()[1]
    const g = guest.msgs<{ type: string; matchId: string; seat: number }>()[0]
    expect(h.type).toBe('matched')
    expect(g.type).toBe('matched')
    expect(h.matchId).toBe(g.matchId)
    expect(h.seat).toBe(0)
    expect(g.seat).toBe(1)
    // room- 前缀是 MatchDO 判定「这局不计天梯」的唯一依据(见 matchId.ts)。
    // 丢了前缀,好友之间互相喂分就能刷天梯。
    expect(h.matchId.startsWith('room-')).toBe(true)
    // 撮合完就该撤掉空房闹钟,否则两小时后 deleteAll 会把观战要用的 matchId 清掉
    expect(ctx._alarm).toBeNull()
  })

  it('并发加入:第二个人撮合不到同一个房主', async () => {
    // 房主 attachment 在 send 之前就被摘掉了,正是为了这个。
    // 没有这一步的话两个好友会各自和房主配成一局,房主同时坐进两局。
    const { room } = make()
    await connect(room, 'create')
    const g1 = await connect(room, 'join')
    const g2 = await connect(room, 'join')
    expect(g1.msgs<{ type: string }>()[0].type).toBe('matched')
    expect(g2.msgs()).toEqual([{ type: 'error', error: 'room-not-found' }])
  })

  it('房主断线后房间就没了 —— 晚到的好友看到的是 room-not-found', async () => {
    const { room } = make()
    const host = await connect(room, 'create')
    host.close() // 房主关掉了浏览器
    const guest = await connect(room, 'join')
    expect(guest.msgs()).toEqual([{ type: 'error', error: 'room-not-found' }])
  })
})

describe('RoomDO · 观战与过期', () => {
  it('对局还没开始时观战 → 404 no-match', async () => {
    const { room } = make()
    await connect(room, 'create')
    const res = await room.fetch(new Request('https://room/?mode=watch') as any)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'no-match' })
  })

  it('撮合之后观战能凭房间码换到 matchId', async () => {
    const { room } = make()
    const host = await connect(room, 'create')
    await connect(room, 'join')
    const matchId = host.msgs<{ matchId: string }>()[1].matchId
    const res = await room.fetch(new Request('https://room/?mode=watch') as any)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ matchId })
  })

  it('空房到期:挂着的房主被断开,storage 清空', async () => {
    const { ctx, room } = make()
    const host = await connect(room, 'create')
    await room.alarm()
    expect(host.closed?.reason).toBe('room-expired')
    expect(ctx._map.size).toBe(0)
  })

  it('非 websocket 且非 watch 的请求 → 426,不是 500', async () => {
    const { room } = make()
    const res = await room.fetch(new Request('https://room/?mode=create&code=ABCD') as any)
    expect(res.status).toBe(426)
  })

  it('缺 code 或 mode 非法 → 400', async () => {
    const { room } = make()
    const noCode = await room.fetch(
      new Request('https://room/?mode=create', { headers: { Upgrade: 'websocket' } }) as any,
    )
    expect(noCode.status).toBe(400)
    const badMode = await room.fetch(
      new Request('https://room/?mode=hack&code=ABCD', {
        headers: { Upgrade: 'websocket' },
      }) as any,
    )
    expect(badMode.status).toBe(400)
  })
})
