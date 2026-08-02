import type { Command, GameState, PlayerIdx } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import { solveLethal } from '../ai/lethalSolver'
import { evaluate } from '../ai/greedy'
import { trivialFaceLethal } from '../ai/lethalSolver'
import type { ReplayFrame, SavedReplay } from './replayStore'

// 军师复盘 —— 打完一局,回头告诉你哪一回合本来能赢。
//
// 【为什么这件事在别处很贵、在这里很便宜】
// 「你第 7 回合有一条没看见的斩杀线」这种复盘,别家要么靠人写,要么专门训一个模型。
// 本作的 `solveLethal` 早就是一个**完备的单回合求解器**(全命令空间 DFS + 转置表),
// 谜题的有解性证明就是它出的。复盘只是换一批输入喂给它:战报里每一个「我方回合开始」帧。
//
// 【只扫回合开始帧】
// 一个回合内每出一张牌都会记一帧,全扫一遍是几十倍的开销,而且会把同一条斩杀线
// 重复报十次。回合开始那一帧是这个回合的**完整资源快照**(法力满、手牌全在),
// 也正是玩家真正需要做判断的那个时刻。
//
// 【为什么要过滤平凡解】
// 「场上单位全砸脸就能赢」不需要军师来提醒,报出来只会稀释真正有价值的那几条。
// trivialFaceLethal 就是内容闸门筛假谜题用的那个谓词,这里第二次用上。

export interface MissedLethal {
  frameIndex: number
  turn: number
  steps: number
  line: Command[]
}

// 亏本交换:你主动打出的一次攻击,把局面分打低了。
//
// 【为什么这条比「错过斩杀」更常见也更有用】
// 一局里错过的斩杀通常是 0–2 次,而**亏本交换每局都在发生** ——
// 拿 5 费的大哥去换对面 2 费的墙、为了清一个小兵把带光环的核心送掉。
// 这才是大多数人真正输掉的地方,但它不像斩杀那样有一个「本来能赢」的时刻,
// 玩家自己复盘时根本注意不到。
//
// 【为什么用 AI 的评估函数而不是另写一套】
// evaluate() 是军神/天機挑选走法时用的**同一个**函数。用它来复盘,
// 军师的意见就永远和 AI 的判断一致 —— 另写一套的话,会出现
// 「军师说这步亏了,而同样的局面 AI 自己也会这么打」这种自相矛盾。
export interface BadTrade {
  frameIndex: number
  turn: number
  loss: number // 局面分掉了多少(越大越亏)
  attackerDefId: string
  attackerDied: boolean
  killedDefIds: string[] // 这一步换掉的敌方单位
}

export interface ScanOpts {
  seat?: PlayerIdx // 复盘谁的视角,默认座位 0(UI 恒定「我」)
  nodeBudget?: number
  onProgress?: (done: number, total: number) => void
}

// 回合开始帧:这一帧的事件里有「该座位的 TurnStarted」。
function turnStartsFor(frames: ReplayFrame[], seat: PlayerIdx): number[] {
  const out: number[] = []
  for (let i = 0; i < frames.length; i++) {
    const ev = frames[i].events.find((e) => e.type === 'TurnStarted' && e.player === seat)
    if (ev) out.push(i)
  }
  return out
}

// 这一帧之后,这一回合内对局有没有结束(结束了就说明这条斩杀**被抓住了**,不算错过)
function wonThisTurn(frames: ReplayFrame[], from: number, seat: PlayerIdx): boolean {
  for (let i = from; i < frames.length; i++) {
    for (const e of frames[i].events) {
      if (e.type === 'GameEnded') return e.winner === seat
      if (e.type === 'TurnEnded' && e.player === seat) return false
    }
  }
  return false
}

function frameState(f: ReplayFrame): GameState {
  return f.state
}

// 同步扫描(测试与脚本用)。UI 请用 scanReplayAsync —— 几十帧的 DFS 会卡住主线程。
export function scanReplay(replay: SavedReplay, opts: ScanOpts = {}): MissedLethal[] {
  const seat = opts.seat ?? 0
  const budget = opts.nodeBudget ?? 20_000
  const out: MissedLethal[] = []
  const starts = turnStartsFor(replay.frames, seat)
  for (const i of starts) {
    const state = frameState(replay.frames[i])
    if (state.phase !== 'main') continue
    if (wonThisTurn(replay.frames, i, seat)) continue // 抓住了,不是「错过」
    if (trivialFaceLethal(state, seat)) continue // 全体打脸就赢,不必提醒
    const res = solveLethal(state, seat, CARDS_BY_ID, { nodeBudget: budget })
    if (!res || res.line.length === 0) continue
    out.push({ frameIndex: i, turn: state.turn, steps: res.steps, line: res.line })
  }
  return out
}

