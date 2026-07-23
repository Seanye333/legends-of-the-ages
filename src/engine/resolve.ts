// 结算内核:伤害/治疗/抽牌/死亡处理 + 效果 DSL 解释器。
// 所有数值变化都从这里走,保证事件流与状态变化一一对应。
//
// 【附魔层】attack / health / maxHealth / keywords 是派生字段。
// 任何对数值的修改都必须记成一条 Enchant 再 refreshInstance(),而不是直接赋值。
// 这是沉默、临时增益、光环三件事共用的撤销路径 —— 直接改数值就没法还原了。
import type {
  CardDef,
  CardInstance,
  CostFilter,
  CountSource,
  CardLibrary,
  DiscoverPool,
  Doctrine,
  EffectScript,
  Enchant,
  GameEvent,
  GameState,
  Keyword,
  PlayerIdx,
  TargetRef,
} from './types'
import { BOARD_LIMIT, HAND_LIMIT, MANA_CAP, START_HP } from './types'
import { rngInt } from './rng'

export function other(p: PlayerIdx): PlayerIdx {
  return p === 0 ? 1 : 0
}

export interface GeneralLoc {
  player: PlayerIdx
  index: number
  inst: CardInstance
}

export function findGeneral(state: GameState, iid: number): GeneralLoc | undefined {
  for (const player of [0, 1] as const) {
    const index = state.players[player].board.findIndex((c) => c.iid === iid)
    if (index >= 0) return { player, index, inst: state.players[player].board[index] }
  }
  return undefined
}

// ---------- 附魔层 ----------

// 从卡面基础值 ⊕ 附魔 ⊖ 沉默 重算派生字段。任何改动附魔/伤害后都必须调用。
export function refreshInstance(inst: CardInstance, lib: CardLibrary): void {
  const def = lib[inst.defId]
  let attack = def?.attack ?? 0
  let maxHealth = def?.health ?? 0
  // 沉默清空卡面关键词,但不改卡面攻血(炉石规则)
  const keywords: Keyword[] = inst.silenced ? [] : (def?.keywords.slice() ?? [])
  for (const e of inst.enchants) {
    attack += e.attack
    maxHealth += e.health
    if (e.keywords) {
      for (const kw of e.keywords) if (!keywords.includes(kw)) keywords.push(kw)
    }
  }
  // 铁壁/潜行一旦消耗就不能被 refresh 从卡面加回来
  const shieldIdx = keywords.indexOf('divineShield')
  if (inst.shieldUsed && shieldIdx >= 0) keywords.splice(shieldIdx, 1)
  const stealthIdx = keywords.indexOf('stealth')
  if (inst.stealthBroken && stealthIdx >= 0) keywords.splice(stealthIdx, 1)

  inst.maxHealth = Math.max(1, maxHealth)
  inst.damage = Math.max(0, inst.damage)
  inst.health = inst.maxHealth - inst.damage
  inst.keywords = keywords
  // 激怒(Enrage):受伤时额外攻击,痊愈自动收回。派生在此,不记附魔 —— 所以
  // 每次 refreshInstance(受伤/治疗都会调)都会重算,状态永远跟 damage 一致。
  // 沉默会连同卡面机制一起抹掉激怒(与亡语/光环一致)。放在攻击定型的最后一步。
  const enrage = inst.silenced ? 0 : (def?.enrage ?? 0)
  inst.attack = Math.max(0, attack + (enrage > 0 && inst.damage > 0 ? enrage : 0))
}

// 挂一条附魔并广播增益事件。授予铁壁时重置消耗标记(相当于补一层新盾)。
export function addEnchant(
  inst: CardInstance,
  lib: CardLibrary,
  ench: Enchant,
  events: GameEvent[] | null,
  player: PlayerIdx,
): void {
  if (ench.keywords?.includes('divineShield')) inst.shieldUsed = false
  inst.enchants.push(ench)
  refreshInstance(inst, lib)
  if (events && (ench.attack !== 0 || ench.health !== 0)) {
    events.push({
      type: 'GeneralBuffed',
      player,
      iid: inst.iid,
      attack: ench.attack,
      health: ench.health,
    })
  }
  if (events && ench.keywords) {
    for (const kw of ench.keywords) {
      events.push({ type: 'KeywordGranted', player, iid: inst.iid, keyword: kw })
    }
  }
}

