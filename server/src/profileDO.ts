// 玩家存档:一个 playerId 一个 Durable Object。
// 存收藏/卡包/战绩/自组卡组/每日军令,让换设备与清缓存不再等于账号归零。
//
// 冲突策略:单调递增的 version,后写覆盖(last-writer-wins)。
// 两台设备离线各改一通再上线,低版本那份会被拒 —— 客户端据此拉回服务器版。
// 这解决的是「跨设备连续性」,不是防作弊:客户端仍能上传任意数据,
// 真正的反作弊要把卡包发放搬到服务器,那是另一件事(联机胜场已由 MatchDO 权威判定)。
const MAX_BODY_BYTES = 512 * 1024

export interface ProfileEnvelope {
  version: number
  updatedAt: number
  data: unknown
}

export class ProfileDO {
  constructor(private ctx: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/profile') {
      const saved = await this.ctx.storage.get<ProfileEnvelope>('profile')
      if (!saved) return json({ version: 0, data: null })
      return json(saved)
    }

    if (request.method === 'PUT' && url.pathname === '/profile') {
      const raw = await request.text()
      if (raw.length > MAX_BODY_BYTES) return json({ error: 'too-large' }, 413)
      let body: ProfileEnvelope
      try {
        body = JSON.parse(raw)
      } catch {
        return json({ error: 'bad-json' }, 400)
      }
      if (typeof body?.version !== 'number' || body.data === undefined) {
        return json({ error: 'bad-envelope' }, 400)
      }
      const saved = await this.ctx.storage.get<ProfileEnvelope>('profile')
      if (saved && saved.version >= body.version) {
        // 客户端落后了:回一份服务器版让它自己对齐
        return json({ stale: true, ...saved }, 409)
      }
      const next: ProfileEnvelope = {
        version: body.version,
        updatedAt: Date.now(),
        data: body.data,
      }
      await this.ctx.storage.put('profile', next)
      return json(next)
    }

    return new Response('not found', { status: 404 })
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
