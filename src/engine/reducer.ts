import type {
  ApplyResult,
  CardLibrary,
  Command,
  GameEvent,
  GameState,
  PlayerIdx,
  TargetRef,
  Winner,
} from './types'
import {
  BOARD_LIMIT,
  CHAIN_TRIGGER,
  HAND_LIMIT,
  MANA_CAP,
  SECRET_LIMIT,
  TURN_LIMIT,
} from './types'
import type { EffectScript } from './types'
import { rngShuffle } from './rng'
import {
  addEnchant,
  changeMorale,
  changeSupply,
  chosenTargetPool,
  damageGeneral,
  refreshAuras,
  drawCards,
  effectiveCost,
  expireTemporaryEnchants,
  findGeneral,
  fireOnSpellCast,
  makeBoardInstance,
  other,
  processDeaths,
  requiresChosenTarget,
  runScript,
  skyOf,
} from './resolve'
import { hasKeyword, performAttack, performDuel } from './combat'
import { fireEnemySecret, hasSecretNamed } from './secrets'

// 纯函数核心:不修改入参,返回新状态 + 事件流。
// AI 模拟、UI 乐观更新、服务器权威校验共用这一个入口。
export function applyCommand(
  state: GameState,
  player: PlayerIdx,
  cmd: Command,
  lib: CardLibrary,
): ApplyResult {
  if (state.phase === 'ended') return { ok: false, error: 'game-ended' }

  // 发现挂起时,对局冻结:只有选择方的 ResolveChoice(或认输)能通过。
  // 放在最前面 —— 别让「待决选择」期间还能出牌/攻击,那会让 pendingChoice 的
  // 目标池、场面统统失去意义。
  if (state.pendingChoice && cmd.type !== 'ResolveChoice' && cmd.type !== 'Concede') {
    return { ok: false, error: 'choice-pending' }
  }

  const next = structuredClone(state)
  const events: GameEvent[] = []

  switch (cmd.type) {
    case 'Concede': {
      endGame(next, events, other(player))
      return { ok: true, state: next, events }
    }
    case 'ResolveChoice': {
      const error = resolveChoice(next, player, cmd.index, events, lib)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    case 'Mulligan': {
      if (next.phase !== 'mulligan') return { ok: false, error: 'not-mulligan-phase' }
      const p = next.players[player]
      if (p.mulliganDone) return { ok: false, error: 'mulligan-already-done' }
      const handIids = new Set(p.hand.map((c) => c.iid))
      for (const iid of cmd.keepIids) {
        if (!handIids.has(iid)) return { ok: false, error: `iid-not-in-hand: ${iid}` }
      }
      const keep = new Set(cmd.keepIids)
      const replaced = p.hand.filter((c) => !keep.has(c.iid))
      p.hand = p.hand.filter((c) => keep.has(c.iid))
      // 先从剩余牌库补抽,再把换掉的牌洗回 —— 保证换掉的牌不会立刻抽回(炉石规则)
      if (replaced.length > 0) {
        for (let i = 0; i < replaced.length; i++) {
          const card = p.deck.pop()
          if (card) {
            p.hand.push(card)
            events.push({ type: 'CardDrawn', player, iid: card.iid, defId: card.defId })
          }
        }
        p.deck.push(...replaced)
        const shuffledDeck = rngShuffle(next.rng, p.deck)
        next.rng = shuffledDeck.next
        p.deck = shuffledDeck.result
      }
      p.mulliganDone = true
      events.push({ type: 'MulliganDone', player, replacedCount: replaced.length })
      if (next.players[0].mulliganDone && next.players[1].mulliganDone) {
        next.phase = 'main'
        beginTurn(next, events, lib)
      }
      return { ok: true, state: next, events }
    }
    case 'EndTurn': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      // 回合结束触发器可能直接把某一方打死(例如诸葛恪的自伤),此时不再开新回合
      if (endTurn(next, events, lib, player)) return { ok: true, state: next, events }
      next.activePlayer = other(next.activePlayer)
      beginTurn(next, events, lib)
      return { ok: true, state: next, events }
    }
    case 'PlayCard': {
      const error = playCard(next, player, cmd.iid, cmd.boardPos, cmd.target, cmd.mode, events, lib)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    case 'UseHeroPower': {
      const error = useHeroPower(next, player, cmd.target, cmd.vice ?? false, events, lib)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    case 'UpgradeHeroPower': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      const p = next.players[player]
      const up = p.heroPower?.upgrade
      if (!up) return { ok: false, error: 'no-upgrade' }
      const price = Math.max(0, p.heroPower?.upgradeCost ?? 0)
      if (p.mana.current < price) return { ok: false, error: 'not-enough-mana' }
      p.mana.current -= price
      // 整份换掉 —— 升级后的那份自己也可以再带 upgrade,天然支持多级
      p.heroPower = up
      p.heroPowerTier = (p.heroPowerTier ?? 0) + 1
      events.push({ type: 'HeroPowerUpgraded', player, powerId: up.id })
      return { ok: true, state: next, events }
    }
    case 'Attack': {
      if (next.phase !== 'main') return { ok: false, error: 'not-main-phase' }
      if (player !== next.activePlayer) return { ok: false, error: 'not-your-turn' }
      const error = performAttack(next, events, lib, player, cmd.attackerIid, cmd.target)
      if (error) return { ok: false, error }
      checkGameEnd(next, events)
      return { ok: true, state: next, events }
    }
    default: {
      const exhaustive: never = cmd
      return { ok: false, error: `unknown-command: ${JSON.stringify(exhaustive)}` }
    }
  }
}

// 主公技:每回合一次,费用与效果由 PlayerState.heroPower 携带。
// 双将:vice=true 时改用副将技 —— 但 heroPowerUsed 是**共用**的一次额度,
// 所以双将加的是「这回合该用哪一个」的决策,不是每回合两次输出。
function useHeroPower(
  state: GameState,
  player: PlayerIdx,
  target: TargetRef | undefined,
  vice: boolean,
  events: GameEvent[],
  lib: CardLibrary,
): string | null {
  if (state.phase !== 'main') return 'not-main-phase'
  if (player !== state.activePlayer) return 'not-your-turn'
  const p = state.players[player]
  const power = vice ? p.vicePower : p.heroPower
  if (!power) return vice ? 'no-vice-power' : 'no-hero-power'
  if (p.heroPowerUsed) return 'hero-power-used'
  // 远征宝物可以让主公技更便宜(整局有效)
  const powerCost = Math.max(0, power.cost + p.heroPowerCostDelta)
  if (powerCost > p.mana.current) return 'not-enough-mana'

  const needsChosen = requiresChosenTarget(power.script)
  let chosen: TargetRef | undefined
  if (needsChosen) {
    const pool = chosenTargetPool(state, player, power.script)
    if (pool.length === 0) return 'no-legal-target'
    if (!target) return 'target-required'
    const inPool = pool.some((x) =>
      x.kind === 'hero'
        ? target.kind === 'hero' && target.player === x.player
        : target.kind === 'general' && target.iid === x.iid,
    )
    if (!inPool) return 'invalid-target'
    chosen = target
  }

  p.mana.current -= powerCost
  p.heroPowerUsed = true
  events.push({
    type: 'HeroPowerUsed',
    player,
    heroId: p.heroId,
    powerId: power.id,
    cost: powerCost,
  })
  events.push({
    type: 'EffectTriggered',
    player,
    sourceDefId: p.heroId,
    kind: 'heroPower',
  })
  runScript(state, events, lib, power.script, {
    player,
    sourceDefId: p.heroId,
    chosen,
    kind: 'heroPower',
  })
  processDeaths(state, events, lib)
  return null
}

function playCard(
  state: GameState,
  player: PlayerIdx,
  iid: number,
  boardPos: number | undefined,
  target: TargetRef | undefined,
  mode: number | undefined,
  events: GameEvent[],
  lib: CardLibrary,
): string | null {
  if (state.phase !== 'main') return 'not-main-phase'
  if (player !== state.activePlayer) return 'not-your-turn'
  const p = state.players[player]
  const handIndex = p.hand.findIndex((c) => c.iid === iid)
  if (handIndex < 0) return 'card-not-in-hand'
  const inst = p.hand[handIndex]
  const def = lib[inst.defId]
  if (!def) return `unknown-card-def: ${inst.defId}`
  // 有效费用 = 卡面费 + 实例 costDelta(费用消减)。扣费、事件都走它。
  const cost = effectiveCost(inst, lib)
  if (cost > p.mana.current) return 'not-enough-mana'
  // 军需:除法力外还要花粮道。**先判后扣**,和法力一个待遇 ——
  // 校验失败必须不产生任何变化,否则 legalCommands 与 applyCommand 的契约就破了。
  const supplyCost = def.supplyCost ?? 0
  if (supplyCost > (p.supply ?? 0)) return 'not-enough-supply'

  // ---- 连击:本回合此牌**之前**已经打出过牌,就改用 combo 脚本 ----
  // 「改用」而不是「追加」:追加的话一张连击牌在连击时价值翻倍,定价没法做。
  // 判定放在扣费之前,因为目标校验也要按实际会跑的那个脚本来 ——
  // 基础脚本要目标而连击脚本不要(或反过来)的卡是存在的。
  const comboActive = def.combo !== undefined && p.cardsPlayedThisTurn > 0

  // ---- 抉择:打出时选一个模式(和连击互斥,一张牌只能是其一)----
  // 校验 index 合法;缺省选 0。模式选中的脚本会替代 battlecry/spell,
  // 于是「模式 A 要目标、模式 B 不要」也照选中的那段走目标校验。
  let chosenMode: EffectScript | undefined
  let modeIndex = 0
  if (def.choose) {
    modeIndex = mode ?? 0
    if (modeIndex < 0 || modeIndex >= def.choose.modes.length) return 'invalid-mode'
    chosenMode = def.choose.modes[modeIndex].script
  }

  // ---- 伏兵:打出后进伏兵区,不结算 spell ----
  if (def.type === 'stratagem' && def.secret) {
    if (p.secrets.length >= SECRET_LIMIT) return 'secrets-full'
    // 同名伏兵不能重复埋 —— 否则「对手还剩几个伏兵」这个信息就失真了
    if (hasSecretNamed(state, player, def.id)) return 'secret-duplicate'
  }

  // ---- 打出前校验目标(校验失败不产生任何变化) ----
  // 优先级:抉择模式 > 连击 > 基础脚本
  const script =
    def.type === 'general'
      ? (chosenMode ?? (comboActive ? def.combo : def.battlecry))
      : def.type === 'stratagem'
        ? (def.secret ? undefined : (chosenMode ?? (comboActive ? def.combo : def.spell)))
        : undefined
  const needsChosen = requiresChosenTarget(script)
  const pool = needsChosen ? chosenTargetPool(state, player, script) : []
  const targetInPool = (t: TargetRef) =>
    pool.some((x) =>
      x.kind === 'hero'
        ? t.kind === 'hero' && t.player === x.player
        : t.kind === 'general' && t.iid === x.iid,
    )
  const duelTarget =
    target?.kind === 'general' ? findGeneral(state, target.iid) : undefined
  const canDuel =
    def.type === 'general' &&
    def.keywords.includes('duel') &&
    duelTarget !== undefined &&
    duelTarget.player === other(player) &&
    !hasKeyword(duelTarget.inst, 'stealth')
  let chosenForScript: TargetRef | undefined
  if (def.type === 'general') {
    if (p.board.length >= BOARD_LIMIT) return 'board-full'
    if (needsChosen && target && targetInPool(target)) chosenForScript = target
    else if (needsChosen && pool.length > 0 && target && !targetInPool(target) && !canDuel)
      return 'invalid-target'
    // 战吼需要目标但未给:目标池非空时要求给目标(单挑目标除外),池空则跳过对应操作
    if (needsChosen && pool.length > 0 && !target) return 'target-required'
  } else if (def.type === 'equipment') {
    // 装备必须指定一名友方在场武将
    if (!target || target.kind !== 'general') return 'target-required'
    if (findGeneral(state, target.iid)?.player !== player) return 'invalid-target'
  } else {
    if (!def.spell && !def.secret && !def.combo && !def.choose) return 'stratagem-without-spell'
    if (needsChosen) {
      if (pool.length === 0) return 'no-legal-target'
      if (!target) return 'target-required'
      if (!targetInPool(target)) return 'invalid-target'
      chosenForScript = target
    }
  }

  // ---- 执行 ----
  p.mana.current -= cost
  if (supplyCost > 0) changeSupply(state, player, -supplyCost, events)
  p.hand.splice(handIndex, 1)
  events.push({ type: 'CardPlayed', player, iid, defId: inst.defId, cost })
  if (def.choose) {
    events.push({ type: 'ChooseModePlayed', player, defId: inst.defId, mode: modeIndex })
  }
  // 连击计数在**打出之后**加,所以这张牌自己不会让自己进入连击态
  p.cardsPlayedThisTurn += 1
  if (comboActive) {
    events.push({ type: 'ComboTriggered', player, iid, defId: inst.defId })
  }
  // 过载只记账,真正扣水晶在下个回合开始时(beginTurn)。
  // 分两步是为了让 UI 能分别说清「这张牌过载了 2 点」和「你这回合被锁了 2 点」。
  if (def.overload) {
    p.overloadNext += def.overload
    events.push({ type: 'ManaOverloaded', player, amount: def.overload })
  }

  if (def.type === 'general') {
    const pos = Math.max(0, Math.min(boardPos ?? p.board.length, p.board.length))
    inst.exhausted = true
    inst.attacksUsed = 0
    p.board.splice(pos, 0, inst)
    events.push({
      type: 'GeneralSummoned',
      player,
      iid: inst.iid,
      defId: inst.defId,
      position: pos,
      attack: inst.attack,
      health: inst.health,
    })
    // 光环可能在入场瞬间改变全场身材
    processDeaths(state, events, lib)
    if (script) {
      events.push({
        type: 'EffectTriggered',
        player,
        sourceIid: inst.iid,
        sourceDefId: inst.defId,
        kind: comboActive ? 'combo' : 'battlecry',
      })
      runScript(state, events, lib, script, {
        player,
        sourceDefId: inst.defId,
        sourceIid: inst.iid,
        chosen: chosenForScript,
        kind: comboActive ? 'combo' : 'battlecry',
      })
    }
    // 单挑:战吼结算后,若单挑者仍在场且目标仍在场
    if (canDuel && target?.kind === 'general' && findGeneral(state, inst.iid)) {
      if (findGeneral(state, target.iid)) {
        performDuel(state, events, lib, player, inst.iid, target.iid)
      }
    }
    // 伏兵在战吼与单挑**之后**触发:入场的战吼是「打出的一部分」,
    // 先让它跑完再让对手的埋伏说话,顺序上更接近玩家的心理模型。
    fireEnemySecret(state, events, lib, player, 'enemySummon', inst.iid)
  } else if (def.type === 'equipment') {
    // 装备:作为一条附魔挂上(因此可被沉默清除),随后入墓
    const loc = target?.kind === 'general' ? findGeneral(state, target.iid) : undefined
    if (loc) {
      events.push({ type: 'EquipmentAttached', player, targetIid: loc.inst.iid, defId: inst.defId })
      addEnchant(
        loc.inst,
        lib,
        {
          attack: def.attack ?? 0,
          health: def.health ?? 0,
          keywords: def.keywords.length > 0 ? def.keywords.slice() : undefined,
          // 傳承装备:持有者阵亡时这条附魔会改挂给另一名友军(见 processDeaths)
          heirloom: def.heirloom ? def.id : undefined,
        },
        events,
        loc.player,
      )
    }
    p.graveyard.push(inst.defId)
  } else if (def.secret) {
    // 伏兵不结算、不入墓 —— 它现在住在伏兵区,翻开时才入墓
    p.secrets.push({ iid: inst.iid, defId: inst.defId })
    events.push({ type: 'SecretPlayed', player, iid: inst.iid, defId: inst.defId })
  } else {
    events.push({
      type: 'EffectTriggered',
      player,
      sourceDefId: inst.defId,
      kind: comboActive ? 'combo' : 'spell',
    })
    // ---- 计谋链:本回合第 CHAIN_TRIGGER+1 张锦囊结算**两次** ----
    //
    // 为什么按回合清零(见 PlayerState.chain):跨回合攒够四张不叫连环计,叫存牌。
    // 一口气使出四条计策要么靠一堆一费锦囊、要么靠费用消减,那是一条得真的去搭的路线,
    // 而且它对既有卡池近乎零影响 —— 现有的贪心 AI 一个回合基本不会甩出四张锦囊。
    const chained = (p.chain ?? 0) >= CHAIN_TRIGGER
    if (chained) {
      p.chain = 0
      events.push({ type: 'ChainTriggered', player, defId: inst.defId })
    } else {
      p.chain = (p.chain ?? 0) + 1
      events.push({ type: 'ChainAdvanced', player, chain: p.chain })
    }
    const castOnce = () =>
      runScript(state, events, lib, script!, {
        player,
        sourceDefId: inst.defId,
        chosen: chosenForScript,
        // 连击脚本也算锦囊,照吃法术伤害加成
        kind: 'spell',
      })
    castOnce()
    // 第二次结算:目标可能已经被第一次打死,runScript 内部按 iid 现查现用,
    // 查不到就跳过 —— 所以「重复施放」不需要任何额外的目标复检。
    // 挂起(发现)时不重复:那次施法还没走完,别在挂起态上再叠一层。
    if (chained && !state.pendingChoice) castOnce()
    p.graveyard.push(inst.defId)
    // 法术流 payoff:锦囊结算后,自己在场的 onSpellCast 武将各触发一次。
    // 若这张锦囊触发了发现(pendingChoice 挂起),就先不触发 —— 这次施法还没走完,
    // 别在挂起态里再叠一层触发;等它罕见,牺牲这点边角换实现简单。
    if (!state.pendingChoice) fireOnSpellCast(state, events, lib, player)
    // 锦囊伏兵在**结算之后**触发:对手先看到锦囊的效果,再被反制
    fireEnemySecret(state, events, lib, player, 'enemyStratagem')
  }

  processDeaths(state, events, lib)
  return null
}

// 发现:玩家从亮出的候选里挑一张进手牌。
// 挂起期间对局其他一切被拒(见 applyCommand 顶部的闸门),所以这里不用再判
// activePlayer / phase —— 谁挂起的就是谁能选,pendingChoice.player 说了算。
function resolveChoice(
  state: GameState,
  player: PlayerIdx,
  index: number,
  events: GameEvent[],
  lib: CardLibrary,
): string | null {
  const pc = state.pendingChoice
  if (!pc) return 'no-pending-choice'
  if (pc.player !== player) return 'not-your-choice'
  if (index < 0 || index >= pc.options.length) return 'invalid-choice-index'
  const defId = pc.options[index]
  // 先清挂起再加牌:万一加牌又触发别的(目前不会),也不会二次挂在旧选择上
  state.pendingChoice = undefined
  const p = state.players[player]
  // 手满则烧掉,和抽牌撞上限一致 —— 发现不该凭空突破手牌上限
  if (p.hand.length >= HAND_LIMIT) {
    events.push({ type: 'CardBurned', player, defId })
    return null
  }
  const inst = makeBoardInstance(state, defId, lib)
  p.hand.push(inst)
  events.push({ type: 'DiscoverPicked', player, defId })
  return null
}

// 回合结束:先跑「回合结束时」触发器,再撤销本回合临时增益,最后解冻自己的单位。
// 解冻放在回合末而不是回合初 —— 否则在对手回合冻结他的单位,他一开局就化了,等于没冻。
// 返回 true 表示对局在回合结束阶段就已经分出胜负。
function endTurn(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
): boolean {
  for (const unit of state.players[player].board.slice()) {
    if (unit.silenced) continue
    const def = lib[unit.defId]
    if (!def?.endOfTurn) continue
    if (!findGeneral(state, unit.iid)) continue
    events.push({
      type: 'EffectTriggered',
      player,
      sourceIid: unit.iid,
      sourceDefId: unit.defId,
      kind: 'endOfTurn',
    })
    runScript(state, events, lib, def.endOfTurn, {
      player,
      sourceDefId: unit.defId,
      sourceIid: unit.iid,
      degradeChosen: true,
      kind: 'endOfTurn',
    })
  }
  expireTemporaryEnchants(state, lib, events)
  // 粮道:每逢自己的回合结束囤一格。放在回合**末**而不是回合初,
  // 是为了让「这回合我打不打得起那张军需卡」在回合开始时就已经定死 ——
  // 回合初再加一格,玩家得先心算一次才知道自己有多少粮。
  changeSupply(state, player, 1, events)
  for (const unit of state.players[player].board) {
    if (unit.frozen) {
      unit.frozen = false
      events.push({ type: 'GeneralUnfrozen', player, iid: unit.iid })
    }
  }
  processDeaths(state, events, lib)
  checkGameEnd(state, events)
  if (state.phase === 'ended') return true
  events.push({ type: 'TurnEnded', player, turn: state.turn })
  return false
}

function beginTurn(state: GameState, events: GameEvent[], lib: CardLibrary): void {
  const skyBefore = skyOf(state.turn)
  state.turn += 1
  if (state.turn > TURN_LIMIT) {
    endGame(state, events, 'draw')
    return
  }
  // 天时换段。零状态 —— 事件只是给 UI 一个「该播报了」的信号,状态里什么都不存,
  // 所以哪怕这条事件丢了,天时本身也不会错(见 types.ts Sky 的说明)。
  const sky = skyOf(state.turn)
  if (sky !== skyBefore) events.push({ type: 'SkyChanged', sky, turn: state.turn })
  const active = state.activePlayer
  const p = state.players[active]
  p.mana.max = Math.min(MANA_CAP, p.mana.max + 1)
  p.mana.current = p.mana.max
  // 过载:上回合透支的水晶现在还。锁到 0 为止,不会欠成负数、也不跨回合累积 ——
  // 累积的话一次连锁过载能把人锁死好几轮,那不是风险,那是自杀。
  p.overloadLocked = Math.min(p.overloadNext, p.mana.current)
  p.overloadNext = 0
  if (p.overloadLocked > 0) {
    p.mana.current -= p.overloadLocked
    events.push({ type: 'ManaLocked', player: active, amount: p.overloadLocked })
  }
  p.cardsPlayedThisTurn = 0
  p.chain = 0
  p.heroPowerUsed = false
  // 士气向 0 收敛一格。没有这条它就是滚雪球(赢的人越赢身材越好),
  // 有了它就是一段**时间窗**:一波赚下来的优势只维持到你下个回合开始。
  const morale = p.morale ?? 0
  if (morale !== 0) {
    changeMorale(state, active, morale > 0 ? -1 : 1, events)
    refreshAuras(state, lib)
  }
  for (const unit of p.board) {
    unit.exhausted = false
    unit.attacksUsed = 0
  }
  events.push({
    type: 'TurnStarted',
    player: active,
    turn: state.turn,
    mana: p.mana.max,
  })
  // 战场环境:每个回合开始烧一次全场,然后倒计时。
  //
  // 放在 TurnStarted **之后**、startOfTurn 触发**之前**:
  // 环境是这一回合的既定条件,武将的回合开始效果应当在它之上结算
  // (「回合开始时治疗自己」要能救回被火烧掉的血,顺序反了就救不到)。
  if (state.field) {
    const burn = state.field.rule.turnDamageAll ?? 0
    if (burn > 0) {
      for (const side of [0, 1] as const) {
        // slice() 先快照:烧死的单位会在 processDeaths 里被移出 board
        const snapshot = state.players[side].board.slice()
        for (const unit of snapshot) {
          const loc = findGeneral(state, unit.iid)
          if (loc) damageGeneral(state, loc, burn, events, lib)
        }
      }
      processDeaths(state, events, lib)
    }
    if (state.field.turnsLeft !== undefined) {
      state.field.turnsLeft -= 1
      if (state.field.turnsLeft <= 0) {
        state.field = undefined
        events.push({ type: 'FieldChanged' })
        refreshAuras(state, lib)
      }
    }
  }
  for (const unit of p.board.slice()) {
    if (unit.silenced) continue
    const def = lib[unit.defId]
    if (!def?.startOfTurn) continue
    if (!findGeneral(state, unit.iid)) continue
    events.push({
      type: 'EffectTriggered',
      player: active,
      sourceIid: unit.iid,
      sourceDefId: unit.defId,
      kind: 'startOfTurn',
    })
    runScript(state, events, lib, def.startOfTurn, {
      player: active,
      sourceDefId: unit.defId,
      sourceIid: unit.iid,
      degradeChosen: true,
      kind: 'startOfTurn',
    })
  }
  drawCards(state, active, 1, events)
  processDeaths(state, events, lib)
  checkGameEnd(state, events)
}

export function checkGameEnd(state: GameState, events: GameEvent[]): void {
  if (state.phase === 'ended') return
  const dead0 = state.players[0].heroHp <= 0
  const dead1 = state.players[1].heroHp <= 0
  if (dead0 || dead1) {
    const winner: Winner = dead0 && dead1 ? 'draw' : dead0 ? 1 : 0
    endGame(state, events, winner)
    return
  }
  // 名局特殊目标(座位 0 = 玩家)。死亡判定优先 —— 撑不住先按普通规则判负。
  const obj = state.objective
  if (!obj) return
  // 守成:在**玩家自己回合开始**判(beginTurn 里 turn 已 +1、activePlayer 已切),
  // 敌方拿满 obj.turns 个回合来强杀,过了这个坎、轮到玩家时还活着,就算守住。
  if (obj.kind === 'survive') {
    if (state.activePlayer === 0 && state.turn > obj.turns) endGame(state, events, 0)
    return
  }
  // 斩将 / 护送:靠本批事件里的 GeneralDied 精确认「那个 iid 死了」。
  // 用事件而非「离场」判 —— 弹回手牌/变形不算死,不能误伤(尤其护送)。
  if (obj.targetIid == null) return
  const targetDied = events.some((e) => e.type === 'GeneralDied' && e.iid === obj.targetIid)
  if (!targetDied) return
  if (obj.kind === 'assassinate') endGame(state, events, 0) // 斩将成功,玩家胜
  else endGame(state, events, 1) // 护送失败,玩家负
}

function endGame(state: GameState, events: GameEvent[], winner: Winner): void {
  if (state.phase === 'ended') return
  state.phase = 'ended'
  state.winner = winner
  events.push({ type: 'GameEnded', winner })
}
