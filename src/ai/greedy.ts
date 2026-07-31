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
import { plannedStep } from './planner'
import { mctsStep } from './mcts'

export interface AiConfig {
  // 失误概率:以该概率选次优解(难度调节)
  blunderChance: number
  // 是否启用斩杀搜索。关掉之后 AI 会漏掉多步斩杀 —— 这是低难度最像人的失误。
  lethalSearch: boolean
  // 一层前瞻:评分时把「对手下回合能打我多少」算进去。见 incomingFaceDamage。
  // 只给最高难度开 —— 它是三档之间**最大**的一处差别,也是最像人的那一处。
  foresight?: boolean
  // 整回合规划(planner.ts):不再一次只看一步,而是对整个回合的命令空间做 DFS,
  // 挑「收手时局面最好」的那条线。只给军神档开 —— 它比贪心贵一个量级。
  planner?: boolean
  // 蒙特卡洛树搜索(mcts.ts):换的不是搜索深度,是**预算怎么分配**。
  // planner 的最好优先排序会把「第一步最差、三步后最好」的线永久饿死;
  // UCT 让试得少的线始终有机会被再试一次。只给天機档开。
  mcts?: boolean
  // 对抗复评(mcts.ts):把最好的几条线各推演一次对手的回合再重排。
  // 这是天機**唯一**结构上强过军神的东西 —— 实测在它之前两档没有显著差别。
  opponentReply?: boolean
  // 评分权重覆盖:同一套引擎、不同的性格(见 evaluate 的 weights 参数)。
  weights?: Partial<EvalWeights>
  // 起手调度是否按**曲线**挑,而不是无脑留 ≤3 费。
  // 从前五档共用同一个 mulliganKeep —— 天機的调度和新兵一字不差,
  // 也就是说「调度」这件事在最高档上根本没有实现。
  // 开关而不是直接改:mulliganKeep 是 AI_NORMAL 也走的路径(铁律 9)。
  smartMulligan?: boolean
  // 是否给「手里留着的牌」记跨回合价值。
  // 实测:军神与天機**从不留牌**(0.0%,127/142 次结束回合里一次都没有
  // 「还有打得出的牌但选择不打」)—— 因为 stopScore 只惩罚剩余法力,
  // 而 EvalWeights 里没有任何跨回合的项。同样用开关隔开基准尺。
  holdValue?: boolean
}

export const AI_NORMAL: AiConfig = { blunderChance: 0, lethalSearch: true }
export const AI_EASY: AiConfig = { blunderChance: 0.25, lethalSearch: false }

