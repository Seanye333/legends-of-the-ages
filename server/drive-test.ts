// 联机端到端验证:连本地 wrangler dev,走真实协议,依次验证——
// 1. 天梯匹配:两个 AI 客户端(不同 playerId)匹配 → AI 打完整局 → 胜负一致
//    + 服务器拒绝注入的非法命令 + 中途模拟闪断自动重连 + 终局天梯分数变动
// 2. 好友房间:创建房间拿码 → 凭码加入 → 开局 → 认输速结 → 不计天梯
// 运行:npx wrangler dev 起服后 node --import tsx server/drive-test.ts
import { RemoteMatch } from '../src/app/remoteMatch'
import { httpBase, wsScheme, DEFAULT_RATING } from '../src/app/protocol'
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { legalCommands } from '../src/engine/legal'
import type { GameState } from '../src/engine/types'

const SERVER = process.env.SERVER ?? 'localhost:8787'
const TIMEOUT_MS = 120_000

interface ClientResult {
  ended: GameState | null
  errors: string[]
  updates: number
  illegalRejected: boolean
  sawReconnecting: boolean
  ratedDelta: number | null
}

interface ClientOpts {
  injectIllegal?: boolean
  dropOnce?: boolean // 中途模拟网络闪断,验证自动重连
  playerId: string
}

function runClient(name: string, deckIndex: number, opts: ClientOpts): Promise<ClientResult> {
  return new Promise((resolve, reject) => {
    const result: ClientResult = {
      ended: null,
      errors: [],
      updates: 0,
      illegalRejected: false,
      sawReconnecting: false,
      ratedDelta: null,
    }
    let rng = deckIndex * 7919 + 17
    let acting = false
    let injectedIllegal = false
    let dropped = false
    let mulliganSent = false

    const timer = setTimeout(() => reject(new Error(`${name}: timeout`)), TIMEOUT_MS)

    const remote = new RemoteMatch(
      SERVER,
      PRECON_DECKS[deckIndex],
      name,
      {
        onStatus(status) {
          console.log(`[${name}] status: ${status}`)
          if (status === 'reconnecting') result.sawReconnecting = true
        },
        onRated(rating, delta) {
          result.ratedDelta = delta
          console.log(`[${name}] 天梯结算: ${rating} (${delta >= 0 ? '+' : ''}${delta})`)
          maybeFinish()
        },
        onError(error) {
          // 注入的非法命令被拒 → 记为通过;其余为真错误
          if (injectedIllegal && !result.illegalRejected) {
            result.illegalRejected = true
            console.log(`[${name}] ✓ 非法命令被服务器拒绝: ${error}`)
            return
          }
          result.errors.push(error)
          console.log(`[${name}] error: ${error}`)
        },
        onUpdate(state) {
          result.updates++
          if (state.phase === 'ended') {
            result.ended = state
            maybeFinish()
            return
          }
          // 进入主阶段后模拟一次闪断:连接被掐,应自动重连并继续对局
          if (opts.dropOnce && !dropped && state.phase === 'main' && result.updates >= 8) {
            dropped = true
            console.log(`[${name}] —— 模拟网络闪断 ——`)
            remote.debugDropConnection()
            return
          }
          // 注入一次非法命令(不存在的攻击者)验证服务器权威校验
          if (opts.injectIllegal && !injectedIllegal && state.phase === 'main') {
            injectedIllegal = true
            remote.send({ type: 'Attack', attackerIid: 999999, target: { kind: 'hero', player: 1 } })
          }
          // 轮到我(本地帧恒为 0 号)就让 AI 走一步;调度只发一次(服务器确认前会收到多次广播)
          const needMulligan = state.phase === 'mulligan' && !state.players[0].mulliganDone
          if (needMulligan && mulliganSent) return
          const myMove = needMulligan || (state.phase === 'main' && state.activePlayer === 0)
          if (!myMove || acting) return
          acting = true
          try {
            const legal = legalCommands(state, 0, CARDS_BY_ID)
            if (legal.length === 0) return
            const step = aiStep(state, 0, CARDS_BY_ID, rng, AI_NORMAL)
            rng = step.rng
            if (step.cmd.type === 'Mulligan') mulliganSent = true
            remote.send(step.cmd)
          } finally {
            acting = false
          }
        },
      },
      opts.playerId,
    )

    // 终局 + 天梯结算都到齐才收尾(结算包可能晚于终局广播;最多再等 3 秒)
    let finishTimer: ReturnType<typeof setTimeout> | null = null
    function maybeFinish() {
      if (!result.ended) return
      if (result.ratedDelta !== null || finishTimer) {
        if (result.ratedDelta !== null && finishTimer) clearTimeout(finishTimer)
        finish()
        return
      }
      finishTimer = setTimeout(finish, 3000)
    }
    function finish() {
      clearTimeout(timer)
      remote.close()
      resolve(result)
    }

    remote.start()
  })
}

