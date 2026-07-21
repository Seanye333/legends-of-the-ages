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

// 武将牌/锦囊牌/装备牌(装备:打给一名友方武将,加成攻血并授予关键词)
export type CardType = 'general' | 'stratagem' | 'equipment'
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
// 冲锋/突袭/守护/连击/单挑/吸血/剧毒(第二卡包)/铁壁(圣盾)/潜行(第三卡包)
export type Keyword =
  | 'charge'
  | 'rush'
  | 'guard'
  | 'windfury'
  | 'duel'
  | 'lifesteal'
  | 'poison'
  // ---- 第三卡包「附魔与谋略」 ----
  | 'divineShield' // 铁壁:抵消下一次伤害
  | 'stealth' // 潜行:不能被敌方选为目标,自身攻击后解除
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
  // ---- 第三卡包 ----
  | 'allFriendlyGenerals'
  | 'allFriendlyOthers' // 除自己外的友方武将(号令类战吼)
  | 'randomFriendlyGeneral'
  | 'allGenerals'
  | 'chosenFriendly' // 指定友方角色(含主公)
  | 'chosenFriendlyGeneral' // 指定友方武将

export interface EffectCondition {
  ifDynastyCount?: { dynasty: DynastyTag; atLeast: number }
  // ---- 第三卡包 ----
  ifBoardCount?: { side: 'friendly' | 'enemy'; atLeast: number }
  ifHeroHpBelow?: number // 我方主公血量低于此值
  ifHandCount?: { atLeast: number }
}

export type EffectOp =
  | { op: 'damage'; amount: number; target: EffectTarget }
  | { op: 'heal'; amount: number; target: EffectTarget }
  | { op: 'draw'; count: number }
  // duration: 'endOfTurn' → 本回合结束时失效(通过附魔层撤销)
  | {
      op: 'buffStats'
      attack: number
      health: number
      target: EffectTarget
      duration?: 'endOfTurn'
    }
  | { op: 'summon'; defId: string; count: number }
  | { op: 'aoeDamage'; amount: number }
  | { op: 'destroy'; target: EffectTarget }
  | { op: 'grantKeyword'; keyword: Keyword; target: EffectTarget; duration?: 'endOfTurn' }
  // ---- 第二卡包 ----
  | { op: 'gainArmor'; amount: number } // 我方主公获得护甲
  | { op: 'returnToHand'; target: EffectTarget } // 武将弹回持有者手牌(重置至卡面原值;手满则烧毁)
  | { op: 'discardRandom'; count: number } // 对手随机弃牌
  // ---- 第三卡包 ----
  | { op: 'silence'; target: EffectTarget } // 沉默:清空附魔与关键词,封印亡语
  | { op: 'freeze'; target: EffectTarget } // 冻结:跳过下一次行动
  | { op: 'gainMana'; amount: number; temporary: boolean } // 增益法力(temporary 只补本回合)
  | { op: 'damageAll'; amount: number } // 双方全场武将
  | { op: 'summonForEnemy'; defId: string; count: number } // 为对手召唤(负面锦囊/亡语用)

export interface EffectScript {
  ops: EffectOp[]
  condition?: EffectCondition
}

// ---------- 第四卡包:伏兵 / 连击 / 过载 ----------

// 伏兵的触发时机。刻意只做三个,而且都发生在**对手的回合**里 ——
// 伏兵的乐趣在于对手不知道自己踩了什么,自己回合会触发的「伏兵」只是延迟战吼。
export type SecretTrigger =
  | 'enemyAttack' // 敌方武将发起攻击时(伤害结算**之前**)
  | 'enemySummon' // 敌方武将入场后(战吼已结算)
  | 'enemyStratagem' // 敌方锦囊结算后

export interface SecretDef {
  trigger: SecretTrigger
  // 触发者(攻击者 / 入场的敌将)会作为 chosen 传进脚本,
  // 所以伏兵脚本里用 chosenEnemyGeneral / chosenAny 就能指到它。
  script: EffectScript
}

// ---------- 卡牌定义 ----------

// 光环:只要来源在场,持续作用于范围内武将。实现为「来源标记的附魔」,
// 每次场面变动重算(refreshAuras),来源离场即自动撤销。
export interface AuraDef {
  scope: 'friendlyOthers' | 'friendlyAll'
  attack: number
  health: number
  keywords?: Keyword[]
}

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
  // 武将:攻/血;装备:攻血加成值(keywords 为授予的关键词)
  attack?: number
  health?: number
  keywords: Keyword[]
  battlecry?: EffectScript
  deathrattle?: EffectScript
  spell?: EffectScript
  text?: LocalizedText
  token?: boolean // 衍生物:只能被召唤,不进卡包、不可构筑
  // ---- 第三卡包:触发器与光环 ----
  aura?: AuraDef
  endOfTurn?: EffectScript // 我方回合结束时
  startOfTurn?: EffectScript // 我方回合开始时
  onDamaged?: EffectScript // 自身受伤后(有递归深度上限)
  spellDamage?: number // 法术伤害加成(在场时为友方锦囊加伤)
  // ---- 第四卡包 ----
  secret?: SecretDef // 伏兵:打出后进伏兵区,对手触发才翻开(仅锦囊)
  combo?: EffectScript // 连击:本回合此牌之前已打出过牌时,**改用**这个脚本
  overload?: number // 过载:下回合锁定的水晶数
}

// 主公技:每回合一次的主动技能,六主义各一。
export interface HeroPowerDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  cost: number
  script: EffectScript
}

export interface HeroDef {
  id: string
  name: LocalizedText
  doctrine: Doctrine
  hp: number
  power: HeroPowerDef
}

export type CardLibrary = Readonly<Record<string, CardDef>>

// ---------- 对局状态 ----------

