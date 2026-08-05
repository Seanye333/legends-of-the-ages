// 自动定价 —— 用一把统一的尺子量整个卡池,报告偏离最大的那些卡。
// 运行:npm run price-cards(TOP=列出前几张,默认 20)
//
// 【它不是「正确的费用」】
// 一张卡的真实强度取决于它和别的卡怎么配合,而那件事只有 sim-balance / sim-cards
// 那种真打得出来。这个脚本量的是**卡面本身值多少** —— 身材加上写在卡面上的效果。
//
// 那它有什么用?它是**唯一能扫全池**的工具。sim-cards 一次只测得动几十张
// (60 局/张,31 秒),而卡池有两千多张;真正的漏网之鱼往往不是「强了 5%」,
// 而是「这张 2 费的怎么写着 5 费的效果」——那种偏差在纸面上就看得见,
// 根本不需要打一局。
//
// 【尺子从哪来】
// 不拍脑袋:用**卡池自己的中位数**回归出来。
//   1. 先算每张卡的「原始价值」= 身材当量 + 效果当量;
//   2. 按费用分组,取每组价值的中位数,得到一条「这个费用档正常长什么样」的曲线;
//   3. 一张卡的定价偏差 = 它落在哪一档 vs 它标着几费。
// 于是曲线随卡池演化自动更新,不需要有人去维护一张手写的价目表。
//
// 【为什么不做成闸门】
// 偏差大不等于错。传奇本来就该超模,build-around 的卡面价值本来就低
// (它的价值在配合里)。把它做成 CI 红线只会逼着大家去糊弄这把尺子。
// 它是一张**给人看的**清单。
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import type { CardDef, EffectOp, EffectScript } from '../src/engine/types'

const TOP = Number(process.env.TOP ?? 20)

// 身材当量。和 ai/greedy 的 unitValue 同一套基准(1 攻 = 1.0,1 血 = 0.8),
// 刻意保持一致 —— 两个地方对「这个身材值多少」的看法不一致会非常难查。
function bodyValue(c: CardDef): number {
  if (c.type === 'general') return (c.attack ?? 0) * 1 + (c.health ?? 0) * 0.8
  // 装备:attack/health 是**给持有者的加成**,不是它自己的身材。
  // 第一版把非武将一律记 0 分,于是七件装备整整齐齐排在「疑似过弱」榜首 ——
  // 那不是卡池的问题,是尺子的问题。
  // 打 0.85 折:它要求场上先有人(空场时是一张死牌),而且加成会跟着那个人一起死。
  if (c.type === 'equipment') {
    const gain = (c.attack ?? 0) * 1 + (c.health ?? 0) * 0.8
    // 傳承:持有者阵亡时改挂给别人 —— 正好抵消上面那半个风险
    return gain * (c.heirloom ? 1.0 : 0.85)
  }
  return 0
}

const KEYWORD_VALUE: Record<string, number> = {
  guard: 1.2,
  charge: 0.8,
  rush: 0.5,
  windfury: 1.4,
  lifesteal: 0.7,
  poison: 1.6,
  divineShield: 1.8,
  stealth: 0.6,
  trample: 0.7,
  duel: 0.5,
}

// 下面那张定价表没覆盖到的 op,跑完在末尾点名(见 opValue 的 default 分支)
const UNPRICED = new Set<string>()

