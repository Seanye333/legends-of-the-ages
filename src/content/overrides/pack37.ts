import type { CardDef } from '../../engine/types'

// 第三十七卡包 · 逐北 —— 「对面快死了」这件事,终于不止一张牌看得见。
//
// 【空洞】
// `ifEnemyHeroHpBelow` 全池只有一张卡在用(pack22 的 窮寇勿迫,3 费 · 面伤 6 · <15)。
// 斩杀线是 CCG 里最经典的一条轴 —— 「他还剩多少血」决定你这一手该怎么打 ——
// 而这个游戏里至今只有一张牌读得到它。
//
// 【为什么这条轴量得准(而剩下四个不行)】
// 五个孤儿条件里,这是最后一个**随对局自然到达**的:
//   · `ifSupply` / `ifChain` 依赖**本回合打了什么**,要牌库配合;
//   · `ifHandCount` / `ifKeywordCount` 依赖**这套牌怎么构筑**;
//   而 `sim-cards` 是把单张卡换进预组打的 —— 依赖配合的条件在这把尺子下
//   量到的是「前置条件没出现」,不是「它强不强」(pack33 为此停过一次手)。
// 敌方主公的血只会往下走,AI 一直在推它,所以这一条不需要任何配合。
//
// 【我在这里写过一段预判,实测把它整个推翻了 —— 留着当反例】
// 原话是:「pack32 的 一以當十(自己残血时烧脸)−12.5、pack34 的 魚麗之陣
// (自己铺开时烧脸)−6.5,而这一条轴不同 —— 对面已经低于二十血,
// 面伤直接换成赢。」听起来很顺,而实测是:
//   兵貴神速(2 费面伤 3)  −8.0 → 放宽门槛后 −8.2
//   乘勝逐北(4 费面伤 7)  −9.8 → 放宽门槛后 −7.8
// 两张都越线,而同一包里三张**板面效果**的卡在同一次放宽后全部进带
// (弹回 +0.8 · aoe −3.0 · 摧毁 −3.2)。
//
// 真正的原因不是「这条轴不好」,是**面伤不影响场面**:
// 对面掉到二十血以下时你多半已经在赢,补刀只是把已经赢的局赢得更快;
// 而你会输的那些局里,它一点忙都帮不上。板面效果不一样 ——
// 它在你落后时也能把局面掰回来。
// 于是三次读数合起来的结论要改写成:
// **面伤是「赢更多」的 op,它在任何以「已经占优」为门槛的轴上都会偏弱。**
// 这一包最后没有一张面伤牌,而那正是实测教的。
//
// 【选 op 与前五包同一条纪律】(ROADMAP 45「按效果归组的定价偏差」)
//   偏低:returnToHand +6.7 · aoeDamage +4.0 · destroy +3.8 · damage +3.7
//   偏高:summon −4.9 · grantKeyword −3.6 · heal −3.4
//   量不到(铁律 8):reduceCost / gainArmor / heal / stealth
//
// 【五包累计的自我约束,开工前照着办】
//   pack32:归组表是**事前挑 op** 用的。
//   pack33:每张牌都要有**立刻收益**。
//   pack34:**费用不是有效杠杆**。
//   pack35:**多挂一个 op 代价远超直觉**(13 个点)—— 所以五张全是单 op。
//   pack36:门槛低于「自然出牌回合」就是装饰;**AoE 是台阶不是斜坡**。
//
// 【为什么是五张不是六张】
// 前六包都是六张,这一包只有五张 —— 不是凑不满,是第六个名字没找到**确切出处**。
// 想过的几个(风卷残云、瓮中捉鳖)都是元明以后的小说戏曲,
// 而这个仓库对出处的规矩是「拿不准宁可空着」(lore-quotes 的原话)。
// 少一张比多一句伪托好。
//
// 【出处】
//   兵貴神速     《三國志·郭嘉傳》「兵貴神速。今千里襲人,輜重多,難以趨利」
//   疾雷不及掩耳 《六韜·龍韜·軍勢》「疾雷不及掩耳,迅電不及瞑目」
//   破竹之勢     《晉書·杜預傳》「今兵威已振,譬如破竹,數節之後,皆迎刃而解」
//   摧枯拉朽     《晉書·甘卓傳》「將軍之舉武昌,若摧枯拉朽,何所顧慮」
//   乘勝逐北     《戰國策·中山策》「乘勝逐北,以歸咸陽」
//
// 五张都**不进任何预组**;但它们进全池,而 bossDeck / battleDeck 从全池现建 ——
// sim-campaign 与 sim-history 必须重跑。
export const PACK37_CARDS: CardDef[] = [
  {
    id: 'strat-bing-gui-shensu',
    collectorNo: 10460,
    name: { zh: '兵貴神速', en: 'Speed Is the Soul of War' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    keywords: [],
    spell: {
      // 【面伤版实测 −8.0 / −8.2,两版都越线 —— 见文件头那段被推翻的判断】
      ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }],
      condition: { ifEnemyHeroHpBelow: 25 },
    },
    text: {
      zh: '若敵方主公血量低於 25:對一名敵方武將造成 3 點傷害。兵貴神速。今千里襲人,輜重多,難以趨利。',
      en: 'If the enemy lord is below 25 Health: deal 3 damage to an enemy general. Speed is the soul of war — a thousand li of baggage will never catch an enemy.',
    },
  },
  {
    id: 'strat-jilei-yaner',
    collectorNo: 10461,
    name: { zh: '疾雷不及掩耳', en: 'Thunder Before the Hands Can Rise' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 「快到捂不住耳朵」讲的是**对方来不及反应**,所以是弹回:
    // 你不杀他,你让他从头再来一次。
    spell: {
      ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }],
      condition: { ifEnemyHeroHpBelow: 25 },
    },
    text: {
      zh: '若敵方主公血量低於 25:將一名敵方武將彈回其手牌。疾雷不及掩耳,迅電不及瞑目。',
      en: "If the enemy lord is below 25 Health: return an enemy general to its owner's hand. Thunder outruns the hands that would cover the ears; lightning outruns the closing eye.",
    },
  },
  {
    id: 'strat-pozhu-zhishi',
    collectorNo: 10462,
    name: { zh: '破竹之勢', en: 'Splitting Bamboo' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'jin',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // AoE 起手就定 2 而不是 3:pack36 量到 aoe 2→1 值 15.8 个点、
    // pack34 量到 3→2 值 5.9 —— 这条曲线在 2 那一档有个台阶,别踩过去再往回收。
    spell: {
      ops: [{ op: 'aoeDamage', amount: 2 }],
      condition: { ifEnemyHeroHpBelow: 25 },
    },
    text: {
      zh: '若敵方主公血量低於 25:對所有敵方武將造成 2 點傷害。今兵威已振,譬如破竹,數節之後,皆迎刃而解。',
      en: 'If the enemy lord is below 25 Health: deal 2 damage to all enemy generals. The army is in full force now — like splitting bamboo: past the first few joints, it falls open at the blade.',
    },
  },
  {
    id: 'strat-chengsheng-zhubei',
    collectorNo: 10463,
    name: { zh: '乘勝逐北', en: 'Ride the Victory, Chase the Routed' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    spell: {
      // 【这张改了三版,前两版都不碰场面 —— 同一个病犯了两次】
      //   一版 面伤 7            −9.8 → 放宽门槛 −7.8
      //   二版 对手随机弃 2 张    −12.2(**更差**)
      //   三版 策反一名敌方武将   见文件头
      // 弃牌和面伤是一类:都是「价值」而不是「场面」。而这条轴的门槛本身
      // 就意味着你已经占优 —— 占优时你缺的从来不是价值,是把场面按死。
      ops: [{ op: 'seize', target: 'chosenEnemyGeneral' }],
      condition: { ifEnemyHeroHpBelow: 20 },
    },
    text: {
      zh: '若敵方主公血量低於 20:將一名敵方武將策反到我方場上。乘勝逐北,以歸咸陽。',
      en: 'If the enemy lord is below 20 Health: take an enemy general over to your side. Ride the victory, chase the routed, and return to Xianyang.',
    },
  },
  {
    id: 'strat-cuiku-larou',
    collectorNo: 10464,
    name: { zh: '摧枯拉朽', en: 'Snapping Dry Wood' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'jin',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    keywords: [],
    spell: {
      ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }],
      condition: { ifEnemyHeroHpBelow: 20 },
    },
    text: {
      zh: '若敵方主公血量低於 20:摧毀一名敵方武將。將軍之舉武昌,若摧枯拉朽,何所顧慮。',
      en: "If the enemy lord is below 20 Health: destroy an enemy general. Your march on Wuchang will be like snapping dry wood — what is there to hesitate over?",
    },
  },
]

