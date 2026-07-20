// 玩家存档:一个 playerId 一个 Durable Object。
// 存收藏/卡包/战绩/自组卡组/每日军令,让换设备与清缓存不再等于账号归零。
//
// 冲突策略:单调递增的 version,后写覆盖(last-writer-wins)。
// 两台设备离线各改一通再上线,低版本那份会被拒 —— 客户端据此拉回服务器版。
// 这解决的是「跨设备连续性」,不是防作弊:客户端仍能上传任意数据,
// 真正的反作弊要把卡包发放搬到服务器,那是另一件事(联机胜负已由 MatchDO 权威判定)。
//
// ---- 归属校验(TOFU) ----
// 从前这里**完全没有鉴权**:playerId 就是 localStorage 里一个 UUID,
// 谁知道了别人的 UUID 就能读走、并覆写他的整个存档。
// 在没有账号系统的前提下,能做到的最强保证是「首次写入即认主」(trust on first use):
// 客户端首次上传时带一个只有它自己知道的密钥,服务器存它的 SHA-256;
// 之后每次读写都要带对同一个密钥。
// 这挡不住「一开始就冒名顶替一个还没同步过的 id」,但挡住了「拿到 id 就能改别人存档」——
// 而后者才是现实中会发生的事(id 会随排行榜、房间码、截图泄漏出去)。
// 老客户端(不带密钥)仍可读写未认主的存档,不会把已有用户锁在门外。
import { log } from './log'

const MAX_BODY_BYTES = 512 * 1024

export interface ProfileEnvelope {
  version: number
  updatedAt: number
  data: unknown
}

interface Owner {
  secretHash: string
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export class ProfileDO {
  constructor(private ctx: DurableObjectState) {}

  // 返回 null 表示放行;否则返回要直接回给调用方的响应。
  // 密钥也接受走查询串:navigator.sendBeacon 不能设请求头(关页面前的抢救式回推用它)。
  private async guard(request: Request, url: URL): Promise<Response | null> {
    const presented =
      request.headers.get('X-Profile-Secret') ?? url.searchParams.get('secret') ?? ''
    const owner = await this.ctx.storage.get<Owner>('owner')
    if (!owner) {
      // 还没认主:带了密钥就在这次写入时认主(GET 不认主,免得读一次就把号占了)
      if (presented && isWrite(request)) {
        await this.ctx.storage.put('owner', { secretHash: await sha256Hex(presented) } satisfies Owner)
      }
      return null
    }
    if (!presented) {
      log.warn({ evt: 'profile.no_secret', method: request.method })
      return json({ error: 'profile-locked' }, 401)
    }
    if ((await sha256Hex(presented)) !== owner.secretHash) {
      // 有人拿着别人的 playerId 来写 —— 这正是 TOFU 要挡的事,值得留痕
      log.warn({ evt: 'profile.bad_secret', method: request.method })
      return json({ error: 'profile-forbidden' }, 403)
    }
    return null
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const denied = await this.guard(request, url)
    if (denied) return denied

    if (request.method === 'GET' && url.pathname === '/profile') {
      const saved = await this.ctx.storage.get<ProfileEnvelope>('profile')
      if (!saved) return json({ version: 0, data: null })
      return json(saved)
    }

    // POST 与 PUT 等价:sendBeacon 只会发 POST。
    // 这里以前只认 PUT —— 所以「关页面前尽力推一把」那条路径其实一直是 404,
    // 刚开的卡包在关页面时并没有被保住。
    if (isWrite(request) && url.pathname === '/profile') {
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

function isWrite(request: Request): boolean {
  return request.method === 'PUT' || request.method === 'POST'
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,PUT,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-Profile-Secret',
    },
  })
}
