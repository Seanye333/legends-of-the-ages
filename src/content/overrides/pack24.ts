import type { CardDef } from '../../engine/types'

// 第二十四卡包 · 因勢 —— **一张新卡面都不为「新机制」而写**。
//
// 这一包只做一件事:让**已经写好但没有任何一张卡行使的九种条件**活过来。
//
// 【背景:一次量出来的结果】
// 2026-08-07 给 `lint-content` 加了 `unused-condition` 规则(条件不是 op,
// 所以此前的 `thin-mechanic` 根本看不见它们),第一次跑出来:
//
//   ifBoardCount · ifHeroHpBelow · ifHandCount · ifKeywordCount · ifMorale
//   ifSupply · ifChain · ifField · ifGraveyardCount        ← 各 0 张
//
// 十四种条件里九种一张卡都不用。而同时全池有 **145 张卡产屯粮、111 张卡涨士气** ——
// 这两条资源轴是**只写不读**的:玩家攒了一局的粮,没有任何一张牌会因此变强。
//
// 上一包(第二十三包)的头注里写着「补上新条件的载体」,但实际补的是 op 与目标,
// 条件那一半漏掉了 —— 而没有任何东西看得见,所以它一直挂在那儿。
//
// 【为什么这一包性价比高】
// 引擎、DSL、reducer、单测**全都写好并付过账了**,缺的只是几张行使它们的卡。
// 每加一张,一整条已经存在的机制就从「在假装被用过」变成真的能用。
//
// 【设计上的两条自我约束】
// 1. **资源轴给两张,其余各一张。** 屯粮与士气的生成侧各有上百张卡,
//    读的一侧只给一张会重蹈第二十三包的覆辙(pack23 自己写着:
//    「一条轴只有一张卡,它就不是流派,是趣闻」)。
// 2. **全部走条件折扣的低配版。** 带条件的效果在定价表里打 0.75 折,
//    而实测说明那个折扣**打反了**(「一张牌永远有用」本身是溢价,见 tuning1.ts
//    候時而動 那一条)。所以这里刻意把条件写严、把收益写小 ——
//    宁可下一轮 sim-cards 说它们偏弱,也不要再造一批需要六轮才收得住的卡。
//
// 这七张**不进任何预组**,所以 sim-balance 不受影响(逐套查过)。
export const PACK24_CARDS: CardDef[] = [
  // ---------------------------------------------------------------- 糧道(ifSupply)
  // 全池 145 张卡产屯粮,**读它的一张都没有**。这两张是这条轴的第一个出口。
  {
    id: 'strat-zu-shi-zu-bing',
    collectorNo: 10300,
    name: { zh: '足食足兵', en: 'Full Granaries, Full Ranks' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    // **軍需 5 而不是「若糧道 ≥4」**。第一版写的是后者,实测 +13.5 ——
    // 因为粮道**每回合末自动 +1**(reducer 的回合结算),所以「糧道 ≥4」
    // 约等于「第 4 回合起」,那是个假条件,不是代价。
    // 而全池 145 张卡产粮、**只有 2 张卡消耗它** —— 这条轴缺的其实是出口。
    supplyCost: 5,
    keywords: [],
    spell: { ops: [{ op: 'buffStats', attack: 2, health: 2, target: 'allFriendlyGenerals' }] },
    text: {
      zh: '軍需 5。友方全體 +2/+2。子貢問政,子曰:足食,足兵,民信之矣。',
      en: 'Provision 5. Give all friendly generals +2/+2. Enough food, enough soldiers, and the trust of the people.',
    },
  },
  {
    id: 'gen-tuntian-duwei',
    collectorNo: 10301,
    name: { zh: '屯田都尉', en: 'Commandant of Agriculture' },
    type: 'general',
    doctrine: 'separatist',
    dynasty: 'wei',
    rarity: 'common',
    archetype: 'strategist',
    cost: 4,
    attack: 3,
    health: 4,
    keywords: [],
    battlecry: {
      ops: [{ op: 'draw', count: 2 }],
      condition: { ifSupply: { atLeast: 3 } },
    },
    text: {
      zh: '戰吼:若糧道 ≥3,抽兩張牌。許下屯田,歲得穀百萬斛。',
      en: 'Battlecry: if Supply is 3 or more, draw two cards. The colonies at Xu yielded a million bushels a year.',
    },
  },

  // ---------------------------------------------------------------- 士氣(ifMorale)
  // 同上:111 张卡涨士气,读的一张都没有。
  //
  // ⚠️ `ifMorale.atLeast` 只表达「不低于」。types.ts 的注释里写着
  // 「负数也能写:atLeast: -2 表示『哀兵』」—— **那句是错的**:
  // `atLeast: -2` 的意思是士气 ≥ −2,也就是绝大多数时候都成立,
  // 恰恰不是哀兵。要做哀兵得给 EffectCondition 加一条 `ifMoraleBelow`,
  // 那是下一包的事,这一包只用它本来能表达的那一半。
  {
    id: 'strat-yi-gu-zuo-qi',
    collectorNo: 10302,
    name: { zh: '一鼓作氣', en: 'The First Drum' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'spring-autumn',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: {
      ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'allFriendlyGenerals' }],
      condition: { ifMorale: { atLeast: 2 } },
    },
    text: {
      zh: '若士氣 ≥2:友方全體獲得衝鋒。一鼓作氣,再而衰,三而竭。',
      en: 'If Morale is 2 or more: all friendly generals gain Charge. The first drum rouses; the second flags; the third fails.',
    },
  },
  {
    id: 'gen-gu-li',
    collectorNo: 10303,
    name: { zh: '鼓吏', en: 'Drum Officer' },
    type: 'general',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'warrior',
    cost: 3,
    attack: 2,
    health: 4,
    keywords: [],
    endOfTurn: {
      ops: [{ op: 'damage', amount: 1, target: 'enemyHero' }],
      condition: { ifMorale: { atLeast: 2 } },
    },
    text: {
      zh: '回合結束:若士氣 ≥2,對敵方主公造成 1 點傷害。鼓在,陣就在。',
      en: 'End of turn: if Morale is 2 or more, deal 1 damage to the enemy lord. While the drum sounds, the line holds.',
    },
  },

  // ---------------------------------------------------------------- 墓地(ifGraveyardCount)
  {
    id: 'strat-bai-gu-lu-ye',
    collectorNo: 10305,
    name: { zh: '白骨露野', en: 'Bones in the Open Field' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 第一版 3 费 3 点,实测 +11.0
    spell: {
      ops: [{ op: 'aoeDamage', amount: 2 }],
      condition: { ifGraveyardCount: { atLeast: 5 } },
    },
    text: {
      zh: '若我方墓地武將 ≥5:對所有敵方武將造成 2 點傷害。白骨露於野,千里無雞鳴。',
      en: 'If five or more of your generals lie in the graveyard: deal 2 damage to all enemy generals. White bones lie in the open field; for a thousand li, no cock crows.',
    },
  },

  // ---------------------------------------------------------------- 戰場環境(ifField)
  // 环境上个卡包就进了 GameState,而**没有任何一张卡读得到它有没有**。
  {
    id: 'gen-xiang-dao',
    collectorNo: 10306,
    name: { zh: '嚮導', en: 'Local Guide' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    attack: 2,
    health: 2,
    keywords: [],
    battlecry: {
      ops: [{ op: 'draw', count: 1 }],
      condition: { ifField: {} },
    },
    text: {
      zh: '戰吼:若場上有戰場環境,抽一張牌。不用鄉導者,不能得地利。',
      en: 'Battlecry: if a battlefield is in play, draw a card. Without local guides you cannot take the ground.',
    },
  },

  // ---------------------------------------------------------------- 眾寡(ifBoardCount)
  {
    id: 'strat-yi-gua-ji-zhong',
    collectorNo: 10307,
    name: { zh: '以寡擊眾', en: 'The Few Against the Many' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 第一版 3 费 3 点,实测 **+19.8** —— 敌方铺到 4 个太常见,这条件不值那么多折扣
    spell: {
      ops: [{ op: 'aoeDamage', amount: 2 }],
      condition: { ifBoardCount: { side: 'enemy', atLeast: 4 } },
    },
    text: {
      zh: '若敵方場上 ≥4 名武將:對所有敵方武將造成 2 點傷害。八百破十萬,先聲奪其氣。',
      en: 'If the enemy has four or more generals: deal 2 damage to all of them. Eight hundred broke a hundred thousand — by taking their nerve first.',
    },
  },
]

// 【另外四种条件挂在**已经存在的四张卡**上,而不是新写四张】
//
// 写这一包的时候我先造了四张新卡:連環計 / 背水一戰 / 運籌帷幄 / 堅壁清野。
// 然后重名闸门(content.test 的「重名卡」)当场红了 —— **这四个名字卡池里全都有**,
// 而且概念一模一样:連環計 本来就该读「链」,背水一戰 本来就该读「残血」。
//
// 那说明问题不在命名,在我**没先查池子就动手设计**。
// 造第二张同概念的卡正是今晚刚总结过的那条(见 tuning1.ts 项伯/蘇飛:
// 「两张同效果的卡本来也不该并排站着」),所以改成给现有那四张加条件。
//
// 四张**都不在预组里**(逐套查过),所以 sim-balance 不受影响。
// 每张的效果都跟着放大了一档 —— 条件让它不再是永远可用,总得换回点什么。
export const PACK24_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 連環計:群体 2 点 → 若本回合已结算 ≥2 张锦囊,4 点。
  // 鐵索連舟本来就是「一环扣一环」,这条件和卡名是同一件事。
  'strat-lianhuan-ji': {
    // **停在 +8.2,不再动。** 这个条件的两档之间落差极大:
    //   ifChain ≥2 + aoe 4 = −8.5   ifChain ≥1 + aoe 3 = +8.2   ifChain ≥1 + aoe 4 = +14.5
    // 中间没有可调的余地。试过涨到 5 费,结果反而是 +12.0 —— 但那两个数差 1.3σ,
    // 而且**改费用会换掉不同的牌**(Δ 是差值,被换掉的那张同样决定结果,见 sim-cards 注释)。
    // +8.2 只比对照组上界(+6.7)高 1.5pp,而 Δ 的标准误是 ±2.9 —— 在噪声里。
    // 照着这一档继续调正是脚本自己警告过的事。
    spell: { ops: [{ op: 'aoeDamage', amount: 3 }], condition: { ifChain: { atLeast: 1 } } },
    text: {
      zh: '若本回合已結算 ≥1 張錦囊:對所有敵方武將造成 3 點傷害。鐵索連舟,一燒俱盡。',
      en: 'If another stratagem resolved this turn: deal 3 damage to all enemy generals. Chain the ships, and one torch takes them all.',
    },
  },

  // 背水一戰:给一名武将 +2/+2 与冲锋 → 残血时给**全体** +2/+0 与冲锋。
  // 「陷之死地而後生」讲的就是绝境,而原来那版跟血量毫无关系。
  'strat-beishui-yizhan': {
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 0, target: 'allFriendlyGenerals' },
        { op: 'grantKeyword', keyword: 'charge', target: 'allFriendlyGenerals' },
      ],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 20:友方全體 +2/+0 並獲得衝鋒。陷之死地而後生。',
      en: 'If your lord is below 20 Health: all friendly generals gain +2/+0 and Charge. Cast them where they must die, and they live.',
    },
  },

  // 運籌帷幄:锦囊 −1 费 → 手牌 ≥5 时 −2 费。囤着牌才谈得上运筹。
  'strat-fame-tempo': {
    spell: {
      ops: [{ op: 'reduceCost', amount: 2, filter: 'stratagems' }],
      condition: { ifHandCount: { atLeast: 4 } },
    },
    text: {
      zh: '若手牌 ≥4:使你手牌中所有錦囊費用 -2。運籌策帷帳之中,決勝於千里之外。',
      en: 'If you hold four or more cards: your stratagems cost 2 less. Plans laid within the tent decide victory a thousand li away.',
    },
  },

  // 堅壁清野:5 点护甲 → 场上有 ≥2 名守护时 9 点。没有壁,清野就只是烧自己的田。
  'strat-jianbi-qingye': {
    spell: {
      ops: [{ op: 'gainArmor', amount: 9 }],
      condition: { ifKeywordCount: { keyword: 'guard', atLeast: 1 } },
    },
    text: {
      zh: '若我方場上有帶守護的武將:我方主公獲得 9 點護甲。深壁固壘,勿與戰。',
      en: 'If any of your generals has Guard: your lord gains 9 Armor. Deepen the moat, raise the wall, and refuse battle.',
    },
  },
}
