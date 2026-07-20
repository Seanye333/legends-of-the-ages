// 战斗:攻击合法性、攻击结算、单挑。
import type {
  CardInstance,
  CardLibrary,
  GameEvent,
  GameState,
  PlayerIdx,
  TargetRef,
} from './types'
import {
  breakStealth,
  damageGeneral,
  damageHero,
  findGeneral,
  healHero,
  other,
  processDeaths,
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
  if (target.kind === 'hero') {
    events.push({
      type: 'AttackResolved',
      attacker: player,
      attackerIid,
      target,
      damageToTarget: attacker.attack,
      damageToAttacker: 0,
    })
    damageHero(state, target.player, attacker.attack, events)
    if (hasKeyword(attacker, 'lifesteal')) healHero(state, player, attacker.attack, events)
  } else {
    const defLoc = findGeneral(state, target.iid)
    if (!defLoc) return 'target-not-found'
    const defender = defLoc.inst
    events.push({
      type: 'AttackResolved',
      attacker: player,
      attackerIid,
      target,
      damageToTarget: attacker.attack,
      damageToAttacker: defender.attack,
    })
    // 同时互击
    strike(state, events, lib, loc, defLoc, attacker.attack)
    strike(state, events, lib, defLoc, loc, defender.attack)
  }
  processDeaths(state, events, lib)
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
