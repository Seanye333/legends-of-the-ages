// 联机端到端验证:两个 AI 客户端连本地 wrangler dev,
// 走真实协议(匹配 → 加入 → AI 打完整局),并验证服务器拒绝非法命令。
// 运行:npx wrangler dev 起服后 node --import tsx server/drive-test.ts
import { RemoteMatch } from '../src/app/remoteMatch'
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
}

function runClient(name: string, deckIndex: number, injectIllegal: boolean): Promise<ClientResult> {
  return new Promise((resolve, reject) => {
    const result: ClientResult = { ended: null, errors: [], updates: 0, illegalRejected: false }
    let rng = deckIndex * 7919 + 17
    let acting = false
    let injectedIllegal = false
    let mulliganSent = false

    const timer = setTimeout(() => reject(new Error(`${name}: timeout`)), TIMEOUT_MS)

    const remote = new RemoteMatch(SERVER, PRECON_DECKS[deckIndex], name, {
      onStatus(status) {
        console.log(`[${name}] status: ${status}`)
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
          clearTimeout(timer)
          remote.close()
          resolve(result)
          return
        }
        // 注入一次非法命令(不存在的攻击者)验证服务器权威校验
        if (injectIllegal && !injectedIllegal && state.phase === 'main') {
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
    })
    remote.start()
  })
}

const [a, b] = await Promise.all([
  runClient('刘备军', 0, true),
  runClient('曹操军', 1, false),
])

console.log('\n=== 结果 ===')
console.log(`刘备军: updates=${a.updates} winner(本地帧)=${a.ended?.winner} errors=${a.errors.length}`)
console.log(`曹操军: updates=${b.updates} winner(本地帧)=${b.ended?.winner} errors=${b.errors.length}`)

const winnerConsistent =
  (a.ended?.winner === 0 && b.ended?.winner === 1) ||
  (a.ended?.winner === 1 && b.ended?.winner === 0) ||
  (a.ended?.winner === 'draw' && b.ended?.winner === 'draw')

const pass =
  a.ended !== null &&
  b.ended !== null &&
  winnerConsistent &&
  a.illegalRejected &&
  a.errors.length === 0 &&
  b.errors.length === 0

if (pass) {
  console.log('✓ 联机端到端验证通过:双客户端完整对局,胜负一致,非法命令被拒')
  process.exit(0)
} else {
  console.error('✗ 验证失败', { winnerConsistent, illegalRejected: a.illegalRejected })
  process.exit(1)
}
