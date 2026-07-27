// 本机埋点与崩溃留档 —— **不上报到任何服务器**。
//
// 【为什么需要它】
// 标题页有二十几个入口,而没有任何数据能回答「哪几个真的有人玩」。
// 没有这个数字,「砍掉哪个模式 / 往哪个模式加内容」就只能靠感觉。
// 客户端同样一直**没有崩溃留档**:错误边界能显示一次,刷新之后那次崩溃就永远消失了 ——
// 用户来报「昨天闪退了」的时候,手上一个字都没有。
//
// 【为什么不上报】
// 上报要么自建端点(服务端目前只有对局相关的 DO),要么接第三方 —— 两条都会
// 把玩家数据送出设备,而这个游戏到现在为止**一个字节都没往外送过**(见 ARCHITECTURE
// 的安全边界一节)。所以这一层只落 localStorage,在设置里给一个「导出诊断信息」按钮:
// 要不要交出去,是玩家点那一下决定的,不是我们决定的。
//
// 容量:模式计数是定长的(每个模式一个整数),崩溃只留最近 20 条。

const MODE_KEY = 'qiangu-mode-counts'
const CRASH_KEY = 'qiangu-crashes'
const MAX_CRASHES = 20

export type ModeKey =
  | 'quick'
  | 'online'
  | 'arena'
  | 'campaign'
  | 'campaign-trial'
  | 'expedition'
  | 'brawl'
  | 'tower'
  | 'history'
  | 'lethal'
  | 'daily-puzzle'
  | 'practice'
  | 'tutorial'
  | 'quiz'
  | 'deckbuilder'
  | 'collection'
  | 'codex'
  | 'lore'
  | 'replays'

export interface CrashRecord {
  at: string // ISO
  message: string
  stack?: string
  screen?: string
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // 配额满/隐私模式:埋点绝不能影响正常游戏,静默放弃
  }
}

// 一次模式启动记一次。调用点在各个入口的「开打/进入」那一下。
export function countMode(mode: ModeKey): void {
  const counts = readJson<Record<string, number>>(MODE_KEY, {})
  counts[mode] = (counts[mode] ?? 0) + 1
  writeJson(MODE_KEY, counts)
}

export function modeCounts(): Record<string, number> {
  return readJson<Record<string, number>>(MODE_KEY, {})
}

export function recordCrash(error: unknown, screen?: string): void {
  const err = error instanceof Error ? error : new Error(String(error))
  const list = readJson<CrashRecord[]>(CRASH_KEY, [])
  list.unshift({
    at: new Date().toISOString(),
    message: err.message,
    // 栈只留前 2000 字符:一条完整的 React 栈能有几十 KB,二十条就把配额吃光了
    stack: err.stack?.slice(0, 2000),
    screen,
  })
  writeJson(CRASH_KEY, list.slice(0, MAX_CRASHES))
}

export function crashes(): CrashRecord[] {
  return readJson<CrashRecord[]>(CRASH_KEY, [])
}

export function clearDiagnostics(): void {
  try {
    localStorage.removeItem(MODE_KEY)
    localStorage.removeItem(CRASH_KEY)
  } catch {
    // 同上
  }
}

// 「导出诊断信息」:一段纯文本,玩家自己决定要不要贴给我们。
export function diagnosticsText(): string {
  const counts = modeCounts()
  const lines: string[] = []
  lines.push(`千古名将 · 诊断信息 ${new Date().toISOString()}`)
  lines.push(`UA: ${typeof navigator === 'undefined' ? 'n/a' : navigator.userAgent}`)
  lines.push('')
  lines.push('模式使用次数:')
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) lines.push('  (无)')
  for (const [k, v] of entries) lines.push(`  ${k}: ${v}`)
  lines.push('')
  const cs = crashes()
  lines.push(`最近 ${cs.length} 次错误:`)
  if (cs.length === 0) lines.push('  (无)')
  for (const c of cs) {
    lines.push(`  [${c.at}]${c.screen ? ` @${c.screen}` : ''} ${c.message}`)
    if (c.stack) lines.push(`    ${c.stack.split('\n').slice(0, 4).join('\n    ')}`)
  }
  return lines.join('\n')
}