// 摘掉满足条件的附魔。clampAlive=true 时保证不会因为撤销增益而把单位打死
// (「本回合内 +X/+X」到期不应该杀人;光环消失可以杀人,那是炉石规则)。
function removeEnchants(
  inst: CardInstance,
  lib: CardLibrary,
  pred: (e: Enchant) => boolean,
  events: GameEvent[] | null,
  player: PlayerIdx,
  clampAlive: boolean,
): void {
  const removed = inst.enchants.filter(pred)
  if (removed.length === 0) return
  inst.enchants = inst.enchants.filter((e) => !pred(e))
  refreshInstance(inst, lib)
  if (clampAlive && inst.health <= 0) {
    inst.damage = Math.max(0, inst.maxHealth - 1)
    refreshInstance(inst, lib)
  }
  if (events) {
    const atk = removed.reduce((n, e) => n + e.attack, 0)
    const hp = removed.reduce((n, e) => n + e.health, 0)
    if (atk !== 0 || hp !== 0) {
      events.push({ type: 'GeneralBuffed', player, iid: inst.iid, attack: -atk, health: -hp })
    }
  }
}

// 光环重算:先撤掉所有光环附魔,再从当前在场的光环来源重新发一遍。
// 来源死亡/回手/被沉默都自动失效,不需要任何反向登记。
export function refreshAuras(state: GameState, lib: CardLibrary): void {
  for (const player of [0, 1] as const) {
    for (const inst of state.players[player].board) {
      if (inst.enchants.some((e) => e.auraFrom !== undefined)) {
        inst.enchants = inst.enchants.filter((e) => e.auraFrom === undefined)
        refreshInstance(inst, lib)
      }
    }
  }
  for (const player of [0, 1] as const) {
    for (const source of state.players[player].board) {
      if (source.silenced) continue
      const aura = lib[source.defId]?.aura
      if (!aura) continue
      for (const inst of state.players[player].board) {
        if (aura.scope === 'friendlyOthers' && inst.iid === source.iid) continue
        inst.enchants.push({
          attack: aura.attack,
          health: aura.health,
          keywords: aura.keywords,
          auraFrom: source.iid,
        })
        refreshInstance(inst, lib)
      }
    }
  }
}

export function silenceGeneral(
  loc: GeneralLoc,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  const inst = loc.inst
  if (inst.silenced) return
  inst.silenced = true
  // 光环附魔留给 refreshAuras 处理(来源可能还在),其余一律清空
  inst.enchants = inst.enchants.filter((e) => e.auraFrom !== undefined)
  inst.frozen = false
  refreshInstance(inst, lib)
  // 沉默不会把单位打死:溢出的伤害按当前上限截断
  if (inst.health <= 0) {
    inst.damage = Math.max(0, inst.maxHealth - 1)
    refreshInstance(inst, lib)
  }
  events.push({ type: 'GeneralSilenced', player: loc.player, iid: inst.iid })
}

export function freezeGeneral(loc: GeneralLoc, events: GameEvent[]): void {
  if (loc.inst.frozen) return
  loc.inst.frozen = true
  events.push({ type: 'GeneralFrozen', player: loc.player, iid: loc.inst.iid })
}

// 潜行在自身发起攻击后解除
export function breakStealth(loc: GeneralLoc, lib: CardLibrary, events: GameEvent[]): void {
  const inst = loc.inst
  if (!inst.keywords.includes('stealth')) return
  removeEnchants(
    inst,
    lib,
    (e) => (e.keywords?.includes('stealth') ?? false) && e.auraFrom === undefined,
    null,
    loc.player,
    false,
  )
  // 卡面自带潜行:用一条「反向附魔」压制不现实,直接标记沉默级别的移除
  if (inst.keywords.includes('stealth')) {
    inst.stealthBroken = true
    refreshInstance(inst, lib)
  }
  events.push({ type: 'StealthBroken', player: loc.player, iid: inst.iid })
}

// 回合结束:撤销所有「本回合内」附魔
export function expireTemporaryEnchants(
  state: GameState,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  for (const player of [0, 1] as const) {
    for (const inst of state.players[player].board) {
      removeEnchants(inst, lib, (e) => e.duration === 'endOfTurn', events, player, true)
    }
  }
}

// ---------- 抽牌 / 伤害 / 治疗 ----------

export function drawCards(
  state: GameState,
  player: PlayerIdx,
  count: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  for (let i = 0; i < count; i++) {
    const card = p.deck.pop()
    if (!card) {
      // 疲劳:每次空抽伤害递增
      p.fatigue += 1
      events.push({ type: 'FatigueDamage', player, amount: p.fatigue })
      damageHero(state, player, p.fatigue, events)
      continue
    }
    if (p.hand.length >= HAND_LIMIT) {
      p.graveyard.push(card.defId)
      events.push({ type: 'CardBurned', player, defId: card.defId })
      continue
    }
    p.hand.push(card)
    events.push({ type: 'CardDrawn', player, iid: card.iid, defId: card.defId })
  }
}

