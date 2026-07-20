// ELO 天梯:全局单例。玩家初始 1200 分,K=32,平局各得 0.5。
// 公开路由只读(/rating /ladder);写入(/report)只由 MatchDO 经内部绑定调用,
// Worker 入口不转发 POST,客户端无法直接刷分。
//
// ---- 赛季 ----
// 从前 key 是永久的 `p:<playerId>`,没有赛季、没有衰减、没有重置 ——
// 半年后的榜首会是一个早就不玩了的人,新玩家永远追不上。
// 现在 key 带赛季前缀,赛季按自然月切(UTC),到点自动换榜,不需要任何运维动作。
//
// 换季不是清零:上赛季分数按 `新分 = 1200 + (旧分 - 1200) * 0.5` 软重置,
// 强者仍有起跑优势,但差距会收敛,不至于第一天就重演上赛季的排序。
// 软重置是**惰性**的:下赛季第一次读到该玩家时才折算,不需要遍历全表。
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
// 换季软重置系数:0 = 完全清零,1 = 完全继承
const CARRY_OVER = 0.5

function fresh(name: string): StoredRating {
  return { name, rating: DEFAULT_RATING, wins: 0, losses: 0 }
}

// 赛季 = UTC 自然月。用 UTC 而不是本地时区:DO 跑在哪个地区不该影响换季时刻。
export function currentSeason(now = Date.now()): string {
  const d = new Date(now)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function softReset(rating: number): number {
  return Math.round(DEFAULT_RATING + (rating - DEFAULT_RATING) * CARRY_OVER)
}

export class RatingsDO {
  constructor(private ctx: DurableObjectState) {}

  private key(season: string, playerId: string): string {
    return `s:${season}:${playerId}`
  }

  // 本赛季还没有记录时,去上一个赛季捞一份做软重置(惰性,不遍历全表)。
  private async load(season: string, playerId: string, name: string): Promise<StoredRating> {
    const existing = await this.ctx.storage.get<StoredRating>(this.key(season, playerId))
    if (existing) return existing
    const prev = await this.ctx.storage.get<StoredRating>(
      this.key(previousSeason(season), playerId),
    )
    if (prev) {
      // 战绩不带过季,只继承(折算后的)分数
      return { name: name || prev.name, rating: softReset(prev.rating), wins: 0, losses: 0 }
    }
    // 更早的旧数据用的是无赛季的 `p:<id>` key,一并接住,不让老玩家凭空归零
    const legacy = await this.ctx.storage.get<StoredRating>(`p:${playerId}`)
    if (legacy) {
      return { name: name || legacy.name, rating: softReset(legacy.rating), wins: 0, losses: 0 }
    }
    return fresh(name)
  }

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
      const season = currentSeason()
      const playerId = url.searchParams.get('playerId') ?? ''
      const r = playerId ? await this.load(season, playerId, '') : fresh('')
      return json({ rating: r.rating, wins: r.wins, losses: r.losses, season })
    }

    if (url.pathname === '/ladder') {
      const season = currentSeason()
      const all = await this.ctx.storage.list<StoredRating>({ prefix: `s:${season}:` })
      const rows: RatingRow[] = [...all.values()]
        .filter((r) => r.wins + r.losses > 0)
        .sort((x, y) => y.rating - x.rating)
        .slice(0, LADDER_SIZE)
        .map((r) => ({ name: r.name || '无名氏', rating: r.rating, wins: r.wins, losses: r.losses }))
      return json({ rows, season })
    }

    return new Response('not found', { status: 404 })
  }

  private async report(body: ReportBody): Promise<ReportResult> {
    const season = currentSeason()
    const keyA = this.key(season, body.a.id)
    const keyB = this.key(season, body.b.id)
    const a = await this.load(season, body.a.id, body.a.name)
    const b = await this.load(season, body.b.id, body.b.name)
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

function previousSeason(season: string): string {
  const [y, m] = season.split('-').map(Number)
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  })
}