// 一个 op 值多少「点」。1 点 ≈ 1 点攻击 ≈ 1.25 点生命。
// 数值取自同类卡的实际定价(例如「造成 3 点伤害」的锦囊普遍 2 费,
// 而 2 费的白板身材大约 5.4 点当量 → 每点伤害约 1.5)。
function opValue(op: EffectOp): number {
  switch (op.op) {
    case 'damage':
      return op.amount * (op.target === 'enemyHero' ? 1.1 : 1.5)
    case 'aoeDamage':
    case 'damageAll':
      return op.amount * 3.2 // 群体:按「平均打到两个」折
    case 'damagePer':
      return op.amount * 3
    case 'heal':
      return op.amount * 0.7
    case 'draw':
      return op.count * 2.2
    case 'buffStats':
      return (op.attack + op.health * 0.8) * (op.duration === 'endOfTurn' ? 0.45 : 1.1)
    case 'buffPer':
      return (op.attack + op.health * 0.8) * 2.2
    case 'destroy':
      return 5
    case 'banish':
      return 5.5
    case 'silence':
      return 2
    case 'freeze':
      return 1.6
    case 'seize':
      return 6
    case 'transform':
      return 4.5
    case 'resurrect':
      return op.count * 4
    case 'recruit':
      return op.count * 3.5
    case 'summon':
      return op.count * 2.5
    case 'summonForEnemy':
      return -op.count * 2.5
    case 'copyGeneral':
      return 4
    case 'tutor':
      return op.count * 2.8
    case 'addToHand':
      return op.count * 1.8
    case 'discover':
      return 2.6
    case 'stealCard':
      return op.count * 2.6
    case 'discardRandom':
      return op.count * 1.8
    case 'returnToHand':
      return 2.4
    case 'grantKeyword':
      return (KEYWORD_VALUE[op.keyword] ?? 1) * (op.duration === 'endOfTurn' ? 0.5 : 1)
    case 'gainArmor':
      return op.amount * 0.7
    case 'gainMana':
      return op.amount * (op.temporary ? 1.0 : 2.4)
    case 'swapStats':
      return 1.5
    case 'reduceCost':
      return op.amount * 1.6
    case 'setField':
      return 3
    // ---- 第二十一卡包 ----
    case 'gainMorale':
      // 士气过线才产生效果(全场 ±1 攻),所以一点士气的期望价值低于一点身材
      return Math.abs(op.amount) * 1.3
    case 'gainSupply':
      return op.amount * 0.8

    // ---- 第二十二卡包:牌库、驱散、借将 ----
    // 下面五条 2026-08-04 补,此前全部落进 default 拿 0 分(见那一段)。
    // 定价一律对标表里已有的锚:伤害 1 点 = 1.5 · 抽 1 张 = 2.2 · 沉默 = 2 ·
    // 弃 1 张手牌 = 1.8 · 永久夺取 = 6。
    case 'mill':
      // 磨牌**不补疲劳伤害**(见 types 的说明),所以它不是伤害,是「拨快对方的疲劳计时器」。
      // 比弃手牌(1.8)轻:弃掉的是他现在就想用的东西,磨掉的是他若干回合后才会摸到的。
      // 磨自己一般是代价而非收益(自磨流另算,那种卡的价值在配合里,这把尺子本来就量不到)。
      return op.count * (op.side === 'friendly' ? 0.2 : 0.9)
    case 'shuffleIntoDeck':
      // 与 addToHand(1.8/张)同类但**延迟且位置随机**:塞给对手的废牌不占他的手牌,
      // 占的是他之后的每一次抽牌。打个七折。
      // 注:这里不去查 defId 到底洗进去的是什么牌 —— 那要递归定价一张卡,
      // 而这把尺子量的是「写在卡面上的效果」,够用即可。
      return op.count * 1.2
    case 'dispel':
      // 沉默(2)的精确版:只摘附魔,不封亡语、不清卡面关键词。
      // 能干的事更少,但**不会误伤自家亡语**,所以不是简单的打折 —— 定在略低于沉默。
      return 1.2
    case 'borrow':
      // 永久夺取 seize = 6;借将只借一个回合(回合结束归还)。
      // 拿到的是「这一次冲锋 + 对方这一回合少一个挡刀的」,约等于夺取的一半不到。
      return 2.8
    case 'delay':
      // 伏笔的价值 = 载荷的价值,按约期打折。每等一个我方回合折 0.85 ——
      // 延迟既是代价(对手看得见、有时间准备)也偶尔是收益(过牌节奏),这里只算代价。
      return scriptValue(op.script, Math.pow(0.85, op.turns))

    default:
      // 【这里从前是「没有 default,直接走到函数末尾」】
      // 于是没定价的 op 返回 undefined,scriptValue 里 `n + undefined` 得到 **NaN**,
      // 而 NaN 会一路往上渗:那张卡的价值是 NaN,它所在费用档的中位数
      // (要排序取中位)也跟着不可信,而整张报表正是拿这条曲线反推「应该几费」的。
      // 关键是 **NaN 的比较永远是 false**,所以这种污染不会报错、不会崩、
      // 也不会在输出里长得像个错误 —— 这正是本仓库最贵的那一类 bug(静默失效)。
      // 实测漏了 5 个:borrow · delay · dispel · mill · shuffleIntoDeck,
      // 全是第二十二卡包前后加的 op,加进引擎时没人回头补这张表。
      // 现在记 0 分,但把 op 名字收集起来在末尾点名 ——
      // 定价缺失可以接受(带它们的卡会被低估成「过弱」),悄无声息不行。
      UNPRICED.add((op as { op: string }).op)
      return 0
  }
}