// 房间流:host 创建房间拿码,guest 凭码加入;guest 调度阶段直接认输速结
function runRoomPair(): Promise<{ hostWinner: unknown; guestWinner: unknown; code: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('room: timeout')), 60_000)
    let hostEnded: GameState | null = null
    let guestEnded: GameState | null = null
    let roomCode = ''
    let guest: RemoteMatch | null = null
    let hostMulliganSent = false
    let guestConceded = false

    function check() {
      if (hostEnded && guestEnded) {
        clearTimeout(timer)
        host.close()
        guest?.close()
        resolve({ hostWinner: hostEnded.winner, guestWinner: guestEnded.winner, code: roomCode })
      }
    }

    const host = new RemoteMatch(
      SERVER,
      PRECON_DECKS[0],
      '房主',
      {
        onStatus(s) {
          console.log(`[房主] status: ${s}`)
        },
        onRoomCode(code) {
          roomCode = code
          console.log(`[房主] 房间码: ${code}`)
          guest = new RemoteMatch(
            SERVER,
            PRECON_DECKS[1],
            '好友',
            {
              onStatus(s) {
                console.log(`[好友] status: ${s}`)
              },
              onError(e) {
                reject(new Error(`guest error: ${e}`))
              },
              onUpdate(state) {
                if (state.phase === 'ended') {
                  guestEnded = state
                  check()
                  return
                }
                if (!guestConceded) {
                  guestConceded = true
                  guest?.send({ type: 'Concede' })
                }
              },
            },
            crypto.randomUUID(),
          )
          guest.joinRoom(code)
        },
        onError(e) {
          reject(new Error(`host error: ${e}`))
        },
        onUpdate(state) {
          if (state.phase === 'ended') {
            hostEnded = state
            check()
            return
          }
          // 认输可能在对方调度完成前无法生效:房主也要过调度
          const needMulligan = state.phase === 'mulligan' && !state.players[0].mulliganDone
          if (needMulligan && !hostMulliganSent) {
            hostMulliganSent = true
            host.send({ type: 'Mulligan', keepIids: state.players[0].hand.map((c) => c.iid) })
          }
        },
      },
      crypto.randomUUID(),
    )
    host.createRoom()
  })
}

async function fetchRating(playerId: string): Promise<number> {
  const res = await fetch(`${httpBase(SERVER)}/rating?playerId=${encodeURIComponent(playerId)}`)
  const json = (await res.json()) as { rating: number }
  return json.rating
}

