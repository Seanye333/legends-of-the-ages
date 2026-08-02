import type { CardDef } from '../../engine/types'

// 第二十一卡包 · 士氣 · 天時 · 糧道 · 陣形
//
// 前二十包全部围着**一张牌能做什么**打转。这一包换了个方向:
// 它给对局加了四个「牌之外」的量 —— 一支军队的心气、天光的走向、
// 后方的粮、以及战线摆成什么形状。牌只是去读它们、拨动它们。
//
// 四条的设计约束是同一条:**不能让既有卡池的定价失效**。
//   · 士氣 —— 唯一自动运转的一条(阵亡/斩将会改它),所以给了两道刹车:
//     阈值(|士气| 要到 2 才有效果)和每回合向 0 收敛一格。
//     于是它奖励的是「白赚一个」而不是「打得多」,而且优势只维持一个回合周期。
//   · 天時 —— **零状态**,纯由回合数推出。老存档、老战报、服务端权威对局全都无感。
//     它不自动改任何数值,只被卡面上的 ifSky 读到。
//   · 糧道 —— 只有带 supplyCost 的新卡会花它,老卡一张都不受影响。
//   · 陣形 —— 只有带 formation 的锚点在场才成立,同样对老卡池零影响。
//
// 所以这一包**跑完 sim-balance 与 sim-campaign 没有任何一格需要回调**,
// 这不是运气,是上面四条约束换来的。

