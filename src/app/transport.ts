// MatchTransport:UI 与对局之间的唯一通道。
// Phase 1 只有 LocalMatch(本地引擎 + AI);Phase 3 的 WsMatch 实现同一接口,UI 零改动。
import type {
  CardLibrary,
  Command,
  GameConfig,
  GameEvent,
  GameState,
  PlayerIdx,
} from '../engine/types'
import { createGame } from '../engine/init'
import { applyCommand } from '../engine/reducer'
import { aiStep, AI_NORMAL, type AiConfig } from '../ai/greedy'

export interface MatchUpdate {
  state: GameState
  events: GameEvent[]
}

export interface MatchTransport {
  readonly humanPlayer: PlayerIdx
  start(): MatchUpdate
  // 人类命令。返回错误字符串或本次(含 AI 跟进回合)的更新序列。
  sendCommand(cmd: Command): { error: string } | { updates: MatchUpdate[] }
}

const MAX_AI_STEPS_PER_TURN = 100

export class LocalMatch implements MatchTransport {
  readonly humanPlayer: PlayerIdx = 0
  private state!: GameState
  private aiRng: number
  private readonly aiPlayer: PlayerIdx = 1

  constructor(
    private readonly cfg: GameConfig,
    private readonly lib: CardLibrary,
    private readonly aiConfig: AiConfig = AI_NORMAL,
  ) {
    this.aiRng = cfg.seed ^ 0x5eed
  }

  start(): MatchUpdate {
    this.state = createGame(this.cfg, this.lib)
    // AI 先完成调度
    const events = this.runAi()
    return { state: this.state, events }
  }

  sendCommand(cmd: Command): { error: string } | { updates: MatchUpdate[] } {
    const r = applyCommand(this.state, this.humanPlayer, cmd, this.lib)
    if (!r.ok) return { error: r.error }
    this.state = r.state
    const updates: MatchUpdate[] = [{ state: this.state, events: r.events }]
    // 轮到 AI(或调度阶段 AI 未完成)就让它走完
    const aiEvents = this.runAi()
    if (aiEvents.length > 0) updates.push({ state: this.state, events: aiEvents })
    return { updates }
  }

  private runAi(): GameEvent[] {
    const all: GameEvent[] = []
    let steps = 0
    while (this.aiShouldAct() && steps < MAX_AI_STEPS_PER_TURN) {
      steps++
      const { cmd, rng } = aiStep(this.state, this.aiPlayer, this.lib, this.aiRng, this.aiConfig)
      this.aiRng = rng
      const r = applyCommand(this.state, this.aiPlayer, cmd, this.lib)
      if (!r.ok) break // AI 给出非法命令:停手保底(fuzz 契约保证不应发生)
      this.state = r.state
      all.push(...r.events)
      // 注意:调度完若 AI 是先手,循环要继续把整个回合走完,
      // 结束条件交给 aiShouldAct(EndTurn 后轮到人类自然退出)
    }
    return all
  }

  private aiShouldAct(): boolean {
    if (this.state.phase === 'ended') return false
    if (this.state.phase === 'mulligan') return !this.state.players[this.aiPlayer].mulliganDone
    return this.state.activePlayer === this.aiPlayer
  }
}
