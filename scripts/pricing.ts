// 定价模型本体 —— 从 price-cards.ts 里抽出来的纯函数部分。
//
// 【为什么要抽出来】
// 从前这套逻辑长在 price-cards.ts 的顶层:import 它就等于跑一遍全池、打印一整页报表。
// 于是它**没有一行测试**,也没法被第二个脚本复用 —— 而这套公式恰恰是本仓库里
// 唯一一把能扫全池的尺子,它自己错了没人会知道(见 ARCHITECTURE 铁律 11)。
// 抽出来之后:price-cards.ts 只管排版和打印,fit-price.ts 拿它跟实测 Δ 对拟合,
// pricing.test.ts 直接钉住那几条最容易在重构里被改坏的性质。
import type { CardDef, EffectOp, EffectScript } from '../src/engine/types'
import { isNoOp } from '../src/content/noOp'

/**
 * 身材那三个系数。**和效果的点数表一样,它也是数据** ——
 * 这样 fit-price 才能拿旧式和新式跑同一份实测比一比,而不是拍胸脯说「新的更好」。
 */
export interface BodyWeights {
  attack: number
  health: number
  /** min(攻,血) 的系数 —— 「均衡」。旧式没有这一项(= 0)。 */
  balance: number
}

/** 2026-08-06 实测校准(见 bodyValue 的注释)。 */
export const DEFAULT_BODY: BodyWeights = { attack: 0.1102, health: 0.349, balance: 1.5836 }

/**
 * 2026-08-06 之前的形式:攻×1 + 血×0.8,没有均衡项。
 * 留着**只为对照** —— `npm run fit-price` 拿它和新式跑同一份实测比拟合优度。
 * `ai/greedy` 的 unitValue 至今仍是这个形式(故意的,见下)。
 */
export const LEGACY_BODY: BodyWeights = { attack: 1, health: 0.8, balance: 0 }

/**
 * 身材当量。
 *
 * 【2026-08-06:从「攻×1 + 血×0.8」换成带均衡项的形式,这是实测逼出来的】
 * 造了 26 张只差身材的白板对照卡,各 800 局(`npm run sim-body`)。
 * 线性模型**解释不了最大的那个效应** —— 6 费、同样 15 点身材总量:
 *
 *     14/1 → Δ −18.9      8/7 → Δ −1.4      1/14 → Δ −12.1
 *
 * 相差 17.5 个百分点,而线性模型对这三张给出的预测几乎相同。
 * 于是它把这一整块结构全丢进残差:残差标准差 ±4.74pp,而测量噪声只有 ±2.50pp,
 * 两个斜率的 z 都掉到 1.0 附近 —— 看起来像「测不出来」,实际是**模型错了**。
 *
 * 加一项 `min(攻, 血)` 之后:
 *
 *     Δ = 0.174·攻 + 0.551·血 + 2.500·min(攻,血) + 费用档     z(均衡) = 8.7
 *     残差标准差 ±2.17pp —— **已经落到测量噪声以下**,也就是说结构基本被吃干净了
 *
 * 道理很直白:1 血的怪碰谁死谁,1 攻的怪换不掉任何东西,两头都是废的,
 * 而它们的 `min` 都是 1;均衡的 8/7 `min` 是 7。**均衡本身就是身材的一部分。**
 *
 * 【为什么要乘 0.6334】
 * 把新式的全池均值**对齐到旧式**(武将 2258 张,旧均值 6.515)。
 * 这样这次改动只动**形状**,不动「身材 vs 效果」的总体比例 ——
 * 后者是另一个还没测准的问题(见 DEFAULT_WEIGHTS 那一段),
 * 一次只改一件能证明的事。
 *
 * 注:`ai/greedy` 的 `unitValue` 仍是旧的线性式。**故意不动** ——
 * 那是 AI 的评分函数,改它等于换掉所有闸门的尺子,要重跑整套矩阵才敢动。
 * 这里改的是给人看的定价报表。两处从此不再一致,所以这段注释必须留着。
 */
