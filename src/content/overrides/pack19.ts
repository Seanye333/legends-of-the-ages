import type { CardDef, FieldRule } from '../../engine/types'

// 第十九卡包 · 天時 · 地利 · 陣型
//
// 这一包一次开三条**结构性**新轴 —— 与之前十八包都不同:那些加的是新效果,
// 这三条改的是「牌桌上有哪些维度」。
//
//   1. **兵种**(content/troops.ts):每个武将从此有一个战场角色。
//      势力回答「他是谁那边的」,兵种回答「他在战场上干什么」。
//   2. **陣型**(aura scope: 'adjacent'):只加左右紧邻的两名友军。
//      这是全游戏第一次让「摆在哪儿」有意义 —— 此前 board 顺序纯粹是渲染下标。
//   3. **戰場環境**(GameState.field):挂在战场而不是角色上的持续规则,双方同吃。
//
// 【定价的三条依据】
// · 陣型光环按「只覆盖 2 个目标」折价:同样的数值,friendlyOthers 覆盖到 5 个,
//   adjacent 最多 2 个,所以 adjacent 给到 +2/+2 也只相当于普通光环的 +1/+1 档。
//   代价换来的是**摆放决策** —— 你得规划出场顺序,还得防着对手把中间那个杀掉。
// · 兵种协同按「该兵种占卡池比例」折价:骑兵 25%、水军 9%,同样的
//   「每有一个 X 兵种 +1/+1」,水军版必须便宜或者给更高的倍率,否则没人带。
// · 战场环境**双方同吃**,所以它本身不是优势,是**赌局**:
//   你布下烈焰,烧的是双方。真正的收益来自「我这套牌不怕烧,你那套怕」。
//   因此环境卡都便宜(3~4 费),贵了就没人愿意赌。

// ---- 战场环境规则(规则整份存进 state,引擎不查表)----
export const FIELD_BLAZE: FieldRule = {
  id: 'field-chibi',
  name: { zh: '赤壁烈焰', en: 'The Fires of Red Cliff' },
  text: {
    zh: '每回合開始時,雙方全場武將受到 1 點傷害。持續 4 個回合。',
    en: 'At the start of each turn, every general takes 1 damage. Lasts 4 turns.',
  },
  turnDamageAll: 1,
}

export const FIELD_SNOW: FieldRule = {
  id: 'field-snow',
  name: { zh: '大雪封山', en: 'Snowbound Passes' },
  text: {
    zh: '雙方全場武將 -1/+2 —— 天寒難進,卻也難破。持續 4 個回合。',
    en: 'All generals get -1/+2: hard to advance, hard to break. Lasts 4 turns.',
  },
  bothStats: { attack: -1, health: 2 },
}

export const FIELD_STEPPE: FieldRule = {
  id: 'field-steppe',
  name: { zh: '平原走馬', en: 'Open Steppe' },
  text: {
    zh: '雙方騎兵 +2/+0。持續 4 個回合。',
    en: 'Cavalry on both sides get +2/+0. Lasts 4 turns.',
  },
  troopBonus: { troop: 'cavalry', attack: 2, health: 0 },
}

export const FIELD_RIVER: FieldRule = {
  id: 'field-river',
  name: { zh: '江河天險', en: 'The River as Rampart' },
  text: {
    zh: '雙方水軍 +2/+3 —— 水軍在池中稀少,所以給得比騎兵狠。持續 4 個回合。',
    en: 'Navy on both sides get +2/+3. Lasts 4 turns.',
  },
  troopBonus: { troop: 'navy', attack: 2, health: 3 },
}

export const PACK19_FIELDS: FieldRule[] = [FIELD_BLAZE, FIELD_SNOW, FIELD_STEPPE, FIELD_RIVER]