// 异步扫描:每帧之间让出一次主线程,让 UI 能画进度条、也能被中断。
// 不上 Web Worker 的原因很实际 —— 求解器要吃整个卡池(CARDS_BY_ID,2000+ 张),
// 塞进 worker 得连内容层一起打包,收益还不如「让出主线程」这一行。
export async function scanReplayAsync(
  replay: SavedReplay,
  opts: ScanOpts = {},
): Promise<MissedLethal[]> {
  const seat = opts.seat ?? 0
  const budget = opts.nodeBudget ?? 20_000
  const out: MissedLethal[] = []
  const starts = turnStartsFor(replay.frames, seat)
  for (let n = 0; n < starts.length; n++) {
    const i = starts[n]
    const state = frameState(replay.frames[i])
    opts.onProgress?.(n, starts.length)
    await new Promise((r) => setTimeout(r, 0))
    if (state.phase !== 'main') continue
    if (wonThisTurn(replay.frames, i, seat)) continue
    if (trivialFaceLethal(state, seat)) continue
    const res = solveLethal(state, seat, CARDS_BY_ID, { nodeBudget: budget })
    if (!res || res.line.length === 0) continue
    out.push({ frameIndex: i, turn: state.turn, steps: res.steps, line: res.line })
  }
  opts.onProgress?.(starts.length, starts.length)
  return out
}

// ---------- 亏本交换 ----------

// 【阈值是怎么定的】实测几组典型交换的 evaluate 差值:
//   6/6 撞 5/10 守护(自己活下来)  → -0.8(其实是赚的)
//   带伤的 6/1 撞 5/10(自己死)     → +2.0
//   2/2 撞 5/10(自己死,没换掉人)  → +2.0
// 也就是说这个尺度上「亏 2 分」就已经是白送掉一个单位了,再高就基本报不出东西。
//
// 但 2 分一刀切会把**用小兵去啃守护**也报成亏本交换 —— 那常常是对的打法。
// 所以再加一条:攻击者得是真投入(3 费以上)。亏得特别狠的(5 分以上)一律报,
// 那种量级不可能是「必要的消耗」。
const LOSS_THRESHOLD = 2
const CHEAP_COST = 3 // 低于此费用的单位换掉了不算「亏」,那是消耗品
const ALWAYS_REPORT = 5
// 最多报几条。复盘要的是「这一局最该记住的三件事」,不是一张完整的账本。
const MAX_TRADES = 4

// 一帧里我方主动发起的攻击(联机/本地都只有一个来源:AttackResolved 的 attacker)
function myAttackIn(frame: ReplayFrame, seat: PlayerIdx) {
  return frame.events.find((e) => e.type === 'AttackResolved' && e.attacker === seat)
}

export function scanBadTrades(replay: SavedReplay, opts: ScanOpts = {}): BadTrade[] {
  const seat = opts.seat ?? 0
  const out: BadTrade[] = []
  for (let i = 1; i < replay.frames.length; i++) {
    const frame = replay.frames[i]
    const atk = myAttackIn(frame, seat)
    if (!atk || atk.type !== 'AttackResolved') continue
    const before = replay.frames[i - 1].state
    const after = frame.state
    // 对局在这一帧结束了就不算亏 —— 赢下来的那一刀分数一定是「亏」的
    // (evaluate 在 ended 时返回 ±1e9,差值毫无意义)
    if (after.phase === 'ended' || before.phase === 'ended') continue
    const loss = evaluate(before, seat, CARDS_BY_ID) - evaluate(after, seat, CARDS_BY_ID)
    if (loss < LOSS_THRESHOLD) continue
    const died = frame.events.filter((e) => e.type === 'GeneralDied')
    const attackerDied = died.some((e) => e.type === 'GeneralDied' && e.iid === atk.attackerIid)
    const attackerDefId =
      before.players[seat].board.find((c) => c.iid === atk.attackerIid)?.defId ?? ''
    const cost = CARDS_BY_ID[attackerDefId]?.cost ?? 0
    if (loss < ALWAYS_REPORT && cost < CHEAP_COST) continue
    out.push({
      frameIndex: i,
      turn: before.turn,
      loss: Math.round(loss * 10) / 10,
      attackerDefId,
      attackerDied,
      killedDefIds: died
        .filter((e) => e.type === 'GeneralDied' && e.player !== seat)
        .map((e) => (e.type === 'GeneralDied' ? e.defId : '')),
    })
  }
  // 只留最亏的几条,按亏损从大到小
  return out.sort((a, b) => b.loss - a.loss).slice(0, MAX_TRADES)
}
