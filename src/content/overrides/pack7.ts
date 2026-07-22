import type { CardDef } from '../../engine/types'

// 第七卡包 · 费用消减 / 牌生成 / 人海。
//
// 用上一批的两个新原语(reduceCost / addToHand)把「势力/流派」之上真正的
// 构筑深度做出来:
//   - build-around 大哥:「使你手牌中某类牌更便宜」,一张牌定义一整副的费用曲线。
//   - 价值/工具箱流:靠生成牌源源不断,把牌差滚成胜势。
//   - 人海:token 生成器 + 「每有一个友军」payoff,一条完整的铺场流派。

// ---------- 衍生物 ----------
export const PACK7_TOKENS: CardDef[] = [
  {
    id: 'token-qimou',
    collectorNo: 9791,
    name: { zh: '奇謀', en: 'Sudden Ploy' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 0,
    keywords: [],
    token: true,
    spell: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
    text: { zh: '造成 1 點傷害。急中生智,信手拈來。', en: 'Deal 1 damage.' },
  },
  {
    id: 'token-xiangyong',
    collectorNo: 9792,
    name: { zh: '鄉勇', en: 'Village Levy' },
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
    text: { zh: '保境安民,一呼百應。', en: 'Levied from the villages to defend their homes.' },
  },
]

// ---------- 新卡 ----------
export const PACK7_CARDS: CardDef[] = [
  // ===== 费用消减 =====
  {
    id: 'strat-fame-tempo',
    collectorNo: 9701,
    name: { zh: '運籌帷幄', en: 'Plans in the Tent' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 名利法术流的节奏卡:一口气把手里锦囊全打折,接一套连锁。
    spell: { ops: [{ op: 'reduceCost', amount: 1, filter: 'stratagems' }] },
    text: {
      zh: '使你手牌中所有錦囊費用 -1。',
      en: 'Reduce the cost of all stratagems in your hand by 1.',
    },
  },
  {
    id: 'strat-royal-summons',
    collectorNo: 9702,
    name: { zh: '徵召天下', en: 'Summon the Realm' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 王道「越铺越便宜」的 ramp:手里武将全打折,大哥提前落地。
    spell: { ops: [{ op: 'reduceCost', amount: 1, filter: 'generals' }] },
    text: {
      zh: '使你手牌中所有武將費用 -1。',
      en: 'Reduce the cost of all generals in your hand by 1.',
    },
  },

  // ===== 牌生成 / 价值 =====
  {
    id: 'strat-fame-conjure',
    collectorNo: 9711,
    name: { zh: '錦囊三授', en: 'Three Sealed Plans' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 无中生有:2 费换三张 0 费的奇谋(锦囊),法术流的燃料。
    spell: { ops: [{ op: 'addToHand', defId: 'token-qimou', count: 3 }] },
    text: {
      zh: '將三張「奇謀」(0 費,造成 1 點)加入手牌。',
      en: 'Add three Sudden Ploys (0-cost, deal 1) to your hand.',
    },
  },

  // ===== 人海 =====
  {
    id: 'strat-swarm-muster',
    collectorNo: 9721,
    name: { zh: '揭竿而起', en: 'Rise in Revolt' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    spell: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 3 }] },
    text: { zh: '召喚三個 1/1 的鄉勇。', en: 'Summon three 1/1 Village Levies.' },
  },
  {
    id: 'strat-swarm-banner',
    collectorNo: 9722,
    name: { zh: '揚旗擂鼓', en: 'Raise the Banners' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 3,
    keywords: [],
    // 人海 payoff:全体 +1/+1,场面越宽收益越大。
    spell: { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'allFriendlyGenerals' }] },
    text: {
      zh: '使你所有武將 +1/+1。',
      en: 'Give all your generals +1/+1.',
    },
  },
]

// ---------- 覆盖真名将(build-around 锚点) ----------
export const PACK7_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 名利 · 耶律楚材(8 费 5/9 · 治世能臣):法术流的顶点 —— 战吼把手里锦囊全打折 2 费。
  // 5/9 的厚身板留在场上,配合名利的锦囊密度,一回合能连锁一整套。
  'hist-yelu-chucai': {
    battlecry: { ops: [{ op: 'reduceCost', amount: 2, filter: 'stratagems' }] },
    text: {
      zh: '戰吼:使你手牌中所有錦囊費用 -2。以儒治國,一言而安天下。',
      en: 'Battlecry: reduce the cost of all stratagems in your hand by 2.',
    },
  },
  // 割据 · 陸抗(5 费 3/6):人海流的顶点 —— 战吼此将 +1/+1 每有一个友军。
  // 铺开一片乡勇之后,它自己就是压场的大哥。
  'lu-kang': {
    battlecry: {
      ops: [{ op: 'buffPer', per: { kind: 'friendlyGenerals' }, attack: 1, health: 1, target: 'self' }],
    },
    text: {
      zh: '戰吼:此將 +1/+1,每有一個友軍武將。西陵一戰,國之藩籬。',
      en: 'Battlecry: gain +1/+1 for each friendly general.',
    },
  },
}
