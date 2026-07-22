import type { CardDef } from '../../engine/types'

// 第九卡包 · 中立工具箱。
//
// 861 张中立卡几乎全是白板 —— 构筑时没有「零件」可选。这一批给中立池补上任何卡组
// 都想要的功能:解场、铺场、弹回、AOE、续航身体。
//
// **刻意加「中立税」**:每张比同效果的主义卡贵半档或弱半档。中立卡提供**选项**,
// 但主义卡永远是更高效的那一个 —— 这样构筑有灵活性,又不会所有卡组都塞同一套中立。

export const PACK9_CARDS: CardDef[] = [
  {
    id: 'strat-neutral-strike',
    collectorNo: 9901,
    name: { zh: '借刀殺人', en: 'Kill with a Borrowed Blade' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 中立点杀:2 费 2 点(名利/霸道的点杀更划算)。任何缺解场的卡组的兜底。
    spell: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] },
    text: { zh: '造成 2 點傷害。', en: 'Deal 2 damage.' },
  },
  {
    id: 'strat-neutral-recall',
    collectorNo: 9902,
    name: { zh: '順水推舟', en: 'Go with the Current' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 中立弹回:临时解场 + 拆战吼/亡语大哥的技术卡。
    spell: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    text: { zh: '將一名敵將彈回其手牌。', en: 'Return an enemy general to its owner’s hand.' },
  },
  {
    id: 'strat-neutral-sweep',
    collectorNo: 9903,
    name: { zh: '風捲殘雲', en: 'Sweep the Field' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 中立 AOE:4 费全场 2 点(霸道的 AOE 更便宜/更狠)。人海/铺场的兜底答案。
    spell: { ops: [{ op: 'aoeDamage', amount: 2 }] },
    text: { zh: '對所有敵方武將造成 2 點傷害。', en: 'Deal 2 damage to all enemy generals.' },
  },
  {
    id: 'strat-neutral-conscript',
    collectorNo: 9904,
    name: { zh: '募兵買馬', en: 'Levy and Muster' },
    type: 'stratagem',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    keywords: [],
    // 中立铺场:两个 1/1(割据/王道的铺场自带羁绊,更强)。
    spell: { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] },
    text: { zh: '召喚兩個 1/1 的鄉勇。', en: 'Summon two 1/1 Village Levies.' },
  },
]

// 中立身体:覆盖安全白板花名册,给中立池补功能身材(有立绘)。
// 全部比同费主义卡弱半档 —— 中立税。
export const PACK9_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 武安國:2 费 2/4 守护 —— 便宜的挡刀墙(比主义守护弱一点身材)
  'wu-anguo': {
    cost: 2,
    attack: 2,
    health: 4,
    keywords: ['guard'],
    text: { zh: '守護。單臂鏖戰呂布,力盡而還。', en: 'Guard. He fought Lü Bu one-armed until his strength gave out.' },
  },
  // 袁譚:3 费 3/3,战吼抽一张 —— 中立续航身体
  'yuan-tan': {
    cost: 3,
    attack: 3,
    health: 3,
    battlecry: { ops: [{ op: 'draw', count: 1 }] },
    text: { zh: '戰吼:抽一張牌。青州之爭,兄弟鬩牆。', en: 'Battlecry: draw a card.' },
  },
  // 田楷:4 费 4/3 冲锋 —— 中立抢攻身体(比霸道冲锋弱一点血)
  'tian-kai': {
    cost: 4,
    attack: 4,
    health: 3,
    keywords: ['charge'],
    text: { zh: '衝鋒。公孫麾下,青州拒袁。', en: 'Charge. Under Gongsun Zan, he held Qingzhou against Yuan.' },
  },
}

export const PACK9_TOKENS: CardDef[] = []