export const PACK19_CARDS: CardDef[] = [
  // ---------- 天时地利:环境锦囊 ----------
  {
    id: 'strat-field-blaze',
    collectorNo: 9920,
    // 「火燒連營」已被既有锦囊 strat-fen-shao 占用 —— 重名会进 AMBIGUOUS_NAMES,
    // 让两张卡在界面上都被迫标朝代。改用赤壁本名,和规则 id(field-chibi)也对得上。
    name: { zh: '赤壁東風', en: 'The East Wind at Red Cliff' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'setField', rule: FIELD_BLAZE, turns: 4 }] },
    text: { zh: '', en: '' }, // 文案由 withFieldText 从规则生成 —— 免得两处写走样
  },
  {
    id: 'strat-field-snow',
    collectorNo: 9921,
    name: { zh: '大雪封山', en: 'Snowbound Passes' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'song',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'setField', rule: FIELD_SNOW, turns: 4 }] },
    text: { zh: '', en: '' },
  },
  {
    id: 'strat-field-steppe',
    collectorNo: 9922,
    name: { zh: '平原走馬', en: 'Open Steppe' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'yuan',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'setField', rule: FIELD_STEPPE, turns: 4 }] },
    text: { zh: '', en: '' },
  },
  {
    id: 'strat-field-river',
    collectorNo: 9923,
    name: { zh: '江河天險', en: 'The River as Rampart' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'setField', rule: FIELD_RIVER, turns: 4 }] },
    text: { zh: '', en: '' },
  },

  // ---------- 陣型:相邻光环 ----------
  {
    id: 'gen-formation-standard',
    collectorNo: 9924,
    name: { zh: '中軍旗官', en: 'Standard Bearer' },
    type: 'general',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    attack: 2,
    health: 4,
    keywords: [],
    aura: { scope: 'adjacent', attack: 2, health: 1 },
    text: {
      zh: '陣型:與其左右緊鄰的友軍各 +2/+1。',
      en: 'Formation: the allies immediately beside this general get +2/+1.',
    },
  },
  {
    id: 'gen-formation-wing',
    collectorNo: 9925,
    name: { zh: '鶴翼陣', en: 'Crane Wing Formation' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'tang',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    aura: { scope: 'adjacent', attack: 0, health: 0, keywords: ['guard'] },
    text: {
      zh: '陣型:與其左右緊鄰的友軍獲得守護 —— 兩翼張開,護住中軍。',
      en: 'Formation: allies immediately beside this general gain Guard.',
    },
  },
  {
    id: 'gen-formation-fishscale',
    collectorNo: 9926,
    name: { zh: '魚鱗陣', en: 'Fish-Scale Formation' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 3,
    attack: 1,
    health: 5,
    keywords: ['guard'],
    aura: { scope: 'adjacent', attack: 1, health: 2 },
    text: {
      zh: '陣型:與其左右緊鄰的友軍各 +1/+2 —— 層層相疊,前後相濟。',
      en: 'Formation: allies immediately beside this general get +1/+2.',
    },
  },

  // ---------- 兵种协同 ----------
  {
    id: 'gen-troop-cavalry',
    collectorNo: 9927,
    name: { zh: '虎豹騎督', en: 'Tiger and Leopard Commander' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    battlecry: {
      ops: [
        {
          op: 'buffPer',
          per: { kind: 'friendlyTroop', troop: 'cavalry' },
          attack: 1,
          health: 1,
          target: 'self',
        },
      ],
    },
    text: {
      zh: '戰吼:場上每有一名友方騎兵,此將 +1/+1。',
      en: 'Battlecry: gain +1/+1 for each friendly Cavalry general.',
    },
  },
  {
    id: 'gen-troop-navy',
    collectorNo: 9928,
    name: { zh: '樓船將軍', en: 'Tower-Ship Admiral' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    attack: 2,
    health: 3,
    keywords: [],
    // 水军只占卡池 9%(骑兵 25%),所以倍率给到 +2/+1 才有人愿意为它构筑
    battlecry: {
      ops: [
        {
          op: 'buffPer',
          per: { kind: 'friendlyTroop', troop: 'navy' },
          attack: 2,
          health: 1,
          target: 'self',
        },
      ],
    },
    text: {
      zh: '戰吼:場上每有一名友方水軍,此將 +2/+1。',
      en: 'Battlecry: gain +2/+1 for each friendly Navy general.',
    },
  },
  {
    id: 'strat-troop-volley',
    collectorNo: 9929,
    name: { zh: '萬箭齊發', en: 'Ten Thousand Arrows' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'shu',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    spell: {
      ops: [
        {
          op: 'damagePer',
          per: { kind: 'friendlyTroop', troop: 'archer' },
          amount: 2,
          target: 'chosenEnemyGeneral',
        },
      ],
    },
    text: {
      zh: '對一名敵方武將造成傷害,數值為你場上弓弩兵數量的兩倍。',
      en: 'Deal damage to an enemy general equal to twice your number of Archer generals.',
    },
  },
  {
    id: 'gen-troop-siege',
    collectorNo: 9930,
    name: { zh: '砲車都尉', en: 'Master of Engines' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'yuan',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 6,
    attack: 4,
    health: 5,
    keywords: ['trample'],
    text: {
      zh: '碾壓。',
      en: 'Trample.',
    },
  },
]

// ---------- 讲堂实练用到的兵种,钉死 ----------
//
// 兵种默认是从攻血与朝代**推导**出来的(content/troops.ts deriveTroop)——
// 这在全池是对的(2,258 名武将不可能一个个手标),但**讲堂实练那一课除外**:
// 那一课教的就是「数清楚你有几个弓弩」,而它用的三张卡一旦身材变了,
// 推导结果就从 archer 变成 advisor,整课当场无解。
//
// 实际发生过:一次播种改动(按事迹给低费卡加微效果)动了这三张的攻血,
// lethalContent.test.ts 立刻红 —— 「lesson-troop 无解」。
// 这就是那道闸门存在的理由,也是这张表存在的理由:
// **课程依赖的事实必须显式写下来,不能靠推导碰巧成立。**
export const PACK19_TROOP_PINS: Record<string, 'archer'> = {
  'wang-xiu': 'archer',
  'sun-qian': 'archer',
  'yuan-shang': 'archer',
}

// ---------- 教具卡:讲堂实练与手搓谜题用到的生成卡,身材钉死 ----------
//
// 同一件事的第二半。实练的每一课都是**算得清的残局**:三个弓弩总攻击 6 点、
// 对面 6 血,所以「先算清楚你有几个弓弩」这句提示才成立。
// 而这些卡是生成卡 —— 一次播种改动就把 2/1 变成 1/2,那一课当场无解。
//
// 钉的只有攻血,机制照旧跟着播种走(课程不依赖它们的效果,只依赖身材)。
// 覆盖层里手写的值优先级高于生成层,所以这张表就是最终身材。
export const LESSON_STAT_PINS: Record<string, Partial<CardDef>> = {
  // 弓弩三张:课程要它们是弓兵、且总攻击 6 点(对面正好 6 血)
  'wang-xiu': { attack: 2, health: 1 },
  'sun-qian': { attack: 2, health: 1 },
  'yuan-shang': { attack: 2, health: 2 },
  // 连击课与过载课的教具:课程依赖的**是这两个机制本身**,不只是身材。
  // 重新播种把彭越从「过载」换成了「抉择」,过载那一课当场无解 ——
  // 所以这两张整份钉死,连文案一起(卡面必须和课程说的一致)。
  'hist-tian-ji': {
    attack: 4,
    health: 4,
    // 关键词也要钉:播种后来给彭越发过碾压,而钉死的文案里没写它,
    // 「带了关键词却没写在卡面上」那道闸门立刻会红(它是对的 —— 看不见的关键词是骗人)
    keywords: [],
    battlecry: { ops: [{ op: 'damage', amount: 1, target: 'chosenEnemyGeneral' }] },
    combo: { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] },
    choose: undefined,
    text: { zh: '戰吼:造成 1 點傷害。連擊:改為造成 4 點。', en: 'Battlecry: Deal 1 damage. Combo: Deal 4 instead.' },
  },
  // 手搓谜题「唯才補刀」要的是「场面差 1 点、正好靠主公技补上」——
  // 这两张一变身材(乐进 5/4→6/3、廖化 3/3→4/2),总攻击从 8 变 10,
  // 谜题当场退化成平凡打脸(闸门抓到了:「有解且非平凡」)。
  'le-jin': { attack: 5, health: 4 },
  'liao-hua': { attack: 3, health: 3 },
  'hist-peng-yue': {
    attack: 5,
    health: 5,
    keywords: [],
    battlecry: { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] },
    overload: 1,
    choose: undefined,
    text: { zh: '戰吼:造成 4 點傷害。過載:(1)', en: 'Battlecry: Deal 4 damage. Overload: (1)' },
  },
}
