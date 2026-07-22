import type { CardDef } from '../../engine/types'

// 第六卡包 · 势力羁绊(朝代)。
//
// `dynasty` 标签每张卡都有,引擎的 friendlyDynastyGenerals / ifDynastyCount 也早写好了,
// 但全卡池只有 17 张在用它 —— 一条几乎全新的构筑轴。这一批把它点亮。
//
// 三国(魏蜀吴)是这游戏的情感核心,却恰恰是最小的池(魏 18 / 蜀 23 / 吴 14),
// 而且每个三国名将都已经是签名卡或预组卡,没有一张能覆盖。所以三国势力这样做:
//   1. 用**精锐衍生物**(虎豹骑/白毦兵/丹阳兵,都带对应势力标签)把小池子撑起来 ——
//      「势力召集」卡一次铺两个同势力身体,羁绊 payoff 立刻就有东西可数;
//   2. payoff 卡同时也让**已有的**魏蜀吴签名卡(关羽/曹操/周瑜…)更强 ——
//      羁绊奖励的身体不只是 token,还有你本来就在打的那些名将。
// 大池(春秋/唐/宋)不缺可覆盖的真名将,直接覆盖做示范,证明这条轴不止于三国。
//
// 主义分配顺带服务「主义身份」:蜀→王道铺场、魏→霸道压制、吴→割据守成换血。

// ---------- 精锐衍生物(token:只被召唤,不进卡包/构筑/发现) ----------
export const PACK6_TOKENS: CardDef[] = [
  {
    id: 'token-hubao-qi',
    collectorNo: 9591,
    name: { zh: '虎豹騎', en: 'Tiger-Leopard Cavalry' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 1,
    keywords: ['charge'],
    token: true,
    text: { zh: '曹魏精騎,一觸即發。', en: "Cao Wei's elite horse — strikes on arrival." },
  },
  {
    id: 'token-baimao-bing',
    collectorNo: 9592,
    name: { zh: '白毦兵', en: 'White-Plume Guard' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    token: true,
    text: { zh: '蜀漢禁衛,陳到所領。', en: "Shu Han's household guard, led by Chen Dao." },
  },
  {
    id: 'token-danyang-bing',
    collectorNo: 9593,
    name: { zh: '丹陽兵', en: 'Danyang Levy' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'wu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 1,
    health: 3,
    keywords: ['guard'],
    token: true,
    text: { zh: '江東勁卒,山越之精。', en: "Jiangdong's hardy levy from the hill tribes." },
  },
]

// ---------- 三国势力包 + 大池示范(新卡) ----------
export const PACK6_DYNASTY_CARDS: CardDef[] = [
  // ===== 魏 · 霸道压制 =====
  {
    id: 'strat-wei-muster',
    collectorNo: 9501,
    name: { zh: '虎豹突擊', en: 'Tiger-Leopard Charge' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'summon', defId: 'token-hubao-qi', count: 2 }] },
    text: { zh: '召喚兩個 2/1 衝鋒的虎豹騎。', en: 'Summon two 2/1 Tiger-Leopard Cavalry with Charge.' },
  },
  {
    id: 'gen-wei-marshal',
    collectorNo: 9502,
    name: { zh: '魏軍都督', en: 'Wei Grand Marshal' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 5,
    attack: 4,
    health: 4,
    keywords: [],
    // 身板刻意压低(4/4 是 5 费的弱身材),换来「每有一个魏势力友军 +1/+1」——
    // 铺开魏势力后它自己就是大哥。含自己,空场也至少 +1/+1。
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' }],
    },
    text: {
      zh: '戰吼:此將 +1/+1,每有一個魏勢力友軍。',
      en: 'Battlecry: gain +1/+1 for each friendly Wei general.',
    },
  },
  {
    id: 'strat-wei-hegemon',
    collectorNo: 9503,
    name: { zh: '挾令諸侯', en: 'Command the Lords' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 羁绊门槛 payoff:3 个魏势力才解锁全场清扫。攒到位是一记横扫。
    spell: {
      ops: [{ op: 'aoeDamage', amount: 3 }],
      condition: { ifDynastyCount: { dynasty: 'wei', atLeast: 3 } },
    },
    text: {
      zh: '若你有至少 3 個魏勢力武將,對所有敵方武將造成 3 點傷害。',
      en: 'If you control at least 3 Wei generals, deal 3 damage to all enemy generals.',
    },
  },

  // ===== 蜀 · 王道铺场 =====
  {
    id: 'strat-shu-muster',
    collectorNo: 9511,
    name: { zh: '白毦精兵', en: 'The White Plumes' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'summon', defId: 'token-baimao-bing', count: 2 }] },
    text: { zh: '召喚兩個 2/2 的白毦兵。', en: 'Summon two 2/2 White-Plume Guards.' },
  },
  {
    id: 'gen-shu-chancellor',
    collectorNo: 9512,
    name: { zh: '蜀漢丞相府', en: 'Chancellery of Shu' },
    type: 'general',
    doctrine: 'royal',
    dynasty: 'shu',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    attack: 2,
    health: 5,
    keywords: [],
    // 号令:所有蜀势力(含关羽张飞赵云等已有签名卡)+1/+1。铺场王道的黏合剂。
    battlecry: {
      ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'friendlyDynastyGenerals' }],
    },
    text: {
      zh: '戰吼:使你所有蜀勢力武將 +1/+1。',
      en: 'Battlecry: give all your Shu generals +1/+1.',
    },
  },
  {
    id: 'strat-shu-oath',
    collectorNo: 9513,
    name: { zh: '興復漢室', en: 'Restore the Han' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'shu',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 2, target: 'friendlyDynastyGenerals' },
        { op: 'draw', count: 1 },
      ],
      condition: { ifDynastyCount: { dynasty: 'shu', atLeast: 3 } },
    },
    text: {
      zh: '若你有至少 3 個蜀勢力武將,使他們 +2/+2 並抽一張牌。',
      en: 'If you control at least 3 Shu generals, give them +2/+2 and draw a card.',
    },
  },

  // ===== 吴 · 割据守成 =====
  {
    id: 'strat-wu-muster',
    collectorNo: 9521,
    name: { zh: '丹陽勁卒', en: 'Danyang Levies' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'summon', defId: 'token-danyang-bing', count: 2 }] },
    text: { zh: '召喚兩個 1/3 守護的丹陽兵。', en: 'Summon two 1/3 Danyang Levies with Guard.' },
  },
  {
    id: 'gen-wu-admiral',
    collectorNo: 9522,
    name: { zh: '江東水都督', en: 'Jiangdong Admiral' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 5,
    attack: 3,
    health: 6,
    keywords: ['guard'],
    // 吴走「守住再反打」:守护身板 + 每有一个吴势力回一点血给主公(靠 heal friendlyHero)
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 0, target: 'self' }],
    },
    text: {
      zh: '守護。戰吼:此將 +1/+0,每有一個吳勢力友軍。',
      en: 'Guard. Battlecry: gain +1/+0 for each friendly Wu general.',
    },
  },

  // ===== 大池示范:覆盖真名将(证明这条轴不止三国) =====
  // 姜子牙(春秋 · 王道 · 10 费 7/10):春秋号令,把整片春秋池拉起来
  // 管仲(春秋 · 名利):经济向,凑够春秋就补法力
  // 武則天(唐 · 王道):唐势力羁绊的顶点
]