// 附魔:一切对卡面数值的修改都记在这里,而不是直接改 attack/health。
// 这样沉默(清空附魔)、临时增益(到期撤销)、光环(来源离场撤销)才有统一的撤销路径。
export interface Enchant {
  attack: number
  health: number
  keywords?: Keyword[]
  duration?: 'endOfTurn'
  auraFrom?: number // 光环来源 iid;由 refreshAuras 全权管理
}

// attack / health / maxHealth / keywords 是**派生字段**:
// 由 refreshInstance() 从卡面基础值 ⊕ enchants ⊖ silenced 算出。
// 保留在实例上是为了 UI / AI / 服务器读取时零成本,写入一律走附魔层。
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
  damage: number // 已承受伤害;health = maxHealth - damage
  silenced: boolean
  frozen: boolean
  shieldUsed: boolean // 铁壁已消耗(防止 refresh 从卡面把圣盾加回来)
  stealthBroken: boolean // 潜行已解除(同上,压制卡面自带的潜行)
}

export interface PlayerState {
  heroId: string
  heroHp: number
  heroMaxHp: number
  armor: number
  fatigue: number
  mana: { current: number; max: number }
  deck: CardInstance[]
  hand: CardInstance[]
  board: CardInstance[]
  graveyard: string[]
  mulliganDone: boolean
  heroPowerUsed: boolean
  // ---- 第四卡包 ----
  // 伏兵区。对对手裁剪时只留 iid(见 redact.ts),否则伏兵形同明牌。
  secrets: { iid: number; defId: string }[]
  overloadNext: number // 下回合开始时要锁掉的水晶
  overloadLocked: number // 本回合已被锁掉的水晶(纯展示用,回合开始时结算)
  cardsPlayedThisTurn: number // 连击判定:本回合已打出的牌数
  // 主公技随状态走(而不是查 HeroDef 表),这样引擎依旧零外部依赖、状态自足可序列化。
  heroPower?: HeroPowerDef
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
  | { type: 'UseHeroPower'; target?: TargetRef }
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
  | { type: 'HeroHealed'; player: PlayerIdx; amount: number; hpAfter: number }
  | { type: 'CardPlayed'; player: PlayerIdx; iid: number; defId: string; cost: number }
  | {
      type: 'GeneralSummoned'
      player: PlayerIdx
      iid: number
      defId: string
      position: number
      attack: number
      health: number
    }
  | {
      type: 'EffectTriggered'
      player: PlayerIdx
      sourceIid?: number
      sourceDefId: string
      kind:
        | 'battlecry'
        | 'deathrattle'
        | 'spell'
        | 'endOfTurn'
        | 'startOfTurn'
        | 'onDamaged'
        | 'heroPower'
        | 'combo'
    }
  | { type: 'GeneralDamaged'; player: PlayerIdx; iid: number; amount: number; healthAfter: number }
  | { type: 'GeneralHealed'; player: PlayerIdx; iid: number; amount: number; healthAfter: number }
  | {
      type: 'GeneralBuffed'
      player: PlayerIdx
      iid: number
      attack: number
      health: number
    }
  | { type: 'KeywordGranted'; player: PlayerIdx; iid: number; keyword: Keyword }
  | { type: 'GeneralDied'; player: PlayerIdx; iid: number; defId: string }
  | {
      type: 'AttackResolved'
      attacker: PlayerIdx
      attackerIid: number
      target: TargetRef
      damageToTarget: number
      damageToAttacker: number
    }
  | {
      type: 'DuelFought'
      challenger: PlayerIdx
      challengerIid: number
      defenderIid: number
      firstStrikeIid?: number
      challengerDied: boolean
      defenderDied: boolean
    }
  // ---- 第二卡包 ----
  | { type: 'EquipmentAttached'; player: PlayerIdx; targetIid: number; defId: string }
  | { type: 'ArmorGained'; player: PlayerIdx; amount: number; armorAfter: number }
  | { type: 'GeneralReturned'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'CardDiscarded'; player: PlayerIdx; iid: number; defId: string }
  // ---- 第三卡包 ----
  | { type: 'DivineShieldPopped'; player: PlayerIdx; iid: number }
  | { type: 'GeneralSilenced'; player: PlayerIdx; iid: number }
  | { type: 'GeneralFrozen'; player: PlayerIdx; iid: number }
  | { type: 'GeneralUnfrozen'; player: PlayerIdx; iid: number }
  | { type: 'StealthBroken'; player: PlayerIdx; iid: number }
  | { type: 'ManaGained'; player: PlayerIdx; amount: number; temporary: boolean }
  // ---- 第四卡包 ----
  // defId 对**对手**要抹掉(redactEvent),否则伏兵一打出就暴露。
  | { type: 'SecretPlayed'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'SecretRevealed'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'ComboTriggered'; player: PlayerIdx; iid: number; defId: string }
  | { type: 'ManaOverloaded'; player: PlayerIdx; amount: number } // 打出时记账
  | { type: 'ManaLocked'; player: PlayerIdx; amount: number } // 下回合开始时真的扣
  | {
      type: 'HeroPowerUsed'
      player: PlayerIdx
      heroId: string
      powerId: string
      cost: number
    }
  | { type: 'GameEnded'; winner: Winner }

// ---------- 对局配置与 API 结果 ----------

export interface GameConfig {
  seed: number
  heroIds: [string, string]
  deckIds: [string[], string[]]
  first: PlayerIdx
  // 可选:不给则无主公技、血量按 START_HP(旧测试与教学局走这条路)
  heroPowers?: [HeroPowerDef | undefined, HeroPowerDef | undefined]
  heroHps?: [number, number]
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
export const SECRET_LIMIT = 5 // 伏兵区上限
export const OPENING_HAND = [3, 4] as const
