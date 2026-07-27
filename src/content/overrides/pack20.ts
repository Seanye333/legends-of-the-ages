import type { CardDef } from '../../engine/types'

// 第二十卡包 · 傳承 · 塚中 · 連環
//
// 三条都不是新 opcode —— 它们填的是**已有词汇拼不出来的那几句话**。
//
// 1. **傳承(CardDef.heirloom)**:装备本来就是一条附魔,所以「持有者阵亡时
//    这件兵器改挂给别人」只是在死亡处理里把附魔搬个家,不需要「装备槽」这种新状态。
//    它解决的是装备最难受的一点:**装备的全部价值都押在一个人身上**,
//    对手一张解场就连人带刀一起带走,亏两张牌。传承把这笔账拆开 ——
//    人会死,刀还在。定价因此比同数值的普通装备贵 1 费。
//
// 2. **塚中(CountSource: friendlyGraveyard)**:此前墓地只能被 resurrect 摸一次,
//    没有任何东西能表达「死得越多越强」。加一个计数源,亡语流第一次有了 payoff 曲线。
//    只数**武将**(锦囊装备不算)—— 否则一套法术牌组开局就能把它喂满,
//    那不是亡语流,那是抽牌流。
//
// 3. **連環(onSpellCast + reduceCost 复用)**:第十八卡包补齐了三十六计 36 张,
//    但它们之间没有任何联系 —— 一张一张单独打出去,和别的锦囊没区别。
//    「打出一个计谋后,下一个便宜一点」是把它们串起来最短的一句话,
//    而这句话用现有的两个 op 就能拼出来,**一行引擎代码都不用动**。

export const PACK20_CARDS: CardDef[] = [
  // ---------- 傳承 ----------
  {
    id: 'eq-heirloom-blade',
    collectorNo: 9931,
    name: { zh: '傳世寶刀', en: 'The Blade That Outlives' },
    type: 'equipment',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    attack: 3,
    health: 1,
    keywords: [],
    heirloom: true,
    text: {
      zh: '友方武將 +3/+1。傳承:持有者陣亡時,此裝備改由另一名友軍繼承。',
      en: 'Give a friendly general +3/+1. Heirloom: when the bearer falls, another ally inherits it.',
    },
  },
  {
    id: 'eq-heirloom-armor',
    collectorNo: 9932,
    name: { zh: '世襲重鎧', en: 'Armour Passed Down' },
    type: 'equipment',
    doctrine: 'royal',
    dynasty: 'song',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 3,
    attack: 0,
    health: 4,
    keywords: ['guard'],
    heirloom: true,
    text: {
      zh: '友方武將 +0/+4 並獲得守護。傳承:持有者陣亡時,此裝備改由另一名友軍繼承。',
      en: 'Give a friendly general +0/+4 and Guard. Heirloom: another ally inherits it when the bearer falls.',
    },
  },

  // ---------- 塚中:亡语流的 payoff ----------
  {
    id: 'gen-grave-mourner',
    collectorNo: 9933,
    name: { zh: '弔古者', en: 'Keeper of the Fallen' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'jin',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 5,
    attack: 2,
    health: 3,
    keywords: [],
    battlecry: {
      ops: [
        {
          op: 'buffPer',
          per: { kind: 'friendlyGraveyard' },
          attack: 1,
          health: 1,
          target: 'self',
        },
      ],
    },
    text: {
      zh: '戰吼:你墓中每有一名陣亡武將,此將 +1/+1。',
      en: 'Battlecry: gain +1/+1 for each of your fallen generals.',
    },
  },
  {
    id: 'strat-grave-requiem',
    collectorNo: 9934,
    name: { zh: '招魂', en: 'Call the Fallen' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'chu-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [
        {
          op: 'damagePer',
          per: { kind: 'friendlyGraveyard' },
          amount: 1,
          target: 'enemyHero',
        },
      ],
    },
    text: {
      zh: '對敵方主公造成傷害,數值等於你墓中陣亡武將的數量。',
      en: 'Deal damage to the enemy hero equal to your number of fallen generals.',
    },
  },
  {
    id: 'gen-grave-general',
    collectorNo: 9935,
    name: { zh: '塚中枯骨', en: 'Bones in the Barrow' },
    type: 'general',
    doctrine: 'reclusion',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    attack: 3,
    health: 3,
    keywords: [],
    deathrattle: { ops: [{ op: 'resurrect', count: 1 }] },
    text: {
      zh: '亡語:從墓中召回一名陣亡武將。',
      en: 'Deathrattle: return a fallen general to the field.',
    },
  },

  // ---------- 連環:把三十六计串起来 ----------
  {
    id: 'gen-chain-strategist',
    collectorNo: 9936,
    name: { zh: '連環計士', en: 'Chain-Scheme Adept' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 4,
    attack: 2,
    health: 4,
    keywords: [],
    // 复用既有两个 op:每打出一个锦囊 → 手里其余锦囊各 -1 费。
    // 一行引擎代码都没动 —— 第十八卡包的三十六计从此互相咬合。
    onSpellCast: { ops: [{ op: 'reduceCost', amount: 1, filter: 'stratagems' }] },
    text: {
      zh: '你每打出一個錦囊,手中其餘錦囊便宜 1 點。',
      en: 'Whenever you cast a stratagem, your other stratagems cost 1 less.',
    },
  },
  {
    id: 'gen-chain-veteran',
    collectorNo: 9937,
    name: { zh: '幕中老吏', en: 'The Old Clerk' },
    type: 'general',
    doctrine: 'ritual',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    attack: 1,
    health: 4,
    keywords: [],
    onSpellCast: { ops: [{ op: 'buffPer', per: { kind: 'friendlyGenerals' }, attack: 1, health: 0, target: 'self' }] },
    text: {
      zh: '你每打出一個錦囊,此將按場上友軍數量獲得等量攻擊。',
      en: 'Whenever you cast a stratagem, gain attack equal to your number of generals.',
    },
  },
]
