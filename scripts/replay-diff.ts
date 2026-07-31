// 回放对拍 —— 把「引擎是确定性的」这句话真的验一遍。
// 运行:npm run replay-diff(GAMES=局数,默认 40;SEED=起始种子)
//
// 【为什么这条必须有工具验,而不是相信它】
// 整套架构压在一个假设上:**同样的 (配置, 命令序列) 必然推出同样的状态**。
// 服务端权威对局靠它做校验,战报回放靠它重现,存档迁移靠它保证老局面还能跑。
// 而这个假设的失败方式极其安静 —— 一个 Math.random、一处 Date.now、
// 一个依赖对象键顺序的遍历,都不会报错,只会让某一局在别人机器上走成另一样。
//
// 【三道对拍】
//   1. **重放**:同一份命令日志跑第二遍,终态必须逐字节相同。
//      抓的是「引擎里有隐藏的非确定性」。
//   2. **逐帧**:不只比终态,比每一步之后的状态。
//      抓的是「中途分叉但最后又走回来了」—— 只比终态会漏掉它。
//   3. **序列化往返**:每一步之后把状态 JSON 存读一遍再继续跑。
//      抓的是「状态里有 JSON 表达不了的东西」(undefined、Map、NaN、循环引用)。
//      服务端 Durable Object 存的就是 JSON,这条挂了就是线上一局打到一半崩掉。
//
// 【为什么用 AI 自对弈来产生命令日志】
// 手写的用例只会走到人想得到的路径。AI 自对弈会随机撞进发现挂起、伏兵翻开、
// 变形、策反、疲劳、平局这些角落 —— 而角落正是非确定性最爱藏的地方。
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID } from '../src/content/cards'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { createGame } from '../src/engine/init'
import { applyCommand } from '../src/engine/reducer'
import { replayMatch, type MatchRecord } from '../src/engine/replay'
import { migrateState } from '../src/engine/migrate'
import { aiStep, AI_NORMAL } from '../src/ai/greedy'
import { START_HP } from '../src/engine/types'
import type { GameConfig, GameState, PlayerIdx } from '../src/engine/types'

const GAMES = Number(process.env.GAMES ?? 40)
const SEED0 = Number(process.env.SEED ?? 1)

// 规范化的状态指纹。**必须包含 rng** —— 它是后续一切随机的来源,
// 两个局面别处全同但 rng 不同,下一步就会分叉。
// JSON.stringify 对同一个对象结构会产出同样的键顺序(引擎里所有状态都由
// 同一批工厂函数造出来),所以直接拿它当指纹是安全的;真出问题时
// 我们要的也正是「哪个字段不一样」,而字符串 diff 最容易读。
function fingerprint(s: GameState): string {
  return JSON.stringify(s)
}

function firstDiff(a: string, b: string): string {
  const n = Math.min(a.length, b.length)
  let i = 0
  while (i < n && a[i] === b[i]) i++
  const from = Math.max(0, i - 60)
  return `偏移 ${i}\n  录制: …${a.slice(from, i + 80)}\n  重放: …${b.slice(from, i + 80)}`
}

interface Fail {
  seed: number
  kind: 'replay' | 'frame' | 'json' | 'record' | 'events'
  detail: string
}
const fails: Fail[] = []
let totalCommands = 0
let totalTurns = 0
const winners: Record<string, number> = {}

const t0 = Date.now()

