import type { CardDef, FieldRule } from '../../engine/types'

// 第二十二卡包 · 軍令 · 伏筆 · 兵器 · 糧道
//
// 上一包加的是「牌之外的量」(士气、天时、粮道、阵形),这一包加的是**时间**:
//   · 軍令狀 —— 这一局你打算怎么打,写在牌上,达成才兑现
//   · 伏筆   —— 埋在时间线上的一段脚本,几个回合之后才应验
//   · 耐久   —— 一把刀砍得动几次
//   · 手牌成长 —— 留在手里会长大,于是「现在打还是再等一回合」成了一个真问题
//
// 定价上的约束和上一包同源:**不能让既有卡池失效**。
// 断粮道(mill)刻意不补疲劳伤害、军令状同时只能领一道、耐久只作用于带
// durability 的新装备 —— 老卡池的 21 件装备、2000 多张武将一个字都不用改。
//
// 另外两条自我约束:
//   · 军令状的奖励**不能要目标**(达成时玩家正在做别的事,要目标会退化成随机)
//   · 伏笔埋下去是双方都看得见的(藏起来只会让对手被一段三回合前的脚本莫名打死)

// 借東風布下的那片火。规则整份内联在卡上 —— 引擎不查内容表(铁律:状态自足)。
const FIELD_CHI_BI: FieldRule = {
  id: 'field-chi-bi-huo',
  name: { zh: '赤壁火起', en: 'Chibi Ablaze' },
  text: {
    zh: '每個回合開始時,對雙方全場武將造成 2 點傷害',
    en: 'At the start of each turn, deal 2 damage to every general on both sides',
  },
  turnDamageAll: 2,
}

