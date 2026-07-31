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
import { recordCrash } from './telemetry'
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

  // 热座(双人同机):没有 AI,两个人轮流在同一台设备上出牌。
  // 引擎侧只要两件事 —— 命令按**当前该谁动**来执行,以及 AI 一步都不许走。
  // 视角翻转是 UI 的事(MatchScreen 按 activePlayer 决定谁在下面)。
  constructor(
    private readonly cfg: GameConfig,
    private readonly lib: CardLibrary,
    private readonly aiConfig: AiConfig = AI_NORMAL,
    private readonly hotSeat = false,
  ) {
    this.aiRng = cfg.seed ^ 0x5eed
  }

  // 该谁出牌。非热座时永远是座位 0(人类);热座时跟着对局走 ——
  // 调度阶段两个人各自调度一次,之后按 activePlayer。
  private actor(): PlayerIdx {
    if (!this.hotSeat) return this.humanPlayer
    if (this.state.phase === 'mulligan') return this.state.players[0].mulliganDone ? 1 : 0
    return this.state.activePlayer
  }

  start(): MatchUpdate {
    this.state = createGame(this.cfg, this.lib)
    // AI 先完成调度
    const events = this.runAi()
    return { state: this.state, events }
  }

  // 斩杀谜题的撤销用:GameState 不可变(applyCommand 产出新对象),快照存引用即可。
  // 只在谜题里用 —— 谜题 AI 从不行动,故 aiRng 无需回滚。
  snapshot(): GameState {
    return this.state
  }
  restore(s: GameState): void {
    this.state = s
  }

  // 【为什么整段包 try】
  // applyCommand 的失败**有两种**:一种是 `{ ok: false, error }`(规则拒绝,
  // 正常路径);另一种是抛异常(引擎内部出错、structuredClone 撞上不可克隆的东西)。
  // 从前只处理了第一种。而抛出来的那一种会一路穿过 React 事件处理器 ——
  // 错误边界**接不住事件处理器里的异常**,于是表现是:牌还在手上,点了没反应,
  // 没有 toast、没有崩溃页。玩家以为卡了,继续点,每点一次多记一条 crash。
  //
  // 现在把它转成一个普通的 error 码,和规则拒绝走同一条显示通路。
  // 状态**不推进**(this.state 只在成功路径上赋值),所以再点一次仍是同一个局面,
  // 不会把对局带进半更新的中间态。
  sendCommand(cmd: Command): { error: string } | { updates: MatchUpdate[] } {
    let r: ReturnType<typeof applyCommand>
    try {
      r = applyCommand(this.state, this.actor(), cmd, this.lib)
    } catch (e) {
      recordCrash(e, 'engine.applyCommand')
      return { error: 'engine-crashed' }
    }
    if (!r.ok) return { error: r.error }
    this.state = r.state
    const updates: MatchUpdate[] = [{ state: this.state, events: r.events }]
    // 轮到 AI(或调度阶段 AI 未完成)就让它走完
    let aiEvents: GameEvent[] = []
    try {
      aiEvents = this.runAi()
    } catch (e) {
      // AI 崩了不该把玩家刚打出的那张牌一起吞掉 —— 上面那一步已经生效,
      // 照常返回 updates,只是这一回合 AI 没走完(下一次交互会再试)。
      recordCrash(e, 'ai.step')
    }
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
    if (this.hotSeat) return false // 热座局没有 AI
    if (this.state.phase === 'ended') return false
    if (this.state.phase === 'mulligan') return !this.state.players[this.aiPlayer].mulliganDone
    return this.state.activePlayer === this.aiPlayer
  }
}