// 四档难度(UI 用兵法称谓:新兵/宿将/名将/军神)。
// 差别不只是失误率:新兵完全看不见多步斩杀,宿将偶尔失误,
// 名将零失误、必算斩杀、会看对手下一回合(foresight),
// 军神在名将之上再加**整回合规划** —— 它能看见「先亏一步再赚回来」的组合,
// 那是贪心结构上永远看不见的一类。
//
// **AI_NORMAL 仍然是基准尺**:sim-balance / sim-campaign 的历史数字全是拿它量的,
// 换掉就没法和过去比(见 ARCHITECTURE 铁律 9)。军神只服务真人玩家。
export const AI_LEVELS = {
  recruit: { blunderChance: 0.35, lethalSearch: false },
  veteran: { blunderChance: 0.12, lethalSearch: false },
  // 名将起开「按曲线调度」:低两档保持无脑留低费(那正是新手会犯的错)。
  general: { blunderChance: 0, lethalSearch: true, foresight: true, smartMulligan: true },
  // 军神/天機再开「留牌有价值」—— 只有走 stopScore 的这两档吃得到它
  // (贪心是一步一评,不经过 stopScore)。
  marshal: {
    blunderChance: 0,
    lethalSearch: true,
    foresight: true,
    planner: true,
    smartMulligan: true,
    holdValue: true,
  },
  // 天機。**已从玩家可选难度里下架**(见 settingsStore 的 Difficulty),
  // 但保留在这里 —— sim-ai-tiers 仍然要能测它,把它删掉等于把结论也删掉。
  //
  // 三次实测(2026-07,各 144 局,SE 4.2pp):
  //   53.5%  修 AI 之前
  //   53.5%  加了对抗复评但没接线(等于没跑)
  //   52.1%  对抗复评真的生效之后,而且慢 15%
  // 也就是说:补上「对手会怎么回应」这一层**没有让它变强**。
  //
  // 原因大概率不在 MCTS,在这个游戏本身:实测 44% 的多选决策点里
  // 最优与次优的差距不到 1 点攻击力,真正有对错之分的只有 22% ——
  // 决策深度不够,再深的搜索也搜不出东西来。
  // opponentReply 因此默认关掉(留着代码与结论,免得下次再试一遍)。
  oracle: {
    blunderChance: 0,
    lethalSearch: true,
    foresight: true,
    mcts: true,
    smartMulligan: true,
    holdValue: true,
  },
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

// 对手下回合能打到我脸上多少。
//
// 贪心 AI 最后一个大盲区:它看得见「这一步换得赚不赚」,看不见「我这样收手会不会被一波带走」。
// 表现出来就是把守护换掉去多打两点脸,然后下回合被打死 —— 每一步单看都是赚的。
//
// 刻意做成粗糙的近似,不做真搜索:
//   - 假设对手所有单位下回合都能动(疲劳/冲锋差异忽略);
//   - 守护墙按「总血量要先被啃穿」折算,不考虑谁打谁;
//   - 潜行单位算进去(它下回合照样能打)。
// 真要精确得展开对手的整个回合,分支立刻上千 —— 而这个近似已经足够
// 把「别在能被斩杀的场面上收手」这条学会,那是它 90% 的价值所在。
function incomingFaceDamage(state: GameState, player: PlayerIdx): number {
  const me = state.players[player]
  const foe = state.players[player === 0 ? 1 : 0]
  let swing = 0
  for (const unit of foe.board) swing += unit.attack * maxAttacksOf(unit)
  let guardHp = 0
  for (const unit of me.board) {
    if (unit.keywords.includes('guard')) guardHp += unit.health
  }
  return Math.max(0, swing - guardHp)
}

// 评分权重 —— 同一套引擎,不同的性格。
//
// 关底 Boss 从前只有「血更厚 + 主公技更强 + 卡组更好」三个旋钮,
// 十六个对手的**打法**是同一个:一律按贪心分数换场面。
// 权重让曹操压场、司马懿苟血、项羽只顾打脸 —— 引擎对称性一点没破,
// 变的只是那一侧 AI 眼里「什么叫局面好」。
//
// 默认值与调平衡时那套常数**逐字相同**:不传 weights 的调用点行为一字不变,
// sim-balance / sim-campaign 的历史数字继续可比。
export interface EvalWeights {
  board: number // 场面身材
  myHp: number // 自己的血(越高越苟)
  foeHp: number // 敌方的血(越高越凶)
  hand: number // 手牌资源
  // 浮费:收手时每点没花出去的法力扣多少分。
  //
  // **它只在 stopScore 里生效,不进 evaluate。** evaluate 打的是「局面好不好」,
  // 而没花的法力不是局面的一部分 —— 它是「这一步走完之后还能不能再走一步」。
  // 混进 evaluate 会让每一次中途打分都带上一笔和局面无关的偏置,
  // 而 sim-balance / sim-campaign 的全部历史数字都是拿 evaluate 量的(铁律 9)。
  //
  // 抽成权重之后它顺带成了一条**新的性格轴**:值高 = 这个 AI 见不得手里有钱,
  // 见牌就打;值低 = 它愿意攥着法力等一个更好的时机。
  mana: number
}

// 数值与抽出来之前**逐字相同**(greedy 的 EndTurn 分支与 planner 的 stopScore
// 各写过一份 `0.05 + mana * 0.18`)—— 所以这次归并对所有历史数字零影响。
export const DEFAULT_WEIGHTS: EvalWeights = {
  board: 1,
  myHp: 0.6,
  foeHp: 0.6,
  hand: 0.4,
  mana: 0.18,
}

export function evaluate(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  foresight = false,
  weights: Partial<EvalWeights> = {},
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights }
  if (state.phase === 'ended') {
    if (state.winner === player) return 1e9
    if (state.winner === 'draw') return 0
    return -1e9
  }
  const me = state.players[player]
  const foe = state.players[player === 0 ? 1 : 0]

  let score = (sideValue(me, lib) - sideValue(foe, lib)) * w.board

  const myHp = me.heroHp + me.armor
  const foeHp = foe.heroHp + foe.armor
  score += myHp * w.myHp - foeHp * w.foeHp
  // 血线非线性:掉到 10 以下时每一点都金贵,防止 AI 为了一点场面优势把自己送进斩杀线
  if (myHp <= 10) score -= (10 - myHp) * 1.2
  if (foeHp <= 10) score += (10 - foeHp) * 1.2

  // 手牌 = 资源;牌库见底则疲劳会自己咬自己
  score += (me.hand.length - foe.hand.length) * w.hand
  if (me.deck.length === 0) score -= 2
  if (foe.deck.length === 0) score += 2

  // 主公技这回合还没用 = 一份没兑现的资源
  if (me.heroPower && !me.heroPowerUsed && me.mana.current >= me.heroPower.cost) score += 0.3

  // 主公技升阶对贪心是**不可见的价值** —— 和伏兵一模一样的毛病:
  // 花掉法力,场面一点变化都没有,于是纯贪心永远不会去升,那批设计在 AI 手里等于不存在。
  // 主公技是全局触发频率最高的效果(每回合一次,一局能用三十次),
  // 所以给的持有价值比伏兵还高一档。
  score += (me.heroPowerTier ?? 0) * 4
  score -= (foe.heroPowerTier ?? 0) * 4

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

  // 一层前瞻(仅最高难度)
  if (foresight) {
    const incoming = incomingFaceDamage(state, player)
    // 连续项:留着挨打的场面本来就该扣分,幅度小于一点血本身(0.6),
    // 否则 AI 会缩回去只做防守、永远不推进。
    score -= incoming * 0.3
    // 断崖项:对手下回合就能带走我 —— 这一步无论换得多赚都不能选。
    // 量级要压过任何单步的场面收益,但远小于胜负项(1e9),
    // 免得它在真正的必死局面里连「拼一把」都不肯。
    if (incoming >= myHp) score -= 400
  }

  return score
}