export function damageHero(
  state: GameState,
  player: PlayerIdx,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  const p = state.players[player]
  const absorbed = Math.min(p.armor, amount)
  p.armor -= absorbed
  const dealt = amount - absorbed
  p.heroHp -= dealt
  events.push({ type: 'HeroDamaged', player, amount: dealt, hpAfter: p.heroHp })
}

export function healHero(
  state: GameState,
  player: PlayerIdx,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  const p = state.players[player]
  // 上限读主公自己的血量,而不是写死 30 —— 高血主公/冒险模式 Boss 才不会治不满
  const healed = Math.min(amount, (p.heroMaxHp || START_HP) - p.heroHp)
  if (healed <= 0) return
  p.heroHp += healed
  events.push({ type: 'HeroHealed', player, amount: healed, hpAfter: p.heroHp })
}

const MAX_TRIGGER_DEPTH = 3

export function damageGeneral(
  state: GameState,
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
  lib: CardLibrary,
  depth = 0,
): void {
  if (amount <= 0) return
  const inst = loc.inst
  // 铁壁:抵消整次伤害,不论多少
  if (inst.keywords.includes('divineShield')) {
    inst.shieldUsed = true
    removeEnchants(
      inst,
      lib,
      (e) => (e.keywords?.includes('divineShield') ?? false) && e.auraFrom === undefined,
      null,
      loc.player,
      false,
    )
    refreshInstance(inst, lib)
    events.push({ type: 'DivineShieldPopped', player: loc.player, iid: inst.iid })
    return
  }
  inst.damage += amount
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralDamaged',
    player: loc.player,
    iid: inst.iid,
    amount,
    healthAfter: inst.health,
  })
  // 受伤触发器(自身仍存活才触发,带递归深度上限)
  const def = lib[inst.defId]
  if (def?.onDamaged && inst.health > 0 && !inst.silenced && depth < MAX_TRIGGER_DEPTH) {
    events.push({
      type: 'EffectTriggered',
      player: loc.player,
      sourceIid: inst.iid,
      sourceDefId: inst.defId,
      kind: 'onDamaged',
    })
    runScript(state, events, lib, def.onDamaged, {
      player: loc.player,
      sourceDefId: inst.defId,
      sourceIid: inst.iid,
      degradeChosen: true,
      kind: 'onDamaged',
      depth: depth + 1,
    })
  }
}

// 真·消灭:无视铁壁,直接打到 0(与「造成等于当前血量的伤害」不同)
export function destroyGeneral(
  loc: GeneralLoc,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  const inst = loc.inst
  if (inst.health <= 0) return
  const before = inst.health
  inst.damage = inst.maxHealth
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralDamaged',
    player: loc.player,
    iid: inst.iid,
    amount: before,
    healthAfter: inst.health,
  })
}

// 「每打出一个锦囊后」触发器:施法方**自己**在场的、带 onSpellCast 的武将各触发一次
// (法术流 payoff,像法力浮龙/legends 的「施法+攻」)。只在施法方的 PlayCard 里调,
// 所以只吃自己的锦囊,不吃对手的。
//
// 先把「施法那一刻」在场的 iid 快照下来再逐个跑:触发脚本自己可能让单位进出场,
// 拿实时 board 迭代会漏触发或重复触发。跑之前重取一次、校验还活着、没被沉默。
export function fireOnSpellCast(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
): void {
  const iids = state.players[player].board
    .filter((c) => lib[c.defId]?.onSpellCast && !c.silenced)
    .map((c) => c.iid)
  for (const iid of iids) {
    const loc = findGeneral(state, iid)
    if (!loc || loc.player !== player || loc.inst.health <= 0 || loc.inst.silenced) continue
    const def = lib[loc.inst.defId]
    if (!def?.onSpellCast) continue
    events.push({
      type: 'EffectTriggered',
      player,
      sourceIid: iid,
      sourceDefId: loc.inst.defId,
      kind: 'onSpellCast',
    })
    runScript(state, events, lib, def.onSpellCast, {
      player,
      sourceDefId: loc.inst.defId,
      sourceIid: iid,
      degradeChosen: true,
      kind: 'onSpellCast',
      depth: 1,
    })
    processDeaths(state, events, lib)
  }
}

export function healGeneral(
  _state: GameState,
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  if (amount <= 0) return
  const inst = loc.inst
  const healed = Math.min(amount, inst.damage)
  if (healed <= 0) return
  inst.damage -= healed
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralHealed',
    player: loc.player,
    iid: inst.iid,
    amount: healed,
    healthAfter: inst.health,
  })
}