function scriptValue(s: EffectScript | undefined, discount = 1): number {
  if (!s) return 0
  // 带条件的效果按打折算:条件不满足时它一分钱都不值
  const cond = s.condition ? 0.75 : 1
  return s.ops.reduce((n, op) => n + opValue(op), 0) * discount * cond
}

function cardValue(c: CardDef): number {
  let v = bodyValue(c)
  for (const kw of c.keywords) v += KEYWORD_VALUE[kw] ?? 0.5
  v += scriptValue(c.battlecry)
  v += scriptValue(c.spell)
  // 亡语打折:对手可以选择不去碰它,而且它兑现得晚
  v += scriptValue(c.deathrattle, 0.7)
  // 每回合触发:一局能触发好几次,但要求它活着
  v += scriptValue(c.endOfTurn, 1.8)
  v += scriptValue(c.startOfTurn, 1.8)
  v += scriptValue(c.onAttack, 1.2)
  v += scriptValue(c.onDamaged, 0.9)
  v += scriptValue(c.onSpellCast, 1.4)
  // 连击/抉择取两条路里更值钱的那条(玩家会挑)
  v += scriptValue(c.combo) * 0.5
  if (c.choose) v += Math.max(...c.choose.modes.map((m) => scriptValue(m.script)))
  if (c.secret) v += scriptValue(c.secret.script, 0.8)
  if (c.aura) v += (c.aura.attack + c.aura.health * 0.8) * 2.2
  if (c.bond) v += (c.bond.attack + c.bond.health * 0.8) * 1.2
  if (c.rival) v += (c.rival.attack + c.rival.health * 0.8) * 0.8
  if (c.formation) v += (c.formation.attack + c.formation.health * 0.8) * 1.5
  if (c.enrage) v += c.enrage * 0.8
  if (c.spellDamage) v += c.spellDamage * 1.4
  // 过载是下回合的债;军需是另一条资源线上的开销
  v -= (c.overload ?? 0) * 1.1
  v -= (c.supplyCost ?? 0) * 0.9
  return v
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const a = [...xs].sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

const cards = COLLECTIBLE_CARDS.filter((c) => !c.token)
const valueOf = new Map(cards.map((c) => [c.id, cardValue(c)]))

// 曲线:每个费用档的中位价值
const byCost = new Map<number, number[]>()
for (const c of cards) {
  const list = byCost.get(c.cost) ?? []
  list.push(valueOf.get(c.id)!)
  byCost.set(c.cost, list)
}
const costs = [...byCost.keys()].sort((a, b) => a - b)

// 曲线必须**单调不减**:高费档卡少(10 费只有个位数),中位数会出现
// 「9 费比 10 费还高」这种由样本量造成的回摆。不修的话最近邻反查会把一大票
// 6 费卡判成 10 费 —— 第一版就是这么输出的,榜单整页都是 +4。
// 取前缀最大值:它保留了曲线的形状,只压掉回摆。
const rawCurve = new Map(costs.map((k) => [k, median(byCost.get(k)!)]))
const curve = new Map<number, number>()
{
  let running = -Infinity
  for (const k of costs) {
    running = Math.max(running, rawCurve.get(k)!)
    curve.set(k, running)
  }
}

console.log('费用曲线(每档的中位卡面价值):')
for (const k of costs) {
  const n = byCost.get(k)!.length
  console.log(`  ${String(k).padStart(2)} 费  中位 ${curve.get(k)!.toFixed(1).padStart(6)}  (${n} 张)`)
}

// 反查:一个价值落在哪个费用档。
// **线性插值而不是最近邻** —— 最近邻在两档间距很宽的地方(高费段)会把
// 一大片价值都吸到同一档上,输出全是同一个数字,读不出差别。
function impliedCost(v: number): number {
  if (v <= curve.get(costs[0])!) return costs[0]
  for (let i = 1; i < costs.length; i++) {
    const lo = costs[i - 1]
    const hi = costs[i]
    const vlo = curve.get(lo)!
    const vhi = curve.get(hi)!
    if (v <= vhi) {
      if (vhi === vlo) return lo
      return Math.round(lo + ((v - vlo) / (vhi - vlo)) * (hi - lo))
    }
  }
  return costs[costs.length - 1]
}

interface Row {
  card: CardDef
  value: number
  implied: number
  delta: number
}
const rows: Row[] = cards.map((c) => {
  const value = valueOf.get(c.id)!
  const implied = impliedCost(value)
  return { card: c, value, implied, delta: implied - c.cost }
})

const pad = (s: string, n: number) => {
  // 中文字宽按 2 算,否则列对不齐
  const w = [...s].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)
  return s + ' '.repeat(Math.max(0, n - w))
}

