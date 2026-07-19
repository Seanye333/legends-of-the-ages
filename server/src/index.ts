// 千古名将联机服务器:Cloudflare Worker 入口。
// /queue → QueueDO(全局单例匹配队列);/match/:id → MatchDO(一场对局一个实例)。
export { QueueDO } from './queueDO'
export { MatchDO } from './matchDO'

interface Env {
  QUEUE: DurableObjectNamespace
  MATCH: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, service: 'qiangu-server' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    if (url.pathname === '/queue') {
      const id = env.QUEUE.idFromName('global')
      return env.QUEUE.get(id).fetch(request)
    }

    const matchRoute = url.pathname.match(/^\/match\/([A-Za-z0-9-]{8,64})$/)
    if (matchRoute) {
      const id = env.MATCH.idFromName(matchRoute[1])
      return env.MATCH.get(id).fetch(request)
    }

    return new Response('not found', { status: 404 })
  },
}
