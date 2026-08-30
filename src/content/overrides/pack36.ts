import type { CardDef } from '../../engine/types'

// 第三十六卡包 · 持久 —— 「拖到后面」终于是一条打法。
//
// 【空洞】
// `ifTurnAtLeast` 全池只有一张卡在用(pack23 的 殘陽如血,门槛 turn ≥ 10)。
// 也就是说这个游戏里「后期牌」这个概念在卡面上只出现过一次,而且是最晚的那一档。
// 中段(第 5~8 回合)完全是空的 —— 那恰恰是大多数对局真正决出胜负的区间。
//
// 【为什么这条轴量得准】
// 和 眾寡 / 白骨 同一个理由:回合数**只会单向增长**,门槛必然到得了,
// 不需要牌库里配合的卡。pack33(地利)停手的那种情况在这里不会发生。
// 而且它比墓地更硬 —— 墓地要死人才涨,回合数是白送的。
//
// 【门槛铺三档:5 / 6 / 8】
// 既有那张是 10,太靠后。pack32 的教训是「够不着的门槛等于没有收益」,
// 而反过来也成立:**门槛太早就等于没有门槛**,那张牌只是打了个折的普通牌。
// 5 是「过了铺场期」、6 是「中盘」、8 是「真的拖起来了」。
//
// 【隱逸补三张】
// 隱逸仍是最薄的主义。这一包给它三张,而且主题是天生的:
// 深根固柢(《老子》)、大器晚成(《老子》)、厚積薄發(蘇軾)——
// 三句话讲的都是同一件事:**不急着出手**。这条轴和这个主义本来就是一回事。
//
// 【选 op 与前四包同一条纪律】(ROADMAP 45「按效果归组的定价偏差」)
//   偏低:returnToHand +6.7 · aoeDamage +4.0 · destroy +3.8 · damage +3.7 ·
//         resurrect +3.1 · tutor +2.2
//   偏高:summon −4.9 · grantKeyword −3.6 · heal −3.4
//   量不到(铁律 8):reduceCost / gainArmor / heal / stealth —— 一概不用
//
// 【四包累计的自我约束,开工前照着办】
//   pack32:归组表是**事前挑 op** 用的。
//   pack33:每张牌都要有**立刻收益**。
//   pack34:**费用不是有效杠杆**,要动就动效果。
//   pack35:**同一张牌上多挂一个 op,代价远超直觉**(实测 13 个百分点)——
//           所以这一包六张里有五张是**单 op**。
//
// 【出处】
//   後發制人   《荀子·議兵》「後之發,先之至,此用兵之要術也」
//   深根固柢   《老子》五十九章「深根固柢,長生久視之道」
//   厚積薄發   蘇軾《稼說送張琥》「博觀而約取,厚積而薄發」
//   十年生聚   《左傳·哀公元年》伍員曰「越十年生聚,而十年教訓」
//   大器晚成   《老子》四十一章「大方無隅,大器晚成,大音希聲」
//   壯士十年歸 《木蘭辭》「將軍百戰死,壯士十年歸」
//
// 六张都**不进任何预组**;但它们进全池,而 bossDeck / battleDeck 从全池现建 ——
// sim-campaign 与 sim-history 必须重跑。
export const PACK36_CARDS: CardDef[] = [
  {
    id: 'strat-shengen-gudi',
    collectorNo: 10454,
    name: { zh: '深根固柢', en: 'Deep Roots, Firm Stem' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'spring-autumn',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [{ op: 'tutor', kind: 'general', count: 1 }],
      condition: { ifTurnAtLeast: 5 },
    },
    text: {
      zh: '第 5 回合起:從牌庫檢索一名武將進手。深根固柢,長生久視之道。',
      en: 'From turn 5: search your deck for a general. Deep roots and a firm stem — that is the way of long life and lasting sight.',
    },
  },
  {
    id: 'strat-houfa-zhiren',
    collectorNo: 10455,
    name: { zh: '後發制人', en: 'Strike After, Arrive First' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 「后发制人」讲的正是**等对方先落子**,所以是弹回而不是消灭:
    // 你不消灭他,你让他重来一遍。
    spell: {
      ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }],
      condition: { ifTurnAtLeast: 5 },
    },
    text: {
      zh: '第 5 回合起:將一名敵方武將彈回其手牌。後之發,先之至,此用兵之要術也。',
      en: "From turn 5: return an enemy general to its owner's hand. To move later and arrive first — that is the essence of war.",
    },
  },
  {
    id: 'strat-houji-bofa',
    collectorNo: 10456,
    name: { zh: '厚積薄發', en: 'Gather Long, Spend Little' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'song',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      // 【这张暴露了这条轴的一个陷阱 —— 见文件头「门槛什么时候是装饰」】
      //   一版 turn>=6 · aoe 2  → +9.3(越线)
      //   二版 turn>=8 · aoe 2  → +9.3(**逐位相同**:5 费的牌本来就要等到
      //                            那时候才打得出,门槛在它身上是装饰)
      //   三版 turn>=8 · aoe 1  → 见文件头
      // 门槛留在 8 是因为它更贴名字(「厚積」本该等更久),但真正收住它的是伤害。
      ops: [{ op: 'aoeDamage', amount: 1 }],
      condition: { ifTurnAtLeast: 8 },
    },
    text: {
      zh: '第 8 回合起:對所有敵方武將造成 1 點傷害。博觀而約取,厚積而薄發。',
      en: 'From turn 8: deal 1 damage to all enemy generals. Observe widely and take little; gather long and spend sparingly.',
    },
  },
  {
    id: 'strat-shinian-shengju',
    collectorNo: 10457,
    name: { zh: '十年生聚', en: 'Ten Years to Gather' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'spring-autumn',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [{ op: 'resurrect', count: 2 }],
      condition: { ifTurnAtLeast: 8 },
    },
    text: {
      zh: '第 8 回合起:復生 2 名武將。越十年生聚,而十年教訓,二十年之外,吳其為沼乎。',
      en: 'From turn 8: resurrect two of your fallen generals. Ten years to gather the people, ten years to teach them — and in twenty, Wu shall be a marsh.',
    },
  },
  {
    id: 'strat-zhuangshi-shinian',
    collectorNo: 10458,
    name: { zh: '壯士十年歸', en: 'Ten Years Before the Brave Come Home' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'southern-northern',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 5,
    keywords: [],
    spell: {
      ops: [{ op: 'damage', amount: 8, target: 'chosenEnemyGeneral' }],
      condition: { ifTurnAtLeast: 8 },
    },
    text: {
      zh: '第 8 回合起:對一名敵方武將造成 8 點傷害。將軍百戰死,壯士十年歸。',
      en: 'From turn 8: deal 8 damage to an enemy general. Generals die in a hundred battles; the brave come home after ten years.',
    },
  },
  {
    id: 'strat-daqi-wancheng',
    collectorNo: 10459,
    name: { zh: '大器晚成', en: 'The Great Vessel Is Late in Forming' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'spring-autumn',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    keywords: [],
    spell: {
      ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }],
      condition: { ifTurnAtLeast: 8 },
    },
    text: {
      zh: '第 8 回合起:摧毀一名敵方武將。大方無隅,大器晚成,大音希聲。',
      en: 'From turn 8: destroy an enemy general. The greatest square has no corners; the greatest vessel is late in forming; the greatest sound is faint.',
    },
  },
]