export function bodyValue(c: CardDef, w: BodyWeights = DEFAULT_BODY): number {
  if (c.type === 'general') {
    const a = c.attack ?? 0
    const h = c.health ?? 0
    return w.attack * a + w.health * h + w.balance * Math.min(a, h)
  }
  // 装备:attack/health 是**给持有者的加成**,不是它自己的身材。
  // 第一版把非武将一律记 0 分,于是七件装备整整齐齐排在「疑似过弱」榜首 ——
  // 那不是卡池的问题,是尺子的问题。
  // 打 0.85 折:它要求场上先有人(空场时是一张死牌),而且加成会跟着那个人一起死。
  if (c.type === 'equipment') {
    // **装备仍用线性式,故意的**:上面那个均衡项量的是「一个单位活不活得下来」,
    // 而装备的攻血是加到**别人**身上的增量 —— 3/0 的兵器挂在 5/6 身上并不产生
    // 一个 3/0 的废物,它让那个人变成 8/6。min(攻,血) 在这里没有意义。
    // 对照卡也没测过装备(探针全是武将),所以这里没有实测依据可改。
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
 * 【2026-08-06:带 ✎ 的二十一个数值第一次由实测校准】
 *
 * 数据:`sim-cards` 扫全池 2416 张 × 60 局(101 分钟),每张的 Δ 是
 * 「把它换进对应主义的预组之后,胜率相对没换的同一套牌动了多少」。
 *
 * 规则(`npm run fit-price` 的「归组版」):
 *   1. 按 op 归组,和全池均值比,**|z| > 2 才动**;
 *   2. 改动量 = (该 op 均值 − 全池均值) / 汇率,单次夹在 ±4 点内;
 *   3. 下限是原值的两成 —— 归零是一句断言「这个效果一分不值」,
 *      而单个 op 的均值标准误约 ±1pp,这类测量给不出这种结论。
 *
 * 【汇率从哪来 —— 这一步以前是整件事的死结】
 * 把「百分点」换算成「点」需要一个汇率。拿本份数据回归出来的斜率(约 1.0)
 * 是**身材与效果的混合值**,而当前表的效果那一半正是我们怀疑错了的东西 ——
 * 用它校正它自己又是一个闭环。
 * 所以汇率取自**另一个独立实验**:`npm run sim-body` 造了 26 张只差身材的白板
 * 对照卡各打 800 局,量出身材的价格,归一系数 0.6334 反过来就是
 * **1 点 = 1.579 pp**。那份数据完全不依赖任何人对效果的看法。
 * (差别是实打实的:用混合斜率会把每个 op 的改动量放大约六成。)
 *
 * 【凭什么信】留出集裁决 —— 选 op、定尺度、定改动量三步**全部只用一半的卡**,
 * 另一半从头到尾没参与:ρ 0.255 → 0.325(Δ +0.070,Steiger 相依检验 z = 4.50)。
 * 规则过关之后才用全部样本重算出下面这组数(训练集只有一半卡,估计噪声大一倍)。
 *
 * 偏差很有规律:**抢节奏 / 解场 / 过牌被低估,加身材 / 回血 / 护甲 / 铺场被高估。**
 * 而 draw(209 张)· buffStats(182 张)· freeze · silence · stealCard 全落在噪声里 ——
 * **这几个原来就定得准**,一个都没动。
 *
 * ⚠️ **这把尺子是贪心 AI**,它对两类东西系统性低估(铁律 8):
 *   · 防守向(治疗 / 护甲 / 屯粮)—— 先手补偿那一轮实测 6 点护甲只值 4.2pp,
 *     不到一张牌的一半;
 *   · 靠**选择**产生价值的(发现 / 借将)—— AI 选得差,它就量不出那份价值。
 * 其中屯粮 / 借将 / 攻守互换 / 临时法力四个的实测值直接撞到了 20% 下限。真人玩家那里它们更值钱,
 * 所以看到这几类卡上「疑似超模」榜时,先想想是不是尺子的问题。
 */
export const DEFAULT_WEIGHTS: Weights = {
  damage: 2.63, //         ✎ 1.5   (n=247, z=+7.0)样本最大,最可信的一条
  damageFace: 2.23, //     ✎ 1.1   同一个 op:归组分不开打脸和打随从,按同样的绝对量一起动
  aoeDamage: 6.05, //       ✎ 3.2   (n=30,  z=+5.8)
  damagePer: 3, //           卡池里太少,量不出来
  heal: 0.33, //          ✎ 0.7   (n=119, z=−2.5)**这正是 AI 的盲区**,见上
  draw: 2.2, //              (n=209, z=+1.8)落在噪声里 —— 原来就定得准
  buffStats: 1.1, //         (n=182, z=+0.8)落在噪声里 —— 原来就定得准
  buffStatsTemp: 0.45,
  buffPer: 3.83, //        ✎ 2.2   (n=21,  z=+2.7)
  destroy: 9, //           ✎ 5     (n=8,   z=+3.4)样本小,但「点杀一个」本来就该贵
  banish: 5.5, //            全池只有 1 张卡在用,量不出来
  silence: 2, //             (n=43,  z=−1.3)落在噪声里
  freeze: 1.6, //            (n=38,  z=−0.7)落在噪声里
  seize: 10, //            ✎ 6     (n=6,   z=+5.1)只有六张,信度最低的一条
  transform: 4.5, //         全池只有 2 张卡在用
  resurrect: 4, //           (n=6,   z=+2.0)刚好没过线
  recruit: 7.5, //         ✎ 3.5   (n=11,  z=+3.0)
  summon: 1.5, //         ✎ 2.5   (n=152, z=−2.7)铺场远不如想象值钱
  copyGeneral: 4,
  tutor: 4.54, //          ✎ 2.8   (n=102, z=+3.7)
  addToHand: 1.8, //         全池只有 1 张卡在用,量不出来
  discover: 1.23, //      ✎ 2.6   (n=53,  z=−2.1)**价值在「选」上,而 AI 选得差**,见上
  stealCard: 2.6, //         (n=38,  z=+0.5)落在噪声里
  discardRandom: 4.47, //  ✎ 1.8   (n=19,  z=+2.6)
  returnToHand: 6.4, //    ✎ 2.4   (n=51,  z=+8.9)**全表最强的单条信号**
  grantKeywordTemp: 0.5, //  grantKeyword 的主体是 KEYWORD_VALUE(不在这张表里),
  //                         只动这一支等于把结论全按到「短效」上,所以 fit-price 整个跳过它
  gainArmor: 0.24, //     ✎ 0.7   (n=193, z=−2.7)**AI 的盲区**,见上
  gainMana: 0.84, //      ✎ 2.4   (n=33,  z=−2.2)
  gainManaTemp: 0.2, //    ✎ 1.0   同一个 op
  swapStats: 0.3, //       ✎ 1.5   (n=23,  z=−3.3)撞下限
  reduceCost: 3.49, //     ✎ 1.6   (n=41,  z=+2.6)
  setField: 3, //            卡池里太少,量不出来
  // ---- 第二十一卡包 ----
  // 士气过线才产生效果(全场 ±1 攻),所以一点士气的期望价值低于一点身材
  gainMorale: 1.3, //        (n=109, z=+1.8 刚好没过线)
  gainSupply: 0.16, //     ✎ 0.8   (n=145, z=−3.2)撞下限;和护甲同一类盲区
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
  // ✎ 2.8 —— (n=15, z=−2.8)撞下限。原来的推理是「永久夺取 seize = 6,
  // 借将只借一个回合,约等于夺取的一半不到」;实测说远不止「不到一半」,
  // 带借将的卡整体弱于全池 4.8pp。
  // **但它和发现同一类:价值在「怎么用那一个回合」,而贪心 AI 用不出来。**
  borrow: 0.56,
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
  body: BodyWeights = DEFAULT_BODY,
): number {
  const sv = (s: EffectScript | undefined, d = 1) => scriptValue(s, d, unpriced, w)
  let v = bodyValue(c, body)
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
 * 这一步是不是**恒等于什么都不做**(量为 0)。
 *
 * 判据本体搬去了 `src/content/noOp.ts` —— 那边还有第三个用处(合并层把它剥掉),
 * 而那一处在浏览器包里,进不了 scripts/。三处共用一份定义,理由见那个文件的注释。
 * 这里保留同名导出,是因为 contentRules 等处按老路径引它。
 *
 * `lint-content` 的 `no-op` 规则报的是同一件事,那边负责让它可见,
 * 这里负责让它**不进统计**。两处都在,是因为它们服务于不同的问题:
 * 一个是「卡池里有没有脏数据」,一个是「校准的分母对不对」。
 */
export { isNoOp }

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
    for (const o of s?.ops ?? []) {
      // 【量为 0 的 op 不算数】
      // 卡池里有 6 张卡带着 `draw count=0`(生成器留下的痕迹,见 lint-content 的
      // no-op 规则)。它在对局里什么都不做,却会被按名字数进 `draw` 组 ——
      // 给定价校准掺沙子:那一组的均值里混着六张根本没抽过牌的卡。
      if (isNoOp(o)) continue
      found.add(o.op)
    }
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