// 覆盖真名将(大池羁绊锚点)。这些人本来就在池子里、有立绘,直接改效果最划算。
export const PACK6_DYNASTY_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 姜子牙(春秋 10 费 7/10 传奇):战吼给所有春秋友军 +2/+2 —— 春秋大池的号令锚
  'hist-jiang-ziya': {
    battlecry: {
      ops: [{ op: 'buffStats', attack: 2, health: 2, target: 'friendlyDynastyGenerals' }],
    },
    text: {
      zh: '戰吼:使你所有春秋勢力武將 +2/+2。太公在此,諸侯來朝。',
      en: 'Battlecry: give all your Spring & Autumn generals +2/+2.',
    },
  },
  // 管仲(春秋 7 费 4/5 传奇 · 名利):战吼若你有≥2春秋,永久 +2 法力上限 —— 经济锚
  'hist-guan-zhong': {
    battlecry: {
      ops: [{ op: 'gainMana', amount: 2, temporary: false }],
      condition: { ifDynastyCount: { dynasty: 'spring-autumn', atLeast: 2 } },
    },
    text: {
      zh: '戰吼:若你有至少 2 個春秋勢力武將,法力上限永久 +2。倉廩實而知禮節。',
      en: 'Battlecry: if you control at least 2 Spring & Autumn generals, gain 2 permanent Mana Crystals.',
    },
  },
  // 武則天(唐 10 费 6/13 传奇):战吼此将 +2/+2 每有一个唐势力友军 —— 唐大池顶点
  'hist-wu-zetian': {
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 2, health: 2, target: 'self' }],
    },
    text: {
      zh: '戰吼:此將 +2/+2,每有一個唐勢力友軍。日月當空,萬象更始。',
      en: 'Battlecry: gain +2/+2 for each friendly Tang general.',
    },
  },
}
