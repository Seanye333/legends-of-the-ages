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
  'connection-lost': { zh: '连接已断开', en: 'Disconnected' },
  'rate-limited': { zh: '操作过于频繁', en: 'Too many actions' },
  'seat-taken': { zh: '座位已被占用', en: 'That seat is taken' },
  'profile-locked': { zh: '存档属于另一台设备', en: 'This save belongs to another device' },
  // ---- 第二批(2026-07)。把全库的错误码扫出来对了一遍,发现 23 条没有映射,
  //      会把 kebab-case 原样显示给玩家。其中 room-not-found / room-taken
  //      是房间码打错一个字符就必然撞到的 —— 玩家看到的就是字面量。----
  // 房间
  'room-not-found': { zh: '没有这个房间 —— 房间码再核对一下', en: 'No such room — check the code' },
  'room-taken': { zh: '这个房间已经有人了', en: 'That room is already full' },
  'no-match': { zh: '这局已经不在了', en: 'That match no longer exists' },
  // 出牌与目标
  'attacker-not-found': { zh: '这个单位已经不在场上了', en: 'That unit is no longer on the board' },
  'target-not-found': { zh: '目标已经不在了', en: 'That target is gone' },
  'duelist-not-found': { zh: '单挑者已经不在场上了', en: 'The duelist is no longer on the board' },
  'duel-target-invalid': { zh: '不能和这个目标单挑', en: 'You cannot duel that target' },
  'stratagem-without-spell': { zh: '这张锦囊没有可施放的效果', en: 'That stratagem has no effect to cast' },
  // 抉择与发现
  'choice-pending': { zh: '先把当前的选择做完', en: 'Resolve the current choice first' },
  'no-pending-choice': { zh: '现在没有要选的东西', en: 'There is nothing to choose right now' },
  'not-your-choice': { zh: '这个选择不归你做', en: 'That choice is not yours to make' },
  'invalid-choice-index': { zh: '选项无效', en: 'That option is not valid' },
  'invalid-mode': { zh: '抉择模式无效', en: 'That mode is not valid' },
  // 资源与机制
  'not-enough-supply': { zh: '粮草不够', en: 'Not enough supply' },
  'no-upgrade': { zh: '这个主公技没有升阶', en: 'This Hero Power has no upgrade' },
  'secrets-full': { zh: '伏兵位已满', en: 'No room for another secret' },
  'secret-duplicate': { zh: '同名伏兵只能埋一个', en: 'That secret is already in play' },
  'not-mulligan-phase': { zh: '现在不是调度阶段', en: 'Not in the mulligan phase' },
  // 协议 / 传输(玩家一般见不到,但见到时也该是人话)
  'bad-json': { zh: '收到一条读不懂的消息', en: 'Received a malformed message' },
  'bad-envelope': { zh: '消息格式不对', en: 'Malformed message envelope' },
  'bad-player-id': { zh: '玩家标识无效', en: 'Invalid player id' },
  'bad-report': { zh: '战绩上报被拒', en: 'Result report rejected' },
  'too-large': { zh: '消息太大,已拒绝', en: 'Message too large' },
  'not-connected': {
    zh: '还没连上,这一步没有发出去 —— 等重连完成再试',
    en: 'Not connected — that move was not sent. Wait for the reconnect to finish.',
  },
  // 引擎内部异常(见 transport.ts:sendCommand 的 try)
  'engine-crashed': {
    zh: '这一步出错了,已保持原局面 —— 换个操作试试;若反复出现请到设置页导出诊断信息',
    en: 'That move hit an internal error and was not applied. Try something else; if it keeps happening, export diagnostics from Settings.',
  },
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