// 【收敛之后的读数(600 局 / 张,六张一起量,族错误率校正线 |Δ| > 7.6)】
//   大器晚成 +4.7 · 壯士十年歸 +3.8 · 十年生聚 +2.8 ·
//   後發制人 −1.3 · 厚積薄發 −6.5 · 深根固柢 −6.7
// 最大 |Δ| 是 6.7,一张都没越线。
//
// 【这一包查出来的两条,都是前四包没有的】
//
// 一、**门槛什么时候是装饰。**
// 厚積薄發 把门槛从 turn≥6 抬到 turn≥8,两次读数**逐位相同**(+9.3 / +9.3)。
// 原因不是它没参与对局(它是 +9.3,活得很好),而是**5 费的牌本来就要等到
// 第 8 回合左右才打得出** —— 门槛落在自然出牌回合之前,它就不生效。
// 推论对整条轴都成立:**`ifTurnAtLeast` 的门槛只有高于「这张牌的费用自然能出的
// 回合」才是真门槛**,否则它只是卡面上一句好听的话。
// 便宜的牌不同:深根固柢 3 费,turn≥5 是真的挡住了它前两回合。
//
// 二、**AoE 是台阶,不是斜坡。**
//   本包 厚積薄發 aoe 2 → 1:+9.3 → −6.5(**一档 15.8 个点**)
//   pack34 卻月陣 aoe 3 → 2:+9.7 → +3.8(一档 5.9 个点)
// 同样是减一点伤害,差了将近三倍。因为 2 → 1 跨过的是「还杀不杀得死 2 血」
// 这条线,而 3 → 2 没有跨过任何线。调 AoE 时先想清楚它现在正好杀掉什么。
