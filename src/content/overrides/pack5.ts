import type { CardDef } from '../../engine/types'

// 第五卡包「抉擇與奇謀」。
//
// 前四包做的是「场面上能发生什么」和「决策的时间轴」;这一包做的是**决策的宽度**。
// 诊断很清楚:2200 张卡只有 40 种效果结构、79% 是 6 个战吼套路,打十局就见全了。
// 加卡治不了这个 —— 自动播种的池子只会让那 6 个套路各多几百张。
// 所以这一包全是手工卡,只做两件事:
//   - 抉择 choose:一张牌两个模式,当场选。同样两张牌,选法不同局势就不同。
//   - 发现 discover:亮 3 张挑 1 张。让**每一局**抽到的答案都不一样。
//
// 计价延续前几包:身材/效果总量 ≈ cost*2+1。
//   抉择:两个模式各按「比同费单模式弱半档」定,平均下来同费,强度挪到了选择上。
//   发现:约等于「抽一张针对性的牌」,比无脑抽牌贵半费(你能挑,方差更低)。

// ---------- 抉择锦囊 ----------
export const PACK5_CHOOSE: CardDef[] = [
  {
    id: 'strat-choose-royal',
    collectorNo: 9401,
    name: { zh: '文武之道', en: 'The Civil and the Martial' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 一张牌覆盖「续航」与「铺场」两种需求:缺牌选抽,压场选加血
    choose: {
      modes: [
        {
          label: { zh: '修文:抽两张牌', en: 'Civil: draw two cards' },
          script: { ops: [{ op: 'draw', count: 2 }] },
        },
        {
          label: { zh: '偃武:全体友军 +0/+2', en: 'Martial: friendly generals +0/+2' },
          script: { ops: [{ op: 'buffStats', attack: 0, health: 2, target: 'allFriendlyGenerals' }] },
        },
      ],
    },
    text: {
      zh: '抉择:抽两张牌;或使我方所有武将 +0/+2。',
      en: 'Choose One — Draw two cards; or give friendly generals +0/+2.',
    },
  },
  {
    id: 'strat-choose-ritual',
    collectorNo: 9402,
    name: { zh: '刑德二柄', en: 'Punishment and Virtue' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 控场二选一:要「拆效果」选沉默,要「抢节奏」选冻结
    choose: {
      modes: [
        {
          label: { zh: '德化:沉默一个敌将', en: 'Virtue: silence an enemy general' },
          script: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
        },
        {
          label: { zh: '刑禁:冻结一个敌将', en: 'Punishment: freeze an enemy general' },
          script: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
        },
      ],
    },
    text: {
      zh: '抉择:沉默一个敌将;或冻结一个敌将。',
      en: 'Choose One — Silence an enemy general; or freeze it.',
    },
  },
  {
    id: 'strat-choose-fame',
    collectorNo: 9403,
    name: { zh: '軟硬兼施', en: 'Carrot and Stick' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 「全伤害」还是「伤害+续航」—— 斩杀线上选前者,拉扯期选后者
    choose: {
      modes: [
        {
          label: { zh: '硬:造成 4 点伤害', en: 'Hard: deal 4 damage' },
          script: { ops: [{ op: 'damage', amount: 4, target: 'chosenAny' }] },
        },
        {
          label: { zh: '软:造成 2 点并抽一张', en: 'Soft: deal 2 and draw a card' },
          script: {
            ops: [
              { op: 'damage', amount: 2, target: 'chosenAny' },
              { op: 'draw', count: 1 },
            ],
          },
        },
      ],
    },
    text: {
      zh: '抉择:造成 4 点伤害;或造成 2 点伤害并抽一张牌。',
      en: 'Choose One — Deal 4 damage; or deal 2 damage and draw a card.',
    },
  },
  {
    id: 'strat-choose-separatist',
    collectorNo: 9404,
    name: { zh: '離間', en: 'Sow Discord' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    choose: {
      modes: [
        {
          label: { zh: '削其锋:一个敌将 -3/-0', en: 'Blunt: an enemy general -3/-0' },
          script: {
            ops: [{ op: 'buffStats', attack: -3, health: 0, target: 'chosenEnemyGeneral' }],
          },
        },
        {
          label: { zh: '乱其心:对手随机弃一张牌', en: 'Confuse: opponent discards a card' },
          script: { ops: [{ op: 'discardRandom', count: 1 }] },
        },
      ],
    },
    text: {
      zh: '抉择:使一个敌将 -3/-0;或令对手随机弃一张牌。',
      en: 'Choose One — Give an enemy general -3/-0; or the opponent discards a card.',
    },
  },
]

// ---------- 抉择武将(覆盖安全花名册) ----------
export const PACK5_CHOOSE_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 鍾會(割据,原 7 费 6/7):抉择战吼 —— 潜行(留着做威胁)或冲锋(立刻换血)
  'zhong-hui': {
    cost: 6,
    attack: 5,
    health: 5,
    choose: {
      modes: [
        {
          label: { zh: '谋:获得潜行', en: 'Scheme: gain Stealth' },
          script: { ops: [{ op: 'grantKeyword', keyword: 'stealth', target: 'self' }] },
        },
        {
          label: { zh: '断:获得冲锋', en: 'Strike: gain Charge' },
          script: { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'self' }] },
        },
      ],
    },
    text: {
      zh: '抉择战吼:获得潜行;或获得冲锋。淮南三叛,反覆之间。',
      en: 'Choose One Battlecry — gain Stealth; or gain Charge.',
    },
  },
  // 姜維(王道,原 7 费 6/6 传奇):抉择战吼 —— 守护(顶住)或对敌将 4 点(点杀)
  // 清掉播种给它的旧战吼:抉择卡的效果全在 modes 里,留着 battlecry 是死代码。
  'jiang-wei': {
    cost: 6,
    attack: 5,
    health: 6,
    battlecry: undefined,
    choose: {
      modes: [
        {
          label: { zh: '守:获得守护', en: 'Hold: gain Guard' },
          script: { ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'self' }] },
        },
        {
          label: { zh: '伐:对一个敌将造成 4 点', en: 'Strike: 4 damage to an enemy general' },
          script: { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] },
        },
      ],
    },
    text: {
      zh: '抉择战吼:获得守护;或对一个敌将造成 4 点伤害。九伐中原,攻守在心。',
      en: 'Choose One Battlecry — gain Guard; or deal 4 damage to an enemy general.',
    },
  },
}