// 死亡结算:光环重算 → 清场 → 遗计 → 循环直到稳定(遗计与光环消失都可能连锁致死)
export function processDeaths(state: GameState, events: GameEvent[], lib: CardLibrary): void {
  for (let guard = 0; guard < 100; guard++) {
    refreshAuras(state, lib)
    const dead: { player: PlayerIdx; inst: CardInstance }[] = []
    for (const player of [0, 1] as const) {
      const p = state.players[player]
      for (let i = p.board.length - 1; i >= 0; i--) {
        if (p.board[i].health <= 0) {
          const [inst] = p.board.splice(i, 1)
          p.graveyard.push(inst.defId)
          dead.push({ player, inst })
        }
      }
    }
    if (dead.length === 0) return
    // 死亡事件按 iid 排序保证确定性(splice 逆序扫描)
    dead.sort((a, b) => a.inst.iid - b.inst.iid)
    for (const d of dead) {
      events.push({ type: 'GeneralDied', player: d.player, iid: d.inst.iid, defId: d.inst.defId })
    }
    for (const d of dead) {
      // 被沉默的单位不触发亡语
      if (d.inst.silenced) continue
      const def = lib[d.inst.defId]
      if (def?.deathrattle) {
        events.push({
          type: 'EffectTriggered',
          player: d.player,
          sourceIid: d.inst.iid,
          sourceDefId: d.inst.defId,
          kind: 'deathrattle',
        })
        runScript(state, events, lib, def.deathrattle, {
          player: d.player,
          sourceDefId: d.inst.defId,
          degradeChosen: true,
          kind: 'deathrattle',
        })
      }
    }
  }
}

// ---------- 效果 DSL ----------

const CHOSEN_TARGETS = new Set([
  'chosenEnemyGeneral',
  'chosenAny',
  'chosenFriendly',
  'chosenFriendlyGeneral',
])

export function requiresChosenTarget(script: EffectScript | undefined): boolean {
  if (!script) return false
  return script.ops.some((op) => 'target' in op && CHOSEN_TARGETS.has(op.target))
}

// 潜行单位不能被敌方选为目标
function selectableByEnemy(inst: CardInstance): boolean {
  return !inst.keywords.includes('stealth')
}