// 【收敛之后的读数(600 局 / 张,五张一起量,族错误率校正线 |Δ| > 8.0)】
//   疾雷不及掩耳 +0.8 · 乘勝逐北 −1.2 · 破竹之勢 −3.0 ·
//   摧枯拉朽 −3.2 · 兵貴神速 −4.0
// 最大 |Δ| 是 4.0,六包里收得最紧的一包 —— 而它紧是因为**这一包只用板面效果**。
//
// 【这一包最值钱的一条:什么样的 op 配什么样的门槛】
// 三次改动指向同一件事:
//   面伤   兵貴神速 −8.0 → 换成对武将 3 伤 → −4.0
//   弃牌   乘勝逐北 −12.2 → 换成策反     → −1.2
//   而三张一开始就用板面效果的,放宽门槛后一次就进带。
// 面伤与弃牌都是**价值**类的 op:它们不改变场上站着谁。
// 而凡是以「你已经占优」为门槛的轴(敌方残血、我方铺开),
// 你缺的从来不是价值,是**把场面按死**。
// 反过来也成立:以「你正落后」为门槛的轴(pack32 背水),
// 面伤同样没用,因为它救不了自己。
// **两头都不要面伤 —— 面伤属于没有门槛的牌。**
//
// 【顺带:这是最后一个能干净测量的孤儿条件】
// 剩下四个(ifHandCount · ifKeywordCount · ifSupply · ifChain)全都依赖
// **牌库怎么配**或**本回合打了什么**,而 sim-cards 是单张换入 —— 量到的会是
// 「前置条件没出现」。要做它们得先换一种验证方式(比如整副牌一起换、
// 或者给预组里塞进配合卡再量),那是另一件事,不该混在卡包里做。
