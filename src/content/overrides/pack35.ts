import type { CardDef } from '../../engine/types'

// 第三十五卡包 · 白骨 —— 「死得越多」终于是一件有回报的事。
//
// 【空洞】
// `ifGraveyardCount` 全池只有一张卡在用(pack24 的 白骨露野),
// 而墓地是这个游戏里**唯一一条只会单向增长**的资源轴 —— 它天然适合做后期流派,
// 却一直只有一个出口。顺带查了一下 `friendlyGraveyard` 这个计数源:4 张。
// 两个数字合起来说的是同一件事:**人一直在死,而没有任何一张牌记得他们死过。**
//
// 【为什么这条轴量得准】
// 和上一包(眾寡)同一个理由,也是上上一包(地利)停手的反面:
// 墓地**随对局自然增长**,不需要牌库里配合的卡。
// 三个回合之后墓地里有三个人是常态,所以这把尺子对它有效。
//
// 【顺带补最薄的那个主义】
// 隱逸 143 张,是六个主义里最薄的一档(王道 430 的三分之一)。
// 这一包给它两张 —— 而且不是硬塞:杜甫《兵車行》与庾信《哀江南賦》
// 都是**站在战场之外看战场**的声音,那正是隱逸这个主义该有的位置。
// 主题对得上才补,对不上宁可让配额难看(pack32 拒绝过一次)。
//
// 【选 op 与前三包同一条纪律】(ROADMAP 45「按效果归组的定价偏差」)
//   偏低(该多给):returnToHand +6.7 · aoeDamage +4.0 · destroy +3.8 ·
//                  damage +3.7 · resurrect +3.1 · tutor +2.2
//   偏高(该少给):summon −4.9 · grantKeyword −3.6 · heal −3.4
// 另外避开**这把尺子量不到的**那一类(铁律 8:贪心 AI 对跨回合价值估值近乎为零)——
// 上一包 背嵬軍 用了减费,改门槛前后两次读数逐位相同,那是「这张牌没参与对局」。
//
// 【三条累计下来的自我约束,这一包开工前就照着办】
//   pack32:归组表是**事前挑 op** 用的,不是事后解释用的。
//   pack33:每张牌都要有**立刻收益** —— 先手亏一整回合的牌怎么接都不划算。
//   pack34:**费用不是有效杠杆**,要动就动效果本身。
//
// 【出处】
//   馬革裹屍 《後漢書·馬援傳》「男兒要當死於邊野,以馬革裹屍還葬耳」
//   黃泉     《左傳·隱公元年》鄭莊公誓於姜氏「不及黃泉,無相見也」
//   掩骼埋胔 《禮記·月令》孟春之月「掩骼埋胔」
//   哭秦庭   《左傳·定公四年》申包胥立依於庭牆而哭,日夜不絕聲,七日不絕水漿
//   新鬼煩冤 杜甫《兵車行》「新鬼煩冤舊鬼哭,天陰雨濕聲啾啾」
//   哀江南   庾信《哀江南賦》
//
// 六张都**不进任何预组**,sim-balance 不受影响;但它们进全池,
// 而 bossDeck / battleDeck 从全池现建 —— sim-campaign 与 sim-history 必须重跑。
export const PACK35_CARDS: CardDef[] = [
  {
    id: 'strat-yange-maizi',
    collectorNo: 10448,
    name: { zh: '掩骼埋胔', en: 'Bury the Bones' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [{ op: 'tutor', kind: 'general', count: 1 }],
      condition: { ifGraveyardCount: { atLeast: 3 } },
    },
    text: {
      zh: '若我方墓地中有 3 名或更多武將:從牌庫檢索一名武將進手。孟春之月,掩骼埋胔。',
      en: 'If three or more generals lie in your graveyard: search your deck for a general. In the first month of spring, cover the bones and bury the flesh.',
    },
  },
  {
    id: 'strat-ku-qinting',
    collectorNo: 10449,
    name: { zh: '哭秦庭', en: 'Weeping at the Court of Qin' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'spring-autumn',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    spell: {
      ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }],
      condition: { ifGraveyardCount: { atLeast: 3 } },
    },
    text: {
      zh: '若我方墓地中有 3 名或更多武將:將一名敵方武將彈回其手牌。立依於庭牆而哭,日夜不絕聲,七日不絕水漿。',
      en: "If three or more generals lie in your graveyard: return an enemy general to its owner's hand. He stood against the courtyard wall and wept, day and night, seven days without water.",
    },
  },
  {
    id: 'strat-mage-guoshi',
    collectorNo: 10450,
    name: { zh: '馬革裹屍', en: 'Wrapped in Horsehide' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    spell: {
      ops: [{ op: 'damage', amount: 7, target: 'chosenEnemyGeneral' }],
      condition: { ifGraveyardCount: { atLeast: 4 } },
    },
    text: {
      zh: '若我方墓地中有 4 名或更多武將:對一名敵方武將造成 7 點傷害。男兒要當死於邊野,以馬革裹屍還葬耳。',
      en: 'If four or more generals lie in your graveyard: deal 7 damage to an enemy general. A man should die on the frontier and come home wrapped in horsehide.',
    },
  },
  {
    id: 'strat-huang-quan',
    collectorNo: 10451,
    name: { zh: '黃泉', en: 'The Yellow Springs' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'spring-autumn',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // resurrect 是这条轴上唯一「主题与机制完全同构」的 op:
    // 墓地既是它的**门槛**,也是它的**弹药**。
    spell: {
      ops: [{ op: 'resurrect', count: 1 }],
      condition: { ifGraveyardCount: { atLeast: 5 } },
    },
    text: {
      zh: '若我方墓地中有 5 名或更多武將:復生 1 名武將。不及黃泉,無相見也。',
      en: 'If five or more generals lie in your graveyard: resurrect one of them. Not until the Yellow Springs shall we meet again.',
    },
  },
  {
    id: 'strat-xingui-fanyuan',
    collectorNo: 10452,
    name: { zh: '新鬼煩冤', en: 'The New Ghosts Complain' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [{ op: 'aoeDamage', amount: 2 }],
      condition: { ifGraveyardCount: { atLeast: 6 } },
    },
    text: {
      zh: '若我方墓地中有 6 名或更多武將:對所有敵方武將造成 2 點傷害。新鬼煩冤舊鬼哭,天陰雨濕聲啾啾。',
      en: 'If six or more generals lie in your graveyard: deal 2 damage to all enemy generals. The new ghosts cry their grievances, the old ghosts weep; in the wet grey rain their voices go on.',
    },
  },
  {
    id: 'strat-ai-jiangnan',
    collectorNo: 10453,
    name: { zh: '哀江南', en: 'Lament for the South' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'southern-northern',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    keywords: [],
    spell: {
      ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }],
      condition: { ifGraveyardCount: { atLeast: 5 } },
    },
    text: {
      zh: '若我方墓地中有 5 名或更多武將:摧毀一名敵方武將。日暮途遠,人間何世。',
      en: 'If five or more generals lie in your graveyard: destroy an enemy general. The day wanes, the road is long — what age is this we live in?',
    },
  },
]

