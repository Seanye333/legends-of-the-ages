import type { CardDef } from '../../engine/types'

// 第二十六卡包 · 糧盡 —— 给粮道补上「代价」那一侧。
//
// 【这一包是 A 组第 1 条(粮尽惩罚)的内容侧,引擎侧见 resolve.changeSupply】
// 上一包(第二十四包)结尾写着:「下一步不是再加条件,是给这两条轴补代价那一侧 ——
// 先让粮真的会被花掉,再谈花光了会怎样。」这就是那一步。
//
// 【动手前量的三个数】
//   产粮 145 张 · 耗粮 **3** 张 · 能减别人粮的 **0** 张
// 第三个数才是关键:粮道**只涨不跌**,所以「粮尽」在对局里根本不可能发生 ——
// 惩罚写得再好也是死条文。所以这一包一半是耗粮出口,一半是断粮入口。
//
// 【卡池先查了一遍,这次查得很值】
// 池子里**已经有五张名字就是「断粮」的卡**,而且**一张都没碰粮道**:
//
//   絕其糧道   mill 3        斷其糧道   弃 1 + 打脸 2
//   焚糧校尉   mill 2        烏巢守將   每回合 mill 1
//   轉運使     每回合 mill 2   ← 名字是「运粮官」,做的是磨敌方牌库
//
// 也就是说「断粮道」这个词在这个卡池里一直是**磨牌的风味词**,和粮道机制无关。
// 这不是它们写错了(磨牌那条轴自己是通的、也平衡),但它意味着两件事:
//   1. 新卡的名字必须全部避开这五个,否则又是「两张同概念的卡并排站着」
//   2. 「卡面在说谎」那一类问题还有一个变种:**名字**在说谎,而没有任何闸门看得见
// 这五张这一轮**一张都不动** —— 一次只动一个旋钮,重命名/改机制是另一件事。
//
// 【定价的两条参照】
// · 耗粮:神機營 7 费 軍需 4(2/4 身子 + 全体 2 伤)、足食足兵 5 费 軍需 5(全体 +2/+2)
// · 断粮:**没有先例**,这一包是第一批。断粮本身对不带军需的对手几乎无害,
//   所以每张都得自带一份不依赖对手构筑的收益,否则就是一张空牌
//   (壁中書 的教训:载荷本身是空的,涨降费用都救不回来)。
//
// 【最终实测(400 局,对照组区间 −4.8 ~ +6.7)】
//   劫糧都尉 +2.5 · 劫糧 +1.5 · 犒軍 +0.5 · 輜重營 +0.0 · 因糧於敵 −1.8 · 圍城 −3.0
// 六张全部在带内。回炉的三张见各自注释,其中一条是这一包最值得记的发现:
//
// **断粮在今天的卡池里几乎不值钱。** 因糧於敵 第一版(3 费,敵 −3 / 我 +3)
// 是纯粹的粮道搬运,实测 −8.3。原因很直白:粮道每回合自动 +1,而全池只有
// **六张**军需卡会因为粮不够而打不出来 —— 断掉三格,对手多半根本不会注意到。
// 于是断粮真正兑现的只有「粮尽 = 士气 -1」那一下。
// 所以这条轴上的每一张断粮卡都得**自带一份不依赖对手构筑的收益**
// (劫糧配抽牌、劫糧都尉配突襲身子、因糧於敵配偷牌),否则就是一张空牌。
// 这个结论会随着军需卡变多而过期 —— 到时候要重新量,别照抄这一段。
export const PACK26_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- 断粮(gainSupply 负 · side enemy)
  {
    id: 'strat-jie-liang',
    collectorNo: 10409,
    name: { zh: '劫糧', en: 'Raid the Grain Train' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 自带抽牌:断粮打在不带军需的对手身上只剩「粮尽 = 士气 -1」那一下,
    // 没有这张牌就会变成「对面构筑对了才有用」的死牌。
    spell: {
      ops: [
        { op: 'gainSupply', amount: -3, side: 'enemy' },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '敵方糧道 −3,抽一張牌。輕騎繞後,不擊其陣,擊其車。',
      en: 'Enemy loses 3 Supply. Draw a card. Light horse goes round the back — not for the line, for the carts.',
    },
  },
  {
    id: 'gen-jie-liang-duwei',
    collectorNo: 10410,
    name: { zh: '劫糧都尉', en: 'Commandant of the Raid' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    attack: 3,
    health: 2,
    keywords: ['rush'],
    battlecry: { ops: [{ op: 'gainSupply', amount: -2, side: 'enemy' }] },
    text: {
      zh: '突襲。戰吼:敵方糧道 −2。專燒他的鍋灶,不與他的陣列糾纏。',
      en: 'Rush. Battlecry: enemy loses 2 Supply. Burn the cookfires; leave the battle line alone.',
    },
  },
  {
    id: 'strat-yin-liang-yu-di',
    collectorNo: 10411,
    name: { zh: '因糧於敵', en: 'Forage Off the Enemy' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 这条轴上唯一一张**两侧同时动**的牌:抢过来的粮既是他的代价也是我的军需。
    //
    // 第一版只有那两行(3 费,敵 −3 / 我 +3),实测 **−8.3** —— 带外偏弱,
    // 而原因不是定价是**载荷**:断粮在今天的卡池里几乎不值钱(全池只有六张军需卡
    // 会因此打不出来),粮道本身又每回合自动 +1,所以「搬三格粮」约等于一张空牌。
    // 这跟 壁中書 是同一个病:费用怎么调都救不回一份本来就空的载荷。
    // 补的这一手顺着卡名走 —— 因糧於敵 抢的从来不只是粮。
    spell: {
      ops: [
        { op: 'gainSupply', amount: -3, side: 'enemy' },
        { op: 'gainSupply', amount: 3 },
        { op: 'stealCard', count: 1 },
      ],
    },
    text: {
      zh: '敵方糧道 −3,我方糧道 +3,並從對手手牌隨機取一張。善用兵者,役不再籍,糧不三載;因糧於敵,故軍食可足也。',
      en: 'Enemy loses 3 Supply; you gain 3; steal a random card from their hand. The skilled commander does not levy twice, nor ship grain thrice — he forages off the enemy.',
    },
  },

  // ---------------------------------------------------------------- 耗粮(supplyCost)
  // 全池此前只有三张。军需卡是粮尽**自找的**那一侧:花到底就要挨一记士气。
  {
    id: 'strat-kao-jun',
    collectorNo: 10412,
    name: { zh: '犒軍', en: 'Feast the Ranks' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    // 第一版 2 费实测 +8.3(带外)。纯涨一格费用 —— 那个杠杆的第一格 ≈ −5.0pp。
    cost: 3,
    supplyCost: 3,
    keywords: [],
    spell: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'allFriendlyGenerals' }] },
    text: {
      zh: '軍需 3。友方全體 +1/+1。殺牛釃酒,勞饗將士。',
      en: 'Provision 3. Give all friendly generals +1/+1. Oxen slaughtered, wine strained, the army fed.',
    },
  },
  {
    id: 'gen-zizhong-ying',
    collectorNo: 10413,
    name: { zh: '輜重營', en: 'The Baggage Camp' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 4,
    attack: 3,
    health: 6,
    keywords: ['guard'],
    supplyCost: 2,
    text: {
      zh: '軍需 2。守護。三軍未動,輜重先行。',
      en: 'Provision 2. Guard. Before the army moves, the baggage moves.',
    },
  },
  {
    id: 'strat-wei-cheng',
    collectorNo: 10414,
    name: { zh: '圍城', en: 'Invest the Walls' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 5 费 軍需 3「全体 2 伤 + 抽 1」实测 **+16.8**,是这一包唯一越过校正线的一张。
    // 不意外:`aoeDamage` 是定价表低估最狠的那一档之一(归组实测平均 +9.4,z=4.6),
    // 而我又给它配了一张抽牌。删掉抽牌、涨一费、军需涨到 4 ——
    // 收成「神機營 去掉身子」的形状(那张 7 费 軍需 4 的 2/4 现在是 +5.2)。
    cost: 6,
    supplyCost: 4,
    keywords: [],
    spell: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    text: {
      zh: '軍需 4。對所有敵方武將造成 2 點傷害。圍城者,先絕其汲道。',
      en: 'Provision 4. Deal 2 damage to all enemy generals. To invest a city, first cut its water.',
    },
  },
]
