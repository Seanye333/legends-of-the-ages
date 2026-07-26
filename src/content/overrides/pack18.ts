import type { CardDef } from '../../engine/types'

// 第十八卡包 · 三十六計補全。
//
// 卡池里锦囊本来就有 88 张,其中 22 张恰好落在三十六计上 —— 差 14 计没凑齐。
// 这一包**只补那 14 计**,把「完整收录三十六计」这句话做实:
// 它是全中国人都叫得出的一套完整清单,自带结构与终点,是白送的品牌资产
//(收集目标天然存在:三十六计 36/36)。
//
// 刻意**不引入任何新机制** —— 全部用现有 opcode 拼。这一包卖的是「集齐」,
// 不是又一次机制扩张;计名本身就是玩法提示,效果贴着计名走才是重点:
//   借刀杀人式的「让敌人互相消耗」、金蝉脱壳式的「抽身」、擒贼擒王式的「直取主帅」。
//
// 主义按计策气质分摊到六家,不堆在名利一家(否则等于给名利白发 14 张牌)。

const s = (
  id: string,
  collectorNo: number,
  zh: string,
  en: string,
  doctrine: CardDef['doctrine'],
  cost: number,
  rarity: CardDef['rarity'],
  spell: CardDef['spell'],
  text: { zh: string; en: string },
): CardDef => ({
  id,
  collectorNo,
  name: { zh, en },
  type: 'stratagem',
  doctrine,
  dynasty: 'qun',
  rarity,
  archetype: 'strategist',
  cost,
  keywords: [],
  spell,
  text,
})

export const PACK18_CARDS: CardDef[] = [
  // 5 趁火打劫:对方越乱越好拿 —— 打一下再抽一张。
  s('strat-36-chenhuo', 9900, '趁火打劫', 'Loot a Burning House', 'hegemonic', 4, 'common',
    { ops: [{ op: 'damage', amount: 3, target: 'chosenAny' }, { op: 'draw', count: 1 }] },
    { zh: '造成 3 點傷害,抽一張牌。', en: 'Deal 3 damage. Draw a card.' }),

  // 7 無中生有:凭空变出兵来。
  s('strat-36-wuzhong', 9905, '無中生有', 'Something from Nothing', 'fame', 3, 'common',
    { ops: [{ op: 'summon', defId: 'token-si-shi', count: 2 }] },
    { zh: '召喚兩個 1/1 的死士。', en: 'Summon two 1/1 Retainers.' }),

  // 9 隔岸觀火:两边一起烧,你在岸上看。
  s('strat-36-gean', 9906, '隔岸觀火', 'Watch the Fire Across the River', 'reclusion', 4, 'rare',
    { ops: [{ op: 'damageAll', amount: 2 }] },
    { zh: '對所有武將造成 2 點傷害。', en: 'Deal 2 damage to all generals.' }),

  // 10 笑裡藏刀:笑脸底下是刀 —— 加攻 + 潜行。
  s('strat-36-xiaoli', 9907, '笑裡藏刀', 'Dagger Behind a Smile', 'separatist', 3, 'common',
    {
      ops: [
        { op: 'buffStats', attack: 3, health: 0, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'stealth', target: 'chosenFriendlyGeneral' },
      ],
    },
    { zh: '使一名友方武將+3/+0並獲得潛行。', en: 'Give a friendly general +3/+0 and Stealth.' }),

  // 11 李代桃僵:找个替身去死。
  s('strat-36-lidai', 9908, '李代桃僵', 'The Plum Dies for the Peach', 'royal', 2, 'common',
    { ops: [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }] },
    { zh: '召喚一個 0/4 的江東水寨(守護)。', en: 'Summon a 0/4 Jiangdong Stockade with Guard.' }),

  // 17 拋磚引玉:丢出去一块砖,换回一块玉。
  s('strat-36-paozhuan', 9909, '拋磚引玉', 'A Brick for Jade', 'ritual', 2, 'common',
    { ops: [{ op: 'discardRandom', count: 1 }, { op: 'draw', count: 2 }] },
    { zh: '隨機棄一張牌,然後抽兩張。', en: 'Discard a random card, then draw two.' }),

  // 18 擒賊擒王:越过前排,直取主帅。
  s('strat-36-qinwang', 9910, '擒賊擒王', 'Capture the Chief', 'hegemonic', 3, 'rare',
    { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
    { zh: '對敵方主公造成 4 點傷害。', en: 'Deal 4 damage to the enemy hero.' }),

  // 20 混水摸魚:水搅浑了,顺手捞一张。
  s('strat-36-hunshui', 9911, '混水摸魚', 'Fish in Troubled Waters', 'fame', 3, 'rare',
    { ops: [{ op: 'stealCard', count: 1 }] },
    { zh: '從對手手牌隨機取走一張。', en: "Take a random card from your opponent's hand." }),

  // 22 關門捉賊:先关门(冻住),再收拾。
  s('strat-36-guanmen', 9912, '關門捉賊', 'Shut the Door, Catch the Thief', 'reclusion', 4, 'rare',
    { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] },
    { zh: '凍結所有敵方武將。', en: 'Freeze all enemy generals.' }),

  // 26 指桑罵槐:指着这个骂那个 —— 让它闭嘴。
  s('strat-36-zhisang', 9913, '指桑罵槐', 'Scold the Locust, Point at the Mulberry', 'ritual', 2, 'common',
    { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    { zh: '沉默一名敵方武將。', en: 'Silence an enemy general.' }),

  // 27 假痴不癲:装傻 —— 把它的攻守调个个儿。
  s('strat-36-jiachi', 9914, '假痴不癲', 'Feign Madness', 'reclusion', 3, 'rare',
    { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] },
    { zh: '交換一名敵方武將的攻擊力與最大生命。', en: "Swap an enemy general's Attack and max Health." }),

  // 28 上屋抽梯:诱上房,再抽走梯子 —— 弹回手牌。
  s('strat-36-shangwu', 9915, '上屋抽梯', 'Remove the Ladder', 'separatist', 3, 'common',
    { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    { zh: '將一名敵方武將移回其手牌。', en: "Return an enemy general to its owner's hand." }),

  // 29 樹上開花:虚张声势,全军看着都壮了。
  s('strat-36-shushang', 9916, '樹上開花', 'Flowers on a Barren Tree', 'royal', 4, 'rare',
    { ops: [{ op: 'buffStats', attack: 1, health: 2, target: 'allFriendlyGenerals' }] },
    { zh: '使所有友方武將+1/+2。', en: 'Give all friendly generals +1/+2.' }),

  // 36 走為上:打不过就撤 —— 收回来再打一次。
  s('strat-36-zouwei', 9917, '走為上', 'Retreat Is Best', 'ritual', 1, 'common',
    { ops: [{ op: 'returnToHand', target: 'chosenFriendlyGeneral' }, { op: 'gainArmor', amount: 2 }] },
    { zh: '將一名友方武將移回手牌,你的主公獲得 2 點護甲。', en: 'Return a friendly general to your hand and gain 2 Armor.' }),
]
