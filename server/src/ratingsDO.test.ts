import { describe, expect, it } from 'vitest'
import { RatingsDO, currentSeason } from './ratingsDO'
import { fakeCtx } from './testStorage'
import { DEFAULT_RATING } from '../../src/app/protocol'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = () => new RatingsDO(fakeCtx() as any)

const report = async (
  ratings: RatingsDO,
  a: string,
  b: string,
  result: 0 | 0.5 | 1,
): Promise<{ a: { rating: number; delta: number }; b: { rating: number; delta: number } }> => {
  const res = await ratings.fetch(
    new Request('https://r/report', {
      method: 'POST',
      body: JSON.stringify({ a: { id: a, name: a }, b: { id: b, name: b }, result }),
    }),
  )
  return res.json()
}

const ratingOf = async (ratings: RatingsDO, id: string) => {
  const res = await ratings.fetch(new Request(`https://r/rating?playerId=${id}`))
  return res.json() as Promise<{ rating: number; wins: number; losses: number; season: string }>
}

describe('ELO', () => {
  it('gives the winner exactly what it takes from the loser (zero-sum)', async () => {
    const r = make()
    const out = await report(r, 'alice', 'bob', 1)
    expect(out.a.delta).toBe(-out.b.delta)
    expect(out.a.rating).toBe(DEFAULT_RATING + out.a.delta)
    expect(out.b.rating).toBe(DEFAULT_RATING + out.b.delta)
  })

  it('awards K/2 on an even matchup win (K=32 → +16)', async () => {
    const r = make()
    const out = await report(r, 'alice', 'bob', 1)
    expect(out.a.delta).toBe(16)
  })

  it('moves nobody on a draw between equals', async () => {
    const r = make()
    const out = await report(r, 'alice', 'bob', 0.5)
    expect(out.a.delta).toBe(0)
    expect(out.b.delta).toBe(0)
  })

  it('pays less for beating a much weaker opponent', async () => {
    const r = make()
    // 先把 alice 拉高
    for (let i = 0; i < 8; i++) await report(r, 'alice', `chaff${i}`, 1)
    const strong = (await ratingOf(r, 'alice')).rating
    expect(strong).toBeGreaterThan(DEFAULT_RATING + 60)
    const out = await report(r, 'alice', 'fresh', 1)
    expect(out.a.delta).toBeLessThan(16)
    expect(out.a.delta).toBeGreaterThan(0)
  })

  it('tracks wins and losses', async () => {
    const r = make()
    await report(r, 'alice', 'bob', 1)
    await report(r, 'alice', 'bob', 0)
    const a = await ratingOf(r, 'alice')
    expect(a.wins).toBe(1)
    expect(a.losses).toBe(1)
  })

  it('rejects self-play reports', async () => {
    const r = make()
    const res = await r.fetch(
      new Request('https://r/report', {
        method: 'POST',
        body: JSON.stringify({ a: { id: 'x', name: 'x' }, b: { id: 'x', name: 'x' }, result: 1 }),
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('seasons', () => {
  it('formats as UTC YYYY-MM', () => {
    expect(currentSeason(Date.UTC(2026, 0, 15))).toBe('2026-01')
    expect(currentSeason(Date.UTC(2026, 11, 1))).toBe('2026-12')
    // 用 UTC 而不是本地时区:DO 跑在哪个地区不该影响换季时刻
    expect(currentSeason(Date.UTC(2026, 6, 1, 0, 0, 0))).toBe('2026-07')
  })

  it('reports the current season on rating and ladder', async () => {
    const r = make()
    await report(r, 'alice', 'bob', 1)
    expect((await ratingOf(r, 'alice')).season).toBe(currentSeason())
    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      season: string
      rows: unknown[]
    }
    expect(ladder.season).toBe(currentSeason())
    expect(ladder.rows).toHaveLength(2)
  })

  it('soft-resets last season toward the mean instead of wiping it', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    const season = currentSeason()
    const [y, m] = season.split('-').map(Number)
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`
    // 上赛季 1600 分、战绩满满
    ctx._map.set(`s:${prev}:veteran`, { name: 'veteran', rating: 1600, wins: 40, losses: 5 })

    const now = await ratingOf(r, 'veteran')
    // 1200 + (1600-1200) * 0.5 = 1400:强者仍有起跑优势,但差距收敛
    expect(now.rating).toBe(1400)
    // 战绩不带过季
    expect(now.wins).toBe(0)
    expect(now.losses).toBe(0)
  })

  it('rescues pre-season legacy rows so old players do not silently reset', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    ctx._map.set('p:oldtimer', { name: 'oldtimer', rating: 1400, wins: 10, losses: 2 })
    expect((await ratingOf(r, 'oldtimer')).rating).toBe(1300)
  })

  it('ladder only lists the current season', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    ctx._map.set('s:1999-01:ancient', { name: 'ancient', rating: 9999, wins: 1, losses: 0 })
    await report(r, 'alice', 'bob', 1)
    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      rows: { name: string }[]
    }
    expect(ladder.rows.map((x) => x.name)).not.toContain('ancient')
  })

  it('hides players with no games from the ladder', async () => {
    const r = make()
    await ratingOf(r, 'lurker') // 只查询,不打
    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      rows: unknown[]
    }
    expect(ladder.rows).toHaveLength(0)
  })
})

describe('榜单不再遍历全表', () => {
  it('首次读会建一次缓冲区,之后的读一次 list 都不做', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    await report(r, 'alice', 'bob', 1)
    ctx._listCalls = 0

    await r.fetch(new Request('https://r/ladder')) // 首次:建缓冲区
    const afterFirst = ctx._listCalls
    await r.fetch(new Request('https://r/ladder'))
    await r.fetch(new Request('https://r/ladder'))
    // 后续读一次全表扫描都不该有 —— 这正是要修的东西
    expect(ctx._listCalls).toBe(afterFirst)
    expect(afterFirst).toBeLessThanOrEqual(1)
  })

  it('结算会增量更新榜单,不触发全表扫描', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    await r.fetch(new Request('https://r/ladder')) // 先把缓冲区建起来
    ctx._listCalls = 0
    for (let i = 0; i < 20; i++) await report(r, `p${i}`, `q${i}`, 1)
    expect(ctx._listCalls).toBe(0)

    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      rows: { name: string }[]
    }
    expect(ladder.rows.length).toBeGreaterThan(0)
    expect(ladder.rows.map((x) => x.name)).toContain('p0')
  })

  it('榜单按分数降序,且赢家排在输家前面', async () => {
    const r = make()
    await report(r, 'winner', 'loser', 1)
    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      rows: { name: string; rating: number }[]
    }
    expect(ladder.rows[0].name).toBe('winner')
    expect(ladder.rows[0].rating).toBeGreaterThan(ladder.rows[1].rating)
  })

  it('limit 可以收窄返回条数', async () => {
    const r = make()
    for (let i = 0; i < 6; i++) await report(r, `a${i}`, `b${i}`, 1)
    const ladder = (await (await r.fetch(new Request('https://r/ladder?limit=3'))).json()) as {
      rows: unknown[]
    }
    expect(ladder.rows).toHaveLength(3)
  })

  it('带 playerId 时回报「我在第几名」,榜外玩家 rank 为 null 但仍给分数', async () => {
    const r = make()
    await report(r, 'champ', 'chump', 1)
    const inTop = (await (await r.fetch(new Request('https://r/ladder?playerId=champ'))).json()) as {
      you: { rank: number | null; rating: number }
    }
    expect(inTop.you.rank).toBe(1)

    const stranger = (await (
      await r.fetch(new Request('https://r/ladder?playerId=never-played'))
    ).json()) as { you: { rank: number | null; rating: number } }
    expect(stranger.you.rank).toBeNull()
    expect(stranger.you.rating).toBe(DEFAULT_RATING)
  })

  it('换季后榜单自然清空,不会把上赛季的人混进来', async () => {
    const ctx = fakeCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new RatingsDO(ctx as any)
    ctx._map.set('top:1999-01', [
      { id: 'ancient', name: 'ancient', rating: 9999, wins: 5, losses: 0 },
    ])
    await report(r, 'alice', 'bob', 1)
    const ladder = (await (await r.fetch(new Request('https://r/ladder'))).json()) as {
      rows: { name: string }[]
    }
    expect(ladder.rows.map((x) => x.name)).not.toContain('ancient')
  })
})
