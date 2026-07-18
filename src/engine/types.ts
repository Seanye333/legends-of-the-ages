// 引擎类型契约。整个游戏(UI、AI、内容生成、未来的服务器)都建立在这些类型上。
// 引擎保持纯粹:可序列化状态、确定性演算、无外部依赖。

export type PlayerIdx = 0 | 1

// 六大主义 = 构筑职业(王道/霸道/礼教/名利/割据/隐逸)
export type Doctrine =
  | 'royal'
  | 'hegemonic'
  | 'ritual'
  | 'fame'
  | 'separatist'
  | 'reclusion'

// 朝代 = 羁绊标签。三国细分魏蜀吴群,其余按朝代。
export type DynastyTag =
  | 'wei'
  | 'shu'
  | 'wu'
  | 'qun'
  | 'spring-autumn'
  | 'warring-states'
  | 'qin'
  | 'chu-han'
  | 'western-han'
  | 'jin'
  | 'southern-northern'
  | 'sui'
  | 'tang'
  | 'five-dynasties'
  | 'song'
  | 'yuan'
  | 'ming'
  | 'qing'

export type CardType = 'general' | 'stratagem'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
// 冲锋/突袭/守护/连击/单挑
export type Keyword = 'charge' | 'rush' | 'guard' | 'windfury' | 'duel'
export type Archetype = 'warrior' | 'strategist'

export interface LocalizedText {
  zh: string
  en: string
}

// ---------- 效果 DSL(数据而非闭包,可序列化、可传服务器) ----------

export type EffectTarget =
  | 'chosenEnemyGeneral'
  | 'chosenAny'
  | 'allEnemyGenerals'
  | 'randomEnemyGeneral'
  | 'self'
  | 'friendlyDynastyGenerals'
  | 'enemyHero'
  | 'friendlyHero'

export interface EffectCondition {
  ifDynastyCount?: { dynasty: DynastyTag; atLeast: number }
}

export type EffectOp =
  | { op: 'damage'; amount: number; target: EffectTarget }
  | { op: 'heal'; amount: number; target: EffectTarget }
  | { op: 'draw'; count: number }
  | { op: 'buffStats'; attack: number; health: number; target: EffectTarget }
  | { op: 'summon'; defId: string; count: number }
  | { op: 'aoeDamage'; amount: number }
  | { op: 'destroy'; target: EffectTarget }
  | { op: 'grantKeyword'; keyword: Keyword; target: EffectTarget }

export interface EffectScript {
  ops: EffectOp[]
  condition?: EffectCondition
}

// ---------- 卡牌定义 ----------

export interface CardDef {
  id: string
  collectorNo: number
  name: LocalizedText
  type: CardType
  doctrine: Doctrine | 'neutral'
  dynasty: DynastyTag
  rarity: Rarity
  archetype: Archetype
  cost: number
  attack?: number
  health?: number
  keywords: Keyword[]
  battlecry?: EffectScript
  deathrattle?: EffectScript
  spell?: EffectScript
  text?: LocalizedText
}

export interface HeroDef {
  id: string
  name: LocalizedText
  doctrine: Doctrine
  hp: number
}

export type CardLibrary = Readonly<Record<string, CardDef>>

// ---------- 对局状态 ----------

export interface Enchant {
  attack: number
  health: number
}

export interface CardInstance {
  iid: number
  defId: string
  attack: number
  health: number
  maxHealth: number
  keywords: Keyword[]
  exhausted: boolean
  attacksUsed: number
  enchants: Enchant[]
}

export interface PlayerState {
  heroId: string
  heroHp: number
  armor: number
  fatigue: number
  mana: { current: number; max: number }
  deck: CardInstance[]
  hand: CardInstance[]
  board: CardInstance[]
  graveyard: string[]
  mulliganDone: boolean
}

export type GamePhase = 'mulligan' | 'main' | 'ended'
export type Winner = PlayerIdx | 'draw'

export interface GameState {
  seed: number
  rng: number
  turn: number
  activePlayer: PlayerIdx
  phase: GamePhase
  winner?: Winner
  players: [PlayerState, PlayerState]
  nextIid: number
}

// ---------- 命令(玩家意图) ----------

export type TargetRef =
  | { kind: 'hero'; player: PlayerIdx }
  | { kind: 'general'; iid: number }

export type Command =
  | { type: 'Mulligan'; keepIids: number[] }
  | { type: 'PlayCard'; iid: number; boardPos?: number; target?: TargetRef }
  | { type: 'Attack'; attackerIid: number; target: TargetRef }
  | { type: 'EndTurn' }
  | { type: 'Concede' }

// ---------- 事件(UI 动画与观战/回放的唯一来源) ----------

export type GameEvent =
  | { type: 'MulliganDone'; player: PlayerIdx; replacedCount: number }
  | { type: 'TurnStarted'; player: PlayerIdx; turn: number; mana: number }
  | { type: 'TurnEnded'; player: PlayerIdx; turn: number }
  | { type: 'CardDrawn'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'CardBurned'; player: PlayerIdx; defId: string }
  | { type: 'FatigueDamage'; player: PlayerIdx; amount: number }
  | { type: 'HeroDamaged'; player: PlayerIdx; amount: number; hpAfter: number }
  | { type: 'GameEnded'; winner: Winner }

// ---------- 对局配置与 API 结果 ----------

export interface GameConfig {
  seed: number
  heroIds: [string, string]
  deckIds: [string[], string[]]
  first: PlayerIdx
}

export type ApplyResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; error: string }

// ---------- 规则常量 ----------

export const START_HP = 30
export const HAND_LIMIT = 10
export const BOARD_LIMIT = 6
export const MANA_CAP = 10
export const TURN_LIMIT = 200
export const DECK_SIZE = 30
export const OPENING_HAND = [3, 4] as const
