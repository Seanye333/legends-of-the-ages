// 回放 = 配置 + 命令日志。重放推导终态;服务器权威校验用同一 applyCommand。
import type { CardLibrary, Command, GameConfig, GameEvent, GameState, PlayerIdx } from './types'
import { createGame } from './init'
import { applyCommand } from './reducer'

export interface MatchRecord {
  cfg: GameConfig
  commands: { player: PlayerIdx; cmd: Command }[]
}

export type ReplayResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string; atIndex: number }

export function replayMatch(record: MatchRecord, lib: CardLibrary): ReplayResult {
  let state = createGame(record.cfg, lib)
  const events: GameEvent[] = []
  for (let i = 0; i < record.commands.length; i++) {
    const { player, cmd } = record.commands[i]
    const r = applyCommand(state, player, cmd, lib)
    if (!r.ok) return { ok: false, error: r.error, atIndex: i }
    state = r.state
    events.push(...r.events)
  }
  return { ok: true, state, events }
}
