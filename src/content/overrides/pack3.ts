import type { CardDef } from '../../engine/types'

// 第三卡包「附魔與謀略」。
//
// 这一包的意义不在卡数,而在于它是第一批**用得上附魔层**的卡:
// 铁壁 divineShield / 潜行 stealth / 沉默 silence / 冻结 freeze /
// 光环 aura / 回合结束 endOfTurn / 受伤触发 onDamaged / 法术伤害 spellDamage。
// 在附魔层落地之前,这些机制一个都写不出来 —— 增益直接改数值就没有撤销路径。
//
// 计价基线延续第二卡包:
//   身材 总和 ≈ cost*2+1;+1/+1 ≈ 1 费;
//   铁壁 ≈ +0/+2(但对剧毒/大怪更强,按 +1 费给);潜行 ≈ +0.5 费;
//   光环按「受益者数量 × 加成」折算,3 个受益者的 +1/+1 光环 ≈ 3 费身材。
//   法术伤害 +1 ≈ 1 费(锦囊密度高的卡组里会更强,给身材时打九折)。

// ---------- 衍生物(token:只能被召唤,不进卡包、不可构筑) ----------

export const PACK3_TOKENS: CardDef[] = [
  {
    id: 'token-si-shi',
    collectorNo: 9291,
    name: { zh: '死士', en: 'Retainer' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 1,
    attack: 1,
    health: 1,
    keywords: [],
    token: true,
    text: { zh: '士為知己者死。', en: 'A retainer dies for the one who knows him.' },
  },
  {
    id: 'token-shui-zhai',
    collectorNo: 9293,
    name: { zh: '江東水寨', en: 'Jiangdong Stockade' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'wu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 1,
    attack: 0,
    health: 4,
    keywords: ['guard'],
    token: true,
    text: { zh: '守護。舟師連營,鎖江而守。', en: 'Guard.' },
  },
  {
    id: 'token-fu-bing',
    collectorNo: 9292,
    name: { zh: '伏兵', en: 'Ambusher' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 1,
    attack: 2,
    health: 1,
    keywords: ['stealth'],
    token: true,
    text: { zh: '潛行。銜枚疾走,不聞人聲。', en: 'Stealth.' },
  },
]

// ---------- 锦囊 ----------

export const PACK3_STRATAGEMS: CardDef[] = [
  {
    id: 'strat-ming-jing',
    collectorNo: 9201,
    name: { zh: '明鏡止水', en: 'Still Mirror' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '沉默一名敵方武將。心如明鏡,萬法皆空。',
      en: 'Silence an enemy general.',
    },
  },
  {
    id: 'strat-bing-feng',
    collectorNo: 9202,
    name: { zh: '冰封千里', en: 'Thousand Li of Ice' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    text: {
      zh: '凍結所有敵方武將。朔風怒號,大河上下頓失滔滔。',
      en: 'Freeze all enemy generals.',
    },
  },
  {
    id: 'strat-tun-tian',
    collectorNo: 9203,
    name: { zh: '屯田積穀', en: 'Garrison Farms' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: {
      ops: [
        { op: 'gainMana', amount: 1, temporary: false },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '法力上限永久+1,抽一張牌。深根固本以制天下。',
      en: 'Gain 1 Mana Crystal permanently. Draw a card.',
    },
  },
  {
    id: 'strat-fen-shao',
    collectorNo: 9204,
    name: { zh: '火燒連營', en: 'Burning the Camps' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: { ops: [{ op: 'damageAll', amount: 3 }] },
    text: {
      zh: '對所有武將造成 3 點傷害。七百里連營,一炬成灰。',
      en: 'Deal 3 damage to all generals.',
    },
  },
  {
    id: 'strat-mai-fu',
    collectorNo: 9205,
    name: { zh: '設伏', en: 'Lay an Ambush' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'summon', defId: 'token-fu-bing', count: 2 }] },
    text: {
      zh: '召喚兩個 2/1 的伏兵(潛行)。林深不見人,但聞弓弦響。',
      en: 'Summon two 2/1 Ambushers with Stealth.',
    },
  },
  {
    id: 'strat-hao-ling',
    collectorNo: 9206,
    name: { zh: '三軍用命', en: 'The Whole Army Obeys' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 1, target: 'allFriendlyGenerals', duration: 'endOfTurn' },
      ],
    },
    text: {
      zh: '本回合內,友方武將+2/+1。一令既下,三軍用命。',
      en: 'Give your generals +2/+1 until end of turn.',
    },
  },
  {
    id: 'strat-tie-bi',
    collectorNo: 9207,
    name: { zh: '鐵壁令', en: 'Order of the Iron Wall' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: {
      ops: [
        { op: 'grantKeyword', keyword: 'divineShield', target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    },
    text: {
      zh: '使一名友方武將獲得鐵壁和守護。',
      en: 'Give a friendly general Divine Shield and Guard.',
    },
  },
  {
    id: 'strat-li-jian',
    collectorNo: 9208,
    name: { zh: '離間計', en: 'Sow Discord' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    spell: {
      ops: [
        { op: 'returnToHand', target: 'chosenEnemyGeneral' },
        { op: 'discardRandom', count: 1 },
      ],
    },
    text: {
      zh: '將一名敵方武將移回對手手牌,並使其隨機棄一張牌。',
      en: 'Return an enemy general to its owner’s hand, then they discard a random card.',
    },
  },
]

// ---------- 装备 ----------

export const PACK3_EQUIPMENT: CardDef[] = [
  {
    id: 'eq-tongque-jia',
    collectorNo: 9251,
    name: { zh: '銅雀甲', en: 'Bronze Sparrow Mail' },
    type: 'equipment',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 3,
    attack: 1,
    health: 2,
    keywords: ['divineShield'],
    text: {
      zh: '友方武將+1/+2並獲得鐵壁。銅雀春深,甲光向日。',
      en: 'Give a friendly general +1/+2 and Divine Shield.',
    },
  },
  {
    id: 'eq-yexing-yi',
    collectorNo: 9252,
    name: { zh: '夜行衣', en: 'Nightwalker’s Garb' },
    type: 'equipment',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    attack: 2,
    health: 0,
    keywords: ['stealth'],
    text: {
      zh: '友方武將+2/+0並獲得潛行。',
      en: 'Give a friendly general +2/+0 and Stealth.',
    },
  },
  {
    id: 'eq-xuan-jia',
    collectorNo: 9253,
    name: { zh: '玄甲', en: 'Black Cavalry Armor' },
    type: 'equipment',
    doctrine: 'royal',
    dynasty: 'tang',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    attack: 1,
    health: 4,
    keywords: ['guard', 'divineShield'],
    text: {
      zh: '友方武將+1/+4並獲得守護和鐵壁。玄甲三千,所向無前。',
      en: 'Give a friendly general +1/+4, Guard and Divine Shield.',
    },
  },
]

// ---------- 武将覆盖(挂在已有花名册上,立绘自动跟随) ----------

export const PACK3_OVERRIDES: Record<string, Partial<CardDef>> = {
  // ===== 隱逸 reclusion:潛行與法術傷害的大本營 =====
  'hist-ji-kang': {
    doctrine: 'reclusion',
    rarity: 'epic',
    cost: 4,
    attack: 4,
    health: 3,
    keywords: ['stealth'],
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '潛行。戰吼:抽一張牌。《廣陵散》於今絕矣。',
      en: 'Stealth. Battlecry: Draw a card.',
    },
  },
  'hist-xu-xiake': {
    doctrine: 'reclusion',
    cost: 5,
    attack: 5,
    health: 4,
    keywords: ['stealth'],
    battlecry: { ops: [{ op: 'gainMana', amount: 1, temporary: true }] },
    text: {
      zh: '潛行。戰吼:本回合獲得 1 點法力。達人所之未達,探人所之未知。',
      en: 'Stealth. Battlecry: Gain 1 Mana this turn only.',
    },
  },
  'hist-zheng-banqiao': {
    doctrine: 'reclusion',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    spellDamage: 1,
    text: {
      zh: '法術傷害+1。咬定青山不放鬆,立根原在破巖中。',
      en: 'Spell Damage +1.',
    },
  },
  'hist-pu-songling': {
    doctrine: 'reclusion',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: [],
    spellDamage: 1,
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: {
      zh: '法術傷害+1。戰吼:抽一張牌。寫鬼寫妖高人一等。',
      en: 'Spell Damage +1. Battlecry: Draw a card.',
    },
  },
  'hist-cao-xueqin': {
    doctrine: 'reclusion',
    rarity: 'epic',
    cost: 5,
    attack: 3,
    health: 6,
    keywords: [],
    endOfTurn: {
      ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'randomFriendlyGeneral' }],
    },
    text: {
      zh: '回合結束時:隨機一名友方武將+1/+1。十年辛苦不尋常。',
      en: 'At the end of your turn, give a random friendly general +1/+1.',
    },
  },

  // ===== 割據 separatist:光環與屯守 =====
  'du-yu': {
    doctrine: 'separatist',
    rarity: 'legendary',
    cost: 6,
    attack: 4,
    health: 6,
    keywords: ['guard'],
    aura: { scope: 'friendlyOthers', attack: 0, health: 1, keywords: ['guard'] },
    text: {
      zh: '守護。光環:其他友方武將+0/+1並獲得守護。勢如破竹,迎刃而解。',
      en: 'Guard. Aura: Your other generals have +0/+1 and Guard.',
    },
  },
  'lu-kang': {
    doctrine: 'separatist',
    cost: 5,
    attack: 3,
    health: 6,
    keywords: ['guard'],
    onDamaged: { ops: [{ op: 'gainArmor', amount: 1 }] },
    text: {
      zh: '守護。此武將受傷後,你的主公獲得 1 點護甲。西陵一戰,國賴以安。',
      en: 'Guard. After this general takes damage, your hero gains 1 Armor.',
    },
  },
  'zhou-fang': {
    doctrine: 'separatist',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: ['stealth'],
    battlecry: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '潛行。戰吼:凍結一名敵方武將。斷髮賺曹休。',
      en: 'Stealth. Battlecry: Freeze an enemy general.',
    },
  },

  // ===== 名利 fame:沉默與剝奪 =====
  // 注:不要把 sima-shi 提成传说 —— 名利预组里放了两张,传说限一张会直接卡死构筑校验
  'sima-shi': {
    doctrine: 'fame',
    cost: 5,
    attack: 4,
    health: 4,
    keywords: [],
    battlecry: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    text: {
      zh: '戰吼:沉默一名敵方武將。廢立由己,朝野側目。',
      en: 'Battlecry: Silence an enemy general.',
    },
  },
  'zhuge-ke': {
    doctrine: 'fame',
    cost: 4,
    attack: 4,
    health: 3,
    keywords: [],
    battlecry: { ops: [{ op: 'discardRandom', count: 1 }] },
    endOfTurn: { ops: [{ op: 'damage', amount: 1, target: 'friendlyHero' }] },
    text: {
      zh: '戰吼:對手隨機棄一張牌。回合結束時:你的主公受到 1 點傷害。剛愎自用,終致覆族。',
      en: 'Battlecry: Your opponent discards a random card. At the end of your turn, your hero takes 1 damage.',
    },
  },
  'cao-pi': {
    doctrine: 'fame',
    cost: 5,
    attack: 4,
    health: 4,
    keywords: [],
    battlecry: { ops: [{ op: 'grantKeyword', keyword: 'divineShield', target: 'self' }] },
    text: {
      zh: '戰吼:獲得鐵壁。受禪稱帝,魏祚始開。',
      en: 'Battlecry: Gain Divine Shield.',
    },
  },

  // ===== 禮教 ritual:法術傷害與秩序光環 =====
  'chen-qun': {
    doctrine: 'ritual',
    rarity: 'epic',
    cost: 4,
    attack: 2,
    health: 5,
    keywords: [],
    aura: { scope: 'friendlyOthers', attack: 1, health: 0 },
    text: {
      zh: '光環:其他友方武將+1/+0。九品官人,銓衡有序。',
      en: 'Aura: Your other generals have +1/+0.',
    },
  },
  'zhong-yao': {
    doctrine: 'ritual',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: [],
    spellDamage: 1,
    text: { zh: '法術傷害+1。楷法之祖,鍾王並稱。', en: 'Spell Damage +1.' },
  },
  'zheng-xuan': {
    doctrine: 'ritual',
    cost: 5,
    attack: 3,
    health: 5,
    keywords: ['guard'],
    startOfTurn: { ops: [{ op: 'heal', amount: 2, target: 'friendlyHero' }] },
    text: {
      zh: '守護。回合開始時:你的主公恢復 2 點生命。遍註群經,鄭學大行。',
      en: 'Guard. At the start of your turn, restore 2 Health to your hero.',
    },
  },

  // ===== 王道 royal:鐵壁與號令 =====
  'jiang-wei': {
    doctrine: 'royal',
    rarity: 'legendary',
    cost: 7,
    attack: 6,
    health: 6,
    keywords: ['divineShield', 'charge'],
    text: {
      zh: '鐵壁、衝鋒。九伐中原,魂歸漢室。',
      en: 'Divine Shield, Charge.',
    },
  },
  'yang-hu': {
    doctrine: 'royal',
    rarity: 'epic',
    cost: 5,
    attack: 3,
    health: 6,
    keywords: ['guard'],
    aura: { scope: 'friendlyOthers', attack: 0, health: 1 },
    text: {
      zh: '守護。光環:其他友方武將+0/+1。羊陸之交,以德懷遠。',
      en: 'Guard. Aura: Your other generals have +0/+1.',
    },
  },

  // ===== 霸道 hegemonic:燒殺與反擊 =====
  'zhang-he': {
    doctrine: 'hegemonic',
    rarity: 'epic',
    cost: 6,
    attack: 5,
    health: 6,
    keywords: ['divineShield'],
    text: { zh: '鐵壁。巧變無方,識地形營陣之勢。', en: 'Divine Shield.' },
  },
  'deng-ai': {
    doctrine: 'hegemonic',
    rarity: 'epic',
    cost: 6,
    attack: 6,
    health: 5,
    keywords: ['rush'],
    onDamaged: { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] },
    text: {
      zh: '突襲。此武將受傷後,獲得+1/+0。偷渡陰平,鄧艾裹氈而下。',
      en: 'Rush. After this general takes damage, it gains +1/+0.',
    },
  },
  'cao-zhang': {
    doctrine: 'hegemonic',
    cost: 5,
    attack: 5,
    health: 4,
    keywords: ['charge'],
    battlecry: { ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self', duration: 'endOfTurn' }] },
    text: {
      zh: '衝鋒。戰吼:本回合此武將+2/+0。黃鬚兒竟大奇也。',
      en: 'Charge. Battlecry: This general has +2/+0 this turn.',
    },
  },
}

export const PACK3_CARDS: CardDef[] = [
  ...PACK3_TOKENS,
  ...PACK3_STRATAGEMS,
  ...PACK3_EQUIPMENT,
]
