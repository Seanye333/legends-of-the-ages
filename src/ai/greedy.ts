// 贪心 AI:枚举合法命令 → 纯函数模拟一步 → 评分取最优。
// 确定性:所有随机(失误抖动)走调用方传入的种子,模拟与正式对局可复现。
//
// 【为什么不是纯 1 层贪心】
// 逐步贪心天生看不见「需要先走一步局部亏分」的斩杀线:把 5/5 送进守护墙,
// 让剩下的场面全部打脸。单看每一步,送兵那步的评分是下降的,于是永远不会被选中。
// 所以在贪心之前先跑一次**专门的斩杀搜索**(findLethal):它只枚举攻击与主公技,
// 分支极小,却能补上贪心最致命的那个盲区。
//
// 【评分为什么要看卡牌身份】
// 早期版本把 lib 参数直接 `void lib` 丢掉,于是 1/1 剧毒和 1/1 白板同分、
// 铁壁等于没有、光环来源等于普通身材。这让 sim-balance 系统性高估铺场卡组、
// 低估任何靠关键词吃饭的卡组 —— 平衡结论会整体走偏。
import type {
  CardInstance,
  CardLibrary,
  Command,
  GameState,
  PlayerIdx,
  PlayerState,
} from '../engine/types'
import { applyCommand } from '../engine/reducer'
import { legalCommands } from '../engine/legal'
import { canAttackNow, maxAttacksOf } from '../engine/combat'
import { rngNext } from '../engine/rng'

export interface AiConfig {
  // 失误概率:以该概率选次优解(难度调节)
  blunderChance: number
  // 是否启用斩杀搜索。关掉之后 AI 会漏掉多步斩杀 —— 这是低难度最像人的失误。
  lethalSearch: boolean
}

export const AI_NORMAL: AiConfig = { blunderChance: 0, lethalSearch: true }
export const AI_EASY: AiConfig = { blunderChance: 0.25, lethalSearch: false }

// 三档难度(UI 用兵法称谓:新兵/宿将/名将)。
// 三档的差别不只是失误率:新兵完全看不见多步斩杀,宿将偶尔失误,名将零失误且必算斩杀。
export const AI_LEVELS = {
  recruit: { blunderChance: 0.35, lethalSearch: false },
  veteran: { blunderChance: 0.12, lethalSearch: false },
  general: { blunderChance: 0, lethalSearch: true },
} as const satisfies Record<string, AiConfig>

// ---------- 估值 ----------

// 关键词的身材当量。基准:1 点攻击 = 1.0,1 点生命 = 0.8。
function keywordValue(inst: CardInstance): number {
  let v = 0
  for (const kw of inst.keywords) {
    switch (kw) {
      case 'guard':
        v += 1.2
        break
      case 'charge':
        v += 0.8
        break
      case 'rush':
        v += 0.5
        break
      case 'windfury':
        v += inst.attack * 0.7 // 多打一次 ≈ 多一份攻击力(打不满,九折)
        break
      case 'lifesteal':
        v += inst.attack * 0.35
        break
      case 'poison':
        v += 1.6 // 换掉任意大怪
        break
      case 'divineShield':
        v += 1.5 + inst.attack * 0.25 // 白吃一次伤害,攻击越高越赚
        break
      case 'stealth':
        v += 0.6 // 不能被点,下回合一定能站着出手
        break
      case 'duel':
        break // 单挑是上场时的一次性效果,在场上没有持续价值
    }
  }
  return v
}

function unitValue(inst: CardInstance, lib: CardLibrary): number {
  const def = lib[inst.defId]
  let v = inst.attack * 1 + inst.health * 0.8 + keywordValue(inst)
  if (def && !inst.silenced) {
    if (def.deathrattle) v += 0.6
    if (def.aura) {
      // 光环价值随受益人数增长,但这里只能给个常数近似 —— 场面越宽越低估,可接受
      v += (def.aura.attack * 1 + def.aura.health * 0.8) * 1.5
    }
    if (def.spellDamage) v += def.spellDamage * 0.9
  }
  // 冻结的单位这一轮打不出来,威胁打折
  if (inst.frozen) v *= 0.55
  return v
}

function sideValue(p: PlayerState, lib: CardLibrary): number {
  let v = 0
  for (const c of p.board) v += unitValue(c, lib)
  return v
}

export function evaluate(state: GameState, player: PlayerIdx, lib: CardLibrary): number {
  if (state.phase === 'ended') {
    if (state.winner === player) return 1e9
    if (state.winner === 'draw') return 0
    return -1e9
  }
  const me = state.players[player]
  const foe = state.players[player === 0 ? 1 : 0]

  let score = sideValue(me, lib) - sideValue(foe, lib)

  const myHp = me.heroHp + me.armor
  const foeHp = foe.heroHp + foe.armor
  score += myHp * 0.6 - foeHp * 0.6
  // 血线非线性:掉到 10 以下时每一点都金贵,防止 AI 为了一点场面优势把自己送进斩杀线
  if (myHp <= 10) score -= (10 - myHp) * 1.2
  if (foeHp <= 10) score += (10 - foeHp) * 1.2

  // 手牌 = 资源;牌库见底则疲劳会自己咬自己
  score += me.hand.length * 0.4 - foe.hand.length * 0.4
  if (me.deck.length === 0) score -= 2
  if (foe.deck.length === 0) score += 2

  // 主公技这回合还没用 = 一份没兑现的资源
  if (me.heroPower && !me.heroPowerUsed && me.mana.current >= me.heroPower.cost) score += 0.3

  // ---- 第四卡包 ----
  // 伏兵对贪心 AI 是**不可见的价值**:打出它场面一点变化都没有,
  // 于是纯贪心永远不会打伏兵 —— 那批卡在 AI 手里等于废牌。
  // 这里给一个固定的持有价值(约等于一张 2 费牌的场面折算),
  // 让 AI 至少愿意把伏兵埋下去。不做「猜对手会不会踩」的推演 ——
  // 那需要对手模型,而这一层是刻意贪心的(见 ARCHITECTURE.md 的平衡一节)。
  score += me.secrets.length * 1.6 - foe.secrets.length * 1.6

  // 过载是**下回合的债**。不记这一笔的话,AI 眼里过载牌就是白送的超模身材,
  // 会毫不犹豫地连着两张过载把自己锁死。按每点 0.5 折算(略低于一点法力的
  // 即时价值,因为债要下回合才还,中间还有一回合的场面收益)。
  score -= me.overloadNext * 0.5
  score += foe.overloadNext * 0.5

  return score
}