const show = (title: string, list: Row[]) => {
  console.log(`\n${title}`)
  for (const r of list.slice(0, TOP)) {
    console.log(
      `  ${pad(r.card.name.zh, 16)} ${String(r.card.cost).padStart(2)} 费  ` +
        `卡面价值 ${r.value.toFixed(1).padStart(6)}  ≈ ${r.implied} 费  ` +
        `(${r.delta > 0 ? '+' : ''}${r.delta})  ${r.card.rarity}`,
    )
  }
}

show(
  `疑似超模(卡面价值高于标价)—— 前 ${TOP}:`,
  rows.filter((r) => r.delta > 0).sort((a, b) => b.delta - a.delta || b.value - a.value),
)
show(
  `疑似过弱(卡面价值低于标价)—— 前 ${TOP}:`,
  rows.filter((r) => r.delta < 0).sort((a, b) => a.delta - b.delta || a.value - b.value),
)

const off = rows.filter((r) => Math.abs(r.delta) >= 2).length
console.log(
  `\n全池 ${cards.length} 张,偏离 2 费及以上的 ${off} 张(${((off / cards.length) * 100).toFixed(1)}%)。`,
)
console.log(
  '这不是错误清单:传奇本来就该超模,build-around 的卡面价值本来就低(它的价值在配合里)。\n' +
    '拿它当**线索**,真正的判断仍然要跑 sim-cards / sim-balance。',
)

if (UNPRICED.size > 0) {
  console.log(
    `\n⚠ 有 ${UNPRICED.size} 个 op 还没进定价表,这一轮按 0 分计 —— ` +
      `带这些 op 的卡会被系统性低估(看起来「过弱」):\n  ${[...UNPRICED].sort().join(' · ')}\n` +
      `  补进 scripts/price-cards.ts 的 opValue 即可。`,
  )
}
