import type {
  CardInstance,
  CardLibrary,
  GameConfig,
  GameState,
  PlayerIdx,
  PlayerState,
} from './types'
import { DECK_SIZE, OPENING_HAND, START_HP } from './types'
import { rngShuffle, seedRng } from './rng'
import { refreshInstance } from './resolve'

// 卡牌实例工厂。派生字段一律由 refreshInstance 算,调用方不要手写 attack/health。
export function createInstance(defId: string, iid: number, lib: CardLibrary): CardInstance {
  const inst: CardInstance = {
    iid,
    defId,
    attack: 0,
    health: 0,
    maxHealth: 0,
    keywords: [],
    exhausted: false,
    attacksUsed: 0,
    enchants: [],
    damage: 0,
    silenced: false,
    frozen: false,
    shieldUsed: false,
    stealthBroken: false,
    costDelta: 0,
  }
  refreshInstance(inst, lib)
  return inst
}

export function createGame(cfg: GameConfig, lib: CardLibrary): GameState {
  for (const side of [0, 1] as const) {
    const deck = cfg.deckIds[side]
    if (deck.length !== DECK_SIZE) {
      throw new Error(`deck ${side} must have ${DECK_SIZE} cards, got ${deck.length}`)
    }
    for (const id of deck) {
      if (!lib[id]) throw new Error(`unknown card id in deck ${side}: ${id}`)
    }
  }

  let rng = seedRng(cfg.seed)
  let nextIid = 1

  const players = ([0, 1] as const).map((side: PlayerIdx): PlayerState => {
    const instances = cfg.deckIds[side].map((defId) => createInstance(defId, nextIid++, lib))
    const shuffledDeck = rngShuffle(rng, instances)
    rng = shuffledDeck.next
    const deck = shuffledDeck.result
    // 手牌数按先后手定(先手 3 后手 4),不是按座位号
    const handSize = side === cfg.first ? OPENING_HAND[0] : OPENING_HAND[1]
    // 数组末尾为牌库顶
    const hand = deck.splice(deck.length - handSize, handSize)
    const maxHp = cfg.heroHps?.[side] ?? START_HP
    return {
      heroId: cfg.heroIds[side],
      heroHp: maxHp,
      heroMaxHp: maxHp,
      armor: 0,
      fatigue: 0,
      mana: { current: 0, max: 0 },
      deck,
      hand,
      board: [],
      graveyard: [],
      mulliganDone: false,
      heroPowerUsed: false,
      heroPower: cfg.heroPowers?.[side],
      secrets: [],
      overloadNext: 0,
      overloadLocked: 0,
      cardsPlayedThisTurn: 0,
    }
  }) as [PlayerState, PlayerState]

  return {
    seed: cfg.seed,
    rng,
    turn: 0,
    activePlayer: cfg.first,
    phase: 'mulligan',
    players,
    nextIid,
  }
}
