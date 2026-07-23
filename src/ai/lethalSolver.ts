// 单回合斩杀求解器 —— 斩杀谜题的验证器 / 提示引擎 / (未来)挖矿器。
//
// 【为什么不能复用 greedy.ts 的 findLethal】
// 那个只搜「把能打脸的单位全派上去」一种斩杀:有守护即放弃、不碰主公技/法术/
// buff 攻击者/先清场再打脸。它是给贪心 AI 补盲区的近似,当不了谜题的「有解性证明」。
//
// 这里做的是**一个回合内的完整搜索**:对「出牌 / 主公技 / 攻击」的全命令空间
// 做 DFS,命中「对局结束且赢家是我」即为斩杀。三道防爆炸闸门:
//   1. 转置表:把局面规范成功能投影(忽略 iid 标签、含 rng)去重 —— 不同出牌次序
//      到达的等价局面只展开一次。对「存在性」是可靠的:等价局面的子树有没有解与
//      到达路径无关。
//   2. 节点预算:applyCommand 调用数封顶,超了返回 null(视作「未能证明有解」)。
//   3. 深度上限:一回合的动作数天然有界。
// 着法按「敌方英雄有效血 + 守护墙总血」升序排,让烧脸/清墙的线最先被找到 ——
// 只影响找到的**速度**,不影响完备性(预算内会穷尽)。
//
// 纯函数、只走 applyCommand,与引擎同源、可确定复现(不用 Date/Math.random)。
import type { CardInstance, CardLibrary, Command, GameState, PlayerIdx, PlayerState } from '../engine/types'
import { applyCommand } from '../engine/reducer'
import { legalCommands } from '../engine/legal'
import { canAttackNow, maxAttacksOf } from '../engine/combat'

export interface LethalResult {
  line: Command[] // 达成斩杀的命令序列(供提示/展示解法回放)
  steps: number // = line.length
  nodes: number // 展开的节点数(可观测性)
}

export interface SolveOpts {
  nodeBudget?: number // applyCommand 调用上限,默认 100_000
  maxDepth?: number // 单回合最大动作数,默认 18
}

const DEFAULT_BUDGET = 100_000
const DEFAULT_DEPTH = 18

// 「离斩杀还有多远」的估值:越小越接近。敌方英雄有效血 + 挡在前面的守护墙总血。
// 清一个守护 → 分数下降 → 该线被优先展开(否则清墙线会排在纯烧脸线后面)。
function distanceToLethal(state: GameState, player: PlayerIdx): number {
  const foe = state.players[player === 0 ? 1 : 0]
  let guardHp = 0
  for (const u of foe.board) {
    if (u.keywords.includes('guard') && !u.keywords.includes('stealth')) guardHp += u.health
  }
  return foe.heroHp + foe.armor + guardHp
}

// 局面的功能投影:两个投影相等 ⇒ 后续可玩法完全一致(iid 标签无关)。
// 忽略 iid、seed、turn、nextIid;保留一切影响合法着法与其结算的字段,含 rng。
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
  const board = p.board.map(unitKey).sort().join('|')
  const hand = p.hand.map((c) => `${c.defId}#${c.costDelta}`).sort().join('|')
  const secrets = p.secrets.map((s) => s.defId).sort().join('|')
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
    board,
    hand,
    secrets,
  ].join('~')
}
function stateKey(state: GameState, player: PlayerIdx): string {
  const pc = state.pendingChoice
    ? `${state.pendingChoice.player}/${state.pendingChoice.options.join('.')}`
    : ''
  return `${state.rng}!${state.activePlayer}!${pc}!${sideKey(state.players[player])}!${sideKey(state.players[player === 0 ? 1 : 0])}`
}

// 找一条本回合结束对局(赢家是自己)的命令序列。找不到 / 超预算返回 null。
export function solveLethal(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts: SolveOpts = {},
): LethalResult | null {
  const budget = opts.nodeBudget ?? DEFAULT_BUDGET
  const maxDepth = opts.maxDepth ?? DEFAULT_DEPTH
  const visited = new Set<string>()
  let nodes = 0

  // 已经赢了?(退化输入)
  if (state.phase === 'ended') {
    return state.winner === player ? { line: [], steps: 0, nodes } : null
  }

  const line: Command[] = []

  function dfs(cur: GameState, depth: number): boolean {
    if (depth > maxDepth) return false
    if (nodes >= budget) return false

    const key = stateKey(cur, player)
    if (visited.has(key)) return false
    visited.add(key)

    // 枚举着法:滤掉结束回合与投降(斩杀只在本回合内成立)
    const cands = legalCommands(cur, player, lib).filter(
      (c) => c.type !== 'EndTurn' && c.type !== 'Concede',
    )

    // 先各走一步、缓存结果态,按「离斩杀的距离」升序排 —— 命中即返回,顺带避免重复 apply
    const nexts: { cmd: Command; next: GameState; win: boolean; dist: number }[] = []
    for (const cmd of cands) {
      if (nodes >= budget) break
      nodes++
      const r = applyCommand(cur, player, cmd, lib)
      if (!r.ok) continue
      const won = r.state.phase === 'ended' && r.state.winner === player
      if (won) {
        // 找到了 —— 记下这一步,直接冒泡返回
        line.push(cmd)
        return true
      }
      // 对手赢了 / 平局(自家单位亡语反噬之类):此路不通
      if (r.state.phase === 'ended') continue
      nexts.push({ cmd, next: r.state, win: false, dist: distanceToLethal(r.state, player) })
    }

    nexts.sort((a, b) => a.dist - b.dist)
    for (const n of nexts) {
      line.push(n.cmd)
      if (dfs(n.next, depth + 1)) return true
      line.pop()
    }
    return false
  }

  const found = dfs(state, 0)
  if (!found) return null
  return { line: [...line], steps: line.length, nodes }
}

// 便捷谓词:只问「有没有斩杀」。
export function hasLethal(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  opts?: SolveOpts,
): boolean {
  return solveLethal(state, player, lib, opts) !== null
}

// 「平凡斩杀」:不出任何牌、不使主公技,只把当前已就绪的单位直接砸向敌方英雄就能赢。
// 内容闸门用它筛掉「全体打脸即可」的假谜题 —— 真谜题要求 solveLethal 有解、而它无解。
export function trivialFaceLethal(state: GameState, player: PlayerIdx): boolean {
  const foe = state.players[player === 0 ? 1 : 0]
  // 有非潜行守护 → 不可能直接打脸
  if (foe.board.some((c) => c.keywords.includes('guard') && !c.keywords.includes('stealth'))) {
    return false
  }
  let dmg = 0
  for (const u of state.players[player].board) {
    if (!canAttackNow(u)) continue
    if (u.exhausted && !u.keywords.includes('charge')) continue
    dmg += u.attack * (maxAttacksOf(u) - u.attacksUsed)
  }
  return dmg >= foe.heroHp + foe.armor
}