// 「就此收手」的分数 —— 局面分减去浮费。
//
// 这个函数此前在两个地方各写了一份(greedy 的 EndTurn 分支、planner 的 stopScore),
// 常数一模一样却互相不知道。第三个消费者(MCTS)出现时,归并已经不是洁癖问题了:
// 三份各自漂移的话,「军神和天機谁更强」量出来的就不是搜索方式的差别,
// 而是三个人对浮费的看法的差别。
export function stopScore(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  foresight = false,
  weights: Partial<EvalWeights> = {},
  holdValue = false,
): number {
  const w = { ...DEFAULT_WEIGHTS, ...weights }
  const base = evaluate(state, player, lib, foresight, weights)
  // 那个 0.05 的常数项不是浮费,是**收手本身**的一点点代价:
  // 没有它,「结束回合」会和「打出一张零收益的牌」并列第一,取谁全看排序稳定性。
  const waste = 0.05 + state.players[player].mana.current * w.mana

  // 留牌的跨回合价值(高档专用,见 AiConfig.holdValue)。
  //
  // 【为什么需要】实测:军神与天機**从不留牌** —— 127/142 次结束回合里
  // 一次都没有「手里还有打得出的牌但选择不打」。因为这个函数只惩罚剩余法力,
  // 而 EvalWeights 里没有任何跨回合的项:憋一张解场等下回合是纯亏损。
  //
  // 【为什么只值这么一点】给留牌记分是有风险的 —— 记多了 AI 会变成
  // 「攥着一手牌不出」,那比无脑出牌更糟。这里只给**打得出却没打**的那些牌
  // 记 0.35/张(约等于三分之一点攻击力),而且封顶两张:
  // 它要表达的是「留一张应急是合理的」,不是「囤牌是好的」。
  if (!holdValue) return base - waste
  const me = state.players[player]
  let playable = 0
  for (const c of me.hand) {
    const cost = lib[c.defId]?.cost ?? 99
    if (cost - c.costDelta <= me.mana.current) playable++
  }
  return base - waste + Math.min(2, playable) * 0.35
}

