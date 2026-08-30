import type { CardDef } from '../../engine/types'
import { FIELD_BLAZE, FIELD_RIVER, FIELD_SNOW, FIELD_STEPPE } from './pack19'

// 第三十三卡包 · 地利 —— 让战场环境这套机制真的出现在对局里。
//
// 【查出来的空洞】
// 战场环境(FieldRule)第十九包就进了引擎与 GameState:四片规则、四张 3 费锦囊。
// 而一年后:
//   · 读它的卡**只有一张**(pack24 的 嚮導),`lint-content` 一直报 thin-condition;
//   · `ifField` 支持 `{ id }`(必须是某一片),**没有任何一张卡用过**;
//   · **六套预组里环境卡是 0 张**。
// 第三条最要命,而它同时是「为什么不能直接补 ifField 收益卡」的答案 ——
// 见下面那段。
//
// 【为什么这一包不做 ifField 收益卡(而这正是原计划)】
// 原计划是给四片环境各配一张「场上有这一片时才生效」的收益卡,
// 把 `ifField: { id }` 这个从没人用过的形式点亮。查了一下就停手了:
// **`sim-cards` 是把待测卡换进预组打的,而六套预组里一张环境卡都没有** ——
// 于是任何以环境为门槛的卡在这把尺子下**必然全灭**,量出来是 −10 到 −13,
// 而那个数字说的是「它的前置条件没出现」,不是「它强不强」。
// 上一包(背水)刚在这上面栽过:两张卡改了三版才发现问题不在门槛数值,
// 在**我拿全池实测最差的两个 op 造了牌**。同一类错不该犯第二次。
//
// 【所以这一包做的是「自带地利」】
// 每张卡**自己布下环境**,同时给一份立刻生效的收益:
//   · 立刻生效那一半让它**量得出来**;
//   · 布环境那一半让环境真的出现在对局里 —— 而那是任何未来的 `ifField`
//     收益卡能被验证的**前置条件**。先把地铺上,再谈在地上盖什么。
// 虞詡 那一张更进一步:战吼布下环境,**回合结束时再由自己去读它** ——
// 一张卡自给自足地兑现了 `ifField`,不依赖牌库里有没有别的环境卡。
// 加上 風角 那张,`ifField` 的使用者从 1 张变成 3 张 —— thin-condition 的判据是
// 「≤2 张就算薄」,所以必须到 3 张才真的摘掉,而且三张全是自给自足的。
//
// 【选 op 的依据是实测,不是手感】(ROADMAP 45「按效果归组的定价偏差」)
//   偏低(该多给):returnToHand z=+6.7 · aoeDamage +4.0 · destroy +3.8 · damage +3.7
//   偏高(该少给):summon −4.9 · grantKeyword −3.6 · heal −3.4
// 这一包只用左边那一列。上一包的教训原话:
// **归组表不是拿来事后解释的,是拿来事前挑 op 的。**
//
// 【环境是赌局不是优势】(pack19 的原话,这里照旧)
// 环境**双方同吃** —— 你布下烈焰,烧的是双方。收益来自「我这套牌不怕烧,你那套怕」。
// 所以这五张的立刻收益都刻意压在同费段的下沿:环境那一半是**给对手也发牌**的,
// 定价不能按「净收益」算。
//
// 【出处】
//   連營七百里 《三國志·文帝紀》曹丕「備不曉兵,豈有七百里營可以拒敵者乎」
//   雪夜入蔡   《資治通鑑·唐紀》李愬雪夜襲蔡州,擒吳元濟
//   度陰山     王昌齡《出塞》「但使龍城飛將在,不教胡馬度陰山」
//   樓船下益州 劉禹錫《西塞山懷古》「王濬樓船下益州,金陵王氣黯然收」
//   風角       《後漢書·方術傳》「風角」—— 漢代占候之術,以風向定吉凶
//   虞詡       《後漢書·虞詡傳》「不遇盤根錯節,何以別利器乎」(增灶破羌於陳倉)
//
// 六张都**不进任何预组**,sim-balance 不受影响;但它们进全池,
// 而 bossDeck / battleDeck 从全池现建 —— sim-campaign 与 sim-history 必须重跑。
export const PACK33_CARDS: CardDef[] = [
  {
    id: 'strat-lianying-qibaili',
    collectorNo: 10436,
    name: { zh: '連營七百里', en: 'Seven Hundred Li of Camps' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'shu',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [
        { op: 'aoeDamage', amount: 2 },
        { op: 'setField', rule: FIELD_BLAZE, turns: 4 },
      ],
    },
    text: {
      zh: '對所有敵方武將造成 2 點傷害,並布下赤壁烈焰:每回合開始時雙方全場武將受到 1 點傷害,持續 4 個回合。豈有七百里營可以拒敵者乎。',
      en: 'Deal 2 damage to all enemy generals, then set the Fires of Red Cliff: every general takes 1 damage at the start of each turn, for 4 turns. Whoever heard of seven hundred li of camps holding off an enemy?',
    },
  },
  {
    id: 'strat-xueye-rucai',
    collectorNo: 10437,
    name: { zh: '雪夜入蔡', en: 'Into Cai by Snow and Night' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    spell: {
      ops: [
        { op: 'damage', amount: 4, target: 'chosenEnemyGeneral' },
        { op: 'setField', rule: FIELD_SNOW, turns: 4 },
      ],
    },
    text: {
      zh: '對一名敵方武將造成 4 點傷害,並布下大雪封山:雙方全場武將 -1/+2,持續 4 個回合。雪夜襲蔡,擒吳元濟。',
      en: 'Deal 4 damage to an enemy general, then set Snowbound Passes: all generals get -1/+2, for 4 turns. Through the snow at night into Cai, and Wu Yuanji was taken.',
    },
  },
  {
    id: 'strat-du-yinshan',
    collectorNo: 10438,
    name: { zh: '度陰山', en: 'Crossing the Yin Mountains' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'yuan',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    spell: {
      ops: [
        { op: 'returnToHand', target: 'chosenEnemyGeneral' },
        { op: 'setField', rule: FIELD_STEPPE, turns: 4 },
      ],
    },
    text: {
      zh: '將一名敵方武將彈回其手牌,並布下平原走馬:雙方騎兵 +2/+0,持續 4 個回合。不教胡馬度陰山。',
      en: "Return an enemy general to its owner's hand, then set the Open Steppe: cavalry on both sides get +2/+0, for 4 turns. We shall not let their horses cross the Yin Mountains.",
    },
  },
  {
    id: 'strat-louchuan-xiayizhou',
    collectorNo: 10439,
    name: { zh: '樓船下益州', en: 'The Tower Ships Come Down from Yizhou' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'jin',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    keywords: [],
    spell: {
      ops: [
        { op: 'destroy', target: 'chosenEnemyGeneral' },
        { op: 'setField', rule: FIELD_RIVER, turns: 4 },
      ],
    },
    text: {
      zh: '摧毀一名敵方武將,並布下江河天險:雙方水軍 +2/+3,持續 4 個回合。王濬樓船下益州,金陵王氣黯然收。',
      en: "Destroy an enemy general, then set the River as Rampart: navy on both sides get +2/+3, for 4 turns. Wang Jun's tower ships came down from Yizhou, and the royal aura of Jinling faded away.",
    },
  },
  {
    id: 'strat-feng-jiao',
    collectorNo: 10441,
    name: { zh: '風角', en: 'Reading the Wind' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 【第三张 ifField —— 而且是自给自足的那种】
    // 先布下环境,再埋一个两回合后的伏笔,伏笔本身以「场上还有环境」为条件。
    // 于是这张牌自己造出了自己的前置条件:不依赖牌库里有没有别的环境卡,
    // 这把尺子才量得动它(见文件头那段「为什么不做 ifField 收益卡」)。
    // delay 在按效果归组里是 z=+5.0 的偏低档,和 aoeDamage(+4.0)一样属于该多给的一列。
    // 【第一版布的是赤壁烈焰,实测 −9.3,越线】
    // 烈焰是**双方同吃**的「每回合全场 1 伤」:等两个回合换一次 aoe 2,
    // 期间自己的场先被烧了四轮。收益是一次性的,代价是每回合都在 ——
    // 和 黃天蕩 那次学到的是同一条,只是这次站在挨打的一侧。
    // 换成平原走马(骑兵 +2/+0,不伤任何人)之后:−10.0 —— **几乎没动,所以那不是原因**。
    //
    // 真正的原因更简单,而且是这一包**自己写在头注里**的原则被我在这一张上违反了:
    // 它是六张里唯一**没有立刻收益**的 —— 4 费打出去,当回合场面上什么都不发生。
    // 另外五张 +0.2 ~ −5.3 全在带内,而它们每一张都立刻做了一件事。
    // 一张「先手亏一整回合」的牌,后面接多大的收益都不划算,除非它足够便宜。
    // 所以第三版只改一件事:**4 费 → 2 费**,把它定位成铺垫而不是一手play。
    spell: {
      ops: [
        { op: 'setField', rule: FIELD_STEPPE, turns: 4 },
        {
          op: 'delay',
          turns: 2,
          script: { ops: [{ op: 'aoeDamage', amount: 2 }], condition: { ifField: {} } },
        },
      ],
    },
    text: {
      zh: '布下平原走馬(雙方騎兵 +2/+0,持續 4 個回合)。兩個回合後,若場上仍有戰場環境:對所有敵方武將造成 2 點傷害。占風以候吉凶。',
      en: 'Set the Open Steppe (cavalry on both sides get +2/+0, for 4 turns). In two turns, if a battlefield is still in play: deal 2 damage to all enemy generals. Read the wind, and know what comes.',
    },
  },
  {
    id: 'gen-yu-xu',
    collectorNo: 10440,
    name: { zh: '虞詡', en: 'Yu Xu' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    attack: 4,
    health: 5,
    keywords: [],
    // 【这张是这一包的关键:它自己把 ifField 的前置条件也带上了】
    // 战吼布下环境 → 回合结束时读环境。于是它**不依赖牌库里有没有别的环境卡**,
    // 也就成了这把尺子量得动的第一张 ifField 卡。
    battlecry: { ops: [{ op: 'setField', rule: FIELD_SNOW, turns: 4 }] },
    endOfTurn: {
      ops: [{ op: 'damage', amount: 2, target: 'enemyHero' }],
      condition: { ifField: {} },
    },
    text: {
      zh: '戰吼:布下大雪封山(雙方全場武將 -1/+2,持續 4 個回合)。我方回合結束時,若場上有戰場環境,對敵方主公造成 2 點傷害。不遇盤根錯節,何以別利器乎。',
      en: 'Battlecry: set Snowbound Passes (all generals get -1/+2, for 4 turns). At the end of your turn, if a battlefield is in play, deal 2 damage to the enemy lord. Without knotted roots and tangled grain, how would you know a fine blade?',
    },
  },
]

// 【收敛之后的读数(600 局 / 张,六张一起量,族错误率校正线 |Δ| > 7.6)】
//   樓船下益州 +0.2 · 雪夜入蔡 −2.3 · 虞詡 −4.5 ·
//   連營七百里 −4.8 · 度陰山 −5.3 · 風角 −7.3
// **一张都没越线。** 整包偏负与上一包同因:环境双方同吃,而定价不该按净收益算。
//
// 【風角 改了三版,而前两版都改错了地方 —— 留着当反例】
//   一版 4 费 · 布赤壁烈焰 · 两回合后 aoe2      → −9.3(越线)
//   二版 4 费 · 换成不伤己的平原走马             → −10.0(**几乎没动**)
//   三版 2 费 · 平原走马                        → −7.3(进带)
// 前两版都在猜「哪一片环境更好」,而真正的原因是这一包**自己头注里写着**的那条:
// 它是六张里唯一没有立刻收益的 —— 4 费打出去当回合场面上什么都不发生。
// 另外五张全在带内,而每一张都立刻做了一件事。
// **一张先手亏一整回合的牌,后面接多大的收益都不划算,除非它足够便宜。**
//
// 【加卡的连带(同上一包,每次加卡都要重跑这两道)】
// bossDeck / battleDeck 从**全池现建**,加六张会把 32 关与 18 场的敌方牌组重洗。
// 这一次:名局全部仍在带内;冒险的 李斯 一关 47.5% → **60.4%**(z=2.8,真的动了)。
// 曲线闸门仍过,所以没动它 —— 但「加了六张卡而某一关变简单了」这件事,
// 不写下来下一个人查不出来。
