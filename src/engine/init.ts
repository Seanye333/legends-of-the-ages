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

function makeInstance(defId: string, iid: number, lib: CardLibrary): CardInstance {
  const def = lib[defId]
  return {
    iid,
    defId,
    attack: def.attack ?? 0,
    health: def.health ?? 0,
    maxHealth: def.health ?? 0,
    keywords: def.keywords.slice(),
    exhausted: false,
    attacksUsed: 0,
    enchants: [],
  }
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
    const instances = cfg.deckIds[side].map((defId) => makeInstance(defId, nextIid++, lib))
    const shuffledDeck = rngShuffle(rng, instances)
    rng = shuffledDeck.next
    const deck = shuffledDeck.result
    // 数组末尾为牌库顶
    const hand = deck.splice(deck.length - OPENING_HAND[side], OPENING_HAND[side])
    return {
      heroId: cfg.heroIds[side],
      heroHp: START_HP,
      armor: 0,
      fatigue: 0,
      mana: { current: 0, max: 0 },
      deck,
      hand,
      board: [],
      graveyard: [],
      mulliganDone: false,
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
