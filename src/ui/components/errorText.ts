import type { LocalizedText } from '../../engine/types'

// 引擎与服务器抛出的都是英文错误码(`not-your-turn`、`match-abandoned`…),
// 之前 UI 直接把它们塞进 toast 里给玩家看。这里收口成人话。
// 未知码原样透出 —— 至少还能截图报 bug,比吞掉强。
const MATCH_ERRORS: Record<string, LocalizedText> = {
  // ---- 引擎 ----
  'not-your-turn': { zh: '还没轮到你', en: 'Not your turn' },
  'not-main-phase': { zh: '现在不能这么做', en: 'Not available right now' },
  'not-enough-mana': { zh: '法力不够', en: 'Not enough mana' },
  'board-full': { zh: '战场已满', en: 'Your board is full' },
  'card-not-in-hand': { zh: '这张牌不在手里', en: 'That card is not in your hand' },
  'target-required': { zh: '需要先选一个目标', en: 'Choose a target first' },
  'invalid-target': { zh: '不能选这个目标', en: 'That target is not legal' },
  'no-legal-target': { zh: '场上没有合法目标', en: 'No legal target on the board' },
  'illegal-attack-target': { zh: '不能攻击这个目标', en: 'That attack is not legal' },
  'hero-power-used': { zh: '主公技本回合已用过', en: 'Hero Power already used this turn' },
  'no-hero-power': { zh: '本局没有主公技', en: 'No Hero Power in this match' },
  'game-ended': { zh: '对局已结束', en: 'The match is over' },
  'mulligan-already-done': { zh: '调度已完成', en: 'Mulligan already submitted' },
  // ---- 服务器 ----
  'match-not-started': { zh: '对局还没开始', en: 'The match has not started' },
  'match-abandoned': { zh: '对局因长期无人行动已关闭', en: 'Match closed after long inactivity' },
  'turn-timeout': { zh: '回合超时,已自动结束回合', en: 'Turn timed out — your turn was ended' },
  'opponent-forfeited': { zh: '对手掉线超时,判你获胜', en: 'Opponent disconnected — you win' },
  'connect-failed': { zh: '连不上服务器', en: 'Could not reach the server' },
  'connection-lost': { zh: '连接已断开', en: 'Connection lost' },
  'rate-limited': { zh: '操作过于频繁', en: 'Too many actions' },
  'seat-taken': { zh: '座位已被占用', en: 'That seat is taken' },
  'profile-locked': { zh: '存档属于另一台设备', en: 'This save belongs to another device' },
  'profile-forbidden': { zh: '存档密钥不匹配', en: 'Save key does not match' },
}

// 客户端版本落后于服务端要求。这是唯一一条**必须给出动作**的错误 ——
// 其余错误重试就行,这条不刷新永远好不了。
export function isProtocolOutdated(code: string): boolean {
  return code.startsWith('protocol-outdated')
}

export function matchErrorText(code: string): LocalizedText {
  if (isProtocolOutdated(code)) {
    return {
      zh: '客户端版本过旧,请刷新页面以更新',
      en: 'This client is out of date — reload to update',
    }
  }
  const known = MATCH_ERRORS[code]
  if (known) return known
  // `illegal-deck: ...`、`unknown-card-def: ...` 这类带冒号的复合码取前缀再试一次
  const head = code.split(':')[0]?.trim()
  if (head === 'illegal-deck') {
    return { zh: '卡组不合法,服务器已拒绝', en: 'Deck rejected by the server' }
  }
  if (head && MATCH_ERRORS[head]) return MATCH_ERRORS[head]
  return { zh: code, en: code }
}
