// 战报回放:录制对局的 (state, events) 帧流,终局落盘 localStorage。
// 本地/联机通吃(联机录的是裁剪后视角,天然不泄露对手手牌)。
// 只保存打完的对局;超大对局(JSON 超限)静默放弃持久化。
import type { GameEvent, GameState, Winner } from '../engine/types'

export interface ReplayFrame {
  state: GameState
  events: GameEvent[]
}

export interface SavedReplay {
  id: string
  date: string // ISO
  mode: 'local' | 'remote'
  heroIds: [string, string]
  opponentName?: string
  winner?: Winner
  frames: ReplayFrame[]
}

const KEY = 'qiangu-replays'
const MAX_REPLAYS = 5
const MAX_BYTES_PER_REPLAY = 2_500_000

let current: SavedReplay | null = null

export function beginReplayRecording(mode: 'local' | 'remote'): void {
  current = {
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
    mode,
    heroIds: ['', ''],
    frames: [],
  }
}

export function recordReplayFrame(
  state: GameState,
  events: GameEvent[],
  opponentName?: string,
): void {
  if (!current) return
  if (current.frames.length === 0) {
    current.heroIds = [state.players[0].heroId, state.players[1].heroId]
  }
  if (opponentName) current.opponentName = opponentName
  current.frames.push({ state, events })
  const ended = events.find((e) => e.type === 'GameEnded')
  if (ended && ended.type === 'GameEnded') {
    current.winner = ended.winner
    finalize()
  }
}

export function discardReplayRecording(): void {
  current = null
}

function finalize(): void {
  const done = current
  current = null
  if (!done || done.frames.length === 0) return
  try {
    const json = JSON.stringify(done)
    if (json.length > MAX_BYTES_PER_REPLAY) return
    const list = listReplays()
    list.unshift(done)
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_REPLAYS)))
  } catch {
    /* 存储不可用/超限:回放只是锦上添花 */
  }
}

export function listReplays(): SavedReplay[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as SavedReplay[]
    return Array.isArray(list) ? list.filter((r) => r?.frames?.length > 0) : []
  } catch {
    return []
  }
}

export function deleteReplay(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listReplays().filter((r) => r.id !== id)))
  } catch {
    /* 忽略 */
  }
}
