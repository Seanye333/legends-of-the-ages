import type { CardDef } from '../../engine/types'

// 第十六卡包 · 搜将(recruit)。
//
// 新 opcode recruit:从我方牌库随机拉 N 个武将直接上场(锦囊/衍生物不算),那张牌被消耗。
// 复用 GeneralSummoned 事件,不新增事件类型。
//
// 它开了一条「越过费用曲线抢节奏」的线:4 费点兵可能拉出一个 8 费大哥,也可能只拉个小兵 ——
// 高方差的 tempo。天生鼓励一副**武将密度高、费用扎实**的卡组(牌库里净是好身材,随便拉都不亏),
// 和「铺场/人海」老套路是两种思路:一个靠场面宽,一个靠单点越费。
//
// recruit 身进了割据 Boss 池(孙策),Boss 卡组本就武将密度高 —— 拉出来多半是净赚的
// 一次 tempo。加完重跑 sim-campaign 确认曲线没被顶出闸门。

export const PACK16_CARDS: CardDef[] = [
  {
    id: 'strat-sep-muster',
    collectorNo: 9998,
    name: { zh: '點兵', en: 'Muster the Ranks' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    // 越费抢节奏:4 费拉一个随机武将上场,期望值是牌库平均身材,运气好直接甩出个大哥。
    spell: { ops: [{ op: 'recruit', count: 1 }] },
    text: {
      zh: '從你的牌庫隨機召喚一個武將上場。',
      en: 'Summon a random general from your deck.',
    },
  },
  {
    id: 'gen-sep-herald',
    collectorNo: 9999,
    name: { zh: '求賢令', en: 'Edict of Talent' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    attack: 3,
    health: 4,
    keywords: [],
    // 一张牌两个身:自己 3/4 落地,再从牌库拉一个武将 —— 5 费两个身的强 tempo。
    battlecry: { ops: [{ op: 'recruit', count: 1 }] },
    text: {
      zh: '戰吼:從你的牌庫隨機召喚一個武將上場。',
      en: 'Battlecry: summon a random general from your deck.',
    },
  },
]

export const PACK16_OVERRIDES: Record<string, Partial<CardDef>> = {}
