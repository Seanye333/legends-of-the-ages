// 视角裁剪:隐藏对手手牌与双方牌库内容。
// Phase 3 服务器只向客户端推送 redact 后的状态与事件。
import type { CardInstance, GameEvent, GameState, PlayerIdx, PlayerState } from './types'

export interface RedactedSelf extends Omit<PlayerState, 'deck'> {
  deckCount: number
}

// 对手的伏兵**只给 iid**。这是整个裁剪层里最不能出错的一处 ——
// 伏兵的全部价值就是对手不知道它是什么;泄漏 defId 等于这个机制不存在。
// pack4.test.ts 里有一条针对性断言。
export interface RedactedOpponent
  extends Omit<PlayerState, 'deck' | 'hand' | 'secrets'> {
  deckCount: number
  handCount: number
  handIids: number[]
  secretIids: number[]
}

export interface RedactedState {
  viewer: PlayerIdx
  turn: number
  activePlayer: PlayerIdx
  phase: GameState['phase']
  winner?: GameState['winner']
  self: RedactedSelf
  opponent: RedactedOpponent
}

export function redactState(state: GameState, viewer: PlayerIdx): RedactedState {
  const me = state.players[viewer]
  const opp = state.players[viewer === 0 ? 1 : 0]
  const cloneInsts = (list: CardInstance[]) => structuredClone(list)
  return {
    viewer,
    turn: state.turn,
    activePlayer: state.activePlayer,
    phase: state.phase,
    winner: state.winner,
    self: {
      heroId: me.heroId,
      heroHp: me.heroHp,
      heroMaxHp: me.heroMaxHp,
      armor: me.armor,
      fatigue: me.fatigue,
      mana: { ...me.mana },
      hand: cloneInsts(me.hand),
      board: cloneInsts(me.board),
      graveyard: me.graveyard.slice(),
      mulliganDone: me.mulliganDone,
      heroPowerUsed: me.heroPowerUsed,
      heroPower: me.heroPower,
      secrets: me.secrets.map((x) => ({ ...x })),
      overloadNext: me.overloadNext,
      overloadLocked: me.overloadLocked,
      cardsPlayedThisTurn: me.cardsPlayedThisTurn,
      deckCount: me.deck.length,
    },
    opponent: {
      heroId: opp.heroId,
      heroHp: opp.heroHp,
      heroMaxHp: opp.heroMaxHp,
      armor: opp.armor,
      fatigue: opp.fatigue,
      mana: { ...opp.mana },
      board: cloneInsts(opp.board),
      graveyard: opp.graveyard.slice(),
      mulliganDone: opp.mulliganDone,
      heroPowerUsed: opp.heroPowerUsed,
      heroPower: opp.heroPower,
      overloadNext: opp.overloadNext,
      overloadLocked: opp.overloadLocked,
      cardsPlayedThisTurn: opp.cardsPlayedThisTurn,
      deckCount: opp.deck.length,
      handCount: opp.hand.length,
      handIids: opp.hand.map((c) => c.iid),
      secretIids: opp.secrets.map((s) => s.iid),
    },
  }
}

// 观战视角:两边的手牌内容都不能给。
// 复用 redactState(state, 0) 的形状,再把 0 号玩家的手牌抹成占位实例 ——
// 客户端本来就把 defId 为空的牌当「未知牌」渲染(联机时对手抽牌就是这么处理的),
// 所以观战端不需要任何特殊分支。
export function redactForSpectator(state: GameState): RedactedState {
  const rs = redactState(state, 0)
  return {
    ...rs,
    self: {
      ...rs.self,
      hand: rs.self.hand.map((c) => ({ ...c, defId: '' })),
      // 观战席看不到任何一方的伏兵(否则观众比对手多知道一半信息)
      secrets: rs.self.secrets.map((s) => ({ ...s, defId: '' })),
    },
  }
}

// 观战者也不能从事件流里反推手牌:任何一方的抽牌都抹掉牌面。
export function redactEventForSpectator(event: GameEvent): GameEvent {
  if (event.type === 'CardDrawn') return { ...event, defId: '' }
  if (event.type === 'SecretPlayed') return { ...event, defId: '' }
  return event
}

// 对手抽牌不暴露牌面(defId 置空)。其余事件均为公开信息。
export function redactEvent(event: GameEvent, viewer: PlayerIdx): GameEvent {
  if (event.type === 'CardDrawn' && event.player !== viewer) {
    return { ...event, defId: '' }
  }
  // 埋伏兵的那一刻也是秘密 —— SecretRevealed 才是公开的
  if (event.type === 'SecretPlayed' && event.player !== viewer) {
    return { ...event, defId: '' }
  }
  return event
}
