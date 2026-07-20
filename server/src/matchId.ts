// 天梯对局 id 的签名。
//
// /match/:id 允许任意 8~64 字符的 id(这是重连所必需的:客户端刷新后要靠 id 找回对局)。
// 但这也意味着**任何人都能自己编一个 id 连上去**。从前 MatchDO 只检查了
// 「不是 room- 前缀」「两边 playerId 不同」就结算 ELO —— 于是两个串通的客户端
// (或者一个人开两个浏览器)自选一个 id、一方秒投,就能把分刷到任意高度。
//
// 修法:天梯 id 由 QueueDO 用服务端密钥签发,形如 `<uuid>~<sig>`。
// MatchDO 结算前验签,验不过就当作非天梯局(对局照常进行,只是不计分)。
// 房间码局本来就不计分,不受影响。

const DEV_SECRET = 'qiangu-dev-secret-change-me'

async function hmac(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  // base64url 前 16 字符:96 位熵,足够挡住暴力构造,又不会让 id 长到难看
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 16)
}

// 生成一个已签名的天梯对局 id
export async function signMatchId(raw: string, secret?: string): Promise<string> {
  return `${raw}~${await hmac(raw, secret || DEV_SECRET)}`
}

// 验签。格式不对或签名不符一律返回 false（= 不计天梯分）。
export async function verifyMatchId(id: string, secret?: string): Promise<boolean> {
  const at = id.lastIndexOf('~')
  if (at <= 0) return false
  const raw = id.slice(0, at)
  const sig = id.slice(at + 1)
  const expected = await hmac(raw, secret || DEV_SECRET)
  // 长度固定,直接比即可;这里不是抗时序攻击的场景（攻击者拿不到 oracle 反馈）
  return sig === expected
}
