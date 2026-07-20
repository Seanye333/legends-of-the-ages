// 每日胜场排行榜客户端:静默容错 —— 无网络/未部署/未配置 KV 时一律安静降级。
// 本地永远自己记当日胜场;服务器只是「锦上添花」。

const NAME_KEY = 'qiangu-player-name'
const DAILY_KEY = 'qiangu-daily-wins'
const PLAYER_ID_KEY = 'qiangu-player-id'

// 匿名设备 ID:首次生成后永续,天梯积分挂在它上面(无账号系统的最小方案)
let memPlayerId: string | null = null
export function getPlayerId(): string {
  if (memPlayerId) return memPlayerId
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY)
    if (saved) {
      memPlayerId = saved
      return saved
    }
  } catch {
    /* node/隐私模式:退化为会话内存 ID */
  }
  memPlayerId = crypto.randomUUID()
  try {
    localStorage.setItem(PLAYER_ID_KEY, memPlayerId)
  } catch {
    /* 忽略 */
  }
  return memPlayerId
}

export interface LeaderboardRow {
  id?: string // 榜位主键(旧数据可能没有)
  name: string
  wins: number
}

export function todayStr(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function getPlayerName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setPlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name.trim().slice(0, 16))
  } catch {
    /* 忽略 */
  }
}

export function todayWins(): number {
  try {
    const raw = localStorage.getItem(DAILY_KEY)
    if (!raw) return 0
    const { date, wins } = JSON.parse(raw) as { date: string; wins: number }
    return date === todayStr() ? wins : 0
  } catch {
    return 0
  }
}

// 记一场胜利,并(若有名字)静默上报服务器
export function reportWin(): void {
  const wins = todayWins() + 1
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ date: todayStr(), wins }))
  } catch {
    /* 忽略 */
  }
  const name = getPlayerName()
  if (!name) return
  void fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // 带上 playerId:服务端以它为榜位主键,名字只作展示。
    // 从前直接以显示名为 key,任何人都能顶着别人的名字往上写。
    body: JSON.stringify({ date: todayStr(), name, wins, playerId: getPlayerId() }),
  }).catch(() => undefined)
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[] | null> {
  try {
    const res = await fetch(`/api/leaderboard?date=${todayStr()}`)
    if (!res.ok) return null
    const json = (await res.json()) as { kvConfigured: boolean; rows: LeaderboardRow[] }
    if (!json.kvConfigured) return null
    return json.rows
  } catch {
    return null
  }
}