for (let g = 0; g < GAMES; g++) {
  const seed = SEED0 + g * 7919
  const d0 = PRECON_DECKS[g % PRECON_DECKS.length]
  const d1 = PRECON_DECKS[(g + 3) % PRECON_DECKS.length]
  const h0 = HEROES_BY_ID[d0.heroId]
  const h1 = HEROES_BY_ID[d1.heroId]
  const cfg: GameConfig = {
    seed,
    heroIds: [d0.heroId, d1.heroId],
    deckIds: [[...d0.cardIds], [...d1.cardIds]],
    first: (g % 2) as PlayerIdx,
    heroPowers: [h0?.power, h1?.power],
    heroHps: [h0?.hp ?? START_HP, h1?.hp ?? START_HP],
  }

  // ---- 录制:AI 自对弈 ----
  let state = createGame(cfg, CARDS_BY_ID)
  const record: MatchRecord = { cfg, commands: [] }
  const frames: string[] = []
  // 事件流也要对。**从前完全不比** —— replayMatch 一直在返回 events,
  // 脚本一次都没用过。而 UI 动画、战报、成就统计全靠事件:
  // 「状态对了但事件发错/漏发」这一整类 bug,对拍此前一个都抓不到。
  const eventFrames: string[] = []
  const rngs: [number, number] = [seed ^ 0xa1, seed ^ 0xb2]
  let guard = 0
  // 录制中断的两种情形。**从前它们是静默的** —— `break` 之后什么都不记,
  // 于是「所有 40 局都在第 3 步就停了」这种运行,依然会打印「✓ 三道对拍全过」。
  // 一道报告自己通过、但其实什么都没测的闸门,比没有闸门更危险。
  let abortReason: string | null = null
  while (state.phase !== 'ended') {
    if (++guard > 4000) {
      abortReason = '步数超过 4000 —— AI 很可能卡在一个死循环里'
      break
    }
    const actor: PlayerIdx =
      state.phase === 'mulligan'
        ? state.players[0].mulliganDone
          ? 1
          : 0
        : state.pendingChoice
          ? state.pendingChoice.player
          : state.activePlayer
    const step = aiStep(state, actor, CARDS_BY_ID, rngs[actor], AI_NORMAL)
    rngs[actor] = step.rng
    const r = applyCommand(state, actor, step.cmd, CARDS_BY_ID)
    if (!r.ok) {
      // AI 给出了非法命令 —— 这本身就是 bug(fuzz 的 legal↔apply 契约保证不该发生)
      abortReason = `AI 在第 ${record.commands.length + 1} 步给出非法命令 ${step.cmd.type}:${r.error}`
      break
    }
    record.commands.push({ player: actor, cmd: step.cmd })
    state = r.state
    frames.push(fingerprint(state))
    eventFrames.push(JSON.stringify(r.events))
  }
  if (abortReason) {
    fails.push({ seed, kind: 'record', detail: abortReason })
    continue
  }
  // 录到的命令太少 = 这一局其实没测到什么。一局对局怎么也该有几十条命令,
  // 低于 10 条说明开局就断了 —— 同样算失败,别让它混进「通过」里。
  if (record.commands.length < 10) {
    fails.push({
      seed,
      kind: 'record',
      detail: `只录到 ${record.commands.length} 条命令就结束了 —— 这一局没有真正被对拍`,
    })
    continue
  }
  totalCommands += record.commands.length
  totalTurns += state.turn
  const w = state.winner === undefined ? 'unfinished' : String(state.winner)
  winners[w] = (winners[w] ?? 0) + 1

  // ---- 对拍 1:整份重放,终态必须逐字节相同 ----
  const rep = replayMatch(record, CARDS_BY_ID)
  if (!rep.ok) {
    fails.push({ seed, kind: 'replay', detail: `第 ${rep.atIndex} 条命令被拒:${rep.error}` })
    continue
  }
  const endA = fingerprint(state)
  const endB = fingerprint(rep.state)
  if (endA !== endB) {
    fails.push({ seed, kind: 'replay', detail: firstDiff(endA, endB) })
    continue
  }

  // ---- 对拍 2 & 3:逐帧比对 + 每帧 JSON 往返 ----
  // 两件事一起走一遍:重放时每一步都存读一次,再和录制时的那一帧比。
  // 分开跑要跑两遍,而这两条抓的是同一类问题的两个侧面。
  let cur = createGame(cfg, CARDS_BY_ID)
  for (let i = 0; i < record.commands.length; i++) {
    const { player, cmd } = record.commands[i]
    const r = applyCommand(cur, player, cmd, CARDS_BY_ID)
    if (!r.ok) {
      fails.push({ seed, kind: 'frame', detail: `第 ${i} 条命令在往返后被拒:${r.error}` })
      break
    }
    const direct = fingerprint(r.state)
    if (direct !== frames[i]) {
      fails.push({ seed, kind: 'frame', detail: `第 ${i} 步分叉:\n  ${firstDiff(frames[i], direct)}` })
      break
    }
    const evNow = JSON.stringify(r.events)
    if (evNow !== eventFrames[i]) {
      fails.push({
        seed,
        kind: 'events',
        detail: `第 ${i} 步事件流不同:\n  录制 ${eventFrames[i].slice(0, 160)}\n  重放 ${evNow.slice(0, 160)}`,
      })
      break
    }
    // 存读一遍再继续 —— 服务端 DO 每一步都在做同样的事
    const roundTripped = migrateState(JSON.parse(direct) as GameState)
    const after = fingerprint(roundTripped)
    if (after !== direct) {
      fails.push({ seed, kind: 'json', detail: `第 ${i} 步 JSON 往返后不同:\n  ${firstDiff(direct, after)}` })
      break
    }
    cur = roundTripped
  }
}

const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(
  `replay-diff:${GAMES} 局,共 ${totalCommands} 条命令、${totalTurns} 个回合(${secs}s)`,
)
console.log(`  胜负分布:${JSON.stringify(winners)}`)

if (fails.length === 0) {
  console.log('\n✓ 四道对拍全过:重放终态一致、逐帧一致、事件流一致、每帧 JSON 往返一致。')
  process.exit(0)
}

console.log(`\n✗ ${fails.length} 局对不上:`)
for (const f of fails.slice(0, 5)) {
  console.log(`\n  [seed ${f.seed}] ${f.kind}\n  ${f.detail}`)
}
if (fails.length > 5) console.log(`\n  …… 还有 ${fails.length - 5} 局`)
process.exit(1)
