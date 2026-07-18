import type { Command, GameState, PlayerIdx } from './types'

// 当前玩家的合法命令。驱动 AI 决策和 UI 可点判定。
// 注:调度阶段的换牌组合数量是指数级,这里只列「全保留」代表项;
// 任意 keepIids 子集是否合法由 applyCommand 校验。
export function legalCommands(state: GameState, player: PlayerIdx): Command[] {
  if (state.phase === 'ended') return []
  if (state.phase === 'mulligan') {
    const p = state.players[player]
    if (p.mulliganDone) return []
    return [
      { type: 'Mulligan', keepIids: p.hand.map((c) => c.iid) },
      { type: 'Concede' },
    ]
  }
  if (player !== state.activePlayer) return []
  // Phase 1 在此加入 PlayCard/Attack 枚举
  return [{ type: 'EndTurn' }, { type: 'Concede' }]
}
