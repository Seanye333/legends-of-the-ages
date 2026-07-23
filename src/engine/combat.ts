// 战斗:攻击合法性、攻击结算、单挑。
import type {
  CardInstance,
  CardLibrary,
  GameEvent,
  GameState,
  PlayerIdx,
  TargetRef,
} from './types'
import { fireEnemySecret } from './secrets'
import {
  breakStealth,
  damageGeneral,
  damageHero,
  findGeneral,
  healHero,
  other,
  processDeaths,
  runScript,
  type GeneralLoc,
} from './resolve'

export function hasKeyword(inst: CardInstance, kw: CardInstance['keywords'][number]): boolean {
  return inst.keywords.includes(kw)
}

// 武将对武将的战斗打击:吸血为持有者回血,剧毒补足致死。
// 剧毒不穿铁壁 —— 铁壁吃掉整次打击时,剧毒也一并被挡下。
function strike(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  src: GeneralLoc,
  dst: GeneralLoc,
  amount: number,
): void {
  if (amount <= 0) return
  const hadShield = hasKeyword(dst.inst, 'divineShield')
  damageGeneral(state, dst, amount, events, lib)
  if (hadShield) return
  if (hasKeyword(src.inst, 'lifesteal')) healHero(state, src.player, amount, events)
  if (hasKeyword(src.inst, 'poison') && dst.inst.health > 0) {
    damageGeneral(state, dst, dst.inst.health, events, lib)
  }
}

// 「攻击后」触发器:武将发起一次普通攻击、并在互击后仍存活时触发。
// 只在 performAttack 里调用 —— 单挑(performDuel)是另一种交战,不算「攻击」。
// 攻击者若在互击中阵亡,findGeneral 取不到就不触发;这是刻意的(死人不结算攻击后)。
function fireOnAttack(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  attackerIid: number,
): void {
  const loc = findGeneral(state, attackerIid)
  if (!loc) return
  const inst = loc.inst
  if (inst.health <= 0 || inst.silenced) return
  const def = lib[inst.defId]
  if (!def?.onAttack) return
  events.push({
    type: 'EffectTriggered',
    player: loc.player,
    sourceIid: inst.iid,
    sourceDefId: inst.defId,
    kind: 'onAttack',
  })
  // depth:1 —— 攻击命令本身在 depth 0,脚本内再触发的伤害等由各自的深度上限兜底
  runScript(state, events, lib, def.onAttack, {
    player: loc.player,
    sourceDefId: inst.defId,
    sourceIid: inst.iid,
    degradeChosen: true,
    kind: 'onAttack',
    depth: 1,
  })
  processDeaths(state, events, lib)
}

export function maxAttacksOf(inst: CardInstance): number {
  return hasKeyword(inst, 'windfury') ? 2 : 1
}

// 本回合还能不能发起攻击(不考虑目标)
export function canAttackNow(inst: CardInstance): boolean {
  if (inst.frozen) return false
  if (inst.attack <= 0) return false
  if (inst.attacksUsed >= maxAttacksOf(inst)) return false
  // 上场当回合(exhausted):冲锋可攻任意,突袭仅武将,否则不能动
  if (inst.exhausted && !hasKeyword(inst, 'charge') && !hasKeyword(inst, 'rush')) return false
  return true
}

// 伏兵触发后的攻击者复检。**不看 attacksUsed** —— 这次攻击的次数在触发前就扣了,
// 用 canAttackNow 会把每一次「触发了伏兵的攻击」都判成无效。
function canAttackNow2(inst: CardInstance): boolean {
  return !inst.frozen && inst.attack > 0
}

// 攻击者的合法目标(守护强制、突袭限制、潜行不可选)
export function legalAttackTargets(
  state: GameState,
  player: PlayerIdx,
  inst: CardInstance,
): TargetRef[] {
  if (!canAttackNow(inst)) return []
  const enemy = other(player)
  // 潜行单位既不能被选中,也不能用自己的守护逼迫对手
  const visible = state.players[enemy].board.filter((c) => !hasKeyword(c, 'stealth'))
  const guards = visible.filter((c) => hasKeyword(c, 'guard'))
  const pool = guards.length > 0 ? guards : visible
  const targets: TargetRef[] = pool.map((c) => ({ kind: 'general', iid: c.iid }))
  const rushOnly = inst.exhausted && !hasKeyword(inst, 'charge')
  if (guards.length === 0 && !rushOnly) {
    targets.push({ kind: 'hero', player: enemy })
  }
  return targets
}

