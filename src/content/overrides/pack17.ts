import type { CardDef } from '../../engine/types'

// 第十七卡包 · 策反(seize)。
//
// 新 opcode seize:把敌方一名武将夺到我方场上 —— 三国最有味道的一手,阵前倒戈。
// 这是引擎里**第一个改变单位归属**的效果(此前只有生成、消灭、弹回、变形)。
//
// 为什么它值得一个新 opcode:现有词汇没法表达「场面差二」。
// 消灭是「敌方 -1」,策反是「敌方 -1 且我方 +1」—— 同样的费用买到双倍摆动,
// 所以定价必须狠:六费起步、且多数带限制(只夺小的 / 一次性)。
//
// 三条设计约束(见 resolve.ts 的 seize 分支):
//   · 我方满场则**无事发生**,不是把目标杀掉 —— 免得出现「打出去反而亏一个单位」的坑;
//   · 夺来的单位当回合不能动,否则等于附赠冲锋;
//   · 伤害/附魔/消耗标记原样带走 —— 它还是那个单位,只是换了旗号。
//
// 主义归属:名利(权谋)与霸道(降将)各一路。名利拿全能版但贵,霸道拿随机的便宜版,
// 两条线不撞车。
//
// 同包第二个新 opcode:**反间 stealCard** —— 从对手手牌随机拿一张过来。
// 它不动场面,动的是**手牌资源**:对手少一张、你多一张,同样是差二,但走的是牌差轴
// 而不是场面轴。刻意不新增事件(复用 CardDiscarded + CardGenerated,后者的 defId
// 本就对对手抹去),所以 UI 三处零改动。

export const PACK17_CARDS: CardDef[] = [
  {
    id: 'strat-fame-defect',
    collectorNo: 9986,
    name: { zh: '策反', en: 'Turn the Coat' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 7,
    keywords: [],
    // 全能版:任意敌将。七费 —— 场面差二的效果,贵到只能当胜负手,不能当解场。
    spell: { ops: [{ op: 'seize', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '奪取一名敵方武將,將其收歸己方。',
      en: 'Take control of an enemy general.',
    },
  },
  {
    id: 'gen-fame-lobbyist',
    collectorNo: 9987,
    name: { zh: '說客', en: 'The Persuader' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'legendary',
    archetype: 'strategist',
    cost: 8,
    attack: 4,
    health: 4,
    keywords: [],
    // 战吼带策反:比锦囊贵一费,但多留一个 4/4 在场 —— 传说该有的分量。
    battlecry: { ops: [{ op: 'seize', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '戰吼:奪取一名敵方武將。',
      en: 'Battlecry: Take control of an enemy general.',
    },
  },
  {
    id: 'gen-heg-recruiter',
    collectorNo: 9988,
    name: { zh: '收編降卒', en: 'Absorb the Defeated' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 6,
    attack: 4,
    health: 5,
    keywords: [],
    // 廉价的限制版:**随机**一名敌将 —— 不可靠,所以比说客便宜两费。
    // 呼应「收编降卒」:乱军之中裹挟一个过来,挑不了人。
    // (刻意不新增「已受伤」这类目标筛选 —— 那要动目标解析与合法目标 UI 两层,
    //  为一张卡不值当;随机已经把强度压到该有的位置。)
    battlecry: {
      ops: [{ op: 'seize', target: 'randomEnemyGeneral' }],
    },
    text: {
      zh: '戰吼:隨機奪取一名敵方武將。',
      en: 'Battlecry: Take control of a random enemy general.',
    },
  },
  {
    id: 'strat-fame-sow',
    collectorNo: 9989,
    name: { zh: '竊書', en: 'Purloined Dispatch' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 牌差轴的差二:对手 -1 张、你 +1 张。三费 —— 比场面的策反便宜得多,
    // 因为拿到的是随机一张(可能是废牌),而且不解决当下的场面。
    spell: { ops: [{ op: 'stealCard', count: 1 }] },
    text: {
      zh: '從對手手牌隨機取走一張,收入你的手牌。',
      en: "Take a random card from your opponent's hand.",
    },
  },
  {
    id: 'gen-recl-spy',
    collectorNo: 9990,
    name: { zh: '間者', en: 'The Infiltrator' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: ['stealth'],
    // 潜行 + 战吼偷牌:隐逸的路数是「不接触地占便宜」,潜行让它多活一轮。
    battlecry: { ops: [{ op: 'stealCard', count: 1 }] },
    text: {
      zh: '潛行。戰吼:從對手手牌隨機取走一張。',
      en: "Stealth. Battlecry: Take a random card from your opponent's hand.",
    },
  },
]
