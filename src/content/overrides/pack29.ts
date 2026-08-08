import type { CardDef } from '../../engine/types'

// 第二十九卡包 · 八陣 —— 把阵形从「四种」补成八种。
//
// 【原来那四种里,真正能摆出来的只有两种】
// 长蛇要**满员**、鱼鳞要三个**同兵种**,门槛高到实战里基本见不到;
// 于是这条轴上真正在跑的只有锋矢(≥3)和鹤翼(≥4)。
// 「八阵图还差一半」写在 ROADMAP 上,但更该修的其实是**门槛**,不是数量。
//
// 所以补的四种刻意全部**只看战线人数与位置**,门槛 3~4 人:
//   偃月 ≥4 → 正中一名        方圓 ≥4 → 锚点与左右紧邻
//   雁行 ≥3 → 锚点**右侧**全部  衡軛 ≥4 → 除首尾之外的中军
//
// 【两条设计上的用意】
// 1. **摆位第一次真的有讲究。** 雁行摆在最右一个人都吃不到,方圓 摆在边上
//    只有两个人吃 —— 这两种是八阵里唯二真的读锚点位置的。
//    `legalCommands` 早就为阵形展开了插入位(见 pack21 的注释),
//    在此之前那个展开几乎没有用武之地。
// 2. **衡軛 是 鶴翼 的补集**(那个给两翼、这个给中军),两张同场正好覆盖全场。
//    这是这条轴上第一个真正的**组合**,而不是又一张各玩各的旗。
//
// 【定价参照 pack21 的四张旗】
// 锋矢 4 费 2/5(+3/+0 给一人)· 鹤翼 5 费 3/5。
// 吃到的人越多、每人给得越少 —— 雁行/衡軛 能覆盖三四个,所以给 +1/+1;
// 偃月 只给一个人,给 +3/+0(和锋矢同档,区别是位置在中不在头)。
//
// 【最终实测(600 局,对照组区间 −4.8 ~ +6.7)】
//   雁行 +6.5 · 衡軛 +5.3 · 偃月 −1.2 · 方圓 −1.2
//
// 【第一版三张全在带外,根因是同一个:门槛写成了 4】
//   偃月 −7.3 · 方圓 −3.0 · 衡軛 −10.5
// 「站满四个人」正是这把尺子(贪心 AI)最不擅长的事,门槛写在 4 等于这条阵形
// 大部分时候不存在 —— 和原有的 长蛇(满员)、鱼鳞(三个同兵种)栽的是同一件事。
// 统一降到 3 之后:偃月 −7.3 → **−1.2**、方圓 −3.0 → −1.2、衡軛 −10.5 → −6.8。
// **这是这一包真正的结论:阵形的强度几乎全写在门槛上,不在增益数值上。**
//
// 衡軛 还多走了两步,顺带量到一件要记住的事:
//   5 费 3/5 = −6.8 → 4 费 3/4 = **+8.5** → 4 费 2/4 = +5.3
// 一费之差跨了 15.3 个点,远大于「+1 费 ≈ −5.0pp」那条通则。
// 它的基准是 坐斷東南(六套里最弱的一套),而那一套的跨度本来就比别套大三倍
// (见 ROADMAP 逐套零点那一节)—— **在它上面量到的每一格都要打折看**。
export const PACK29_CARDS: CardDef[] = [
  {
    id: 'gen-yanyue-qi',
    collectorNo: 10421,
    name: { zh: '偃月陣旗', en: 'Banner of the Crescent' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 4,
    attack: 2,
    health: 5,
    keywords: [],
    formation: {
      id: 'formation-crescent',
      name: { zh: '偃月陣', en: 'Crescent' },
      shape: 'crescent',
      attack: 3,
      health: 0,
    },
    text: {
      zh: '偃月陣:你的戰線滿 3 人時,正中一名友軍 +3/+0。兩翼張如彎月,中軍獨出。',
      en: 'Crescent: while you have 3 or more generals, your centre general gets +3/+0. The wings curve back like a crescent, and the centre stands out alone.',
    },
  },
  {
    id: 'gen-fangyuan-qi',
    collectorNo: 10422,
    name: { zh: '方圓陣旗', en: 'Banner of the Square' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 4,
    attack: 2,
    health: 6,
    keywords: ['guard'],
    formation: {
      id: 'formation-square',
      name: { zh: '方圓陣', en: 'Square' },
      shape: 'square',
      attack: 0,
      health: 2,
    },
    text: {
      zh: '方圓陣:你的戰線滿 3 人時,此旗與左右緊鄰的友軍各 +0/+2。結方圓以自守,敵不能入。',
      en: 'Square: while you have 3 or more generals, this banner and the generals beside it each get +0/+2. Form the square and hold; they cannot get in.',
    },
  },
  {
    id: 'gen-yanxing-qi',
    collectorNo: 10423,
    name: { zh: '雁行陣旗', en: 'Banner of the Wild Geese' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'archer',
    cost: 5,
    attack: 3,
    health: 5,
    keywords: [],
    formation: {
      id: 'formation-goose',
      name: { zh: '雁行陣', en: 'Wild Geese' },
      shape: 'goose',
      attack: 1,
      health: 1,
    },
    text: {
      zh: '雁行陣:你的戰線滿 3 人時,此旗**右側**的友軍各 +1/+1。雁行斜出,首尾相銜。',
      en: 'Wild Geese: while you have 3 or more generals, friendly generals to the right of this banner each get +1/+1. The geese fly slanted, head to tail.',
    },
  },
  {
    id: 'gen-heng-e-qi',
    collectorNo: 10424,
    name: { zh: '衡軛陣旗', en: 'Banner of the Yoke' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    // 5 费 3/5 = -6.8,4 费 3/4 = **+8.5** —— 一费之差跨了 15.3 个点,
    // 远大于「+1 费 ≈ -5.0pp」那条通则。基准是 坐斷東南(六套里最弱的一套),
    // 那一套的跨度本来就比别套大三倍(见 ROADMAP 逐套零点那一节),
    // 所以在它上面量到的每一格都要打折看。停在 4 费但把身材收一档。
    cost: 4,
    attack: 2,
    health: 4,
    keywords: [],
    formation: {
      id: 'formation-yoke',
      name: { zh: '衡軛陣', en: 'Yoke' },
      shape: 'yoke',
      attack: 1,
      health: 1,
    },
    text: {
      zh: '衡軛陣:你的戰線滿 3 人時,除最左與最右之外的友軍各 +1/+1。轅有衡,衡有軛,中軍所在。',
      en: 'Yoke: while you have 3 or more generals, friendly generals other than the leftmost and rightmost each get +1/+1. The yoke sits at the centre of the shaft.',
    },
  },
]
