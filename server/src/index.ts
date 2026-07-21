import { MIN_CLIENT_VERSION, SERVER_PROTOCOL_VERSION } from './protocolGuard'
// 千古名将联机服务器:Cloudflare Worker 入口。
// /queue → QueueDO(全局单例匹配队列,按天梯分段撮合)
// /room/new /room/join/:code → RoomDO(好友房间码,一码一实例)
// /match/:id → MatchDO(一场对局一个实例)
// /rating /ladder → RatingsDO(ELO 天梯,只读;写入仅限 MatchDO 内部绑定)
export { QueueDO } from './queueDO'
export { MatchDO } from './matchDO'
export { RoomDO } from './roomDO'
export { RatingsDO } from './ratingsDO'
export { ProfileDO } from './profileDO'

interface Env {
  QUEUE: DurableObjectNamespace
  MATCH: DurableObjectNamespace
  ROOM: DurableObjectNamespace
  RATINGS: DurableObjectNamespace
  PROFILE: DurableObjectNamespace
}

// 去掉易混字符(0O1IL)的房间码字母表
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const CODE_LEN = 4

function newRoomCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LEN; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return code
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'qiangu-server', protocol: SERVER_PROTOCOL_VERSION, minClient: MIN_CLIENT_VERSION }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (url.pathname === '/queue') {
      const id = env.QUEUE.idFromName('global')
      return env.QUEUE.get(id).fetch(request)
    }

    if (url.pathname === '/room/new') {
      const code = newRoomCode()
      const forward = new URL(request.url)
      forward.searchParams.set('mode', 'create')
      forward.searchParams.set('code', code)
      const id = env.ROOM.idFromName(code)
      return env.ROOM.get(id).fetch(new Request(forward, request))
    }

    const roomJoin = url.pathname.match(/^\/room\/join\/([A-Za-z0-9]{4,8})$/)
    if (roomJoin) {
      const code = roomJoin[1].toUpperCase()
      const forward = new URL(request.url)
      forward.searchParams.set('mode', 'join')
      forward.searchParams.set('code', code)
      const id = env.ROOM.idFromName(code)
      return env.ROOM.get(id).fetch(new Request(forward, request))
    }

    // 观战:凭房间码取本局 matchId,客户端拿它以 seat=2 接入 MatchDO
    const roomWatch = url.pathname.match(/^\/room\/watch\/([A-Za-z0-9]{4,8})$/)
    if (roomWatch) {
      const code = roomWatch[1].toUpperCase()
      const forward = new URL(request.url)
      forward.searchParams.set('mode', 'watch')
      const id = env.ROOM.idFromName(code)
      return env.ROOM.get(id).fetch(new Request(forward, request))
    }

    // 天梯只读查询;/report 不经公网转发,只有 MatchDO 内部可写
    if ((url.pathname === '/rating' || url.pathname === '/ladder') && request.method === 'GET') {
      const id = env.RATINGS.idFromName('global')
      return env.RATINGS.get(id).fetch(request)
    }

    // 存档同步:一个 playerId 一个 DO
    if (url.pathname === '/profile') {
      if (request.method === 'OPTIONS') return corsPreflight()
      const playerId = url.searchParams.get('playerId') ?? ''
      if (!/^[A-Za-z0-9-]{8,64}$/.test(playerId)) {
        return new Response(JSON.stringify({ error: 'bad-player-id' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        })
      }
      const id = env.PROFILE.idFromName(playerId)
      return env.PROFILE.get(id).fetch(request)
    }

    // 天梯 id 形如 `<uuid>~<sig>`(见 matchId.ts),波浪号要放行
    const matchRoute = url.pathname.match(/^\/match\/([A-Za-z0-9~_-]{8,96})$/)
    if (matchRoute) {
      const id = env.MATCH.idFromName(matchRoute[1])
      return env.MATCH.get(id).fetch(request)
    }

    return new Response('not found', { status: 404 })
  },
}

function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Profile-Secret',
      'Access-Control-Max-Age': '86400',
    },
  })
}