// ---------- 发现 ----------
export const PACK5_DISCOVER: CardDef[] = [
  {
    id: 'strat-discover-stratagem',
    collectorNo: 9411,
    name: { zh: '錦囊妙計', en: 'A Sealed Stratagem' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '发现一张锦囊。三个锦囊,临机而拆。',
      en: 'Discover a stratagem.',
    },
  },
  {
    id: 'strat-discover-general',
    collectorNo: 9412,
    name: { zh: '招賢納士', en: 'Summon the Worthy' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'western-han',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'discover', pool: 'myGeneral' }] },
    text: {
      zh: '发现一名武将。',
      en: 'Discover a general.',
    },
  },
  {
    id: 'strat-discover-keyword',
    collectorNo: 9413,
    name: { zh: '不拘一格', en: 'By Any Talent' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 跨主义找关键词:割据缺什么工具就现找什么
    spell: { ops: [{ op: 'discover', pool: 'anyKeyword' }] },
    text: {
      zh: '发现一名带关键词的武将(不限主义)。',
      en: 'Discover a general with a keyword (any doctrine).',
    },
  },
  {
    id: 'strat-discover-costly',
    collectorNo: 9414,
    name: { zh: '千金買骨', en: 'Bones of a Steed' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 找大哥:霸道后期直接翻出一张 6 费以上的猛将
    spell: { ops: [{ op: 'discover', pool: 'costlyGeneral' }] },
    text: {
      zh: '发现一名 6 费或以上的武将。',
      en: 'Discover a general costing 6 or more.',
    },
  },
]

// ---------- build-around:发现流传奇(覆盖安全花名册) ----------
//
// 这两张不是新机制,是**围绕发现构筑一整套牌的锚点**:身材够硬能上场,
// 战吼给一次高质量发现,值得你为它塞更多发现卡把「找答案」这条线做厚。
// 真正会把整副牌费用曲线扭掉的 build-around(比如「你的某类牌费用-2」)
// 需要新的 opcode(费用消减 / 牌生成),那是下一包的事,这里不硬塞。
export const PACK5_LEGEND_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 田豐(礼教,原 5 费 3/2 稀有):升传奇,做成「谋士锚点」——
  // 战吼发现一张锦囊,礼教控场靠它源源不断找到对的解场。
  'tian-feng': {
    rarity: 'legendary',
    cost: 5,
    attack: 4,
    health: 5,
    battlecry: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '战吼:发现一张锦囊。刚而犯上,谋无不中。',
      en: 'Battlecry: Discover a stratagem.',
    },
  },
  // 沮授(礼教,原 5 费 3/6 稀有):升传奇,做成「大哥锚点」——
  // 身板厚、战吼翻出一个 6 费以上的猛将,慢速卡组的中期铰链。
  'ju-shou': {
    rarity: 'legendary',
    cost: 6,
    attack: 5,
    health: 7,
    keywords: ['guard'],
    battlecry: { ops: [{ op: 'discover', pool: 'costlyGeneral' }] },
    text: {
      zh: '守护。战吼:发现一名 6 费或以上的武将。监军之谋,未尝不允。',
      en: 'Guard. Battlecry: Discover a general costing 6 or more.',
    },
  },
}

export const PACK5_CARDS: CardDef[] = [...PACK5_CHOOSE, ...PACK5_DISCOVER]

// 覆盖表合并:抉择武将 + 传奇锚点
export const PACK5_OVERRIDES: Record<string, Partial<CardDef>> = {
  ...PACK5_CHOOSE_OVERRIDES,
  ...PACK5_LEGEND_OVERRIDES,
}
