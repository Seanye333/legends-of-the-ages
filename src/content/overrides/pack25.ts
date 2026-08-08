import type { CardDef } from '../../engine/types'

// 第二十五卡包 · 授受 —— 把四条只有一两张卡的 op 铺成能构筑的轴。
//
// `npm run lint-content` 的 thin-mechanic 长期报着这四条:
//   addToHand 1 张 · banish 1 张 · shuffleIntoDeck 1 张 · transform 2 张
//
// 和上一包修的「条件没人用」是同一类问题:**引擎写好了、没人行使**。
// 区别是这四条**有人用过一两次**,所以它不是死的,是薄的 ——
// pack23 的头注把标准写得很好:「一条轴只有一张卡,它就不是流派,是趣闻:
// 抽到了很好玩,抽不到等于不存在,而且没有任何一副卡组会为它调整构筑。」
//
// 【这一包动手前先查了池子 —— 上一包的教训】
// 第二十四包我先造了十一张,然后重名闸门当场红:四个名字卡池里全都有,
// 概念一模一样。所以这次先把四条 op 的现有用例全列出来,照着**避开**:
//
//   addToHand      錦囊三授(給 3 張 0 費的「奇謀」)
//   banish         焚屍揚灰(指定放逐一名敵將)
//   shuffleIntoDeck 流言四起(往**敵方**牌庫洗 3 張廢牌)
//   transform      陳群 / 化敵為羊 —— **两张都是变羊**
//
// 所以这一包里:
//   · banish 走**不指定目标**(最强 / 最弱),不和「指定放逐」重叠
//   · shuffleIntoDeck 走 `side: 'friendly'`(往**自己**牌库洗好牌)——
//     那一支此前**一张卡都没有**(pricing.unusedWeights 早点过名)
//   · transform 走**友方升级**方向,不再是第三张变羊
//
// 【定价刻意保守】
// 上一包七张里有三张要回炉(以寡擊眾 +19.8 / 足食足兵 +13.5 / 白骨露野 +11.0)。
// 这一包全部按「宁可偏弱」写,改完照样逐张量。
//
// 【最终实测(600/400 局,对照组区间 −4.8 ~ +6.7)】
//   書佐 +5.5 · 偽書 +5.5 · 車裂 +3.5 · 圯上授書 +3.0
//   拔於行伍 +2.8 · 長平坑降 +2.3 · 壁中書 −3.3
// 七张全部落在带内。回炉的四张见各自注释 —— 其中两条值得单独记:
//
// · **書佐削身材完全没用**(2/2 +11.0 → 1/2 +12.0)。值钱的是那张白送的抽牌,
//   不是身材。只能从费用收。顺带量到一个有用的锚:同一套牌里 2 费 2/3 的白板
//   (張布)本身就是 +6.5 —— 低费卡在 桃園仁德 里天然偏高,不是这张卡的问题。
// · **壁中書 三版都是负的,而根因不在费用**:第一版洗的是「太公兵法」(0 费抽 1),
//   洗进自己牌库**净收益为零** —— 每张只抽出它自己的替代品,那是一张空牌。
//   换成「奇謀」仍然 −7.3,直到加了一张**当场兑现**的抽牌才回到 −3.3。
//   这一类「把价值洗进牌库」的慢牌正是铁律 8 说的、贪心 AI 低估的那一档;
//   我分不出「尺子偏」和「卡就是差」,所以给它一个不依赖那个判断的部分。
export const PACK25_TOKENS: CardDef[] = [
  {
    id: 'token-taigong',
    collectorNo: 10400,
    name: { zh: '太公兵法', en: 'The Taigong’s Art of War' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 0,
    keywords: [],
    token: true,
    spell: { ops: [{ op: 'draw', count: 1 }] },
    text: { zh: '抽一張牌。讀此則為王者師。', en: 'Draw a card. Read it, and you may teach kings.' },
  },
  {
    id: 'token-xianzhen',
    collectorNo: 10401,
    name: { zh: '陷陣士', en: 'Breachman' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 4,
    attack: 4,
    health: 4,
    keywords: [],
    token: true,
    text: { zh: '所攻無不破。', en: 'Whatever they charge, breaks.' },
  },
]

export const PACK25_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- addToHand
  {
    id: 'strat-yishang-shoushu',
    collectorNo: 10402,
    name: { zh: '圯上授書', en: 'The Book on the Bridge' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'addToHand', defId: 'token-taigong', count: 2 }] },
    text: {
      zh: '將兩張「太公兵法」加入手牌。孺子可教也 —— 五日後,雞鳴時再來。',
      en: 'Add two copies of The Taigong’s Art of War to your hand. The boy can be taught — come back in five days, at cockcrow.',
    },
  },
  {
    id: 'gen-shu-zuo',
    collectorNo: 10403,
    name: { zh: '書佐', en: 'Clerk of Records' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    // 第一版 2 费 2/2 实测 **+11.0**;削成 1/2 之后是 +12.0 —— **一动不动**。
    // 说明值钱的不是身材是那张白送的抽牌,所以只能从费用收。
    // 参照:同一套牌里 2 费 2/3 的白板(張布)本身就是 +6.5,低费卡在这套里天然偏高。
    cost: 3,
    attack: 2,
    health: 3,
    keywords: [],
    battlecry: { ops: [{ op: 'addToHand', defId: 'token-taigong', count: 1 }] },
    text: {
      zh: '戰吼:將一張「太公兵法」加入手牌。刀筆之吏,亦知兵事。',
      en: 'Battlecry: add a copy of The Taigong’s Art of War to your hand. Even a clerk knows something of war.',
    },
  },

  // ---------------------------------------------------------------- banish
  // 现有那张是「指定放逐一名敵將」,所以这两张都**不给选目标** —— 换来的是别的东西。
  {
    id: 'strat-che-lie',
    collectorNo: 10404,
    name: { zh: '車裂', en: 'Torn by Chariots' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // **双方同吃**:商鞅立的法最后车裂了他自己。
    // 便宜、强力、而且会反噬 —— 这是它和「焚屍揚灰」拉开的地方。
    spell: {
      ops: [
        { op: 'banish', target: 'strongestEnemyGeneral' },
        { op: 'banish', target: 'strongestFriendlyGeneral' },
      ],
    },
    text: {
      zh: '放逐雙方攻擊力最高的武將。商君之法,反噬其身。',
      en: 'Banish the strongest general on each side. Lord Shang’s own law tore him apart.',
    },
  },
  {
    id: 'strat-changping',
    collectorNo: 10405,
    name: { zh: '長平坑降', en: 'The Pits of Changping' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    // 第一版 5 费实测 +10.3 —— 对面铺开时它是无亡语的二换一
    cost: 6,
    keywords: [],
    spell: {
      ops: [
        { op: 'banish', target: 'weakestEnemyGeneral' },
        { op: 'banish', target: 'weakestEnemyGeneral' },
      ],
    },
    text: {
      zh: '放逐敵方兩名生命最低的武將 —— 不觸發亡語,也不入墓地。趙卒降者四十萬,盡坑之。',
      en: 'Banish the two enemy generals with the least Health — no deathrattles, no graveyard. Four hundred thousand surrendered, and were buried.',
    },
  },

  // ---------------------------------------------------------------- shuffleIntoDeck
  {
    id: 'strat-bi-zhong-shu',
    collectorNo: 10406,
    name: { zh: '壁中書', en: 'The Books in the Wall' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    // 【两版都是负的:2 费 −5.3、1 费 −8.2 —— 费用不是那个问题】
    // 根因是**载荷本身是空的**:「太公兵法」是 0 费抽 1,洗进自己牌库净收益为零 ——
    // 每一张都只抽出它自己的替代品。塞进手牌没问题(等于「以后抽一张」),
    // 洗进牌库就是纯稀释。改成洗「奇謀」(0 费造成 1 点),那才是真的多出来的东西。
    cost: 2,
    keywords: [],
    // `side: 'friendly'` 此前**一张卡都没有** —— 洗牌一直只有「往对面塞废牌」这一种用法。
    spell: {
      // **加一张即时抽牌**:第三版了。前两版(2 费 −5.3、1 费 −8.2、换载荷 −7.3)都靠
      // 「以后会抽到」兑现,而这把尺子(贪心 AI)对跨回合价值的估值近乎为零(铁律 8)——
      // 我分不出「尺子偏」和「卡就是差」,所以给它一个**当场就兑现**的部分,
      // 让这张卡的好坏不取决于那个判断。参照:偽書 同样是 2 费「洗 2 张 + 抽 1」,+5.5。
      ops: [
        { op: 'shuffleIntoDeck', defId: 'token-qimou', count: 3, side: 'friendly' },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '將 3 張「奇謀」洗入我方牌庫,並抽一張牌。魯壁既壞,得兵書三卷。',
      en: 'Shuffle three Stratagems into your deck and draw a card. They broke down the wall at Lu, and found three scrolls of war.',
    },
  },
  {
    id: 'strat-wei-shu',
    collectorNo: 10407,
    name: { zh: '偽書', en: 'The Forged Letter' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 4 费实测 −12.8 —— 往对面塞两张废牌几乎影响不到这一局
    cost: 2,
    keywords: [],
    spell: {
      ops: [
        { op: 'shuffleIntoDeck', defId: 'token-liu-yan', count: 2, side: 'enemy' },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '將 2 張【謠言】洗入敵方牌庫,並抽一張牌。一紙足以離其君臣。',
      en: 'Shuffle two Rumours into the enemy deck and draw a card. One sheet of paper can part a lord from his minister.',
    },
  },

  // ---------------------------------------------------------------- transform
  // 现有两张**都是变羊**(陳群 / 化敵為羊),所以这一张走反方向:把自己人变强。
  {
    id: 'strat-ba-yu-hangwu',
    collectorNo: 10408,
    name: { zh: '拔於行伍', en: 'Raised From the Ranks' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 4 费实测 −12.3
    cost: 2,
    keywords: [],
    // 变成**定值** 4/4:拿它去换一个 1/1 的衍生物是赚,去换自己的 6/6 是亏 ——
    // 这张牌的全部内容就是那个判断。
    spell: { ops: [{ op: 'transform', target: 'chosenFriendlyGeneral', into: 'token-xianzhen' }] },
    text: {
      zh: '將一名友方武將變為 4/4 的「陷陣士」。拔于行伍之間,不問所從來。',
      en: 'Turn a friendly general into a 4/4 Breachman. Raised from the ranks — no one asks where he came from.',
    },
  },
]
