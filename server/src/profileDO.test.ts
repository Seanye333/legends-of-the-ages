import { describe, expect, it } from 'vitest'
import { ProfileDO } from './profileDO'
import { fakeCtx } from './testStorage'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const make = () => new ProfileDO(fakeCtx() as any)

const body = (version: number, packs = 1) =>
  JSON.stringify({ version, data: { owned: {}, packs, wins: 0, losses: 0 } })

const put = (p: ProfileDO, version: number, secret?: string, packs = 1) =>
  p.fetch(
    new Request('https://p/profile', {
      method: 'PUT',
      headers: secret
        ? { 'Content-Type': 'application/json', 'X-Profile-Secret': secret }
        : { 'Content-Type': 'application/json' },
      body: body(version, packs),
    }),
  )

const get = (p: ProfileDO, secret?: string) =>
  p.fetch(new Request('https://p/profile', secret ? { headers: { 'X-Profile-Secret': secret } } : {}))

describe('profile TOFU ownership', () => {
  it('lets an unclaimed profile be read and written without a secret (old clients)', async () => {
    const p = make()
    expect((await get(p)).status).toBe(200)
    expect((await put(p, 1)).status).toBe(200)
    // 不带密钥写入不认主 —— 否则老客户端会把号锁死在自己身上
    expect((await get(p)).status).toBe(200)
  })

  it('claims on the first write that carries a secret', async () => {
    const p = make()
    expect((await put(p, 1, 'mine')).status).toBe(200)
    expect((await get(p, 'mine')).status).toBe(200)
  })

  it('locks out readers with no secret once claimed', async () => {
    const p = make()
    await put(p, 1, 'mine')
    expect((await get(p)).status).toBe(401)
  })

  it('rejects a wrong secret — this is the whole point of TOFU', async () => {
    const p = make()
    await put(p, 1, 'mine')
    expect((await get(p, 'theirs')).status).toBe(403)
    expect((await put(p, 2, 'theirs')).status).toBe(403)
  })

  it('does not claim on GET (a read must not be able to steal the profile)', async () => {
    const p = make()
    await get(p, 'drive-by')
    // 还没认主,所以真正的主人仍然能用自己的密钥首写认主
    expect((await put(p, 1, 'real-owner')).status).toBe(200)
    expect((await get(p, 'drive-by')).status).toBe(403)
  })

  it('accepts the secret via query string (sendBeacon cannot set headers)', async () => {
    const p = make()
    await put(p, 1, 'mine')
    const res = await p.fetch(
      new Request('https://p/profile?secret=mine', {
        method: 'POST', // sendBeacon 只会发 POST
        headers: { 'Content-Type': 'application/json' },
        body: body(2),
      }),
    )
    expect(res.status).toBe(200)
  })
})

describe('profile versioning', () => {
  it('rejects a stale version with 409 and returns the server copy', async () => {
    const p = make()
    await put(p, 5, 'mine', 7)
    const res = await put(p, 5, 'mine', 999)
    expect(res.status).toBe(409)
    const back = (await res.json()) as { stale: boolean; data: { packs: number } }
    expect(back.stale).toBe(true)
    expect(back.data.packs).toBe(7) // 回传的是服务器那份,不是被拒的那份
  })

  it('rejects malformed envelopes instead of storing garbage', async () => {
    const p = make()
    const bad = await p.fetch(
      new Request('https://p/profile', { method: 'PUT', body: '{"nope":1}' }),
    )
    expect(bad.status).toBe(400)
    const notJson = await p.fetch(
      new Request('https://p/profile', { method: 'PUT', body: 'not json' }),
    )
    expect(notJson.status).toBe(400)
  })

  it('reports an empty profile as version 0 rather than 404', async () => {
    const p = make()
    const res = await get(p)
    expect(res.status).toBe(200)
    expect((await res.json()) as { version: number }).toEqual({ version: 0, data: null })
  })
})
