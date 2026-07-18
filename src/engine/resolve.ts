// 结算内核:伤害/治疗/抽牌/死亡处理 + 效果 DSL 解释器。
// 所有数值变化都从这里走,保证事件流与状态变化一一对应。
import type {
  CardInstance,
  CardLibrary,
  EffectScript,
  GameEvent,
  GameState,
  PlayerIdx,
  TargetRef,
} from './types'
import { BOARD_LIMIT, HAND_LIMIT, START_HP } from './types'
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
  const healed = Math.min(amount, START_HP - p.heroHp)
  if (healed <= 0) return
  p.heroHp += healed
  events.push({ type: 'HeroHealed', player, amount: healed, hpAfter: p.heroHp })
}

export function damageGeneral(
  _state: GameState, // 占位:Phase 2 受伤触发会用
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  loc.inst.health -= amount
  events.push({
    type: 'GeneralDamaged',
    player: loc.player,
    iid: loc.inst.iid,
    amount,
    healthAfter: loc.inst.health,
  })
}

export function healGeneral(
  _state: GameState, // 占位:Phase 2 治疗触发会用
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  const healed = Math.min(amount, loc.inst.maxHealth - loc.inst.health)
  if (healed <= 0) return
  loc.inst.health += healed
  events.push({
    type: 'GeneralHealed',
    player: loc.player,
    iid: loc.inst.iid,
    amount: healed,
    healthAfter: loc.inst.health,
  })
}

// 死亡结算:清场 → 遗计 → 循环直到稳定(遗计可能造成连锁死亡)
export function processDeaths(state: GameState, events: GameEvent[], lib: CardLibrary): void {
  for (let guard = 0; guard < 100; guard++) {
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
      const def = lib[d.inst.defId]
      if (def?.deathrattle) {
        events.push({
          type: 'EffectTriggered',
          player: d.player,
          sourceIid: d.inst.iid,
          sourceDefId: d.inst.defId,
          kind: 'deathrattle',
        })
        runScript(state, events, lib, d.player, d.inst.defId, undefined, def.deathrattle, undefined, true)
      }
    }
  }
}

// ---------- 效果 DSL ----------

export function requiresChosenTarget(script: EffectScript | undefined): boolean {
  if (!script) return false
  return script.ops.some(
    (op) =>
      'target' in op && (op.target === 'chosenEnemyGeneral' || op.target === 'chosenAny'),
  )
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
    for (const c of state.players[enemy].board) pool.push({ kind: 'general', iid: c.iid })
  }
  if (scopes.has('chosenAny')) {
    for (const p of [0, 1] as const) {
      for (const c of state.players[p].board) pool.push({ kind: 'general', iid: c.iid })
      pool.push({ kind: 'hero', player: p })
    }
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
    return count >= atLeast
  }
  return true
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
    case 'chosenEnemyGeneral':
    case 'chosenAny': {
      if (chosen) return [chosen]
      if (degradeChosen) {
        // 遗计等无法选择的场景:退化为随机敌方武将
        const board = state.players[enemy].board
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        return [{ kind: 'general', iid: board[roll.value].iid }]
      }
      return []
    }
    case 'allEnemyGenerals':
      return state.players[enemy].board.map((c) => ({ kind: 'general', iid: c.iid }))
    case 'randomEnemyGeneral': {
      const board = state.players[enemy].board
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

export function runScript(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
  sourceDefId: string,
  sourceIid: number | undefined,
  script: EffectScript,
  chosen: TargetRef | undefined,
  degradeChosen: boolean,
): void {
  if (!conditionMet(state, player, lib, script)) return
  for (const op of script.ops) {
    switch (op.op) {
      case 'damage': {
        for (const ref of resolveRefs(state, player, sourceIid, sourceDefId, lib, op.target, chosen, degradeChosen)) {
          if (ref.kind === 'hero') damageHero(state, ref.player, op.amount, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) damageGeneral(state, loc, op.amount, events)
          }
        }
        break
      }
      case 'heal': {
        for (const ref of resolveRefs(state, player, sourceIid, sourceDefId, lib, op.target, chosen, degradeChosen)) {
          if (ref.kind === 'hero') healHero(state, ref.player, op.amount, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) healGeneral(state, loc, op.amount, events)
          }
        }
        break
      }
      case 'draw':
        drawCards(state, player, op.count, events)
        break
      case 'buffStats': {
        for (const ref of resolveRefs(state, player, sourceIid, sourceDefId, lib, op.target, chosen, degradeChosen)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          loc.inst.attack = Math.max(0, loc.inst.attack + op.attack)
          loc.inst.health += op.health
          if (op.health > 0) loc.inst.maxHealth += op.health
          events.push({
            type: 'GeneralBuffed',
            player: loc.player,
            iid: loc.inst.iid,
            attack: op.attack,
            health: op.health,
          })
        }
        break
      }
      case 'summon': {
        const def = lib[op.defId]
        if (!def) break
        const p = state.players[player]
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT; i++) {
          const inst: CardInstance = {
            iid: state.nextIid++,
            defId: def.id,
            attack: def.attack ?? 0,
            health: def.health ?? 0,
            maxHealth: def.health ?? 0,
            keywords: def.keywords.slice(),
            exhausted: true,
            attacksUsed: 0,
            enchants: [],
          }
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
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
          if (loc) damageGeneral(state, loc, op.amount, events)
        }
        break
      }
      case 'destroy': {
        for (const ref of resolveRefs(state, player, sourceIid, sourceDefId, lib, op.target, chosen, degradeChosen)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc && loc.inst.health > 0) {
            damageGeneral(state, loc, loc.inst.health, events)
          }
        }
        break
      }
      case 'grantKeyword': {
        for (const ref of resolveRefs(state, player, sourceIid, sourceDefId, lib, op.target, chosen, degradeChosen)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc && !loc.inst.keywords.includes(op.keyword)) {
            loc.inst.keywords.push(op.keyword)
            events.push({
              type: 'KeywordGranted',
              player: loc.player,
              iid: loc.inst.iid,
              keyword: op.keyword,
            })
          }
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
