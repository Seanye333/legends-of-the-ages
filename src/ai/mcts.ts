import type { CardLibrary, Command, GameState, PlayerIdx } from '../engine/types'
import { applyCommand } from '../engine/reducer'
import { legalCommands } from '../engine/legal'
import { stopScore, type EvalWeights } from './greedy'
import type { PlanResult } from './planner'

// 蒙特卡洛树搜索 —— 「天機」档的大脑。
//
// 【它补的是 planner 补不了的那个洞】
// planner 是**最好优先的 DFS**:先各走一步、按「就此收手」的分数排序,再深挖。
// 这在分支窄的时候很好,但它有一个结构性的毛病 ——
// 排序用的是**一步之后**的分数,于是任何「第一步看起来最差、三步之后最好」的线
// 会被排到队尾,预算一到就永远轮不到它。手牌一多分支就爆炸,而排序的偏见照旧。
//
// MCTS 换的是**如何分配预算**:不按一步后的分数排序,而是按
// 「这条线迄今为止的平均结果」和「它被试过多少次」一起决定下一次往哪儿走(UCT)。
// 试得少的线永远有机会被再试一次,所以那类线不会被永久饿死。
//
// 【为什么它仍然是确定性的】
// 铁律:同样的输入必须产出同样的输出,否则回放和服务端权威对局都完了。
// 随机数走的是从 state.rng 派生的 LCG —— 不碰 Math.random。
// 所以同一个局面跑两次,连每一次 rollout 走的路都逐字相同。
//
// 【为什么 rollout 只走到回合结束】
// 走到对局结束需要给对手建模,而这一层刻意不做对手模型
// (见 ARCHITECTURE 的平衡一节)。回合结束时用 evaluate 打分,和 planner 同一把尺 ——
// 这样两者的强弱是可比的,sim-ai-tiers 量出来的差别才是「搜索方式」的差别。
//
// 【为什么要归一化】
// UCT 的探索项和收益项要在同一个量纲上。evaluate 返回的是无界分数
// (胜负项直接 1e9),不归一化的话探索项会被彻底淹没,MCTS 退化成纯贪心。
// 这里按**根节点见过的 min/max** 线性映射到 [0,1] —— 简单、无须先验、
// 而且随着搜索进行会自动收紧。

export interface MctsOpts {
  iterations?: number
  maxDepth?: number
  foresight?: boolean
  weights?: Partial<EvalWeights>
  // 探索常数。UCT 的经典取值是 √2 ≈ 1.414,但那是给「胜率」这种 [0,1] 收益用的;
  // 这里的收益是归一化后的局面分,方差小得多,所以调低到 0.9 ——
  // 太高会把预算摊平在一堆同样平庸的线上。
  c?: number
}

const DEFAULT_ITERATIONS = 900
const DEFAULT_DEPTH = 8

interface Node {
  state: GameState
  // 到达这个节点的命令(根节点为 null)
  cmd: Command | null
  parent: Node | null
  // 还没展开的候选命令。空数组 = 全展开;null = 还没算过
  untried: Command[] | null
  children: Node[]
  visits: number
  total: number // 归一化收益之和
  // 这个节点「就此收手」的原始分数。终局节点也用它。
  stopScore: number
  terminal: boolean
}

