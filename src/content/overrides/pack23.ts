import type { CardDef } from '../../engine/types'

// 第二十三卡包 · 兵勢 —— **一张新轴都不开**。
//
// 上一包一口气加了六条维度,但每条只有一到两张卡在用(`npm run lint-content`
// 的 thin-mechanic 一次报了五条)。一条轴只有一张卡,它就不是流派,是趣闻:
// 抽到了很好玩,抽不到等于不存在,而且**没有任何一副卡组会为它调整构筑**。
//
// 这一包补的就是这件事:军令 / 伏笔 / 断粮 / 借将 / 驱散 / 耐久 / 缴械 / 攻城
// 各自铺到三四张,再补上「最」类目标与新条件的载体。
// 判断一条轴够不够厚的标准很土但好用:**这条轴能不能撑起一副三十张的牌组**。
//
// 定价沿用 statBudget(攻+血 ≈ 2×费+1),带效果的从身材里扣点数。
export const PACK23_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- 斷糧道(磨牌流)
  {
    id: 'gen-cao-cao-shao-liang',
    collectorNo: 10200,
    name: { zh: '焚糧校尉', en: 'Granary Burner' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'warrior',
    troop: 'cavalry',
    cost: 2,
    attack: 2,
    health: 2,
    keywords: ['rush'],
    battlecry: { ops: [{ op: 'mill', count: 2 }] },
    text: { zh: '戰吼:敵方牌庫頂 2 張入墓。', en: "Battlecry: mill the top 2 cards of the enemy's deck." },
  },
  {
    id: 'strat-jiao-tu',
    collectorNo: 10201,
    name: { zh: '焦土千里', en: 'A Thousand Li of Ash' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'jin',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // 磨牌流的终结手:对面牌库越空,这一张越接近直接斩杀
    spell: { ops: [{ op: 'mill', count: 8 }] },
    text: { zh: '敵方牌庫頂 8 張入墓。', en: "Mill the top 8 cards of the enemy's deck." },
  },
  {
    id: 'gen-liang-dao-guan',
    collectorNo: 10202,
    name: { zh: '轉運使', en: 'Commissioner of Transport' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'song',
    rarity: 'rare',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 4,
    attack: 2,
    health: 6,
    keywords: ['guard'],
    // 磨牌流最缺的是「活到那一天」,所以这条轴的中坚是一堵会持续磨的墙
    endOfTurn: { ops: [{ op: 'mill', count: 2 }] },
    text: {
      zh: '守護。我方回合結束時,敵方牌庫頂 2 張入墓。',
      en: "Guard. At the end of your turn, mill the top 2 cards of the enemy's deck.",
    },
  },
  {
    id: 'strat-kong-cang',
    collectorNo: 10203,
    name: { zh: '倉廩已空', en: 'The Granaries Are Bare' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'ming',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 磨牌流的 payoff:墓地厚了才打得动。和 friendlyGraveyard 那条计数配对
    spell: {
      ops: [{ op: 'damagePer', per: { kind: 'friendlyGraveyard' }, amount: 1, target: 'enemyHero' }],
    },
    text: {
      zh: '對敵方主公造成傷害,數值等於我方墓地中的武將數。',
      en: 'Deal damage to the enemy hero equal to the number of generals in your graveyard.',
    },
  },

  // ---------------------------------------------------------------- 軍令狀
  {
    id: 'quest-shou-tu',
    collectorNo: 10204,
    name: { zh: '守土令', en: 'Hold the Ground' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'southern-northern',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    quest: {
      id: 'q-shou-tu',
      name: { zh: '守土令', en: 'Hold the Ground' },
      goal: { kind: 'summonGenerals', count: 4 },
      // 防守向军令:奖励是一堵墙 + 一层甲,给的是「再撑十回合」的能力
      reward: {
        ops: [
          { op: 'grantKeyword', keyword: 'guard', target: 'allFriendlyGenerals' },
          { op: 'buffStats', attack: 0, health: 3, target: 'allFriendlyGenerals' },
          { op: 'gainArmor', amount: 10 },
        ],
      },
    },
    text: {
      zh: '軍令:本局從手牌打出 4 名武將。獎勵:我方全場獲得【守護】與 +0/+3,主公獲得 10 點護甲。',
      en: 'Quest: play 4 generals from hand. Reward: your board gains [Guard] and +0/+3; your hero gains 10 Armor.',
    },
  },
  {
    id: 'quest-po-di',
    collectorNo: 10205,
    name: { zh: '破敵令', en: 'Break Their Line' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'tang',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    quest: {
      id: 'q-po-di',
      name: { zh: '破敵令', en: 'Break Their Line' },
      goal: { kind: 'playStratagems', count: 3 },
      reward: { ops: [{ op: 'aoeDamage', amount: 5 }, { op: 'gainMorale', amount: 2 }] },
    },
    text: {
      zh: '軍令:本局打出 3 張錦囊。獎勵:對敵方全場造成 5 點傷害,士氣 +2。',
      en: 'Quest: play 3 stratagems. Reward: deal 5 damage to all enemy generals and gain 2 Morale.',
    },
  },

  // ---------------------------------------------------------------- 伏筆
  {
    id: 'strat-qian-shi-ye-xing',
    collectorNo: 10206,
    name: { zh: '潛師夜行', en: 'March by Night' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'chu-han',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 伏笔的另一种用法:不是打伤害,是**在未来给自己一个大场面**
    spell: { ops: [{ op: 'delay', turns: 2, script: { ops: [{ op: 'recruit', count: 3 }] } }] },
    text: {
      zh: '伏筆:2 個我方回合後,從牌庫召喚 3 名武將。',
      en: 'Fuse: in 2 of your turns, summon 3 generals from your deck.',
    },
  },
  {
    id: 'gen-shou-ling-zhe',
    collectorNo: 10207,
    name: { zh: '守陵人', en: 'Keeper of the Tombs' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qin',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    // 亡语埋伏笔:杀了他反而给自己招来一件麻烦事
    deathrattle: {
      ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'resurrect', count: 2 }] } }],
    },
    text: {
      zh: '亡語:伏筆 —— 1 個我方回合後,從墓地復生 2 名武將。',
      en: 'Deathrattle: set a fuse — in 1 of your turns, resurrect 2 generals.',
    },
  },
  {
    id: 'strat-qi-nian-zhi-yue',
    collectorNo: 10208,
    name: { zh: '克期會獵', en: 'A Date for the Hunt' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'wu',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [
        { op: 'draw', count: 1 },
        { op: 'delay', turns: 1, script: { ops: [{ op: 'buffStats', attack: 3, health: 3, target: 'allFriendlyGenerals' }] } },
      ],
    },
    text: {
      zh: '抽 1 張牌。伏筆:1 個我方回合後,我方全場 +3/+3。',
      en: 'Draw a card. Fuse: in 1 of your turns, give your board +3/+3.',
    },
  },

  // ---------------------------------------------------------------- 借將 / 驅散
  {
    id: 'gen-zong-heng-jia',
    collectorNo: 10209,
    name: { zh: '縱橫家', en: 'The Persuader' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    // 借将进战吼:一次「借人打人」的爆发,而且借来的当回合就能动
    battlecry: { ops: [{ op: 'borrow', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '戰吼:借將 —— 奪取一名敵將,他本回合可立刻行動,回合結束時歸還。',
      en: 'Battlecry: borrow an enemy general — it can act at once and returns at end of turn.',
    },
  },
  {
    id: 'strat-jie-jia',
    collectorNo: 10210,
    name: { zh: '解甲歸田', en: 'Lay Down the Armour' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'western-han',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 群体驱散:专治「把一个大哥堆满增益」的那一路
    spell: { ops: [{ op: 'dispel', target: 'allEnemyGenerals' }] },
    text: {
      zh: '驅散敵方全場:移除他們身上的全部附魔(不封亡語、不移除卡面詞條)。',
      en: 'Dispel every enemy general — strip their enchantments, leaving deathrattles and printed keywords.',
    },
  },
  {
    id: 'gen-yu-shi',
    collectorNo: 10211,
    name: { zh: '御史', en: 'The Censor' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'ming',
    rarity: 'rare',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 3,
    attack: 3,
    health: 3,
    keywords: [],
    battlecry: { ops: [{ op: 'dispel', target: 'strongestEnemyGeneral' }] },
    text: {
      zh: '戰吼:驅散敵方**攻擊最高**的武將身上的全部附魔。',
      en: 'Battlecry: dispel every enchantment from the enemy general with the highest attack.',
    },
  },

  // ---------------------------------------------------------------- 兵器(耐久)
  {
    id: 'eq-liang-yin-qiang',
    collectorNo: 10212,
    name: { zh: '亮銀槍', en: 'Bright Silver Spear' },
    type: 'equipment',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'legendary',
    archetype: 'warrior',
    cost: 5,
    attack: 6,
    health: 0,
    keywords: ['windfury'],
    durability: 2,
    // 耐久与傳承叠在一起:刀会断,但断之前会先传给下一个人
    heirloom: true,
    text: {
      zh: '裝備:+6/+0 並授予【風怒】,耐久 2。傳承:持有者陣亡時改挂到另一名友軍身上。',
      en: 'Equip: +6/+0 and grant [Windfury], 2 Durability. Heirloom: passes to another ally when the bearer falls.',
    },
  },
  {
    id: 'eq-lian-nu',
    collectorNo: 10213,
    name: { zh: '連弩', en: 'Repeating Crossbow' },
    type: 'equipment',
    doctrine: 'ritual',
    dynasty: 'shu',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 3,
    attack: 1,
    health: 0,
    keywords: ['windfury', 'siege'],
    durability: 4,
    // 低加成 + 高耐久 + 风怒:它卖的不是一刀多疼,是**砍很多次**
    text: {
      zh: '裝備:+1/+0 並授予【風怒】【攻城】,耐久 4。',
      en: 'Equip: +1/+0 and grant [Windfury] and [Siege], 4 Durability.',
    },
  },

  // ---------------------------------------------------------------- 繳械 / 攻城
  {
    id: 'gen-tao-shou',
    collectorNo: 10214,
    name: { zh: '絆馬索手', en: 'Rope-and-Snare Man' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    battlecry: { ops: [{ op: 'grantKeyword', keyword: 'disarm', target: 'strongestEnemyGeneral' }] },
    text: {
      zh: '戰吼:使敵方**攻擊最高**的武將【繳械】。',
      en: 'Battlecry: give the enemy general with the highest attack [Disarm].',
    },
  },
  {
    id: 'gen-lou-che',
    collectorNo: 10215,
    name: { zh: '樓車', en: 'Siege Tower' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'yuan',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'siege',
    cost: 4,
    attack: 3,
    health: 5,
    keywords: ['siege', 'guard'],
    text: {
      zh: '守護。攻城:攻擊主公時額外造成 2 點傷害。',
      en: 'Guard. Siege: 2 extra damage when attacking a hero.',
    },
  },
  {
    id: 'strat-pao-shi',
    collectorNo: 10216,
    name: { zh: '砲石如雨', en: 'A Rain of Stones' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'song',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 器械流的 payoff:凑够三台机械才放得出这一波
    spell: {
      ops: [{ op: 'aoeDamage', amount: 3 }, { op: 'damage', amount: 3, target: 'enemyHero' }],
      condition: { ifTroopCount: { troop: 'siege', atLeast: 2 } },
    },
    text: {
      zh: '若我方有 2 台以上器械:對敵方全場造成 3 點傷害,並對敵方主公造成 3 點。',
      en: 'If you control 2 or more Siege units: deal 3 damage to all enemy generals and 3 to the enemy hero.',
    },
  },

  // ---------------------------------------------------------------- 「最」類 / 新條件
  {
    id: 'gen-jiu-huo-zhe',
    collectorNo: 10217,
    name: { zh: '軍醫', en: 'Field Physician' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'sui',
    rarity: 'common',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 2,
    attack: 1,
    health: 3,
    keywords: [],
    // 每回合先救伤得最重的那个 —— 「最」类目标最自然的用法
    endOfTurn: { ops: [{ op: 'heal', amount: 3, target: 'weakestFriendlyGeneral' }] },
    text: {
      zh: '我方回合結束時,為**現存生命最低**的友方武將恢復 3 點。',
      en: 'At the end of your turn, restore 3 health to your general with the lowest health.',
    },
  },
  {
    id: 'strat-qiong-tu-mo-zhui',
    collectorNo: 10218,
    name: { zh: '殘陽如血', en: 'Sun Like Blood' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'five-dynasties',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // 后期牌:第 10 回合之前它是一张废牌,之后是一记重锤
    spell: {
      ops: [{ op: 'damageAll', amount: 4 }, { op: 'damage', amount: 4, target: 'enemyHero' }],
      condition: { ifTurnAtLeast: 10 },
    },
    text: {
      zh: '第 10 回合起可用:對雙方全場造成 4 點傷害,並對敵方主公造成 4 點。',
      en: 'From turn 10 on: deal 4 damage to every general and 4 to the enemy hero.',
    },
  },
  {
    id: 'gen-lao-bing',
    collectorNo: 10219,
    name: { zh: '老卒', en: 'The Old Soldier' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qing',
    rarity: 'epic',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 2,
    health: 3,
    keywords: [],
    // 手牌成长第三张:留得越久越硬,配合囤牌流
    handGrowth: { attack: 1, health: 1 },
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'handCount' }, attack: 0, health: 1, target: 'self' }],
    },
    text: {
      zh: '每逢我方回合結束,此牌在手中獲得 +1/+1。戰吼:手牌每有一張,+0/+1。',
      en: 'At the end of each of your turns, this card gains +1/+1 in hand. Battlecry: +0/+1 for each card in your hand.',
    },
  },
  {
    id: 'gen-si-zhan-zhi-shi',
    collectorNo: 10220,
    name: { zh: '死戰之士', en: 'Fight-to-the-Last'},
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'southern-northern',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 5,
    attack: 4,
    health: 5,
    keywords: [],
    // 敌众我寡:对面铺得越满他越强 —— 落后方才吃得到的那一类 payoff
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'enemyGenerals' }, attack: 1, health: 1, target: 'self' }],
    },
    text: {
      zh: '戰吼:敵方場上每有一名武將,此牌 +1/+1。',
      en: 'Battlecry: +1/+1 for each general the enemy controls.',
    },
  },
]