// ---------- 斩杀搜索 ----------

// 本回合能打到对方脸上的总伤害。
//
// 【改过一次:守护墙不再直接判负】
// 第一版遇到守护墙就 `return null` —— 也就是说斩杀搜索**结构上看不见
// 「先清墙再斩杀」**,而那是这个游戏里最常见的一条斩杀线
// (全池 261 张带守护,六套预组每套 12 张)。
// 实测:名将档以上在对面有墙时会漏掉本可以赢的一回合。
//
// 现在的做法仍然很克制 —— 不做完整搜索,只算一笔账:
//   拆掉所有墙需要多少攻击力(按墙的**总有效血量**算),
//   剩下的攻击力够不够打脸。
// 这会**低估**自己(拆墙的单位如果打死墙还活着,下一个墙由别人拆更省),
// 也会**高估**(没考虑剧毒/铁壁这些让拆墙更便宜或更贵的因素)——
// 但方向是对的,而且宁可低估:findLethal 后面还会逐步验证一遍,
// 验不出真斩杀就退回贪心,不会打出一条错线。
function faceDamageAvailable(state: GameState, player: PlayerIdx): number | null {
  const foe = state.players[player === 0 ? 1 : 0]
  const guards = foe.board.filter(
    (c) => c.keywords.includes('guard') && !c.keywords.includes('stealth'),
  )
  let total = 0
  for (const unit of state.players[player].board) {
    if (!canAttackNow(unit)) continue
    // 突袭单位上场当回合打不到脸
    if (unit.exhausted && !unit.keywords.includes('charge')) continue
    total += unit.attack * (maxAttacksOf(unit) - unit.attacksUsed)
  }
  if (guards.length > 0) {
    // 铁壁要多挨一下才碎 —— 这一下按「墙的攻击力」估价太麻烦,
    // 按 1 点算(保守:低估自己的余力)
    const wallHp = guards.reduce(
      (n, g) => n + g.health + (g.keywords.includes('divineShield') ? 1 : 0),
      0,
    )
    total -= wallHp
  }
  return total
}

