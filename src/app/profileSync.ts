// 存档云同步:把收藏/卡包/战绩/自组卡组/每日军令挂到匿名 playerId 上,
// 换设备或清缓存不再等于账号归零。
//
// 设计取舍:
// - **本地优先**。所有读写照旧走 localStorage,云端只是异步的镜像;
//   没配服务器、断网、服务器没部署 —— 一律静默降级,不阻塞任何操作。
// - **后写覆盖**。单调 version,服务器拒收低版本并回传自己那份,客户端据此对齐。
// - 这解决跨设备连续性,**不是反作弊**:客户端仍可上传任意数据。
//   真反作弊要把卡包发放搬到服务器(联机胜负已由 MatchDO 权威判定,是现成的落点)。
import { useCollection } from './collectionStore'
import { useQuests } from './questStore'
import { getPlayerId } from './leaderboard'
import { DEFAULT_SERVER, httpBase } from './protocol'

const SERVER_KEY = 'qiangu-server-addr'
const VERSION_KEY = 'qiangu-profile-version'
const PUSH_DEBOUNCE_MS = 2500

export interface ProfileData {
  owned: Record<string, number>
  packs: number
  // 加了会变的存档字段,记得同时改 snapshot() 与 adopt() 两侧 —— 只改一边
  // 表现为「换设备后这个字段悄悄归零」,而且不会报错。
  merit: number
  packsSinceLegendary: number
  wins: number
  losses: number
  customDecks: unknown[]
  questDate: string
  quests: unknown[]
}

interface Envelope {
  version: number
  updatedAt?: number
  data: ProfileData | null
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline'

let status: SyncStatus = 'idle'
let pushTimer: ReturnType<typeof setTimeout> | null = null
let started = false
const listeners = new Set<(s: SyncStatus) => void>()

function setStatus(s: SyncStatus): void {
  if (status === s) return
  status = s
  for (const fn of listeners) fn(s)
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// 服务器地址与联机面板共用一份配置;用户没填过就用默认值
function serverBase(): string {
  let addr = DEFAULT_SERVER
  try {
    addr = localStorage.getItem(SERVER_KEY) ?? DEFAULT_SERVER
  } catch {
    /* 隐私模式:用默认值 */
  }
  return httpBase(addr.trim())
}

function localVersion(): number {
  try {
    return Number(localStorage.getItem(VERSION_KEY) ?? '0') || 0
  } catch {
    return 0
  }
}

function setLocalVersion(v: number): void {
  try {
    localStorage.setItem(VERSION_KEY, String(v))
  } catch {
    /* 忽略 */
  }
}

export function snapshot(): ProfileData {
  const c = useCollection.getState()
  const q = useQuests.getState()
  return {
    owned: c.owned,
    packs: c.packs,
    merit: c.merit,
    packsSinceLegendary: c.packsSinceLegendary,
    wins: c.wins,
    losses: c.losses,
    customDecks: c.customDecks,
    questDate: q.date,
    quests: q.quests,
  }
}

// 采纳服务器版本:整份替换(版本号已经表明它更新)
function adopt(data: ProfileData): void {
  if (!data || typeof data !== 'object') return
  useCollection.setState({
    owned: data.owned ?? {},
    packs: data.packs ?? 0,
    merit: data.merit ?? 0,
    packsSinceLegendary: data.packsSinceLegendary ?? 0,
    wins: data.wins ?? 0,
    losses: data.losses ?? 0,
    customDecks: (data.customDecks ?? []) as never,
  })
  if (data.questDate && Array.isArray(data.quests)) {
    useQuests.setState({ date: data.questDate, quests: data.quests as never })
    useQuests.getState().refreshIfNewDay() // 服务器那份可能是昨天的
  }
}

async function pull(): Promise<void> {
  const res = await fetch(
    `${serverBase()}/profile?playerId=${encodeURIComponent(getPlayerId())}`,
  )
  if (!res.ok) throw new Error(`pull ${res.status}`)
  const env = (await res.json()) as Envelope
  if (env.data && env.version > localVersion()) {
    adopt(env.data)
    setLocalVersion(env.version)
  } else if (env.version < localVersion()) {
    // 服务器落后(比如换了新服务器):把本地推上去
    await push()
  }
}

async function push(): Promise<void> {
  const version = localVersion() + 1
  const res = await fetch(
    `${serverBase()}/profile?playerId=${encodeURIComponent(getPlayerId())}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, data: snapshot() }),
    },
  )
  if (res.status === 409) {
    // 别的设备更新过:对齐服务器那份
    const env = (await res.json()) as Envelope
    if (env.data) {
      adopt(env.data)
      setLocalVersion(env.version)
    }
    return
  }
  if (!res.ok) throw new Error(`push ${res.status}`)
  setLocalVersion(version)
}

function schedulePush(): void {
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    pushTimer = null
    setStatus('syncing')
    push()
      .then(() => setStatus('synced'))
      .catch(() => setStatus('offline'))
  }, PUSH_DEBOUNCE_MS)
}

// 应用启动时调一次:先拉,再订阅本地变更做防抖回推。
export function startProfileSync(): void {
  if (started) return
  started = true

  setStatus('syncing')
  pull()
    .then(() => setStatus('synced'))
    .catch(() => setStatus('offline'))

  // 收藏与任务任一变化就排一次回推(防抖合并连续变更)
  useCollection.subscribe(schedulePush)
  useQuests.subscribe(schedulePush)

  // 关页面前尽力推一把,别把刚开的卡包丢了。
  // 用 globalThis 特性探测而非直接摸 window:这个模块在测试(无 DOM)里也会被加载。
  const g = globalThis as unknown as {
    addEventListener?: (type: string, fn: () => void) => void
    navigator?: { sendBeacon?: (url: string, data: Blob) => boolean }
  }
  g.addEventListener?.('pagehide', () => {
    if (!pushTimer) return
    clearTimeout(pushTimer)
    pushTimer = null
    const body = JSON.stringify({ version: localVersion() + 1, data: snapshot() })
    try {
      g.navigator?.sendBeacon?.(
        `${serverBase()}/profile?playerId=${encodeURIComponent(getPlayerId())}`,
        new Blob([body], { type: 'application/json' }),
      )
    } catch {
      /* 尽力而为 */
    }
  })
}

// 手动触发一次立即同步(设置页「立即同步」用)
export async function syncNow(): Promise<SyncStatus> {
  setStatus('syncing')
  try {
    await push()
    setStatus('synced')
  } catch {
    setStatus('offline')
  }
  return status
}