// ---------- 斩杀搜索 ----------

// 本回合能打到对方脸上的总伤害。守护墙存在时直接判定打不穿(不做清墙推演,
// 那属于贪心的领域;这里只负责补「场面已经能一波带走」这个洞)。
function faceDamageAvailable(state: GameState, player: PlayerIdx): number | null {
  const foe = state.players[player === 0 ? 1 : 0]
  const hasGuard = foe.board.some(
    (c) => c.keywords.includes('guard') && !c.keywords.includes('stealth'),
  )
  if (hasGuard) return null
  let total = 0
  for (const unit of state.players[player].board) {
    if (!canAttackNow(unit)) continue
    // 突袭单位上场当回合打不到脸
    if (unit.exhausted && !unit.keywords.includes('charge')) continue
    total += unit.attack * (maxAttacksOf(unit) - unit.attacksUsed)
  }
  return total
}

// 找一条能这回合结束对局的攻击序列。找不到返回 null。
function findLethal(state: GameState, player: PlayerIdx, lib: CardLibrary): Command | null {
  const foe = state.players[player === 0 ? 1 : 0]
  const available = faceDamageAvailable(state, player)
  if (available === null) return null
  if (available < foe.heroHp + foe.armor) return null

  // 伤害够了,验证一遍并给出第一步(逐个把能打脸的单位派上去)
  let sim = state
  let first: Command | null = null
  for (let guard = 0; guard < 16; guard++) {
    const attacker = sim.players[player].board.find(
      (u) => canAttackNow(u) && !(u.exhausted && !u.keywords.includes('charge')) && u.attack > 0,
    )
    if (!attacker) break
    const cmd: Command = {
      type: 'Attack',
      attackerIid: attacker.iid,
      target: { kind: 'hero', player: player === 0 ? 1 : 0 },
    }
    const r = applyCommand(sim, player, cmd, lib)
    if (!r.ok) break
    if (first === null) first = cmd
    sim = r.state
    if (sim.phase === 'ended') {
      return sim.winner === player ? first : null
    }
  }
  return null
}

// ---------- 决策 ----------

export interface AiStepResult {
  cmd: Command
  rng: number
}

// 起手调度:留低费,但保证留下的牌能铺满前几回合的曲线。
// 全留 3 费以下会在只有高费手牌时把整手换光,反而更差。
function mulliganKeep(state: GameState, player: PlayerIdx, lib: CardLibrary): number[] {
  const hand = state.players[player].hand
  const withCost = hand.map((c) => ({ c, cost: lib[c.defId]?.cost ?? 99 }))
  const cheap = withCost.filter((x) => x.cost <= 3)
  if (cheap.length >= 2) return cheap.map((x) => x.c.iid)
  // 便宜牌不够,把最便宜的两张留下来当开局
  return withCost
    .sort((a, b) => a.cost - b.cost)
    .slice(0, Math.max(2, cheap.length))
    .map((x) => x.c.iid)
}

// 选出当前一步。调用方负责 applyCommand 并循环调用直到 EndTurn/对局结束。
export function aiStep(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  aiRng: number,
  config: AiConfig = AI_NORMAL,
): AiStepResult {
  let rng = aiRng

  if (state.phase === 'mulligan') {
    return { cmd: { type: 'Mulligan', keepIids: mulliganKeep(state, player, lib) }, rng }
  }

  if (config.lethalSearch) {
    const lethal = findLethal(state, player, lib)
    if (lethal) return { cmd: lethal, rng }
  }

  const commands = legalCommands(state, player, lib).filter((c) => c.type !== 'Concede')
  if (commands.length === 0) return { cmd: { type: 'EndTurn' }, rng }

  const scored = commands.map((cmd) => {
    const r = applyCommand(state, player, cmd, lib)
    if (!r.ok) return { cmd, score: -Infinity }
    let score = evaluate(r.state, player, lib)
    if (cmd.type === 'EndTurn') {
      // 浮费惩罚:结束回合时每点没花掉的法力都是白扔的。
      // 没有这一项,AI 会因为「出牌会掉一点手牌分」而攥着牌过回合。
      score -= 0.05 + state.players[player].mana.current * 0.18
    }
    return { cmd, score }
  })
  scored.sort((a, b) => b.score - a.score)

  let pickIndex = 0
  if (config.blunderChance > 0 && scored.length > 1) {
    const roll = rngNext(rng)
    rng = roll.next
    if (roll.value < config.blunderChance) pickIndex = 1
  }
  return { cmd: scored[pickIndex].cmd, rng }
}