export const PACK22_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- 軍令狀
  {
    id: 'quest-jue-sheng',
    collectorNo: 10100,
    name: { zh: '決勝千里', en: 'Victory a Thousand Li Away' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'western-han',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    quest: {
      id: 'q-jue-sheng',
      name: { zh: '決勝千里', en: 'Victory a Thousand Li Away' },
      goal: { kind: 'playStratagems', count: 4 },
      // 奖励不要目标(见文件头)。抽满 + 全面降费 = 后半局一口气把手牌倒出来
      reward: {
        ops: [
          { op: 'draw', count: 3 },
          { op: 'reduceCost', amount: 2, filter: 'all' },
        ],
      },
    },
    text: {
      zh: '軍令:本局打出 4 張錦囊。獎勵:抽 3 張牌,手牌全部 -2 費。',
      en: 'Quest: play 4 stratagems this game. Reward: draw 3 cards and reduce your hand by 2 mana.',
    },
  },
  {
    id: 'quest-zhao-xian',
    collectorNo: 10101,
    name: { zh: '招賢令', en: 'Call for Worthies' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'wei',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    quest: {
      id: 'q-zhao-xian',
      name: { zh: '招賢令', en: 'Call for Worthies' },
      goal: { kind: 'summonGenerals', count: 5 },
      reward: {
        ops: [
          { op: 'buffStats', attack: 2, health: 2, target: 'allFriendlyGenerals' },
          { op: 'recruit', count: 2 },
        ],
      },
    },
    text: {
      zh: '軍令:本局從手牌打出 5 名武將。獎勵:我方全場 +2/+2,並從牌庫召喚 2 名武將。',
      en: 'Quest: play 5 generals from your hand this game. Reward: give your board +2/+2 and summon 2 generals from your deck.',
    },
  },
  {
    id: 'quest-zhan-jiang',
    collectorNo: 10102,
    name: { zh: '斬將令', en: 'Order of the Headsman' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    quest: {
      id: 'q-zhan-jiang',
      name: { zh: '斬將令', en: 'Order of the Headsman' },
      goal: { kind: 'killGenerals', count: 4 },
      reward: {
        ops: [
          { op: 'gainMorale', amount: 3 },
          { op: 'buffStats', attack: 3, health: 0, target: 'allFriendlyGenerals' },
        ],
      },
    },
    text: {
      zh: '軍令:本局斬殺 4 名敵將(衍生物不計)。獎勵:士氣 +3,我方全場 +3 攻擊。',
      en: 'Quest: kill 4 enemy generals this game (tokens do not count). Reward: gain 3 Morale and give your board +3 attack.',
    },
  },

  // ---------------------------------------------------------------- 伏筆
  {
    id: 'strat-qi-xing-tan',
    collectorNo: 10103,
    name: { zh: '七星壇祭風', en: 'Rite of the Seven-Star Altar' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'shu',
    rarity: 'legendary',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 全卡池第一张「约期」牌。诸葛亮筑七星坛借风,借的从来不是风,是时间。
    spell: { ops: [{ op: 'delay', turns: 2, script: { ops: [{ op: 'setField', rule: FIELD_CHI_BI, turns: 4 }] } }] },
    text: {
      zh: '伏筆:2 個我方回合後,戰場化作【赤壁火起】(每回合開始燒全場 2 點,持續 4 回合)。',
      en: 'Fuse: in 2 of your turns, the field becomes [Chibi Ablaze] — 2 damage to every general each turn, for 4 turns.',
    },
  },
  {
    id: 'strat-fu-nu',
    collectorNo: 10104,
    name: { zh: '伏弩待發', en: 'Crossbows in Waiting' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'chu-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'aoeDamage', amount: 4 }] } }] },
    text: {
      zh: '伏筆:1 個我方回合後,對敵方全場造成 4 點傷害。',
      en: 'Fuse: in 1 of your turns, deal 4 damage to all enemy generals.',
    },
  },
  {
    id: 'gen-xu-you',
    collectorNo: 10105,
    name: { zh: '許攸', en: 'Xu You' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: [],
    // 夜奔曹营献计烧乌巢 —— 战吼埋下的这把火,烧的是对手的补给
    battlecry: { ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'mill', count: 4 }] } }] },
    text: {
      zh: '戰吼:伏筆 —— 1 個我方回合後,敵方牌庫頂 4 張直接入墓。',
      en: 'Battlecry: set a fuse — in 1 of your turns, mill the top 4 cards of the enemy deck.',
    },
  },

  // ---------------------------------------------------------------- 斷糧道
  {
    id: 'strat-jue-liang-dao',
    collectorNo: 10106,
    name: { zh: '絕其糧道', en: 'Cut the Supply Road' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'warring-states',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'mill', count: 3 }] },
    text: {
      zh: '敵方牌庫頂 3 張直接入墓。',
      en: "Mill the top 3 cards of the enemy's deck.",
    },
  },
  {
    id: 'gen-wu-chao-jiao-wei',
    collectorNo: 10107,
    name: { zh: '烏巢守將', en: 'Warden of Wuchao' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 2,
    health: 5,
    keywords: ['guard'],
    // 守着粮仓的人,每个回合都在往对面的粮道上动手
    endOfTurn: { ops: [{ op: 'mill', count: 1 }] },
    text: {
      zh: '守護。我方回合結束時,敵方牌庫頂 1 張入墓。',
      en: "Guard. At the end of your turn, mill the top card of the enemy's deck.",
    },
  },
  {
    id: 'strat-liu-yan',
    collectorNo: 10108,
    name: { zh: '流言四起', en: 'Rumours Spread' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'shuffleIntoDeck', defId: 'token-liu-yan', count: 3, side: 'enemy' }] },
    text: {
      zh: '將 3 張【謠言】洗入敵方牌庫。謠言是一張什麼都不做的 2 費牌。',
      en: "Shuffle 3 [Rumour] into the enemy's deck. A Rumour is a 2-mana card that does nothing.",
    },
  },
  {
    id: 'token-liu-yan',
    collectorNo: 10109,
    name: { zh: '謠言', en: 'Rumour' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    token: true,
    // 「什么都不做」也得是一段合法脚本 —— 引擎要求锦囊有 spell/secret/combo/choose/quest
    spell: { ops: [{ op: 'draw', count: 0 }] },
    text: { zh: '空無一物。', en: 'Nothing at all.' },
  },

  // ---------------------------------------------------------------- 驅散 / 借將
  {
    id: 'strat-po-jia',
    collectorNo: 10110,
    name: { zh: '破甲', en: 'Strip the Armour' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qin',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    spell: { ops: [{ op: 'dispel', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '驅散:移除一名敵將身上的全部附魔(增益與裝備),但不封印其亡語,也不移除卡面詞條。',
      en: 'Dispel: strip every enchantment and equipment from an enemy general. Its deathrattle and printed keywords remain.',
    },
  },
  {
    id: 'strat-qu-hu-tun-lang',
    collectorNo: 10111,
    name: { zh: '驅虎吞狼', en: 'Drive the Tiger to Devour the Wolf' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    spell: { ops: [{ op: 'borrow', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '借將:奪取一名敵將,他本回合可以立刻行動,回合結束時歸還。',
      en: 'Borrow an enemy general — it can act at once and returns at the end of your turn.',
    },
  },

  // ---------------------------------------------------------------- 兵器(耐久)
  {
    id: 'eq-long-quan-jian',
    collectorNo: 10112,
    name: { zh: '龍泉劍', en: 'Longquan Blade' },
    type: 'equipment',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 3,
    attack: 4,
    health: 0,
    keywords: [],
    durability: 2,
    text: {
      zh: '裝備:+4/+0,耐久 2 —— 持有者每次發起攻擊消耗 1 點,耗盡即損毀。',
      en: 'Equip: +4/+0 with 2 Durability — one is spent on each attack, and the blade breaks at zero.',
    },
  },
  {
    id: 'eq-zhen-tian-gong',
    collectorNo: 10113,
    name: { zh: '震天弓', en: 'Skyshaker Bow' },
    type: 'equipment',
    doctrine: 'fame',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 0,
    keywords: ['siege'],
    durability: 3,
    text: {
      zh: '裝備:+2/+0 並授予【攻城】,耐久 3。',
      en: 'Equip: +2/+0 and grant [Siege], 3 Durability.',
    },
  },

  // ---------------------------------------------------------------- 手牌成長
  {
    id: 'gen-qian-long',
    collectorNo: 10114,
    name: { zh: '潛龍', en: 'The Hidden Dragon' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 2,
    attack: 1,
    health: 2,
    keywords: [],
    handGrowth: { attack: 1, health: 1 },
    text: {
      zh: '每逢我方回合結束,此牌在手中獲得 +1/+1。',
      en: 'At the end of each of your turns, this card gains +1/+1 while in your hand.',
    },
  },
  {
    id: 'gen-wo-long-shu-tong',
    collectorNo: 10115,
    name: { zh: '臥龍書童', en: "Sleeping Dragon's Page" },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'shu',
    rarity: 'epic',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 4,
    attack: 2,
    health: 3,
    keywords: [],
    handGrowth: { attack: 0, health: 2 },
    // 战吼吃墓地:等得越久、死的人越多,他带来的消息越沉
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyGraveyard' }, attack: 1, health: 0, target: 'self' }],
    },
    text: {
      zh: '每逢我方回合結束,此牌在手中獲得 +0/+2。戰吼:我方墓地每有一名武將,+1 攻擊。',
      en: 'At the end of each of your turns, this card gains +0/+2 in your hand. Battlecry: +1 attack for each general in your graveyard.',
    },
  },

  // ---------------------------------------------------------------- 繳械 / 攻城
  {
    id: 'strat-xie-jia',
    collectorNo: 10116,
    name: { zh: '卸甲', en: 'Lay Down Arms' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'song',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'grantKeyword', keyword: 'disarm', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '使一名敵將【繳械】——不能發起攻擊,但身材、光環與亡語一概不變。',
      en: 'Give an enemy general [Disarm] — it cannot attack, but keeps its stats, auras and deathrattle.',
    },
  },
  {
    id: 'gen-pi-li-che',
    collectorNo: 10117,
    name: { zh: '霹靂車', en: 'Thunderclap Trebuchet' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'siege',
    cost: 5,
    attack: 4,
    health: 6,
    keywords: ['siege'],
    text: {
      zh: '攻城:攻擊主公時額外造成 2 點傷害。',
      en: 'Siege: deals 2 extra damage when attacking a hero.',
    },
  },
  {
    id: 'gen-shen-she-shou',
    collectorNo: 10118,
    name: { zh: '神射手', en: 'Deadeye Archer' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'archer',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: [],
    // 「最」类目标的招牌卡:射的是最强的那个,不是随机的那个
    battlecry: { ops: [{ op: 'damage', amount: 3, target: 'strongestEnemyGeneral' }] },
    text: {
      zh: '戰吼:對敵方**攻擊最高**的武將造成 3 點傷害(並列時取先上場者)。',
      en: 'Battlecry: deal 3 damage to the enemy general with the highest attack (ties go to the one who arrived first).',
    },
  },
  {
    id: 'strat-qiong-kou-wu-po',
    collectorNo: 10119,
    name: { zh: '窮寇勿迫', en: 'Press Not the Cornered Foe' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'spring-autumn',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 处决线:对手血够低才打得出去 —— 反过来说,它是一张只在收官时存在的牌
    spell: {
      ops: [{ op: 'damage', amount: 6, target: 'enemyHero' }],
      condition: { ifEnemyHeroHpBelow: 15 },
    },
    text: {
      zh: '若敵方主公生命低於 15,造成 6 點傷害。',
      en: 'If the enemy hero is below 15 health, deal 6 damage.',
    },
  },
  {
    id: 'gen-tie-fu-tu',
    collectorNo: 10120,
    name: { zh: '鐵浮圖', en: 'Iron Pagoda Cavalry' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'song',
    rarity: 'epic',
    archetype: 'warrior',
    troop: 'cavalry',
    cost: 6,
    attack: 5,
    health: 6,
    keywords: [],
    // 兵种条件的招牌:凑够三骑才连成一堵墙(金军铁浮图三骑一联)
    battlecry: {
      ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'allFriendlyGenerals' }],
      condition: { ifTroopCount: { troop: 'cavalry', atLeast: 3 } },
    },
    text: {
      zh: '戰吼:若我方有 3 名以上騎兵,我方全場獲得【守護】。',
      en: 'Battlecry: if you control 3 or more Cavalry, give your board [Guard].',
    },
  },
]