// 找一条能这回合结束对局的攻击序列。找不到返回 null。
function findLethal(state: GameState, player: PlayerIdx, lib: CardLibrary): Command | null {
  const foe = state.players[player === 0 ? 1 : 0]
  const available = faceDamageAvailable(state, player)
  if (available === null) return null
  if (available < foe.heroHp + foe.armor) return null

  // 伤害够了,验证一遍并给出第一步。
  // **先拆墙再打脸** —— 上面的估算已经把拆墙的代价扣掉了,这里要真的按那个顺序走,
  // 否则第一步就会被引擎拒(有守护时打不到脸)。
  let sim = state
  let first: Command | null = null
  const foeSeat: PlayerIdx = player === 0 ? 1 : 0
  for (let step = 0; step < 24; step++) {
    const wall = sim.players[foeSeat].board.find(
      (c) => c.keywords.includes('guard') && !c.keywords.includes('stealth'),
    )
    const attacker = sim.players[player].board.find(
      (u) => canAttackNow(u) && !(u.exhausted && !u.keywords.includes('charge')) && u.attack > 0,
    )
    if (!attacker) break
    const cmd: Command = wall
      ? { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'general', iid: wall.iid } }
      : { type: 'Attack', attackerIid: attacker.iid, target: { kind: 'hero', player: foeSeat } }
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

// 按曲线调度(高档专用)。
//
// 上面那个「留 ≤3 费」的问题是它**不看已经留了几张同费的牌** ——
// 一手四张 2 费会全留,于是第 4、5 回合无牌可打。
// 这里改成给每个费位设配额:1-2 费各留 2 张、3 费留 2 张、4 费留 1 张,
// 5 费以上一律换掉(留一张也打不出,前六回合根本到不了)。
// 配额之外的同费牌换掉 —— 换回来的期望比手上第三张 2 费高。
function mulliganKeepByCurve(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
): number[] {
  const hand = state.players[player].hand
  const QUOTA: Record<number, number> = { 1: 2, 2: 2, 3: 2, 4: 1 }
  const used: Record<number, number> = {}
  const keep: number[] = []
  // 先按费用升序 —— 同费位内优先留先抽到的那张(顺序确定,不引入随机)
  const sorted = hand
    .map((c) => ({ c, cost: lib[c.defId]?.cost ?? 99 }))
    .sort((a, b) => a.cost - b.cost)
  for (const { c, cost } of sorted) {
    const quota = QUOTA[cost] ?? 0
    if ((used[cost] ?? 0) < quota) {
      used[cost] = (used[cost] ?? 0) + 1
      keep.push(c.iid)
    }
  }
  // 一张都没留住(全是 5 费以上)时退回旧规则,别把整手换光 ——
  // 换回来的还是同一个牌库,空手比一张贵牌更糟。
  return keep.length > 0 ? keep : mulliganKeep(state, player, lib)
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
    const keep = config.smartMulligan
      ? mulliganKeepByCurve(state, player, lib)
      : mulliganKeep(state, player, lib)
    return { cmd: { type: 'Mulligan', keepIids: keep }, rng }
  }

  // 发现挂起:evaluate 看不见手牌里具体是哪张牌(只数张数),所以不能靠通用打分选。
  // 用一个便宜的代理:挑费用最高的那张(费用是身材/效果的总量,粗糙但方向对)。
  // options 里可能有引擎不认识的 defId 兜底成 -1,永远排在最后。
  if (state.pendingChoice && state.pendingChoice.player === player) {
    const opts = state.pendingChoice.options
    let best = 0
    for (let i = 1; i < opts.length; i++) {
      if ((lib[opts[i]]?.cost ?? -1) > (lib[opts[best]]?.cost ?? -1)) best = i
    }
    return { cmd: { type: 'ResolveChoice', index: best }, rng }
  }

  // 天機:蒙特卡洛树搜索。和军神一样,斩杀是它的一个特例,不必再单独搜。
  if (config.mcts) {
    return {
      cmd: mctsStep(state, player, lib, {
        foresight: config.foresight === true,
        weights: config.weights,
        holdValue: config.holdValue === true,
        opponentReply: config.opponentReply === true,
      }),
      rng,
    }
  }

  // 军神:整回合规划。斩杀是它的一个特例(赢 = 1e9,自然是最大值),
  // 所以这里不再单独跑 findLethal —— 跑了也只是重复一遍它已经会算的东西。
  if (config.planner) {
    return {
      cmd: plannedStep(state, player, lib, {
        foresight: config.foresight === true,
        weights: config.weights,
        holdValue: config.holdValue === true,
      }),
      rng,
    }
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
    let score = evaluate(r.state, player, lib, config.foresight === true, config.weights)
    if (cmd.type === 'UpgradeHeroPower') {
      // 升阶是**投资**:这一步一点场面都不改,却花掉一大笔法力。
      // evaluate 看不见法力(它只看局面),所以不在这里显式收一次机会成本的话,
      // 升阶在 AI 眼里就是白送的分数 —— 实测它会在刚够钱的那个回合无脑升,
      // 把 sim-balance 的矩阵打出一个 25% 的极化对位。
      //
      // 收 0.6/点:5 费升阶净得 +1,而同样 5 费的一张牌大约值 +9 ——
      // 于是 AI 只在「这笔法力没有更好去处」时才升,这正是人类的判断。
      score -= Math.max(0, state.players[player].heroPower?.upgradeCost ?? 0) * 0.6
    }
    if (cmd.type === 'EndTurn') {
      // 浮费惩罚:结束回合时每点没花掉的法力都是白扔的。
      // 没有这一项,AI 会因为「出牌会掉一点手牌分」而攥着牌过回合。
      // 系数在 DEFAULT_WEIGHTS.mana(与 planner / MCTS 共用一份定义)。
      score -= 0.05 + state.players[player].mana.current * (config.weights?.mana ?? DEFAULT_WEIGHTS.mana)
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
