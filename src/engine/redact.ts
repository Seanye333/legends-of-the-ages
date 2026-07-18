// 视角裁剪:隐藏对手手牌与双方牌库内容。
// Phase 3 服务器只向客户端推送 redact 后的状态与事件。
import type { CardInstance, GameEvent, GameState, PlayerIdx, PlayerState } from './types'

export interface RedactedSelf extends Omit<PlayerState, 'deck'> {
  deckCount: number
}

export interface RedactedOpponent
  extends Omit<PlayerState, 'deck' | 'hand'> {
  deckCount: number
  handCount: number
  handIids: number[]
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
      armor: me.armor,
      fatigue: me.fatigue,
      mana: { ...me.mana },
      hand: cloneInsts(me.hand),
      board: cloneInsts(me.board),
      graveyard: me.graveyard.slice(),
      mulliganDone: me.mulliganDone,
      deckCount: me.deck.length,
    },
    opponent: {
      heroId: opp.heroId,
      heroHp: opp.heroHp,
      armor: opp.armor,
      fatigue: opp.fatigue,
      mana: { ...opp.mana },
      board: cloneInsts(opp.board),
      graveyard: opp.graveyard.slice(),
      mulliganDone: opp.mulliganDone,
      deckCount: opp.deck.length,
      handCount: opp.hand.length,
      handIids: opp.hand.map((c) => c.iid),
    },
  }
}

// 对手抽牌不暴露牌面(defId 置空)。其余事件均为公开信息。
export function redactEvent(event: GameEvent, viewer: PlayerIdx): GameEvent {
  if (event.type === 'CardDrawn' && event.player !== viewer) {
    return { ...event, defId: '' }
  }
  return event
}
