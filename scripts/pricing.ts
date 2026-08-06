// 定价模型本体 —— 从 price-cards.ts 里抽出来的纯函数部分。
//
// 【为什么要抽出来】
// 从前这套逻辑长在 price-cards.ts 的顶层:import 它就等于跑一遍全池、打印一整页报表。
// 于是它**没有一行测试**,也没法被第二个脚本复用 —— 而这套公式恰恰是本仓库里
// 唯一一把能扫全池的尺子,它自己错了没人会知道(见 ARCHITECTURE 铁律 11)。
// 抽出来之后:price-cards.ts 只管排版和打印,fit-price.ts 拿它跟实测 Δ 对拟合,
// pricing.test.ts 直接钉住那几条最容易在重构里被改坏的性质。
import type { CardDef, EffectOp, EffectScript } from '../src/engine/types'

// 身材当量。和 ai/greedy 的 unitValue 同一套基准(1 攻 = 1.0,1 血 = 0.8),
// 刻意保持一致 —— 两个地方对「这个身材值多少」的看法不一致会非常难查。
export function bodyValue(c: CardDef): number {
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

export const KEYWORD_VALUE: Record<string, number> = {
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

/**
 * 一个 op 值多少「点」。1 点 ≈ 1 点攻击 ≈ 1.25 点生命。
 *
 * 【这些数字从哪来 —— 读之前先看这一段】
 * 第一版的注释写着「数值取自同类卡的实际定价」。那是一个**闭环**:
 * 卡池里某一类效果整体定价偏低时,这张表会忠实地把偏差学过来,再拿去给新卡定价,
 * 于是偏差自我复制,而且永远不会暴露 —— 用它自己量自己,结果当然是「都在曲线上」。
 *
 * 所以这张表被抽成了**数据**(而不是散落在 switch 里的字面量):
 * scripts/fit-price.ts 可以拿任意一组权重去跑全池,和 sim-cards 的实测 Δ 求秩相关,
 * 于是「改完有没有变准」第一次有了可证伪的答案。改数值请先跑 npm run fit-price。
 */
export interface Weights {
  /** 伤害:每点,目标是随从 */
  damage: number
  /** 伤害:每点,目标是敌方主公(打脸比解场便宜) */
  damageFace: number
  /** 群体伤害:每点(按「平均打到两个」折) */
  aoeDamage: number
  damagePer: number
  heal: number
  draw: number
  /** 永久增益的身材当量乘子 */
  buffStats: number
  /** 只到回合结束的增益乘子 */
  buffStatsTemp: number
  buffPer: number
  destroy: number
  banish: number
  silence: number
  freeze: number
  seize: number
  transform: number
  resurrect: number
  recruit: number
  summon: number
  copyGeneral: number
  tutor: number
  addToHand: number
  discover: number
  stealCard: number
  discardRandom: number
  returnToHand: number
  /** 只到回合结束的关键词乘子 */
  grantKeywordTemp: number
  gainArmor: number
  gainMana: number
  gainManaTemp: number
  swapStats: number
  reduceCost: number
  setField: number
  gainMorale: number
  gainSupply: number
  /** 磨对方的牌库:每张 */
  millEnemy: number
  /** 磨自己:一般是代价而非收益 */
  millSelf: number
  shuffleIntoDeck: number
  dispel: number
  borrow: number
  /** 伏笔:每推迟一个我方回合乘这个数 */
  delayDecay: number
}

/**
 * 【2026-08-05:第一次拿实测量过这张表,但**数值没有落地** —— 读完这一段再动它】
 *
 * `sim-cards` 扫了全池 2416 张 × 60 局(101 分钟),每张的 Δ 是「把它换进对应主义的
 * 预组之后,胜率相对没换的同一套牌动了多少」。拿它当真值,这张表**确实偏了**,
 * 而且偏得有规律(下面每个 op 后面括号里的 n 和 z 就是那次实测):
 *
 *   抢节奏 / 解场 / 过牌被**低估** —— returnToHand +10.0(z=8.9)· aoeDamage +8.6 ·
 *   damage +4.0(n=247, z=7.0)· tutor +3.4 · reduceCost +3.7 · recruit +7.4
 *   加身材 / 回血 / 护甲 / 铺场被**高估** —— gainSupply −1.4 · gainArmor −0.8 ·
 *   summon −1.0 · heal −1.1 · discover −1.5 · borrow −4.8 · swapStats −4.6
 *   而 draw(209 张)· buffStats(182 张)· freeze · silence · stealCard 落在噪声里,
 *   **这几个原来就定得准**。
 *
 * `npm run fit-price` 把「照这份实测改一版」做成了可证伪的流程,并且它过了关:
 * 选 op、定尺度、定改动量三步全部只用一半的卡,另一半从头到尾没参与,
 * 在那一半上秩相关 ρ 0.220 → 0.278(Δ +0.058,Steiger 相依检验 z = 2.95)。
 *
 * **那为什么还没改?** 因为改完之后 `price-cards` 这份报表**变难用了**:
 * 偏离 2 费及以上的从 200 张涨到 574 张(8.3% → 23.8%),榜首整页都是低费伤害锦囊。
 * 根子在于这次校准**只量了效果,没量身材** —— 身材那把尺(1 攻 = 1 点、1 血 = 0.8)
 * 不在这张表里,回归给身材估出来的系数是负的(纯噪声,已被守卫拦下)。
 * 于是效果整体涨了三倍而费用曲线(由以身材为主的中位卡决定)几乎没动,
 * 每张带效果的牌就都显得超模。
 *
 * 也就是说:**op 之间的相对次序是有证据的,效果与身材之间的总体比例没有。**
 * 而后者恰恰是改完变化最大的东西。要落地得先回答「一点攻击到底值多少胜率」,
 * 那需要一批只改身材的对照卡,现在没有。
 *
 * 在那之前,把这份实测当**线索**用(哪几类效果被系统性看错了),
 * 而不是当新数值。跑 `npm run fit-price` 可以看到完整的建议表。
 *
 * ⚠️ 还有一层:**这把尺子是贪心 AI**,它对两类东西系统性低估(铁律 8)——
 * 防守向(治疗 / 护甲 / 屯粮;先手补偿那一轮实测 6 点护甲只值 4.2pp,不到一张牌的一半),
 * 以及靠**选择**产生价值的(发现 / 借将 —— AI 选得差,就量不出那份价值)。
 * 上面那串负号里有一大半正好落在这两类上,别照单全收。
 */
export const DEFAULT_WEIGHTS: Weights = {
  damage: 1.5, //            (n=247, z=+7.0 实测偏低,未落地 —— 见上)
  damageFace: 1.1,
  aoeDamage: 3.2, //         (n=30,  z=+5.8 实测偏低)
  damagePer: 3,
  heal: 0.7, //              (n=119, z=−2.5 实测偏高,但正是 AI 的盲区)
  draw: 2.2, //              (n=209, z=+1.8 落在噪声里 —— 原来就定得准)
  buffStats: 1.1, //         (n=182, z=+0.8 落在噪声里)
  buffStatsTemp: 0.45,
  buffPer: 2.2, //           (n=21,  z=+2.7 实测偏低)
  destroy: 5, //             (n=8,   z=+3.4 实测偏低,样本小)
  banish: 5.5, //            全池只有 1 张卡在用,量不出来
  silence: 2, //             (n=43,  z=−1.3 落在噪声里)
  freeze: 1.6, //            (n=38,  z=−0.7 落在噪声里)
  seize: 6, //               (n=6,   z=+5.1 实测偏低,只有六张)
  transform: 4.5, //         全池只有 2 张卡在用
  resurrect: 4, //           (n=6,   z=+2.0 刚好没过线)
  recruit: 3.5, //           (n=11,  z=+3.0 实测偏低)
  summon: 2.5, //            (n=152, z=−2.7 实测偏高)
  copyGeneral: 4,
  tutor: 2.8, //             (n=102, z=+3.7 实测偏低)
  addToHand: 1.8, //         全池只有 1 张卡在用,量不出来
  discover: 2.6, //          (n=53,  z=−2.1 实测偏高,但价值在「选」上,AI 选得差)
  stealCard: 2.6, //         (n=38,  z=+0.5 落在噪声里)
  discardRandom: 1.8, //     (n=19,  z=+2.6 实测偏低)
  returnToHand: 2.4, //      (n=51,  z=+8.9 **全表最强的单条信号**,实测偏低)
  grantKeywordTemp: 0.5, //  grantKeyword 的主体是 KEYWORD_VALUE(不在这张表里),
  //                         只动这一支等于把结论全按到「短效」上,所以 fit-price 整个跳过它
  gainArmor: 0.7, //         (n=193, z=−2.7 实测偏高,但正是 AI 的盲区)
  gainMana: 2.4, //          (n=33,  z=−2.2 实测偏高)
  gainManaTemp: 1.0,
  swapStats: 1.5, //         (n=23,  z=−3.3 实测偏高)
  reduceCost: 1.6, //        (n=41,  z=+2.6 实测偏低)
  setField: 3,
  // ---- 第二十一卡包 ----
  // 士气过线才产生效果(全场 ±1 攻),所以一点士气的期望价值低于一点身材
  gainMorale: 1.3, //        (n=109, z=+1.8 刚好没过线)
  gainSupply: 0.8, //        (n=145, z=−3.2 实测偏高,和护甲同一类盲区)
  // ---- 第二十二卡包:牌库、驱散、借将 ----
  // 下面六条 2026-08-04 补,此前全部落进 default 拿 0 分(见 opValue 的 default 分支)。
  // 定价一律对标表里已有的锚(伤害 1 点 = 1.5 · 抽 1 张 = 2.2 · 沉默 = 2 ·
  // 弃 1 张手牌 = 1.8 · 永久夺取 = 6)—— 而 2026-08-05 的实测说其中几个锚本身就偏低,
  // 所以这几条多半跟着一起偏低(只有 borrow 有自己的实测)。
  //
  // 磨牌**不补疲劳伤害**(见 types 的说明),所以它不是伤害,是「拨快对方的疲劳计时器」。
  // 比弃手牌(1.8)轻:弃掉的是他现在就想用的东西,磨掉的是他若干回合后才会摸到的。
  millEnemy: 0.9,
  // 磨自己一般是代价而非收益(自磨流另算,那种卡的价值在配合里,这把尺子本来就量不到)
  millSelf: 0.2,
  // 与 addToHand(1.8/张)同类但**延迟且位置随机**:塞给对手的废牌不占他的手牌,
  // 占的是他之后的每一次抽牌。打个七折。
  // 注:这里不去查 defId 到底洗进去的是什么牌 —— 那要递归定价一张卡,
  // 而这把尺子量的是「写在卡面上的效果」,够用即可。
  shuffleIntoDeck: 1.2,
  // 沉默(2)的精确版:只摘附魔,不封亡语、不清卡面关键词。
  // 能干的事更少,但**不会误伤自家亡语**,所以不是简单的打折 —— 定在略低于沉默。
  dispel: 1.2,
  // 永久夺取 seize = 6;借将只借一个回合(回合结束归还)。
  // 拿到的是「这一次冲锋 + 对方这一回合少一个挡刀的」,约等于夺取的一半不到。
  // (n=15, z=−2.8 实测说远不止「不到一半」—— 带借将的卡整体弱于全池 4.8pp。
  //  但它和发现同一类:价值在**怎么用那一个回合**,而贪心 AI 用不出来。)
  borrow: 2.8,
  // 伏笔的价值 = 载荷的价值,按约期打折。
  // 延迟既是代价(对手看得见、有时间准备)也偶尔是收益(过牌节奏),这里只算代价。
  delayDecay: 0.85,
}

/**
 * `unpriced` 是个可选的收集袋:定价表没覆盖到的 op 会把名字丢进去,
 * 由调用方在报表末尾点名(见 default 分支)。
 */
export function opValue(op: EffectOp, unpriced?: Set<string>, w: Weights = DEFAULT_WEIGHTS): number {
  switch (op.op) {
    case 'damage':
      return op.amount * (op.target === 'enemyHero' ? w.damageFace : w.damage)
    case 'aoeDamage':
    case 'damageAll':
      return op.amount * w.aoeDamage
    case 'damagePer':
      return op.amount * w.damagePer
    case 'heal':
      return op.amount * w.heal
    case 'draw':
      return op.count * w.draw
    case 'buffStats':
      return (op.attack + op.health * 0.8) * (op.duration === 'endOfTurn' ? w.buffStatsTemp : w.buffStats)
    case 'buffPer':
      return (op.attack + op.health * 0.8) * w.buffPer
    case 'destroy':
      return w.destroy
    case 'banish':
      return w.banish
    case 'silence':
      return w.silence
    case 'freeze':
      return w.freeze
    case 'seize':
      return w.seize
    case 'transform':
      return w.transform
    case 'resurrect':
      return op.count * w.resurrect
    case 'recruit':
      return op.count * w.recruit
    case 'summon':
      return op.count * w.summon
    case 'summonForEnemy':
      return -op.count * w.summon
    case 'copyGeneral':
      return w.copyGeneral
    case 'tutor':
      return op.count * w.tutor
    case 'addToHand':
      return op.count * w.addToHand
    case 'discover':
      return w.discover
    case 'stealCard':
      return op.count * w.stealCard
    case 'discardRandom':
      return op.count * w.discardRandom
    case 'returnToHand':
      return w.returnToHand
    case 'grantKeyword':
      return (KEYWORD_VALUE[op.keyword] ?? 1) * (op.duration === 'endOfTurn' ? w.grantKeywordTemp : 1)
    case 'gainArmor':
      return op.amount * w.gainArmor
    case 'gainMana':
      return op.amount * (op.temporary ? w.gainManaTemp : w.gainMana)
    case 'swapStats':
      return w.swapStats
    case 'reduceCost':
      return op.amount * w.reduceCost
    case 'setField':
      return w.setField
    case 'gainMorale':
      return Math.abs(op.amount) * w.gainMorale
    case 'gainSupply':
      return op.amount * w.gainSupply
    case 'mill':
      return op.count * (op.side === 'friendly' ? w.millSelf : w.millEnemy)
    case 'shuffleIntoDeck':
      return op.count * w.shuffleIntoDeck
    case 'dispel':
      return w.dispel
    case 'borrow':
      return w.borrow
    case 'delay':
      return scriptValue(op.script, Math.pow(w.delayDecay, op.turns), unpriced, w)

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
      unpriced?.add((op as { op: string }).op)
      return 0
  }
}

export function scriptValue(
  s: EffectScript | undefined,
  discount = 1,
  unpriced?: Set<string>,
  w: Weights = DEFAULT_WEIGHTS,
): number {
  if (!s) return 0
  // 带条件的效果按打折算:条件不满足时它一分钱都不值
  const cond = s.condition ? 0.75 : 1
  return s.ops.reduce((n, op) => n + opValue(op, unpriced, w), 0) * discount * cond
}

export function cardValue(
  c: CardDef,
  unpriced?: Set<string>,
  w: Weights = DEFAULT_WEIGHTS,
): number {
  const sv = (s: EffectScript | undefined, d = 1) => scriptValue(s, d, unpriced, w)
  let v = bodyValue(c)
  for (const kw of c.keywords) v += KEYWORD_VALUE[kw] ?? 0.5
  v += sv(c.battlecry)
  v += sv(c.spell)
  // 亡语打折:对手可以选择不去碰它,而且它兑现得晚
  v += sv(c.deathrattle, 0.7)
  // 每回合触发:一局能触发好几次,但要求它活着
  v += sv(c.endOfTurn, 1.8)
  v += sv(c.startOfTurn, 1.8)
  v += sv(c.onAttack, 1.2)
  v += sv(c.onDamaged, 0.9)
  v += sv(c.onSpellCast, 1.4)
  // 连击/抉择取两条路里更值钱的那条(玩家会挑)
  v += sv(c.combo) * 0.5
  if (c.choose) v += Math.max(...c.choose.modes.map((m) => sv(m.script)))
  if (c.secret) v += sv(c.secret.script, 0.8)
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

/**
 * 卡池里**没有任何一张卡**在使用的权重。
 *
 * 这是 UNPRICED 的镜像:UNPRICED 抓的是「卡里有、表里没有」(那些卡被系统性低估),
 * 这里抓的是「表里有、卡里没有」—— 一个没有任何卡行使的数字。
 * 它不会让报表出错,但它是**在假装被校准过**:price-cards 的曲线量不到它,
 * fit-price 的回归也解不出它(那一列全是 0)。写下来比藏着好。
 *
 * `lint-content` 的 thin-mechanic 抓不到这一类,因为它按 op 名字数卡,
 * 而这里的粒度更细:`mill` 有卡在用,但 `side='friendly'` 那一支一张都没有。
 */
export function unusedWeights(cards: CardDef[]): (keyof Weights)[] {
  const out: (keyof Weights)[] = []
  for (const k of Object.keys(DEFAULT_WEIGHTS) as (keyof Weights)[]) {
    // 把这个权重挪开一大截:有卡在用的话,它的卡面价值一定跟着动。
    const probe: Weights = { ...DEFAULT_WEIGHTS, [k]: DEFAULT_WEIGHTS[k] * 100 + 7 }
    const used = cards.some(
      (c) => Math.abs(cardValue(c, undefined, probe) - cardValue(c, undefined, DEFAULT_WEIGHTS)) > 1e-9,
    )
    if (!used) out.push(k)
  }
  return out
}

/**
 * 一张卡用到了哪些 op(去重)。
 *
 * sim-cards 的按效果归组和 fit-price 的归组版必须用**同一份**定义 ——
 * 两边各写一遍的话,有一天一边加了新触发时机、另一边没加,
 * 于是两份报表对同一张卡的归属悄悄分叉,而且谁都不会红。
 */
export function opsOf(c: CardDef): string[] {
  const found = new Set<string>()
  const scan = (s?: { ops?: Array<{ op: string }> }) => {
    for (const o of s?.ops ?? []) found.add(o.op)
  }
  const anyC = c as unknown as Record<string, { ops?: Array<{ op: string }> } | undefined>
  for (const k of [
    'battlecry', 'spell', 'deathrattle', 'endOfTurn', 'startOfTurn',
    'onAttack', 'onDamaged', 'onSpellCast', 'combo',
  ]) {
    scan(anyC[k])
  }
  if (c.choose) for (const m of c.choose.modes) scan(m.script)
  if (c.secret) scan(c.secret.script)
  return [...found]
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const a = [...xs].sort((x, y) => x - y)
  const mid = a.length >> 1
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2
}

export interface Curve {
  /** 出现过的费用档,升序 */
  costs: number[]
  /** 费用档 → 该档的中位卡面价值(已压平回摆) */
  curve: Map<number, number>
  /** 费用档 → 该档所有卡的价值,用于打印张数 */
  byCost: Map<number, number[]>
}

/**
 * 曲线:每个费用档的中位价值。
 *
 * 必须**单调不减**:高费档卡少(10 费只有个位数),中位数会出现
 * 「9 费比 10 费还高」这种由样本量造成的回摆。不修的话最近邻反查会把一大票
 * 6 费卡判成 10 费 —— 第一版就是这么输出的,榜单整页都是 +4。
 * 取前缀最大值:它保留了曲线的形状,只压掉回摆。
 */
export function buildCurve(values: Array<{ cost: number; value: number }>): Curve {
  const byCost = new Map<number, number[]>()
  for (const c of values) {
    const list = byCost.get(c.cost) ?? []
    list.push(c.value)
    byCost.set(c.cost, list)
  }
  const costs = [...byCost.keys()].sort((a, b) => a - b)
  const curve = new Map<number, number>()
  let running = -Infinity
  for (const k of costs) {
    running = Math.max(running, median(byCost.get(k)!))
    curve.set(k, running)
  }
  return { costs, curve, byCost }
}

/**
 * 反查:一个价值落在哪个费用档。
 *
 * **线性插值而不是最近邻** —— 最近邻在两档间距很宽的地方(高费段)会把
 * 一大片价值都吸到同一档上,输出全是同一个数字,读不出差别。
 *
 * 返回的是**取整后的费用**,给报表用。做拟合请改用 excessValue ——
 * 取整会把 ±0.49 费的信息全部丢掉,而那正是相关性所在的量级。
 */
export function impliedCost({ costs, curve }: Curve, v: number): number {
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

/**
 * 一张卡比**它这个费用档的正常水平**高出多少点 —— 不取整的连续量。
 *
 * 这是拿去和 sim-cards 的实测 Δ 做相关的那个量:impliedCost 取整之后,
 * 「高出 0.4 费」和「高出 0.4 费」是同一个 0,而卡池里绝大多数卡都落在那个区间。
 * 费用超出曲线范围时按最高档算(卡池里没有,但别让它悄悄返回 NaN)。
 */
export function excessValue({ costs, curve }: Curve, cost: number, value: number): number {
  const at = curve.get(cost) ?? curve.get(costs[costs.length - 1])!
  return value - at
}
