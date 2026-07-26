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
  // ---- 第三个新 opcode:疑兵 copyGeneral ----
  // 照**卡面**复制我方一个武将(不带伤、不带附魔)。第三条轴:既不是场面差二、
  // 也不是牌差,而是**把你最好的那张牌再打一次** —— 天生鼓励「养一张大哥」的构筑,
  // 与铺场流是两个方向。定价靠上限:复制出来的身材恒等于那张牌本身,不会滚雪球。
  {
    id: 'strat-royal-decoy',
    collectorNo: 9940,
    name: { zh: '疑兵', en: 'Decoy Ranks' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: { ops: [{ op: 'copyGeneral', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '在你的場上複製一名友方武將(照卡面)。',
      en: 'Summon a copy of a friendly general (base stats).',
    },
  },
  {
    id: 'gen-ritual-double',
    collectorNo: 9941,
    name: { zh: '影武者', en: 'The Body Double' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    attack: 3,
    health: 3,
    keywords: [],
    battlecry: { ops: [{ op: 'copyGeneral', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '戰吼:複製一名友方武將(照卡面)。',
      en: 'Battlecry: Summon a copy of a friendly general (base stats).',
    },
  },
  // ---- 第四个新 opcode:焚尸 banish ----
  // 补的是卡池里一个真空:此前**没有任何一张牌能解掉亡语/复生流**——
  // 消灭只会把目标送进墓地,正好喂给复生。放逐则彻底带走(不算死亡、不进墓地)。
  // 定价比同效果的消灭贵一点:它是「精确解」,专治那一类卡组。
  {
    id: 'strat-heg-immolate',
    collectorNo: 9942,
    name: { zh: '焚屍揚灰', en: 'Ashes to the Wind' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    spell: { ops: [{ op: 'banish', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '放逐一名敵方武將 —— 不觸發亡語,也不入墓地。',
      en: 'Banish an enemy general — no deathrattle, and it never reaches the graveyard.',
    },
  },
  // ---- 第五个新 opcode:求贤 tutor ----
  // 从牌库检索指定**类型**的牌进手。与抽牌的差别是确定性:缺解场就搜锦囊,
  // 缺身材就搜武将。与 recruit 的差别:那个直接上场(tempo),这个进手(资源与选择权)。
  {
    id: 'strat-ritual-summons',
    collectorNo: 9943,
    name: { zh: '求賢詔', en: 'The Call for Worthies' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'tutor', kind: 'general', count: 1 }] },
    text: {
      zh: '從你的牌庫檢索一名武將進入手牌。',
      en: 'Draw a general from your deck.',
    },
  },
  {
    id: 'gen-recl-archivist',
    collectorNo: 9944,
    name: { zh: '藏書閣', en: 'The Archive' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    attack: 2,
    health: 3,
    keywords: [],
    battlecry: { ops: [{ op: 'tutor', kind: 'stratagem', count: 1 }] },
    text: {
      zh: '戰吼:從你的牌庫檢索一張錦囊進入手牌。',
      en: 'Battlecry: Draw a stratagem from your deck.',
    },
  },
]