// 攻击结算。返回错误字符串或 null(成功,直接改动 state)。
export function performAttack(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
  attackerIid: number,
  target: TargetRef,
): string | null {
  const loc = findGeneral(state, attackerIid)
  if (!loc || loc.player !== player) return 'attacker-not-found'
  const attacker = loc.inst
  const legal = legalAttackTargets(state, player, attacker)
  const match = legal.some((t) =>
    t.kind === 'hero'
      ? target.kind === 'hero' && target.player === t.player
      : target.kind === 'general' && target.iid === t.iid,
  )
  if (!match) return 'illegal-attack-target'

  attacker.attacksUsed += 1
  // 出手即暴露
  breakStealth(loc, lib, events)

  // ---- 伏兵在**伤害结算之前**触发 ----
  // 这是三个触发时机里唯一会打断调用方流程的:埋伏可以直接把攻击者带走
  // (请君入甕),也可以把它弹回手牌(欲擒故縱)。所以触发之后必须**重新取一次**
  // 攻击者与目标,任一方没了就当这次攻击已经被化解 —— 攻击次数照扣。
  //
  // 注意 `attacker`/`loc` 是触发前抓的引用:武将弹回手牌时实例会离开 board,
  // 拿着旧引用继续算伤害就是「打了个已经不在场上的人」。这里的重取不是保险,是必需。
  if (fireEnemySecret(state, events, lib, player, 'enemyAttack', attackerIid) !== null) {
    const stillThere = findGeneral(state, attackerIid)
    if (!stillThere || stillThere.player !== player) return null
    if (!canAttackNow2(stillThere.inst)) return null
    if (target.kind === 'general' && !findGeneral(state, target.iid)) return null
    if (target.kind === 'hero' && state.players[target.player].heroHp <= 0) return null
    // 攻击者可能被冻结/被削成 0 攻,上面已挡掉;身材变化则照新数值结算
    loc.inst = stillThere.inst
    loc.player = stillThere.player
  }
  const attackerNow = loc.inst

  if (target.kind === 'hero') {
    events.push({
      type: 'AttackResolved',
      attacker: player,
      attackerIid,
      target,
      damageToTarget: attackerNow.attack,
      damageToAttacker: 0,
    })
    damageHero(state, target.player, attackerNow.attack, events)
    if (hasKeyword(attackerNow, 'lifesteal')) healHero(state, player, attackerNow.attack, events)
  } else {
    const defLoc = findGeneral(state, target.iid)
    if (!defLoc) return 'target-not-found'
    const defender = defLoc.inst
    events.push({
      type: 'AttackResolved',
      attacker: player,
      attackerIid,
      target,
      damageToTarget: attackerNow.attack,
      damageToAttacker: defender.attack,
    })
    // 碾压:溢出伤害穿透到敌方主公。必须在互击**之前**抓两样东西 ——
    // 防守方挨打前的生命(算溢出的基准)、以及它有没有铁壁(挡下就没有穿透)。
    // 用「攻击力 − 挨打前生命」而不是防守方死没死来算溢出:剧毒是把血截到 0,
    // 不代表打出了那么多伤害,拿死亡当依据会让 1 攻剧毒也穿透一大片。
    const defHealthBefore = defender.health
    const defHadShield = hasKeyword(defender, 'divineShield')
    // 同时互击
    strike(state, events, lib, loc, defLoc, attackerNow.attack)
    strike(state, events, lib, defLoc, loc, defender.attack)
    if (hasKeyword(attackerNow, 'trample') && !defHadShield && defender.health <= 0) {
      const overkill = attackerNow.attack - defHealthBefore
      if (overkill > 0) damageHero(state, other(player), overkill, events)
    }
  }
  processDeaths(state, events, lib)
  fireOnAttack(state, events, lib, attackerIid)
  return null
}

// 单挑:打出带单挑关键词的武将时指定敌将强制对决。
// 攻高者先手,若先手一击致死则不受反击;攻等则同时互击。不消耗攻击次数。
export function performDuel(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
  challengerIid: number,
  defenderIid: number,
): string | null {
  const chLoc = findGeneral(state, challengerIid)
  if (!chLoc || chLoc.player !== player) return 'duelist-not-found'
  const defLoc = findGeneral(state, defenderIid)
  if (!defLoc || defLoc.player !== other(player)) return 'duel-target-invalid'
  const ch = chLoc.inst
  const def = defLoc.inst

  let firstStrikeIid: number | undefined
  if (ch.attack > def.attack) firstStrikeIid = ch.iid
  else if (def.attack > ch.attack) firstStrikeIid = def.iid

  if (firstStrikeIid === undefined) {
    // 同攻:同时互击
    strike(state, events, lib, chLoc, defLoc, ch.attack)
    strike(state, events, lib, defLoc, chLoc, def.attack)
  } else if (firstStrikeIid === ch.iid) {
    strike(state, events, lib, chLoc, defLoc, ch.attack)
    if (def.health > 0) strike(state, events, lib, defLoc, chLoc, def.attack)
  } else {
    strike(state, events, lib, defLoc, chLoc, def.attack)
    if (ch.health > 0) strike(state, events, lib, chLoc, defLoc, ch.attack)
  }

  events.push({
    type: 'DuelFought',
    challenger: player,
    challengerIid,
    defenderIid,
    firstStrikeIid,
    challengerDied: ch.health <= 0,
    defenderDied: def.health <= 0,
  })
  processDeaths(state, events, lib)
  return null
}