// 该脚本可选目标池(供 UI 高亮与 AI 枚举;单挑目标池另见 combat.ts)
export function chosenTargetPool(
  state: GameState,
  player: PlayerIdx,
  script: EffectScript | undefined,
): TargetRef[] {
  if (!script) return []
  const pool: TargetRef[] = []
  const scopes = new Set(script.ops.filter((op) => 'target' in op).map((op) => op.target))
  const enemy = other(player)
  if (scopes.has('chosenEnemyGeneral')) {
    for (const c of state.players[enemy].board) {
      if (selectableByEnemy(c)) pool.push({ kind: 'general', iid: c.iid })
    }
  }
  if (scopes.has('chosenAny')) {
    for (const p of [0, 1] as const) {
      for (const c of state.players[p].board) {
        if (p === player || selectableByEnemy(c)) pool.push({ kind: 'general', iid: c.iid })
      }
      pool.push({ kind: 'hero', player: p })
    }
  }
  if (scopes.has('chosenFriendly') || scopes.has('chosenFriendlyGeneral')) {
    for (const c of state.players[player].board) pool.push({ kind: 'general', iid: c.iid })
    if (scopes.has('chosenFriendly')) pool.push({ kind: 'hero', player })
  }
  // 去重(chosenEnemyGeneral 与 chosenAny 同时存在时)
  const seen = new Set<string>()
  return pool.filter((t) => {
    const key = t.kind === 'hero' ? `h${t.player}` : `g${t.iid}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function conditionMet(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  script: EffectScript,
): boolean {
  const cond = script.condition
  if (!cond) return true
  if (cond.ifDynastyCount) {
    const { dynasty, atLeast } = cond.ifDynastyCount
    const count = state.players[player].board.filter(
      (c) => lib[c.defId]?.dynasty === dynasty,
    ).length
    if (count < atLeast) return false
  }
  if (cond.ifBoardCount) {
    const { side, atLeast } = cond.ifBoardCount
    const who = side === 'friendly' ? player : other(player)
    if (state.players[who].board.length < atLeast) return false
  }
  if (cond.ifHeroHpBelow !== undefined) {
    if (state.players[player].heroHp >= cond.ifHeroHpBelow) return false
  }
  if (cond.ifHandCount) {
    if (state.players[player].hand.length < cond.ifHandCount.atLeast) return false
  }
  if (cond.ifKeywordCount) {
    const { keyword, atLeast } = cond.ifKeywordCount
    const count = state.players[player].board.filter((c) => c.keywords.includes(keyword)).length
    if (count < atLeast) return false
  }
  return true
}

// buffPer 的计数来源。只数**我方场面**。
// friendlyDynasty 用来源卡的势力,和 friendlyDynastyGenerals 目标一致。
function countFor(
  state: GameState,
  player: PlayerIdx,
  sourceDefId: string,
  lib: CardLibrary,
  per: CountSource,
): number {
  const board = state.players[player].board
  switch (per.kind) {
    case 'friendlyGenerals':
      return board.length
    case 'friendlyKeyword':
      return board.filter((c) => c.keywords.includes(per.keyword)).length
    case 'friendlyDynasty': {
      const dynasty = lib[sourceDefId]?.dynasty
      return board.filter((c) => lib[c.defId]?.dynasty === dynasty).length
    }
  }
}

// 在场友方单位提供的法术伤害加成
export function spellPowerOf(state: GameState, player: PlayerIdx, lib: CardLibrary): number {
  let n = 0
  for (const c of state.players[player].board) {
    if (c.silenced) continue
    n += lib[c.defId]?.spellDamage ?? 0
  }
  return n
}

function resolveRefs(
  state: GameState,
  player: PlayerIdx,
  sourceIid: number | undefined,
  sourceDefId: string,
  lib: CardLibrary,
  target: string,
  chosen: TargetRef | undefined,
  degradeChosen: boolean,
): TargetRef[] {
  const enemy = other(player)
  switch (target) {
    case 'chosenFriendly':
    case 'chosenFriendlyGeneral': {
      if (chosen) return [chosen]
      if (degradeChosen) {
        // 亡语/回合结束等无法交互的场景:退化为随机友方武将
        const board = state.players[player].board
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        return [{ kind: 'general', iid: board[roll.value].iid }]
      }
      return []
    }
    case 'chosenEnemyGeneral':
    case 'chosenAny': {
      if (chosen) return [chosen]
      if (degradeChosen) {
        // 遗计等无法选择的场景:退化为随机敌方武将
        const board = state.players[enemy].board.filter(selectableByEnemy)
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        return [{ kind: 'general', iid: board[roll.value].iid }]
      }
      return []
    }
    case 'allEnemyGenerals':
      return state.players[enemy].board.map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allFriendlyGenerals':
      return state.players[player].board.map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allFriendlyOthers':
      return state.players[player].board
        .filter((c) => c.iid !== sourceIid)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allGenerals':
      return [0, 1].flatMap((p) =>
        state.players[p as PlayerIdx].board.map((c) => ({ kind: 'general' as const, iid: c.iid })),
      )
    case 'randomFriendlyGeneral': {
      const board = state.players[player].board
      if (board.length === 0) return []
      const roll = rngInt(state.rng, board.length)
      state.rng = roll.next
      return [{ kind: 'general', iid: board[roll.value].iid }]
    }
    case 'randomEnemyGeneral': {
      const board = state.players[enemy].board.filter(selectableByEnemy)
      if (board.length === 0) return []
      const roll = rngInt(state.rng, board.length)
      state.rng = roll.next
      return [{ kind: 'general', iid: board[roll.value].iid }]
    }
    case 'self':
      return sourceIid !== undefined ? [{ kind: 'general', iid: sourceIid }] : []
    case 'friendlyDynastyGenerals': {
      const dynasty = lib[sourceDefId]?.dynasty
      return state.players[player].board
        .filter((c) => lib[c.defId]?.dynasty === dynasty)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    }
    case 'enemyHero':
      return [{ kind: 'hero', player: enemy }]
    case 'friendlyHero':
      return [{ kind: 'hero', player }]
    default:
      return []
  }
}

export interface ScriptCtx {
  player: PlayerIdx
  sourceDefId: string
  sourceIid?: number
  chosen?: TargetRef
  degradeChosen?: boolean
  kind?:
    | 'battlecry'
    | 'deathrattle'
    | 'spell'
    | 'endOfTurn'
    | 'startOfTurn'
    | 'onDamaged'
    | 'onAttack'
    | 'onSpellCast'
    | 'heroPower'
    | 'secret'
    | 'combo'
  depth?: number
}

export function runScript(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  script: EffectScript,
  ctx: ScriptCtx,
): void {
  const { player, sourceDefId, sourceIid, chosen, kind } = ctx
  const degradeChosen = ctx.degradeChosen ?? false
  const depth = ctx.depth ?? 0
  if (!conditionMet(state, player, lib, script)) return
  // 法术伤害只加成锦囊(战吼/主公技不吃加成,与炉石一致)
  const bonus = kind === 'spell' ? spellPowerOf(state, player, lib) : 0
  const refs = (target: string) =>
    resolveRefs(state, player, sourceIid, sourceDefId, lib, target, chosen, degradeChosen)

  for (const op of script.ops) {
    // 发现把对局停在 pendingChoice 上等玩家挑牌 —— 一旦挂起,本脚本剩下的 op 不再跑。
    // 所以「发现必须是脚本最后一个 op」不是约定,是这里强制的。
    if (state.pendingChoice) break
    switch (op.op) {
      case 'damage': {
        for (const ref of refs(op.target)) {
          if (ref.kind === 'hero') damageHero(state, ref.player, op.amount + bonus, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
          }
        }
        break
      }
      case 'heal': {
        for (const ref of refs(op.target)) {
          if (ref.kind === 'hero') healHero(state, ref.player, op.amount, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) healGeneral(state, loc, op.amount, events, lib)
          }
        }
        break
      }
      case 'draw':
        drawCards(state, player, op.count, events)
        break
      case 'buffStats': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          addEnchant(
            loc.inst,
            lib,
            { attack: op.attack, health: op.health, duration: op.duration },
            events,
            loc.player,
          )
        }
        break
      }
      case 'swapStats': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const inst = loc.inst
          // 交换**当前**攻击与最大生命,用一条附魔的 delta 完成 —— 复用附魔层与
          // GeneralBuffed 事件,不需要新事件。伤害尽量保留:8/8 挨过 1 刀(现血 7)换完
          // 仍带那道伤。但换位本身**不杀人** —— 旧伤若超过新的最大生命(拿 1/8 的墙换成
          // 8/1),就把伤夹到存活(留 1 血),沿用沉默撤增益那套 clampAlive,别让「换个位置」
          // 变成秒杀,那太反直觉、也会诱发自换自杀的坑。
          const dAtk = inst.maxHealth - inst.attack
          const dHp = inst.attack - inst.maxHealth
          if (dAtk !== 0 || dHp !== 0) {
            addEnchant(inst, lib, { attack: dAtk, health: dHp }, events, loc.player)
            if (inst.health <= 0) {
              inst.damage = Math.max(0, inst.maxHealth - 1)
              refreshInstance(inst, lib)
            }
          }
        }
        break
      }
      case 'buffPer': {
        // 计数在**施加前**定死:自己也在场时会被算进 friendlyGenerals/friendlyDynasty,
        // 但增益是同一批一次性加的,不会自我滚雪球(先数,再加)。
        const n = countFor(state, player, sourceDefId, lib, op.per)
        if (n > 0) {
          for (const ref of refs(op.target)) {
            if (ref.kind !== 'general') continue
            const loc = findGeneral(state, ref.iid)
            if (!loc) continue
            addEnchant(
              loc.inst,
              lib,
              { attack: op.attack * n, health: op.health * n },
              events,
              loc.player,
            )
          }
        }
        break
      }
      case 'damagePer': {
        // 计数先定死再打(和 buffPer 同理)。amount×count 一次性算好,
        // 免得「打死一个又少一个」这种边打边数的怪异结算。
        const dmg = countFor(state, player, sourceDefId, lib, op.per) * op.amount
        if (dmg > 0) {
          for (const ref of refs(op.target)) {
            if (ref.kind === 'hero') damageHero(state, ref.player, dmg, events)
            else {
              const loc = findGeneral(state, ref.iid)
              if (loc) damageGeneral(state, loc, dmg, events, lib, depth)
            }
          }
        }
        break
      }
      case 'recruit': {
        // 搜将:从我方牌库随机拉武将上场(锦囊/衍生物不算)。牌库里那张被消耗掉。
        // 每次都重扫牌库下标 —— 上一次抽走会让下标漂移;复用 GeneralSummoned,不新增事件。
        const p = state.players[player]
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT; i++) {
          const genIdx = p.deck
            .map((c, idx) => ({ defId: c.defId, idx }))
            .filter((x) => lib[x.defId]?.type === 'general')
          if (genIdx.length === 0) break
          const roll = rngInt(state.rng, genIdx.length)
          state.rng = roll.next
          const pick = genIdx[roll.value]
          p.deck.splice(pick.idx, 1)
          const inst = makeBoardInstance(state, pick.defId, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
            iid: inst.iid,
            defId: pick.defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'summon':
      case 'summonForEnemy': {
        const def = lib[op.defId]
        if (!def) break
        const side = op.op === 'summon' ? player : other(player)
        const p = state.players[side]
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT; i++) {
          const inst = makeBoardInstance(state, def.id, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player: side,
            iid: inst.iid,
            defId: inst.defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'aoeDamage': {
        const enemy = other(player)
        for (const c of state.players[enemy].board.slice()) {
          const loc = findGeneral(state, c.iid)
          if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
        }
        break
      }
      case 'damageAll': {
        for (const side of [0, 1] as const) {
          for (const c of state.players[side].board.slice()) {
            const loc = findGeneral(state, c.iid)
            if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
          }
        }
        break
      }
      case 'destroy': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) destroyGeneral(loc, events, lib)
        }
        break
      }
      case 'grantKeyword': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          if (loc.inst.keywords.includes(op.keyword) && op.keyword !== 'divineShield') continue
          addEnchant(
            loc.inst,
            lib,
            { attack: 0, health: 0, keywords: [op.keyword], duration: op.duration },
            events,
            loc.player,
          )
        }
        break
      }
      case 'silence': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) silenceGeneral(loc, lib, events)
        }
        break
      }
      case 'freeze': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) freezeGeneral(loc, events)
        }
        break
      }
      case 'gainMana': {
        const p = state.players[player]
        if (op.temporary) {
          p.mana.current = Math.min(MANA_CAP, p.mana.current + op.amount)
        } else {
          p.mana.max = Math.min(MANA_CAP, p.mana.max + op.amount)
          p.mana.current = Math.min(p.mana.max, p.mana.current + op.amount)
        }
        events.push({ type: 'ManaGained', player, amount: op.amount, temporary: op.temporary })
        break
      }
      case 'gainArmor': {
        const p = state.players[player]
        p.armor += op.amount
        events.push({ type: 'ArmorGained', player, amount: op.amount, armorAfter: p.armor })
        break
      }
      case 'returnToHand': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const owner = state.players[loc.player]
          owner.board.splice(loc.index, 1)
          events.push({
            type: 'GeneralReturned',
            player: loc.player,
            iid: loc.inst.iid,
            defId: loc.inst.defId,
          })
          if (owner.hand.length >= HAND_LIMIT) {
            owner.graveyard.push(loc.inst.defId)
            events.push({ type: 'CardBurned', player: loc.player, defId: loc.inst.defId })
            continue
          }
          // 回手即重置为卡面原值(附魔/受伤/沉默/冻结全部清除)
          resetInstance(loc.inst, lib)
          owner.hand.push(loc.inst)
        }
        break
      }
      case 'discardRandom': {
        const foe = state.players[other(player)]
        for (let i = 0; i < op.count && foe.hand.length > 0; i++) {
          const roll = rngInt(state.rng, foe.hand.length)
          state.rng = roll.next
          const [discarded] = foe.hand.splice(roll.value, 1)
          foe.graveyard.push(discarded.defId)
          events.push({
            type: 'CardDiscarded',
            player: other(player),
            iid: discarded.iid,
            defId: discarded.defId,
          })
        }
        break
      }
      case 'discover': {
        beginDiscover(state, player, op.pool, op.count ?? 3, lib, events, sourceDefId)
        break
      }
      case 'reduceCost': {
        reduceHandCost(state, player, sourceDefId, lib, op.amount, op.filter, events)
        break
      }
      case 'addToHand': {
        const def = lib[op.defId]
        if (!def) break
        const p = state.players[player]
        for (let i = 0; i < op.count; i++) {
          if (p.hand.length >= HAND_LIMIT) {
            events.push({ type: 'CardBurned', player, defId: op.defId })
            continue
          }
          const inst = makeBoardInstance(state, op.defId, lib)
          p.hand.push(inst)
          events.push({ type: 'CardGenerated', player, iid: inst.iid, defId: op.defId })
        }
        break
      }
      case 'transform': {
        if (!lib[op.into]) break
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          // 原地替换成全新实例:不触发亡语(变形不是死亡),保持位置。新单位当回合眩晕。
          const fresh = makeBoardInstance(state, op.into, lib)
          state.players[loc.player].board[loc.index] = fresh
          events.push({
            type: 'GeneralTransformed',
            player: loc.player,
            iid: ref.iid,
            intoIid: fresh.iid,
            defId: op.into,
          })
        }
        break
      }
      case 'resurrect': {
        // 从墓地随机召回死去的**友方武将**(按卡面复生)。墓地混着锦囊,先滤出武将。
        const p = state.players[player]
        const deadGenerals = p.graveyard.filter((id) => lib[id]?.type === 'general' && !lib[id]?.token)
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT && deadGenerals.length > 0; i++) {
          const roll = rngInt(state.rng, deadGenerals.length)
          state.rng = roll.next
          const [defId] = deadGenerals.splice(roll.value, 1)
          const inst = makeBoardInstance(state, defId, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
            iid: inst.iid,
            defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      default: {
        const exhaustive: never = op
        void exhaustive
      }
    }
    // 每个操作后结算死亡,避免后续操作作用在已死单位上
    processDeaths(state, events, lib)
  }
}

// ---------- 实例工厂 ----------

export function resetInstance(inst: CardInstance, lib: CardLibrary): void {
  inst.enchants = []
  inst.damage = 0
  inst.silenced = false
  inst.frozen = false
  inst.shieldUsed = false
  inst.stealthBroken = false
  inst.exhausted = false
  inst.attacksUsed = 0
  refreshInstance(inst, lib)
}

// ---------- 费用消减 / 牌生成 ----------

// 有效费用 = max(0, 卡面费 + 实例 costDelta)。手牌打出/合法性判定都走它。
export function effectiveCost(inst: CardInstance, lib: CardLibrary): number {
  return Math.max(0, (lib[inst.defId]?.cost ?? 0) + inst.costDelta)
}

// 减少手牌中匹配 filter 的牌的费用。dynasty 用来源卡的势力。
export function reduceHandCost(
  state: GameState,
  player: PlayerIdx,
  sourceDefId: string,
  lib: CardLibrary,
  amount: number,
  filter: CostFilter,
  events: GameEvent[],
): void {
  const srcDynasty = lib[sourceDefId]?.dynasty
  for (const inst of state.players[player].hand) {
    const def = lib[inst.defId]
    if (!def) continue
    const match =
      filter === 'all' ||
      (filter === 'dynasty' && def.dynasty === srcDynasty) ||
      (filter === 'generals' && def.type === 'general') ||
      (filter === 'stratagems' && def.type === 'stratagem')
    if (!match) continue
    const before = effectiveCost(inst, lib)
    inst.costDelta -= amount
    const after = effectiveCost(inst, lib)
    if (after !== before) {
      events.push({ type: 'CardCostChanged', player, iid: inst.iid, cost: after })
    }
  }
}

// ---------- 发现 ----------

// 发现的候选池。用**来源卡的主义**判定「我方主义」——
// 引擎只有 heroId、拿不到主义,而「你打出一张王道卡 → 发现王道卡」在体感上
// 和「你的主公是王道」是一回事,还免去了把主义塞进引擎。
function discoverCandidates(
  lib: CardLibrary,
  pool: DiscoverPool,
  sourceDoctrine: Doctrine | 'neutral',
): string[] {
  const all = Object.values(lib).filter((c) => !c.token)
  const mine = (c: CardDef) => c.doctrine === sourceDoctrine || c.doctrine === 'neutral'
  let picked: CardDef[]
  switch (pool) {
    case 'myStratagem':
      picked = all.filter((c) => c.type === 'stratagem' && mine(c))
      break
    case 'myGeneral':
      picked = all.filter((c) => c.type === 'general' && mine(c))
      break
    case 'anyKeyword':
      picked = all.filter((c) => c.type === 'general' && c.keywords.length > 0)
      break
    case 'costlyGeneral':
      picked = all.filter((c) => c.type === 'general' && c.cost >= 6)
      break
  }
  // 按 collectorNo 排序:候选集合必须**确定**,采样才可复现(引擎纯度铁律)
  return picked.sort((a, b) => a.collectorNo - b.collectorNo).map((c) => c.id)
}

// 从候选池里用种子 RNG 取 count 张不重复的,挂上 pendingChoice。
// 池子比 count 小就全给(常见于窄主义 + 窄谓词)。
export function beginDiscover(
  state: GameState,
  player: PlayerIdx,
  pool: DiscoverPool,
  count: number,
  lib: CardLibrary,
  events: GameEvent[],
  sourceDefId: string,
): void {
  const doctrine = lib[sourceDefId]?.doctrine ?? 'neutral'
  const candidates = discoverCandidates(lib, pool, doctrine)
  if (candidates.length === 0) return // 无候选:发现直接落空,不挂起对局
  // 部分 Fisher–Yates:只洗出前 count 个就够
  const bag = candidates.slice()
  const options: string[] = []
  for (let i = 0; i < count && bag.length > 0; i++) {
    const roll = rngInt(state.rng, bag.length)
    state.rng = roll.next
    options.push(bag.splice(roll.value, 1)[0])
  }
  state.pendingChoice = { player, options, reason: 'discover' }
  events.push({ type: 'DiscoverStarted', player, options, reason: 'discover' })
}

export function makeBoardInstance(
  state: GameState,
  defId: string,
  lib: CardLibrary,
): CardInstance {
  const inst: CardInstance = {
    iid: state.nextIid++,
    defId,
    attack: 0,
    health: 0,
    maxHealth: 0,
    keywords: [],
    exhausted: true,
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
