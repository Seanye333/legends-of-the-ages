import type { CardDef } from '../../engine/types'

// 冒险第二章「逐鹿千年」几位雄主主公技召唤的衍生物。
// 比第一章的 1/1 力士/门客更硬一档——历代精锐,也把关底主公技的分量拉起来。
// token:true,只能被召唤,不进卡包、不可构筑。中立,不污染任何势力池。

export const CAMPAIGN_TOKENS: CardDef[] = [
  {
    id: 'token-tie-qi',
    collectorNo: 9971,
    name: { zh: '鐵騎', en: 'Ironclad Cavalry' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    token: true,
    text: { zh: '', en: '' },
  },
  {
    id: 'token-jin-jun',
    collectorNo: 9972,
    name: { zh: '禁軍', en: 'Imperial Guard' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    attack: 3,
    health: 3,
    keywords: [],
    token: true,
    text: { zh: '', en: '' },
  },
]
