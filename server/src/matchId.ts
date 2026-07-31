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

// 开发用的回落密钥。**它是公开的**(就在这份开源代码里),
// 所以任何人都能用它自签合法的天梯 matchId。
//
// 从前 signMatchId/verifyMatchId 直接 `secret || DEV_SECRET` 静默回落 ——
// 线上忘了配 MATCH_SECRET 的话,天梯验签形同虚设,而且**没有任何迹象**:
// 日志干净、对局正常、分照记。这正是最坏的一种失败方式。
//
// 现在改成:回落时每次都吼一句(见 resolveSecret)。日志里搜 'matchId.dev_secret'
// 就知道线上是不是裸奔。
const DEV_SECRET = 'qiangu-dev-secret-change-me'

export const DEV_SECRET_FOR_TEST = DEV_SECRET

function resolveSecret(secret: string | undefined, where: string): string {
  if (secret) return secret
  // 不抛异常:抛了会让本地 wrangler dev 与单测直接跑不起来,
  // 而它们本来就该用开发密钥。要的是「线上一眼能看见」。
  console.warn(
    JSON.stringify({
      evt: 'matchId.dev_secret',
      where,
      msg: 'MATCH_SECRET 未配置,正在使用公开的开发密钥 —— 天梯验签等于没有。上线前务必 wrangler secret put MATCH_SECRET',
    }),
  )
  return DEV_SECRET
}

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
  return `${raw}~${await hmac(raw, resolveSecret(secret, 'sign'))}`
}

// 验签。格式不对或签名不符一律返回 false（= 不计天梯分）。
export async function verifyMatchId(id: string, secret?: string): Promise<boolean> {
  const at = id.lastIndexOf('~')
  if (at <= 0) return false
  const raw = id.slice(0, at)
  const sig = id.slice(at + 1)
  const expected = await hmac(raw, resolveSecret(secret, 'verify'))
  // 长度固定,直接比即可;这里不是抗时序攻击的场景（攻击者拿不到 oracle 反馈）
  return sig === expected
}