// 【收敛之后的读数(600 局 / 张,六张一起量,族错误率校正线 |Δ| > 7.6)】
//   新鬼煩冤 +6.5 · 馬革裹屍 +4.2 · 哀江南 +3.3 ·
//   哭秦庭 +0.7 · 黃泉 −4.3 · 掩骼埋胔 −6.0
// 最大 |Δ| 是 6.5,一张都没越线。
//
// 【这一包和前三包不同的一点:整体偏**正**,而不是偏负】
// 前三包收敛后都落在 0 到 −7 之间,这一包落在 +6.5 到 −6.0。原因不难想:
// 墓地是**只会单向增长**的资源,而这把尺子的对局够长 —— 门槛到得了,
// 于是「后期变强」这件事真的兑现了。同样的条件折扣,轴不同结果就不同。
//
// 【第一版三张越线,收法各不相同 —— 三种改动的效力实测】
//   新鬼煩冤 aoe 3→2      +16.7 → +8.5   再把门槛 5→6  → +6.5
//   哀江南   去掉附带的复生 +16.2 → +3.3(一个 op 值 13 个点)
//   黃泉     复生 2→1     +11.3 → −4.3(复生第二个值 15 个点)
// 值得记住的是最后两行:**同一张牌上多挂一个 op,代价远超直觉**。
// 「摧毁 + 复生 1」看起来只是顺手带一下,实测是 13 个百分点。
