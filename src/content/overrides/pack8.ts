import type { CardDef } from '../../engine/types'

// 第八卡包 · 变形 / 复生。
//
// 用两个新原语开两条新答案线:
//   - 变形:把大哥原地变成 1/1 羔羊 —— 硬解的另一条路(不吃亡语、不吃复生)。
//   - 复生:从墓地召回死去的友军 —— 亡语/人海流的顶点,越死越强。

export const PACK8_TOKENS: CardDef[] = [
  {
    id: 'token-gaoyang',
    collectorNo: 9891,
    name: { zh: '羔羊', en: 'Lamb' },
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
    text: { zh: '咩。', en: 'Baa.' },
  },
]

export const PACK8_CARDS: CardDef[] = [
  // ===== 变形 =====
  {
    id: 'strat-ritual-morph',
    collectorNo: 9801,
    name: { zh: '化敵為羊', en: 'Beast into Lamb' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 硬解:再大的大哥也变 1/1。礼教控场的干净答案 —— 不给亡语、不给复生留东西。
    spell: { ops: [{ op: 'transform', target: 'chosenEnemyGeneral', into: 'token-gaoyang' }] },
    text: {
      zh: '將一名敵將變為 1/1 的羔羊。',
      en: 'Transform an enemy general into a 1/1 Lamb.',
    },
  },

  // ===== 复生 =====
  {
    id: 'strat-sep-rez',
    collectorNo: 9811,
    name: { zh: '借屍還魂', en: 'Borrowed Corpse' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // 亡语/人海流的回收:死得越多越值。割据「换血再换血」的续航答案。
    spell: { ops: [{ op: 'resurrect', count: 2 }] },
    text: {
      zh: '召回兩個死去的友方武將。',
      en: 'Resurrect two friendly generals that have died.',
    },
  },
]

export const PACK8_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 礼教 · 陳群(4 费 2/5):九品中正,品评人物 —— 战吼把一个敌将「评」为 1/1 羔羊。
  'chen-qun': {
    battlecry: { ops: [{ op: 'transform', target: 'chosenEnemyGeneral', into: 'token-gaoyang' }] },
    text: {
      zh: '戰吼:將一名敵將變為 1/1 的羔羊。九品中正,人物臧否在我。',
      en: 'Battlecry: transform an enemy general into a 1/1 Lamb.',
    },
  },
  // 王道 · 申包胥(5 费 4/5):哭秦庭七日复楚国 —— 战吼召回一个死去的友军。复国即复生。
  'hist-shen-baoxu': {
    battlecry: { ops: [{ op: 'resurrect', count: 1 }] },
    text: {
      zh: '戰吼:召回一個死去的友方武將。哭秦庭七日,存楚於既亡。',
      en: 'Battlecry: resurrect a friendly general that has died.',
    },
  },
}