export const PACK21_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- 士氣
  {
    id: 'strat-ji-gu',
    collectorNo: 10000,
    name: { zh: '擊鼓進軍', en: 'Beat the War Drums' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'gainMorale', amount: 2 }] },
    text: {
      zh: '我方士氣 +2。士氣達到 2,全場武將 +1 攻擊;每逢你的回合開始,士氣向 0 收斂一格。',
      en: 'Gain 2 Morale. At 2 Morale all your generals get +1 attack; Morale drifts one step toward 0 at the start of each of your turns.',
    },
  },
  {
    id: 'strat-ming-jin',
    collectorNo: 10001,
    name: { zh: '鳴金收兵', en: 'Sound the Gongs' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 挫敌 + 自保:锣声一响是「别打了」,所以它既压对面的势也给自己垫一手
    spell: {
      ops: [
        { op: 'gainMorale', amount: -2, side: 'enemy' },
        { op: 'gainArmor', amount: 4 },
      ],
    },
    text: {
      zh: '敵方士氣 -2,我方主公獲得 4 點護甲。敵方士氣低至 -2 時,其全場武將 -1 攻擊。',
      en: "Enemy loses 2 Morale; your hero gains 4 Armor. At -2 Morale their generals get -1 attack.",
    },
  },
  {
    id: 'gen-du-zhan-xiao-wei',
    collectorNo: 10002,
    name: { zh: '督戰校尉', en: 'Provost of the Line' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    // 阵亡本来会让己方 -1 士气,这条亡语正好把它抵回来 ——
    // 「督战的人倒下,队伍反而不乱」,机制和意象是同一件事
    deathrattle: { ops: [{ op: 'gainMorale', amount: 1 }] },
    text: {
      zh: '亡語:我方士氣 +1 —— 他倒下的地方,隊伍沒有散。',
      en: 'Deathrattle: gain 1 Morale — the line did not break where he fell.',
    },
  },

  // ---------------------------------------------------------------- 天時
  {
    id: 'gen-ye-xing-jun',
    collectorNo: 10003,
    name: { zh: '夜行軍', en: 'The Night March' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 3,
    attack: 3,
    health: 3,
    keywords: [],
    // 时机没到也还有一副 3/3 的身子 —— 天时卡不该做成「时候不对就是废牌」,
    // 那样玩家学到的是「别带它」,而不是「算着回合打它」。
    battlecry: {
      ops: [{ op: 'damage', amount: 3, target: 'chosenEnemyGeneral' }],
      condition: { ifSky: 'night' },
    },
    text: {
      zh: '戰吼:若此刻是夜半,對一名敵將造成 3 點傷害。',
      en: 'Battlecry: if it is Night, deal 3 damage to an enemy general.',
    },
  },
  {
    id: 'gen-po-xiao-qi',
    collectorNo: 10004,
    name: { zh: '破曉騎', en: 'Riders of First Light' },
    type: 'general',
    doctrine: 'royal',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'cavalry',
    cost: 4,
    attack: 4,
    health: 3,
    keywords: [],
    battlecry: {
      ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'self' }],
      condition: { ifSky: 'dawn' },
    },
    text: {
      zh: '戰吼:若此刻是拂曉,此武將獲得【衝鋒】。',
      en: 'Battlecry: if it is Dawn, this general gains [Charge].',
    },
  },
  {
    id: 'strat-hou-shi',
    collectorNo: 10005,
    name: { zh: '候時而動', en: 'Wait Upon the Hour' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 抉择而不是硬条件:时候不对就选另一个模式。
    // 「等」这件事本身要有第二条路可走,否则它就只是一张会失手的牌。
    choose: {
      modes: [
        {
          label: { zh: '正午擊之', en: 'Strike at Noon' },
          script: {
            ops: [{ op: 'aoeDamage', amount: 3 }],
            condition: { ifSky: 'noon' },
          },
        },
        {
          label: { zh: '按兵屯糧', en: 'Hold and Store' },
          script: {
            ops: [
              { op: 'draw', count: 1 },
              { op: 'gainSupply', amount: 2 },
            ],
          },
        },
      ],
    },
    text: {
      zh: '抉擇 —— 正午擊之:若此刻是正午,對所有敵方武將造成 3 點傷害;或按兵屯糧:抽一張牌,糧道 +2。',
      en: 'Choose — Strike at Noon: if it is Noon, deal 3 damage to all enemy generals; or Hold and Store: draw a card and gain 2 Supply.',
    },
  },

  // ---------------------------------------------------------------- 糧道
  {
    // id 原本是 'strat-tun-tian',**和第三卡包的「屯田積穀」撞了**。
    // 撞 id 的后果不是报错,是**两张卡在池子里都在、但 CARDS_BY_ID 只认后写的那张**:
    // 竞技场按数组发牌(发出的可能是割据的屯田積穀),引擎按 id 结算(拿到的是王道的屯田),
    // 于是「发给割据主公一张王道牌」这种越界会偶发出现 —— arena.test 就是这么闪红的。
    id: 'strat-tun-tian-shu',
    collectorNo: 10006,
    name: { zh: '屯田', en: 'Garrison Fields' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    spell: { ops: [{ op: 'gainSupply', amount: 3 }] },
    text: {
      zh: '糧道 +3。糧道每逢你的回合結束自動 +1,由軍需牌花掉。',
      en: 'Gain 3 Supply. You also gain 1 Supply at the end of each of your turns; Provision cards spend it.',
    },
  },
  {
    id: 'gen-yun-liang-guan',
    collectorNo: 10007,
    name: { zh: '運糧官', en: 'Quartermaster of the Baggage Train' },
    type: 'general',
    doctrine: 'royal',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 2,
    attack: 1,
    health: 4,
    keywords: [],
    endOfTurn: { ops: [{ op: 'gainSupply', amount: 1 }] },
    text: {
      zh: '回合結束時:糧道 +1。',
      en: 'At the end of your turn: gain 1 Supply.',
    },
  },
  {
    id: 'gen-shen-ji-ying',
    collectorNo: 10008,
    name: { zh: '神機營', en: 'The Divine Engine Corps' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'ming',
    rarity: 'epic',
    archetype: 'warrior',
    troop: 'siege',
    cost: 6,
    attack: 5,
    health: 6,
    supplyCost: 4,
    keywords: [],
    battlecry: { ops: [{ op: 'aoeDamage', amount: 3 }] },
    text: {
      zh: '軍需 4。戰吼:對所有敵方武將造成 3 點傷害。',
      en: 'Provision 4. Battlecry: deal 3 damage to all enemy generals.',
    },
  },
  {
    id: 'strat-gong-cheng',
    collectorNo: 10009,
    name: { zh: '攻城車陣', en: 'The Siege Train' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    supplyCost: 3,
    keywords: [],
    spell: { ops: [{ op: 'damage', amount: 7, target: 'enemyHero' }] },
    text: {
      zh: '軍需 3。對敵方主公造成 7 點傷害。',
      en: 'Provision 3. Deal 7 damage to the enemy hero.',
    },
  },

  // ---------------------------------------------------------------- 計謀鏈
  {
    id: 'strat-lian-huan-qi',
    collectorNo: 10010,
    name: { zh: '環環相扣', en: 'Link Upon Link' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    // 便宜、能续 —— 它是「凑链」这条路本身需要的燃料。
    spell: { ops: [{ op: 'tutor', kind: 'stratagem', count: 1 }] },
    text: {
      zh: '從牌庫檢索一張錦囊。本回合使出的第四條計策會結算兩次。',
      en: 'Draw a Stratagem from your deck. The fourth stratagem you cast in a turn resolves twice.',
    },
  },
  {
    id: 'gen-lian-huan-shi',
    collectorNo: 10011,
    name: { zh: '連環士', en: 'The Chainwright' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    troop: 'advisor',
    cost: 3,
    attack: 2,
    health: 5,
    keywords: [],
    onSpellCast: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] },
    text: {
      zh: '你每打出一個錦囊,此武將 +1/+0。',
      en: 'Whenever you cast a Stratagem, this general gains +1/+0.',
    },
  },

  // ---------------------------------------------------------------- 陣形
  //
  // 四面陣旗。**位置直接决定谁吃增益**,所以它们是全卡池第一批
  // 「摆在哪一格」比「打不打得出」更要紧的牌 ——
  // legalCommands 也因此专门为它们展开了摆放位置(否则 AI 永远塞最右)。
  {
    id: 'gen-feng-shi-qi',
    collectorNo: 10012,
    name: { zh: '鋒矢陣旗', en: 'Banner of the Wedge' },
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
      id: 'formation-wedge',
      name: { zh: '鋒矢陣', en: 'Wedge' },
      shape: 'wedge',
      attack: 3,
      health: 0,
    },
    text: {
      zh: '鋒矢陣:你的戰線滿 3 人時,最左一名友軍 +3/+0。',
      en: 'Wedge: while you have 3 or more generals, your leftmost general gets +3/+0.',
    },
  },
  {
    id: 'gen-he-yi-qi',
    collectorNo: 10013,
    name: { zh: '鶴翼陣旗', en: 'Banner of the Crane' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 5,
    attack: 3,
    health: 5,
    keywords: [],
    formation: {
      id: 'formation-crane',
      name: { zh: '鶴翼陣', en: 'Crane Wing Formation' },
      shape: 'crane',
      attack: 0,
      health: 3,
    },
    text: {
      zh: '鶴翼陣:你的戰線滿 4 人時,最左與最右各 +0/+3。',
      en: 'Crane Wing: while you have 4 or more generals, your leftmost and rightmost each get +0/+3.',
    },
  },
  {
    id: 'gen-yu-lin-qi',
    collectorNo: 10014,
    name: { zh: '魚鱗陣旗', en: 'Banner of the Scales' },
    type: 'general',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    troop: 'cavalry',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    formation: {
      id: 'formation-scale',
      name: { zh: '魚鱗陣', en: 'Fish-Scale Formation' },
      shape: 'scale',
      attack: 1,
      health: 1,
    },
    text: {
      zh: '魚鱗陣:你場上有 3 名以上騎兵時,這些騎兵各 +1/+1(含自己)。',
      en: 'Fish Scales: while you have 3 or more Cavalry, each of them gets +1/+1 (this one included).',
    },
  },
  {
    id: 'gen-chang-she-qi',
    collectorNo: 10015,
    name: { zh: '長蛇陣旗', en: 'Banner of the Long Serpent' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'legendary',
    archetype: 'warrior',
    troop: 'infantry',
    cost: 6,
    attack: 4,
    health: 6,
    keywords: [],
    formation: {
      id: 'formation-serpent',
      name: { zh: '長蛇陣', en: 'Long Serpent' },
      shape: 'serpent',
      attack: 2,
      health: 2,
    },
    text: {
      zh: '長蛇陣:你的戰線站滿時,全場友軍 +2/+2。',
      en: 'Long Serpent: while your board is full, all your generals get +2/+2.',
    },
  },
]