// 存档归属(TOFU):带密钥首写认主 → 之后不带密钥读写一律被拒。
// 从前这里完全没有鉴权,知道别人的 playerId 就能覆写他的整个存档。
async function checkProfileOwnership(): Promise<boolean> {
  const base = httpBase(SERVER)
  const pid = crypto.randomUUID()
  const secret = crypto.randomUUID()
  const url = `${base}/profile?playerId=${encodeURIComponent(pid)}`
  const body = (version: number) =>
    JSON.stringify({ version, data: { owned: {}, packs: 1, wins: 0, losses: 0, customDecks: [], questDate: '', quests: [] } })

  // 带密钥首写 → 认主
  const claim = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Profile-Secret': secret },
    body: body(1),
  })
  if (!claim.ok) {
    console.log('✗ 带密钥的首次写入应成功', claim.status)
    return false
  }

  // 冒名者不带密钥 → 401
  const anon = await fetch(url)
  if (anon.status !== 401) {
    console.log(`✗ 认主后不带密钥读取应 401(收到 ${anon.status})`)
    return false
  }

  // 冒名者带错密钥 → 403
  const wrong = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Profile-Secret': 'not-the-secret' },
    body: body(2),
  })
  if (wrong.status !== 403) {
    console.log(`✗ 错密钥写入应 403(收到 ${wrong.status})`)
    return false
  }

  // 主人自己仍然可读
  const mine = await fetch(url, { headers: { 'X-Profile-Secret': secret } })
  if (!mine.ok) {
    console.log('✗ 主人自己应能读回存档', mine.status)
    return false
  }

  // sendBeacon 路径:POST + 查询串密钥(它不能设请求头)
  const beacon = await fetch(`${url}&secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body(2),
  })
  if (!beacon.ok) {
    console.log('✗ sendBeacon 式 POST + 查询串密钥应被接受', beacon.status)
    return false
  }

  console.log('✓ 存档归属:首写认主 / 无密钥 401 / 错密钥 403 / beacon POST 可写')
  return true
}

// 自选(未签名)的 matchId 不得计入天梯 —— 否则两个串通的客户端可以随意刷分。
async function checkUnsignedMatchIdIsUnrated(): Promise<boolean> {
  const pid1 = crypto.randomUUID()
  const pid2 = crypto.randomUUID()
  const before = await fetchRating(pid1)
  // 自己编一个合法格式但没有签名的 id
  const forged = `forged-${crypto.randomUUID()}`
  const ok = await playForgedMatch(forged, pid1, pid2)
  if (!ok) {
    console.log('✗ 伪造 id 的对局本身应能正常进行(只是不计分)')
    return false
  }
  const after = await fetchRating(pid1)
  if (after !== before) {
    console.log(`✗ 未签名的对局不该改变天梯分(${before} → ${after})`)
    return false
  }
  console.log('✓ 天梯 id 验签:自选 matchId 的对局不计分')
  return true
}

// 用自选 id 开一局并立刻投降,只为验证「不计分」
async function playForgedMatch(matchId: string, pidA: string, pidB: string): Promise<boolean> {
  const mk = (seat: 0 | 1) =>
    new WebSocket(
      `${wsScheme(SERVER)}${SERVER}/match/${matchId}?seat=${seat}&token=${crypto.randomUUID()}`,
    )
  const a = mk(0)
  const b = mk(1)
  const ready = (ws: WebSocket) =>
    new Promise<void>((res, rej) => {
      const timer = setTimeout(() => rej(new Error('forged: open timeout')), TIMEOUT_MS)
      ws.addEventListener('open', () => {
        clearTimeout(timer)
        res()
      })
      ws.addEventListener('error', () => {
        clearTimeout(timer)
        rej(new Error('forged: socket error'))
      })
    })
  try {
    await Promise.all([ready(a), ready(b)])
    const deck = PRECON_DECKS[0]
    const join = (pid: string) =>
      JSON.stringify({
        type: 'join',
        heroId: deck.heroId,
        deckIds: deck.cardIds,
        name: 'forged',
        playerId: pid,
      })
    a.send(join(pidA))
    b.send(join(pidB))
    await new Promise((r) => setTimeout(r, 600))
    a.send(JSON.stringify({ type: 'cmd', cmd: { type: 'Concede' } }))
    await new Promise((r) => setTimeout(r, 600))
    return true
  } catch {
    return false
  } finally {
    try {
      a.close()
      b.close()
    } catch {
      /* 忽略 */
    }
  }
}

// 存档同步:空档拉取 → 推送 → 拉回一致 → 旧版本被拒(409 并回传服务器版)
async function checkProfileSync(): Promise<boolean> {
  const base = httpBase(SERVER)
  const pid = crypto.randomUUID()
  const url = `${base}/profile?playerId=${encodeURIComponent(pid)}`
  const put = (version: number, data: unknown) =>
    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, data }),
    })

  const empty = (await (await fetch(url)).json()) as { version: number; data: unknown }
  if (empty.version !== 0 || empty.data !== null) {
    console.log('✗ 新账号不该有存档', empty)
    return false
  }

  const mine = { owned: { 'guan-yu': 1 }, packs: 3, wins: 2, losses: 1, customDecks: [], questDate: '2026-07-19', quests: [] }
  if (!(await put(1, mine)).ok) {
    console.log('✗ 首次推送失败')
    return false
  }

  const back = (await (await fetch(url)).json()) as { version: number; data: typeof mine }
  if (back.version !== 1 || back.data.packs !== 3 || back.data.owned['guan-yu'] !== 1) {
    console.log('✗ 拉回的存档与推上去的不一致', back)
    return false
  }

  // 另一台设备用同样(过期)的版本号推 → 必须被拒,并拿回服务器那份
  const stale = await put(1, { ...mine, packs: 999 })
  if (stale.status !== 409) {
    console.log(`✗ 过期版本应被拒(收到 ${stale.status})`)
    return false
  }
  const staleBody = (await stale.json()) as { stale?: boolean; data: typeof mine }
  if (!staleBody.stale || staleBody.data.packs !== 3) {
    console.log('✗ 409 应回传服务器版供客户端对齐', staleBody)
    return false
  }

  // 正常推进版本 → 通过
  if (!(await put(2, { ...mine, packs: 5 })).ok) {
    console.log('✗ 递增版本推送失败')
    return false
  }
  const final = (await (await fetch(url)).json()) as { version: number; data: typeof mine }
  const ok = final.version === 2 && final.data.packs === 5
  console.log(ok ? '✓ 存档同步:推送/拉取/版本冲突全部符合预期' : '✗ 最终状态不对')
  return ok
}

// ---- 1. 天梯匹配全流程 ----
const idA = crypto.randomUUID()
const idB = crypto.randomUUID()
const [a, b] = await Promise.all([
  runClient('刘备军', 0, { injectIllegal: true, dropOnce: true, playerId: idA }),
  runClient('曹操军', 1, { playerId: idB }),
])

console.log('\n=== 天梯匹配结果 ===')
console.log(`刘备军: updates=${a.updates} winner(本地帧)=${a.ended?.winner} errors=${a.errors.length} 重连=${a.sawReconnecting} Δ=${a.ratedDelta}`)
console.log(`曹操军: updates=${b.updates} winner(本地帧)=${b.ended?.winner} errors=${b.errors.length} Δ=${b.ratedDelta}`)

const winnerConsistent =
  (a.ended?.winner === 0 && b.ended?.winner === 1) ||
  (a.ended?.winner === 1 && b.ended?.winner === 0) ||
  (a.ended?.winner === 'draw' && b.ended?.winner === 'draw')

const ratingA = await fetchRating(idA)
const ratingB = await fetchRating(idB)
const isDraw = a.ended?.winner === 'draw'
const ratingsMoved = isDraw || (ratingA !== DEFAULT_RATING && ratingB !== DEFAULT_RATING)
const ratedMsgOk = isDraw || (a.ratedDelta !== null && b.ratedDelta !== null)
console.log(`天梯分: 刘备军=${ratingA} 曹操军=${ratingB}`)

// ---- 2. 好友房间流 ----
console.log('\n=== 好友房间流 ===')
const room = await runRoomPair()
const roomOk =
  room.code.length >= 4 &&
  ((room.hostWinner === 0 && room.guestWinner === 1) ||
    (room.hostWinner === 1 && room.guestWinner === 0))
// 房间局不计天梯:分数不变
const ratingA2 = await fetchRating(idA)
const roomUnrated = ratingA2 === ratingA

// ---- 3. 存档同步 ----
console.log('\n=== 存档同步 ===')
const profileOk = await checkProfileSync()

// ---- 4. 加固项:存档归属 + 天梯 id 验签 ----
console.log('\n=== 安全加固 ===')
const guardOk = await checkProfileOwnership()
const matchIdOk = await checkUnsignedMatchIdIsUnrated()

const pass =
  a.ended !== null &&
  b.ended !== null &&
  profileOk &&
  winnerConsistent &&
  a.illegalRejected &&
  a.sawReconnecting &&
  a.errors.length === 0 &&
  b.errors.length === 0 &&
  ratingsMoved &&
  ratedMsgOk &&
  roomOk &&
  roomUnrated &&
  guardOk &&
  matchIdOk

if (pass) {
  console.log(
    '\n✓ 联机端到端验证通过:天梯匹配全流程(含重连/非法命令拒绝/ELO 结算)+ 好友房间流 + 存档同步 + 存档归属 + 天梯 id 验签',
  )
  process.exit(0)
} else {
  console.error('\n✗ 验证失败', {
    winnerConsistent,
    illegalRejected: a.illegalRejected,
    sawReconnecting: a.sawReconnecting,
    clientErrors: [...a.errors, ...b.errors],
    ratingsMoved,
    ratedMsgOk,
    roomOk,
    roomUnrated,
    profileOk,
    guardOk,
    matchIdOk,
  })
  process.exit(1)
}
