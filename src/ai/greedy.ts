// 贪心 AI:枚举合法命令 → 纯函数模拟一步 → 评分取最优。
// 评分里终局是压倒项,所以逐步贪心天然会走出多步斩杀线。
// 确定性:所有随机(平手抖动/失误)走调用方传入的种子,模拟与正式对局可复现。
import type { CardLibrary, Command, GameState, PlayerIdx } from '../engine/types'
import { applyCommand } from '../engine/reducer'
import { legalCommands } from '../engine/legal'
import { rngNext } from '../engine/rng'

export interface AiConfig {
  // 失误概率:以该概率选次优解(难度调节)
  blunderChance: number
}

export const AI_NORMAL: AiConfig = { blunderChance: 0 }
export const AI_EASY: AiConfig = { blunderChance: 0.25 }

// 三档难度(UI 用兵法称谓:新兵/宿将/名将)。
// 「名将」= 零失误的完全贪心;越往下失误概率越高,给新玩家喘息空间。
export const AI_LEVELS = {
  recruit: { blunderChance: 0.35 },
  veteran: { blunderChance: 0.12 },
  general: { blunderChance: 0 },
} as const satisfies Record<string, AiConfig>

export function evaluate(state: GameState, player: PlayerIdx, lib: CardLibrary): number {
  if (state.phase === 'ended') {
    if (state.winner === player) return 1e9
    if (state.winner === 'draw') return 0
    return -1e9
  }
  const me = state.players[player]
  const foe = state.players[player === 0 ? 1 : 0]
  let score = 0
  for (const c of me.board) {
    score += c.attack * 1 + c.health * 0.8
    if (c.keywords.includes('guard')) score += 1
  }
  for (const c of foe.board) {
    score -= c.attack * 1 + c.health * 0.8
    if (c.keywords.includes('guard')) score -= 1
  }
  score += (me.heroHp + me.armor) * 0.6 - (foe.heroHp + foe.armor) * 0.6
  score += me.hand.length * 0.4 - foe.hand.length * 0.4
  void lib
  return score
}

export interface AiStepResult {
  cmd: Command
  rng: number
}

// 选出当前一步。调用方负责 applyCommand 并循环调用直到 EndTurn/对局结束。
export function aiStep(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  aiRng: number,
  config: AiConfig = AI_NORMAL,
): AiStepResult {
  let rng = aiRng

  if (state.phase === 'mulligan') {
    // 简单调度:留 3 费以下
    const keepIids = state.players[player].hand
      .filter((c) => (lib[c.defId]?.cost ?? 99) <= 3)
      .map((c) => c.iid)
    return { cmd: { type: 'Mulligan', keepIids }, rng }
  }

  const commands = legalCommands(state, player, lib).filter((c) => c.type !== 'Concede')
  if (commands.length === 0) return { cmd: { type: 'EndTurn' }, rng }

  const scored = commands.map((cmd) => {
    const r = applyCommand(state, player, cmd, lib)
    if (!r.ok) return { cmd, score: -Infinity }
    let score = evaluate(r.state, player, lib)
    // EndTurn 轻微惩罚:还有正收益动作时别提前结束
    if (cmd.type === 'EndTurn') score -= 0.05
    return { cmd, score }
  })
  scored.sort((a, b) => b.score - a.score)

  let pickIndex = 0
  if (config.blunderChance > 0 && scored.length > 1) {
    const roll = rngNext(rng)
    rng = roll.next
    if (roll.value < config.blunderChance) pickIndex = 1
  }
  return { cmd: scored[pickIndex].cmd, rng }
}
