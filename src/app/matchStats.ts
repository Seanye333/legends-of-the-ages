// 终局战绩:把事件流折叠成几个数字,给结算画面用。
//
// 为什么不在结算时从 GameState 反推:打完之后的状态里没有「这一局总共造成多少伤害」
// 这种信息 —— 它只存在于过程里。事件流是唯一记着过程的东西,所以边打边折。
//
// 一律以**人类玩家 = 0 号**为视角(联机局里 remoteMatch 已经把座位翻转好了)。
import type { GameEvent, GameState } from '../engine/types'

export interface MatchStats {
  damageDealt: number // 我方打出去的总伤害(主公 + 武将)
  damageToFace: number // 其中打在敌方主公脸上的
  damageTaken: number // 我方主公承受的
  generalsPlayed: number // 我方登场的武将数(含召唤出来的)
  enemyGeneralsSlain: number // 敌方武将阵亡数
  cardsDrawn: number
  manaSpent: number
  peakBoard: number // 我方场面同时在场的最大武将数
  secretsRevealed: number // 我方伏兵被触发的次数
  combosTriggered: number
  discoveries: number // 我方完成的发现次数
  turns: number
}

export const EMPTY_STATS: MatchStats = {
  damageDealt: 0,
  damageToFace: 0,
  damageTaken: 0,
  generalsPlayed: 0,
  enemyGeneralsSlain: 0,
  cardsDrawn: 0,
  manaSpent: 0,
  peakBoard: 0,
  secretsRevealed: 0,
  combosTriggered: 0,
  discoveries: 0,
  turns: 0,
}

// 折进一批新事件。纯函数:返回新对象,不改入参。
//
// 一处必须说清的近似:伤害事件带的 `player` 是**承受方**,不是来源方。
// 所以「我方造成的伤害」这里算的是「敌方承受的伤害」—— 对手用苦肉计之类
// 自伤时会被算进我的账上。真要精确得给每个伤害事件加来源字段,
// 那是引擎层的改动,为一个结算数字不值得。数量级上完全够用。
export function foldStats(
  prev: MatchStats,
  events: readonly GameEvent[],
  state: GameState | null,
): MatchStats {
  if (events.length === 0) return prev
  const s = { ...prev }
  for (const ev of events) {
    switch (ev.type) {
      case 'HeroDamaged':
        if (ev.player === 1) {
          s.damageDealt += ev.amount
          s.damageToFace += ev.amount
        } else {
          s.damageTaken += ev.amount
        }
        break
      case 'GeneralDamaged':
        if (ev.player === 1) s.damageDealt += ev.amount
        break
      case 'GeneralSummoned':
        if (ev.player === 0) s.generalsPlayed += 1
        break
      case 'GeneralDied':
        if (ev.player === 1) s.enemyGeneralsSlain += 1
        break
      case 'CardDrawn':
        if (ev.player === 0) s.cardsDrawn += 1
        break
      case 'CardPlayed':
        if (ev.player === 0) s.manaSpent += ev.cost
        break
      case 'SecretRevealed':
        if (ev.player === 0) s.secretsRevealed += 1
        break
      case 'ComboTriggered':
        if (ev.player === 0) s.combosTriggered += 1
        break
      case 'DiscoverPicked':
        if (ev.player === 0) s.discoveries += 1
        break
      case 'TurnStarted':
        if (ev.player === 0) s.turns += 1
        break
      default:
        break
    }
  }
  // 场面峰值从状态里取:事件流里没有「当前有几个」这个量,
  // 靠 Summoned 减 Died 去推会在弹回手牌、沉默这些路径上悄悄算错。
  if (state) s.peakBoard = Math.max(s.peakBoard, state.players[0].board.length)
  return s
}