// 与 planner 同款的 LCG。放在这里而不是 import engine/rng:
// 那一份推进的是**对局的** rng(会写回 state),这里要的是一条与对局无关的、
// 只服务于搜索的随机流 —— 混用会让「AI 想了想」这件事改变发牌结果。
function lcg(seed: number): () => number {
  let s = (seed >>> 0) || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function turnCommands(state: GameState, player: PlayerIdx, lib: CardLibrary): Command[] {
  return legalCommands(state, player, lib).filter(
    (c) => c.type !== 'EndTurn' && c.type !== 'Concede',
  )
}

export function planTurnMcts(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts: MctsOpts = {},
): PlanResult {
  const iterations = opts.iterations ?? DEFAULT_ITERATIONS
  const maxDepth = opts.maxDepth ?? DEFAULT_DEPTH
  const c = opts.c ?? 0.9
  const foresight = opts.foresight ?? false
  const weights = opts.weights
  const rand = lcg(state.rng ^ (player + 1) * 0x9e3779b1)

  // 与 planner 同一把尺:回合内任何一点的价值,就是「此刻收手」值多少。
  const score = (s: GameState) => stopScore(s, player, lib, foresight, weights)

  const root: Node = {
    state,
    cmd: null,
    parent: null,
    untried: null,
    children: [],
    visits: 0,
    total: 0,
    stopScore: score(state),
    terminal: false,
  }

  let lo = root.stopScore
  let hi = root.stopScore
  const norm = (v: number) => (hi > lo ? (v - lo) / (hi - lo) : 0.5)
  const observe = (v: number) => {
    if (v < lo) lo = v
    if (v > hi) hi = v
  }

  // 全局最优线:MCTS 的返回值按访问次数选是**平均意义**上最稳的一步,
  // 但我们要的是「这个回合怎么打」,而回合内没有对手介入 ——
  // 也就是说这是一个纯粹的最大化问题,直接记住见过的最好局面才对。
  // (访问次数那套是为对抗搜索准备的,用在这里反而会因为平均值而错过尖峰。)
  let bestScore = root.stopScore
  let bestLine: Command[] = []

  const lineOf = (node: Node): Command[] => {
    const out: Command[] = []
    for (let n: Node | null = node; n && n.cmd; n = n.parent) out.unshift(n.cmd)
    return out
  }

  let nodes = 0

  for (let iter = 0; iter < iterations; iter++) {
    // ---- 选择:沿 UCT 下行到一个还有未展开着法的节点 ----
    let node = root
    let depth = 0
    while (!node.terminal && node.untried !== null && node.untried.length === 0 && depth < maxDepth) {
      if (node.children.length === 0) break
      let best: Node | null = null
      let bestUct = -Infinity
      for (const child of node.children) {
        // 没访问过的孩子优先(否则 log(0) 与除零都要特判)
        const uct =
          child.visits === 0
            ? Infinity
            : child.total / child.visits + c * Math.sqrt(Math.log(node.visits + 1) / child.visits)
        if (uct > bestUct) {
          bestUct = uct
          best = child
        }
      }
      if (!best) break
      node = best
      depth++
    }

    // ---- 展开:从未展开的着法里随机取一个 ----
    if (!node.terminal && depth < maxDepth) {
      if (node.untried === null) node.untried = turnCommands(node.state, player, lib)
      if (node.untried.length > 0) {
        const i = Math.floor(rand() * node.untried.length)
        const [cmd] = node.untried.splice(i, 1)
        const r = applyCommand(node.state, player, cmd, lib)
        nodes++
        if (r.ok) {
          const child: Node = {
            state: r.state,
            cmd,
            parent: node,
            untried: null,
            children: [],
            visits: 0,
            total: 0,
            stopScore: score(r.state),
            terminal: r.state.phase === 'ended',
          }
          node.children.push(child)
          node = child
          depth++
          observe(child.stopScore)
          if (child.stopScore > bestScore) {
            bestScore = child.stopScore
            bestLine = lineOf(child)
          }
        }
      }
    }

    // ---- 模拟:随机走到回合结束(或深度上限),取路上见过的**最好**局面 ----
    // 取最好而不是取终点:回合内的每一步都是自愿的,玩家随时可以收手,
    // 所以一条线的价值是它路上能达到的最高点,不是它随机乱走到的那个终点。
    let sim = node.state
    let simScore = node.stopScore
    let simLine = lineOf(node)
    for (let d = depth; d < maxDepth && sim.phase !== 'ended'; d++) {
      const cands = turnCommands(sim, player, lib)
      if (cands.length === 0) break
      const cmd = cands[Math.floor(rand() * cands.length)]
      const r = applyCommand(sim, player, cmd, lib)
      nodes++
      if (!r.ok) break
      sim = r.state
      simLine = [...simLine, cmd]
      const s = score(sim)
      observe(s)
      if (s > simScore) {
        simScore = s
        if (s > bestScore) {
          bestScore = s
          bestLine = simLine
        }
      }
      if (sim.phase === 'ended') break
    }

    // ---- 回传 ----
    const reward = norm(simScore)
    for (let n: Node | null = node; n; n = n.parent) {
      n.visits++
      n.total += reward
    }
  }

  return { line: bestLine, score: bestScore, nodes }
}

// MCTS 给出的**下一步**。空线 = 这回合最好的选择就是直接结束。
export function mctsStep(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts?: MctsOpts,
): Command {
  return planTurnMcts(state, player, lib, opts).line[0] ?? { type: 'EndTurn' }
}
