import type { CardDef } from '../../engine/types'

// 第六卡包 · 主义流派 payoff。
//
// 数据显示六主义其实已经有**自发的倾向**(播种自然长出来的):
//   王道 65 吸血 + 44 守护 · 霸道 55 冲锋 + 19 单挑 · 礼教 129 战吼几乎无关键词 ·
//   名利 304 张却毫无倾向 · 割据 守护/突袭 · 隐逸 25 潜行
// 但这些只是「倾向」,没有 payoff 卡去奖励它。这一批给每个主义一套 build-around,
// 把「六个略有偏向的池」做成「六种真正不同的玩法」。
//
// 名利是重点救助对象:最大的池(304)却最没身份。给它一整套**资源/法术/铺垫**
// 的价值流派 —— 抽牌、法术伤害、法力增益,让它成为「靠牌差和锦囊赢」的控制向主义。

// ---------- 新卡(锦囊为主,不需要立绘) ----------
export const PACK6_DOCTRINE_CARDS: CardDef[] = [
  // ===== 王道 · 吸血续航 =====
  {
    id: 'strat-royal-transfuse',
    collectorNo: 9601,
    name: { zh: '仁心仁術', en: 'Healing Hand' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 吸血流的启动器:给一个友军吸血。配合王道的 65 张吸血底子做续航。
    spell: { ops: [{ op: 'grantKeyword', keyword: 'lifesteal', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '使一名友方武將獲得吸血。',
      en: 'Give a friendly general Lifesteal.',
    },
  },

  // ===== 霸道 · 冲锋压制 =====
  {
    id: 'strat-hegemon-blitz',
    collectorNo: 9611,
    name: { zh: '雷霆突進', en: 'Thunder Rush' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    overload: 1,
    // 一波流终结:全体本回合获得冲锋。霸道 55 张冲锋底子之外,把静态铺场也变成脸伤。
    spell: {
      ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'allFriendlyGenerals', duration: 'endOfTurn' }],
    },
    text: {
      zh: '本回合你的所有武將獲得衝鋒。過載 (1)。',
      en: 'Give all your generals Charge this turn. Overload (1).',
    },
  },

  // ===== 礼教 · 控场锁定 =====
  {
    id: 'strat-ritual-freeze-all',
    collectorNo: 9621,
    name: { zh: '禮法森嚴', en: 'The Rites Bind All' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 礼教是控场向(129 战吼、几乎无关键词):一记全场冻结换一个回合的喘息。
    spell: { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    text: {
      zh: '凍結所有敵方武將。',
      en: 'Freeze all enemy generals.',
    },
  },

  // ===== 名利 · 资源/法术/铺垫(重点救助) =====
  {
    id: 'strat-fame-treasury',
    collectorNo: 9631,
    name: { zh: '積財巨萬', en: 'Coffers Overflowing' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'draw', count: 2 }] },
    text: { zh: '抽兩張牌。', en: 'Draw two cards.' },
  },
  {
    id: 'strat-fame-levy',
    collectorNo: 9632,
    name: { zh: '鹽鐵之利', en: 'Salt and Iron' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 名利的 ramp:永久 +1 法力上限 + 抽一张。让价值流有加速。
    spell: {
      ops: [
        { op: 'gainMana', amount: 1, temporary: false },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '法力上限永久 +1,並抽一張牌。',
      en: 'Gain a permanent Mana Crystal and draw a card.',
    },
  },
  {
    id: 'strat-fame-spellbook',
    collectorNo: 9633,
    name: { zh: '奇門遁甲', en: 'The Hidden Arts' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 发现一张锦囊 —— 价值流靠它找到对的答案。名利的锦囊密度最高,发现命中率也高。
    spell: { ops: [{ op: 'discover', pool: 'myStratagem' }] },
    text: {
      zh: '發現一張錦囊。',
      en: 'Discover a stratagem.',
    },
  },

  // ===== 割据 · 突袭换血 =====
  {
    id: 'strat-sep-raid',
    collectorNo: 9641,
    name: { zh: '輕騎劫營', en: 'Camp Raid' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    keywords: [],
    // 割据是节奏/换血向:给一个友军突袭 + 冲上去。
    spell: { ops: [{ op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' }] },
    text: {
      zh: '使一名友方武將獲得突襲。',
      en: 'Give a friendly general Rush.',
    },
  },

  // ===== 隐逸 · 潜行连招 =====
  {
    id: 'strat-reclusion-veil',
    collectorNo: 9651,
    name: { zh: '深藏若虛', en: 'Hidden Depths' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 隐逸潜行流:给一个友军潜行+2/+2,养一个刺客。
    spell: {
      ops: [
        { op: 'grantKeyword', keyword: 'stealth', target: 'chosenFriendlyGeneral' },
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
      ],
    },
    text: {
      zh: '使一名友方武將獲得潛行,並 +2/+2。',
      en: 'Give a friendly general Stealth and +2/+2.',
    },
  },
]

// ---------- 覆盖真名将(流派 payoff 锚点,带立绘) ----------
export const PACK6_DOCTRINE_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 王道 · 羊祜(5 费 3/6 epic):吸血流的顶点 —— 每有一个吸血友军 +1/+1,并自带吸血
  'yang-hu': {
    keywords: ['lifesteal'],
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyKeyword', keyword: 'lifesteal' }, attack: 1, health: 1, target: 'self' }],
    },
    text: {
      zh: '吸血。戰吼:此將 +1/+1,每有一個吸血友軍。懷柔之政,以德服人。',
      en: 'Lifesteal. Battlecry: gain +1/+1 for each friendly Lifesteal general.',
    },
  },
  // 霸道 · 張郃(6 费 5/6 epic):冲锋流的顶点 —— 获得冲锋,每有一个冲锋友军对敌方主公 1 点
  'zhang-he': {
    battlecry: {
      ops: [
        { op: 'grantKeyword', keyword: 'charge', target: 'self' },
        { op: 'buffPer', per: { kind: 'friendlyKeyword', keyword: 'charge' }, attack: 1, health: 0, target: 'self' },
      ],
    },
    text: {
      zh: '戰吼:獲得衝鋒,並 +1/+0 每有一個衝鋒友軍。巧變之將,料戰勢地形。',
      en: 'Battlecry: gain Charge, and +1/+0 for each friendly Charge general.',
    },
  },
  // 名利 · 樗里疾(8 费 7/7 legendary):法术流锚点 —— 常驻法术伤害 +2 + 战吼抽一张
  'hist-chuli-ji': {
    spellDamage: 2,
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '你的錦囊傷害 +2。戰吼:抽一張牌。智囊樗里,秦之謀主。',
      en: 'Your stratagems deal 2 extra damage. Battlecry: draw a card.',
    },
  },
  // 名利 · 李左車(7 费 6/7 epic):牌差引擎 —— 战吼抽两张,手牌越多抽越多
  'hist-li-zuoche': {
    battlecry: {
      ops: [{ op: 'draw', count: 2 }],
    },
    text: {
      zh: '戰吼:抽兩張牌。廣武君之謀,百戰百勝在握。',
      en: 'Battlecry: draw two cards.',
    },
  },
  // 隐逸 · 嵇康(4 费 4/3 epic):潜行连招 —— 获得潜行;连击则改为潜行且额外抽一张
  'hist-ji-kang': {
    combo: {
      ops: [
        { op: 'grantKeyword', keyword: 'stealth', target: 'self' },
        { op: 'draw', count: 1 },
      ],
    },
    battlecry: {
      ops: [{ op: 'grantKeyword', keyword: 'stealth', target: 'self' }],
    },
    text: {
      zh: '戰吼:獲得潛行。連擊:改為獲得潛行並抽一張。廣陵散絕,竹林遺風。',
      en: 'Battlecry: gain Stealth. Combo: gain Stealth and draw a card.',
    },
  },
}
