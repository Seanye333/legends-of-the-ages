import type { Command, GameState, PlayerIdx } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import { solveLethal } from '../ai/lethalSolver'
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
