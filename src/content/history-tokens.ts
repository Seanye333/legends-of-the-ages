import type { CardDef } from '../engine/types'

// 历史名战「目标版」用到的具名衍生物 —— 作为斩将/护送的目标单位。
// 用具名 token(而不是复用水寨/铁骑)是为了让棋盘上那个单位一眼能认出来:
// 目标横幅说「斩 顏良」,场上就得真有一张叫「顏良」的牌。
// token:true,只能被召唤(开局态势放上场),不进卡包、不可构筑、中立不污染势力池。
//
// 单位形态是**为了让贪心 AI 天然朝目标打**而定的(AI 不懂目标):
//   · 斩将目标带**守护** —— 逼玩家(与 sim 里的贪心玩家)必须先啃穿它,斩将自然发生;
//   · 护送目标是**0 攻后排** —— 贪心 AI 不会拿它去送死,自然留在后方,除非敌方够到它。
export const HISTORY_TOKENS: CardDef[] = [
  {
    id: 'token-yan-liang',
    collectorNo: 9983,
    name: { zh: '顏良', en: 'Yan Liang' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 5,
    attack: 3,
    health: 7,
    keywords: ['guard'],
    token: true,
    text: { zh: '守護。萬軍之中,上將首級。', en: 'Guard.' },
  },
  {
    id: 'token-you-zhu',
    collectorNo: 9984,
    name: { zh: '幼主', en: 'The Young Lord' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'shu',
    rarity: 'common',
    archetype: 'strategist',
    cost: 4,
    attack: 0,
    health: 6,
    keywords: [],
    token: true,
    text: { zh: '襁褓中的社稷。護他周全。', en: 'The dynasty in swaddling clothes. Keep him safe.' },
  },
]
