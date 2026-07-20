// ELO 天梯:全局单例。玩家初始 1200 分,K=32,平局各得 0.5。
// 公开路由只读(/rating /ladder);写入(/report)只由 MatchDO 经内部绑定调用,
// Worker 入口不转发 POST,客户端无法直接刷分。
import { DEFAULT_RATING, type RatingRow } from '../../src/app/protocol'

interface StoredRating {
  name: string
  rating: number
  wins: number
  losses: number
}

export interface ReportBody {
  a: { id: string; name: string }
  b: { id: string; name: string }
  result: 0 | 0.5 | 1 // a 的得分
}

export interface ReportResult {
  a: { rating: number; delta: number }
  b: { rating: number; delta: number }
}

const K = 32
const LADDER_SIZE = 50

function fresh(name: string): StoredRating {
  return { name, rating: DEFAULT_RATING, wins: 0, losses: 0 }
}

export class RatingsDO {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'POST' && url.pathname === '/report') {
      const body = (await request.json()) as ReportBody
      if (!body?.a?.id || !body?.b?.id || body.a.id === body.b.id) {
        return json({ error: 'bad-report' }, 400)
      }
      const result = await this.report(body)
      return json(result)
    }

    if (url.pathname === '/rating') {
      const playerId = url.searchParams.get('playerId') ?? ''
      const row = playerId ? await this.ctx.storage.get<StoredRating>(`p:${playerId}`) : null
      const r = row ?? fresh('')
      return json({ rating: r.rating, wins: r.wins, losses: r.losses } satisfies Omit<RatingRow, 'name'>)
    }

    if (url.pathname === '/ladder') {
      const all = await this.ctx.storage.list<StoredRating>({ prefix: 'p:' })
      const rows: RatingRow[] = [...all.values()]
        .filter((r) => r.wins + r.losses > 0)
        .sort((x, y) => y.rating - x.rating)
        .slice(0, LADDER_SIZE)
        .map((r) => ({ name: r.name || '无名氏', rating: r.rating, wins: r.wins, losses: r.losses }))
      return json({ rows })
    }

    return new Response('not found', { status: 404 })
  }

  private async report(body: ReportBody): Promise<ReportResult> {
    const keyA = `p:${body.a.id}`
    const keyB = `p:${body.b.id}`
    const a = (await this.ctx.storage.get<StoredRating>(keyA)) ?? fresh(body.a.name)
    const b = (await this.ctx.storage.get<StoredRating>(keyB)) ?? fresh(body.b.name)
    a.name = body.a.name || a.name
    b.name = body.b.name || b.name

    const expectedA = 1 / (1 + Math.pow(10, (b.rating - a.rating) / 400))
    const deltaA = Math.round(K * (body.result - expectedA))
    a.rating += deltaA
    b.rating -= deltaA
    if (body.result === 1) {
      a.wins++
      b.losses++
    } else if (body.result === 0) {
      a.losses++
      b.wins++
    }
    await this.ctx.storage.put(keyA, a)
    await this.ctx.storage.put(keyB, b)
    return {
      a: { rating: a.rating, delta: deltaA },
      b: { rating: b.rating, delta: -deltaA },
    }
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
