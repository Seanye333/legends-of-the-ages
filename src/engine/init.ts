import type {
  BattleObjective,
  CardInstance,
  CardLibrary,
  GameConfig,
  GameState,
  PlayerIdx,
  PlayerState,
  PuzzleScenario,
} from './types'
import { BOARD_LIMIT, DECK_SIZE, HAND_LIMIT, OPENING_HAND, SECRET_LIMIT, START_HP } from './types'
import { rngShuffle, seedRng } from './rng'
import { refreshInstance } from './resolve'

// 斩将/护送目标:开局在指定座位场上找到那张具名 token,把它的 iid 钉进目标。
// 内容层只给「哪一侧的哪张牌」,iid 在这里(棋盘刚铺好、iid 已分配)才拿得到。
// 找不到 → targetIid 留空 → 该目标永不触发(内容闸门会断言它一定找得到)。
function resolveObjective(
  objective: BattleObjective | undefined,
  players: [PlayerState, PlayerState],
): BattleObjective | undefined {
  if (!objective) return undefined
  if (objective.kind === 'assassinate' || objective.kind === 'protect') {
    if (objective.targetIid != null) return objective
    const unit = players[objective.targetSide].board.find((u) => u.defId === objective.targetDefId)
    return { ...objective, targetIid: unit?.iid }
  }
  return objective
}

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
  // 斩杀谜题:直接铺开指定残局,不走发牌/洗牌那条路。
  if (cfg.scenario) return createScenarioGame(cfg, cfg.scenario, lib)

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
    const mod = cfg.modifiers?.[side]
    // 远征宝物:起手多抽
    if (mod?.bonusHandSize) {
      const extra = deck.splice(deck.length - mod.bonusHandSize, mod.bonusHandSize)
      hand.push(...extra)
    }
    // 起手全部手牌减费
    if (mod?.handCostDelta) {
      for (const c of hand) c.costDelta += mod.handCostDelta
    }
    // 开局场上衍生物
    const board: CardInstance[] = []
    for (const tokenId of mod?.startTokens ?? []) {
      if (board.length >= BOARD_LIMIT) break
      board.push(createInstance(tokenId, nextIid++, lib))
    }
    return {
      heroId: cfg.heroIds[side],
      heroHp: maxHp,
      heroMaxHp: maxHp,
      armor: mod?.startArmor ?? 0,
      fatigue: 0,
      mana: { current: 0, max: 0 },
      deck,
      hand,
      board,
      graveyard: [],
      mulliganDone: false,
      heroPowerUsed: false,
      heroPowerCostDelta: mod?.heroPowerCostDelta ?? 0,
      heroPower: cfg.heroPowers?.[side],
      // 副将可以来自开局配置(双将模式)或远征宝物 —— 宝物优先,它是这一局临时拿到的
      vicePower: mod?.vicePower ?? cfg.vicePowers?.[side],
      secrets: [],
      overloadNext: 0,
      overloadLocked: 0,
      cardsPlayedThisTurn: 0,
      morale: mod?.startMorale ?? 0,
      supply: mod?.startSupply ?? 0,
      chain: 0,
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
    objective: resolveObjective(cfg.objective, players),
    field: cfg.field,
  }
}

// 从残局规格直接构造一个可对局的 GameState(斩杀谜题)。
// 与 createGame 主路径共用 createInstance / refreshInstance,派生字段仍由附魔层导出。
// 产出的状态 phase='main'、双方 mulliganDone=true —— 谜题从「你的回合」开始。
function createScenarioGame(
  cfg: GameConfig,
  sc: PuzzleScenario,
  lib: CardLibrary,
): GameState {
  // 先校验所有引用的 defId 真实存在(与主路径同风格,给出清晰报错而不是构造出坏实例)
  for (const side of [0, 1] as const) {
    const spec = sc.players[side]
    for (const id of [...spec.board.map((u) => u.defId), ...spec.hand, ...(spec.deck ?? [])]) {
      if (!lib[id]) throw new Error(`unknown card id in scenario side ${side}: ${id}`)
    }
    if (spec.board.length > BOARD_LIMIT) {
      throw new Error(`scenario side ${side} board exceeds ${BOARD_LIMIT}: ${spec.board.length}`)
    }
    if (spec.hand.length > HAND_LIMIT) {
      throw new Error(`scenario side ${side} hand exceeds ${HAND_LIMIT}: ${spec.hand.length}`)
    }
    if ((spec.secrets?.length ?? 0) > SECRET_LIMIT) {
      throw new Error(`scenario side ${side} secrets exceeds ${SECRET_LIMIT}`)
    }
  }

  let nextIid = 1

  const buildSide = (side: PlayerIdx): PlayerState => {
    const spec = sc.players[side]

    const board = spec.board.map((u): CardInstance => {
      const inst = createInstance(u.defId, nextIid++, lib)
      if (u.enchants) inst.enchants = u.enchants.map((e) => ({ ...e }))
      inst.exhausted = u.exhausted ?? false
      inst.attacksUsed = u.attacksUsed ?? 0
      inst.frozen = u.frozen ?? false
      inst.silenced = u.silenced ?? false
      inst.damage = Math.max(0, u.damage ?? 0)
      refreshInstance(inst, lib)
      // 不允许「出生即死」:预置伤害 ≥ 上限则夹到留 1 血(作者笔误的兜底)
      if (inst.damage >= inst.maxHealth) {
        inst.damage = inst.maxHealth - 1
        refreshInstance(inst, lib)
      }
      return inst
    })

    const hand = spec.hand.map((defId) => createInstance(defId, nextIid++, lib))
    const deck = (spec.deck ?? []).map((defId) => createInstance(defId, nextIid++, lib))
    const secrets = (spec.secrets ?? []).map((defId) => ({ iid: nextIid++, defId }))
    const maxHp = spec.heroMaxHp ?? Math.max(spec.heroHp, START_HP)

    return {
      heroId: cfg.heroIds[side],
      heroHp: spec.heroHp,
      heroMaxHp: maxHp,
      armor: spec.armor ?? 0,
      fatigue: 0,
      mana: { current: spec.mana, max: spec.mana },
      deck,
      hand,
      board,
      graveyard: [],
      mulliganDone: true,
      heroPowerUsed: spec.heroPowerUsed ?? false,
      heroPowerCostDelta: spec.heroPowerCostDelta ?? 0,
      heroPower: cfg.heroPowers?.[side],
      vicePower: cfg.vicePowers?.[side],
      secrets,
      overloadNext: 0,
      overloadLocked: 0,
      cardsPlayedThisTurn: 0,
      // 谜题是「这一回合之内解决战斗」,不该有任何隐藏的历史包袱:
      // 士气 0、粮道 0、链 0。题面上写着的才算数。
      morale: 0,
      supply: spec.supply ?? 0,
      chain: 0,
    }
  }

  const players: [PlayerState, PlayerState] = [buildSide(0), buildSide(1)]

  return {
    seed: cfg.seed,
    // 挖矿类残局带着原局的 rng(随机效果的解法才可复现);手搓题走 seed 起点
    rng: sc.rng ?? seedRng(cfg.seed),
    turn: 1,
    activePlayer: sc.activePlayer,
    phase: 'main',
    players,
    nextIid,
    objective: resolveObjective(cfg.objective, players),
    field: cfg.field,
  }
}
