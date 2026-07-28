import type { CardDef, CardInstance, GameState, LocalizedText, PlayerIdx } from '../engine/types'
import { BOARD_LIMIT } from '../engine/types'

// 「这张牌为什么打不出?」
//
// 【问题】
// 打不出的牌现在是灰的,点它没有任何反应。灰色只说了「不行」,没说「为什么不行」——
// 而这游戏里「不行」的原因有六七种,其中至少三种新手根本想不到
// (场上满了 / 锦囊没有合法目标 / 这张牌被冻在手里)。
// 于是新手的体验是:我点了,它不动,这游戏是不是坏了。
//
// 【为什么放在 UI 层而不是引擎里】
// 引擎只回答「合不合法」,那是一个布尔值,而且必须保持纯粹与最小 ——
// 给 `legalCommands` 加一路「不合法的理由」等于让引擎背上文案的责任,
// 还得跟着 i18n 走。UI 这边本来就拿得到 state 和 CardDef,自己重算一遍很便宜。
//
// 【顺序是有讲究的】
// 一张牌可能同时踩中好几条(既没费又满场)。按「玩家最该先解决哪一条」排:
// 费用永远第一(它最常见也最好懂),回合归属第二(那是最根本的),
// 之后才是场地与目标这类局面性的原因。
export type UnplayableReason =
  | 'not-your-turn'
  | 'mana'
  | 'board-full'
  | 'no-target'
  | 'unknown'

export interface Unplayable {
  reason: UnplayableReason
  text: LocalizedText
}

export function whyNotPlayable(
  state: GameState,
  seat: PlayerIdx,
  inst: CardInstance,
  def: CardDef | undefined,
  // 该玩家当前所有合法的出牌命令(MatchScreen 已经算好了,直接传进来避免重算)
  playableIids: ReadonlySet<number>,
): Unplayable | null {
  if (playableIids.has(inst.iid)) return null

  const me = state.players[seat]

  if (state.phase !== 'main' || state.activePlayer !== seat) {
    return {
      reason: 'not-your-turn',
      text: { zh: '还没轮到你 —— 等对方结束回合', en: 'Not your turn yet' },
    }
  }

  // 有效费用 = 卡面费 + 实例级修正(第七卡包的费用消减),下限 0。
  // 这里不 import 引擎的 effectiveCost 只为少绕一层:公式就这一行,而且它是稳定的。
  const cost = Math.max(0, (def?.cost ?? 0) + inst.costDelta)
  if (cost > me.mana.current) {
    const short = cost - me.mana.current
    return {
      reason: 'mana',
      text: {
        zh: `法力不够,还差 ${short} 点(这张 ${cost} 费,你有 ${me.mana.current} 点)`,
        en: `Need ${short} more mana — costs ${cost}, you have ${me.mana.current}`,
      },
    }
  }

  // 武将/衍生物要占位;锦囊与装备不占,所以只对上场类的牌查场地
  const takesBoard = def?.type === 'general'
  if (takesBoard && me.board.length >= BOARD_LIMIT) {
    return {
      reason: 'board-full',
      text: {
        zh: `战场已满(最多 ${BOARD_LIMIT} 名武将)—— 先打一波或让位`,
        en: `Board is full (max ${BOARD_LIMIT}) — attack or make room first`,
      },
    }
  }

  // 走到这里说明费用够、位置够、也是自己的回合,那么剩下的几乎只有一种:
  // 这张牌需要一个目标,而场上没有满足条件的目标(比如「消灭一名敌方武将」时对面空场)。
  // 说「没有可选的目标」比说「无法打出」有用得多 —— 它指向了解决办法:先让对面有东西。
  return {
    reason: 'no-target',
    text: {
      zh: '场上没有这张牌能选的目标',
      en: 'No legal target on the board for this card',
    },
  }
}
