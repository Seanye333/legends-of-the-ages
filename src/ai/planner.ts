// 整回合规划器 —— 「军神」档的大脑。
//
// 【它补的是哪个洞】
// 贪心 AI 一次只看一步:枚举当前所有合法命令、各走一步、挑评分最高的那个。
// 这让它系统性地看不见**任何需要先亏后赚的组合**:
//   · 先用一张 buff 把 3/3 变成 5/5,再拿它换掉对面的 5/5 —— buff 那一步是掉分的;
//   · 先扔掉一张手牌解掉守护,再让全场打脸 —— 解场那一步换不回等价身材;
//   · 先出小怪再出光环,和先出光环再出小怪,收益差一整轮 —— 一步贪心分不出顺序。
// findLethal 补过其中最致命的一类(多步斩杀),但它**只搜攻击**,
// 不碰出牌、主公技、buff,而且有守护就直接放弃。
//
// 【为什么现在做得起】
// solveLethal 已经把「一个回合内的全命令空间 DFS」写好并测过了:转置表(功能投影
// 去重)、节点预算、深度上限,三道防爆炸闸门都在。这里换的只是**目标函数** ——
// 从「局面结束且赢家是我」换成「回合结束时 evaluate 最高」。搜索骨架是同一套。
//
// 【与 solveLethal 的分工】
// 斩杀是这里的一个特例(赢 = evaluate 返回 1e9,自然是最大值),所以军神档
// 不需要再单独跑 findLethal。但 solveLethal 保留:谜题验证要的是**完备性证明**
// (穷尽预算内所有线),而这里要的是**预算内最优**,两者的终止条件不一样。
import type { CardInstance, CardLibrary, Command, GameState, PlayerIdx, PlayerState } from '../engine/types'
import { applyCommand } from '../engine/reducer'
import { legalCommands } from '../engine/legal'
import { evaluate, stopScore, type EvalWeights } from './greedy'

export interface PlanResult {
  line: Command[] // 到达最优局面的命令序列(不含最后的 EndTurn)
  score: number
  nodes: number
}

export interface PlanOpts {
  nodeBudget?: number
  maxDepth?: number
  foresight?: boolean
  weights?: Partial<EvalWeights>
  // 留牌的跨回合价值(见 greedy.ts 的 stopScore)。透传即可,这里不做判断。
  holdValue?: boolean
}

// 预算比 solveLethal 小一个量级(那个是离线验证器,这个要在玩家等着的时候跑完)。
// 1200 个 applyCommand 在桌面上是几毫秒,手机上几十毫秒 —— 一个回合等这么久没问题。
// 实测:再往上加收益迅速衰减,因为一回合的有效分支本来就不深。
const DEFAULT_BUDGET = 1200
const DEFAULT_DEPTH = 10

// 局面的功能投影(与 lethalSolver 同一套思路):两个投影相等 ⇒ 后续可玩法一致。
// 忽略 iid 标签与 turn,保留一切影响合法着法与结算的字段(含 rng)。
function unitKey(u: CardInstance): string {
  return [
    u.defId,
    u.attack,
    u.health,
    u.maxHealth,
    [...u.keywords].sort().join('.'),
    u.exhausted ? 1 : 0,
    u.attacksUsed,
    u.frozen ? 1 : 0,
    u.silenced ? 1 : 0,
    u.shieldUsed ? 1 : 0,
    u.stealthBroken ? 1 : 0,
  ].join(':')
}
function sideKey(p: PlayerState): string {
  return [
    p.heroHp,
    p.armor,
    p.mana.current,
    p.heroPowerUsed ? 1 : 0,
    p.heroPowerCostDelta,
    p.overloadNext,
    p.cardsPlayedThisTurn,
    p.fatigue,
    p.deck.length,
    p.board.map(unitKey).sort().join('|'),
    p.hand.map((c) => `${c.defId}#${c.costDelta}`).sort().join('|'),
    p.secrets.map((s) => s.defId).sort().join('|'),
  ].join('~')
}
function stateKey(state: GameState, player: PlayerIdx): string {
  const pc = state.pendingChoice
    ? `${state.pendingChoice.player}/${state.pendingChoice.options.join('.')}`
    : ''
  return `${state.rng}!${state.activePlayer}!${pc}!${sideKey(state.players[player])}!${sideKey(
    state.players[player === 0 ? 1 : 0],
  )}`
}

// 「就在这里收手」值多少分。与 greedy 的 EndTurn 罚项保持一致 ——
// 否则规划器会算出一条「留着法力不花」的线,而贪心那边认为那是亏的,两个档位打法会分裂。
// 规划整个回合。返回预算内评分最高的那条线(可能是空 —— 意思是「直接结束回合」)。
export function planTurn(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts: PlanOpts = {},
): PlanResult {
  const budget = opts.nodeBudget ?? DEFAULT_BUDGET
  const maxDepth = opts.maxDepth ?? DEFAULT_DEPTH
  const foresight = opts.foresight ?? true
  const holdValue = opts.holdValue === true
  const weights = opts.weights
  const visited = new Set<string>()
  let nodes = 0

  let bestScore = stopScore(state, player, lib, foresight, weights, holdValue)
  let bestLine: Command[] = []
  const line: Command[] = []

  function dfs(cur: GameState, depth: number): void {
    if (depth > maxDepth || nodes >= budget) return
    const key = stateKey(cur, player)
    if (visited.has(key)) return
    visited.add(key)

    const cands = legalCommands(cur, player, lib).filter(
      (c) => c.type !== 'EndTurn' && c.type !== 'Concede',
    )

    // 先各走一步、缓存结果态,按「走完这一步就收手」的分数降序排。
    // 好线优先展开 = 预算用光时手上握着的那条更好,这是**预算内最优**的关键:
    // 与 solveLethal 不同,这里超预算不是「没证明」,而是「就用现在最好的」。
    const nexts: { cmd: Command; next: GameState; score: number }[] = []
    for (const cmd of cands) {
      if (nodes >= budget) break
      nodes++
      const r = applyCommand(cur, player, cmd, lib)
      if (!r.ok) continue
      // 对局结束:赢了就是 1e9(斩杀天然是这里的最大值),输/平直接剪掉
      if (r.state.phase === 'ended') {
        const s = evaluate(r.state, player, lib, foresight, weights)
        if (s > bestScore) {
          bestScore = s
          bestLine = [...line, cmd]
        }
        continue
      }
      const s = stopScore(r.state, player, lib, foresight, weights, holdValue)
      if (s > bestScore) {
        bestScore = s
        bestLine = [...line, cmd]
      }
      nexts.push({ cmd, next: r.state, score: s })
    }

    nexts.sort((a, b) => b.score - a.score)
    for (const n of nexts) {
      if (nodes >= budget) break
      line.push(n.cmd)
      dfs(n.next, depth + 1)
      line.pop()
    }
  }

  dfs(state, 0)
  return { line: bestLine, score: bestScore, nodes }
}

// 规划器给出的**下一步**。空线 = 这回合最好的选择就是直接结束。
export function plannedStep(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts?: PlanOpts,
): Command {
  const plan = planTurn(state, player, lib, opts)
  return plan.line[0] ?? { type: 'EndTurn' }
}
