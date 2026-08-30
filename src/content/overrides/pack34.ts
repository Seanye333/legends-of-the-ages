import type { CardDef } from '../../engine/types'

// 第三十四卡包 · 眾寡 —— 把「场上人多人少」这条轴做成流派。
//
// 【查出来的空洞比预想的更深】
// `ifBoardCount` 的形状是 `{ side: 'friendly' | 'enemy'; atLeast: number }` ——
// 两侧,等于两条子轴。而全池只有一张卡用它(pack24 的 以寡擊眾),
// 用的是 `enemy` 那一侧。也就是说:
//   · `enemy`   侧:1 张
//   · `friendly` 侧:**0 张 —— 从来没有任何一张卡用过**
// 「我这边铺开了」这件事在这个游戏里至今没有任何回报,
// 而铺场恰恰是 CCG 里最基本的一种打法。
//
// 【为什么这条轴量得准(挑它的理由)】
// 上一包(地利)开工前停了一次手:环境卡在六套预组里是 0 张,
// 所以任何以环境为门槛的卡在 `sim-cards` 下必然全灭 —— 量到的是
// 「前置条件没出现」,不是「它强不强」。
// `ifBoardCount` 没有这个问题:**场面会自己填满**,不需要牌库里配合的卡。
// 三个回合之后双方场上有三个人是常态,所以这把尺子对它是有效的。
//
// 【选 op 的依据仍然是实测,不是手感】(ROADMAP 45「按效果归组的定价偏差」)
//   偏低(该多给):returnToHand +6.7 · delay +5.0 · aoeDamage +4.0 ·
//                  destroy +3.8 · damage +3.7 · reduceCost +2.8 · discardRandom +2.1
//   偏高(该少给):summon −4.9 · grantKeyword −3.6 · heal −3.4 · borrow −2.8
// 这一包只用左边那一列。连着三包的同一条纪律:
// **归组表是拿来事前挑 op 的,不是拿来事后解释的。**
//
// 【前两包各留下一条教训,这一包开工前就照着办了】
//   pack32(背水):门槛不是问题,**op 才是** —— 别用实测最差的 op 造最贵的牌。
//   pack33(地利):**每张牌都要有立刻收益** —— 一张先手亏一整回合的牌,
//                  后面接多大的收益都不划算,除非它足够便宜。
// 所以这六张全部是「条件满足时立刻发生一件事」,没有一张是纯铺垫。
//
// 【门槛最后全定在 3,而两档是被实测否掉的】
// pack32 的 <15 血那一档实测是死的(到得太少也太晚)。板上三个人是常态、
// 四个人要认真铺,所以 3 是「常规回报」、4 是「真的铺开了」——
// 两档都够得着,而不是给一个好听但到不了的数。
//
// 【出处】
//   魚麗之陣 《左傳·桓公五年》「為魚麗之陳,先偏後伍,伍承彌縫」
//   陷陣營   《英雄記》高順所將七百餘兵,號為千人,「每所攻擊無不破者,名為陷陳營」
//   背嵬軍   《宋史·岳飛傳》岳家軍背嵬,郾城以少擊眾破拐子馬
//   圍師必闕 《孫子·軍爭》「圍師必闕,窮寇勿迫」
//   卻月陣   《宋書·朱齡石傳》劉裕以卻月陣破北魏鐵騎於黃河岸
//   四面楚歌 《史記·項羽本紀》「夜聞漢軍四面皆楚歌,項王乃大驚」
//
// 六张都**不进任何预组**,sim-balance 不受影响;但它们进全池,
// 而 bossDeck / battleDeck 从全池现建 —— sim-campaign 与 sim-history 必须重跑。
export const PACK34_CARDS: CardDef[] = [
  // ================= 我方鋪開(friendly)—— 这一侧此前是 0 张 =================
  {
    id: 'strat-yuli-zhen',
    collectorNo: 10442,
    name: { zh: '魚麗之陣', en: 'The Fish-Scale Formation' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'spring-autumn',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 铺开之后的**结束手段**:面伤在这一侧是对的 —— 你已经占场,
    // 差的是最后那几点。(对照 pack32 的教训:同样是面伤,残血时打脸救不了自己,
    // 而占场时打脸正是赢法。同一个 op,主题对不对决定它是 +2 还是 −12。)
    spell: {
      ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }],
      condition: { ifBoardCount: { side: 'friendly', atLeast: 3 } },
    },
    text: {
      zh: '若我方場上有 3 名或更多武將:對敵方主公造成 4 點傷害。為魚麗之陳,先偏後伍,伍承彌縫。',
      en: 'If you have three or more generals: deal 4 damage to the enemy lord. Chariots ahead, footmen behind, each file closing the gaps of the last.',
    },
  },
  {
    id: 'strat-xianzhen-ying',
    collectorNo: 10443,
    name: { zh: '陷陣營', en: 'The Breach Camp' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 5,
    keywords: [],
    spell: {
      ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }],
      condition: { ifBoardCount: { side: 'friendly', atLeast: 3 } },
    },
    text: {
      zh: '若我方場上有 3 名或更多武將:摧毀一名敵方武將。每所攻擊無不破者,名為陷陳營。',
      en: 'If you have three or more generals: destroy an enemy general. Wherever they struck, nothing held — and so they were called the Breach Camp.',
    },
  },
  {
    id: 'strat-beiwei-jun',
    collectorNo: 10444,
    name: { zh: '背嵬軍', en: 'The Beiwei Guard' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'song',
    rarity: 'epic',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    // 【这张改了两版,第一版的病是**这把尺子根本量不到它**】
    //   一版 ≥4 门槛 · reduceCost generals −2  → −12.7
    //   二版 ≥3 门槛 · 同样效果               → −12.7(**逐位相同**)
    // 两次读数一个字都不差,说明这张牌对对局结果**毫无影响** —— 而那不是
    // 「门槛够不着」,是铁律 8:贪心 AI 对**跨回合价值**的估值近乎为零,
    // 减费在它眼里是空的。同一条铁律里的护甲、治疗、潜行也是这样。
    // 结论不是「这张卡不好」,是**这把尺子量不了它**;而这个仓库的规矩是
    // 不落地量不动的东西。所以换成 AI 读得到的即时效果。
    spell: {
      ops: [{ op: 'damage', amount: 6, target: 'chosenEnemyGeneral' }],
      condition: { ifBoardCount: { side: 'friendly', atLeast: 3 } },
    },
    text: {
      zh: '若我方場上有 3 名或更多武將:對一名敵方武將造成 6 點傷害。背嵬親隨,以少擊眾。',
      en: "If you have three or more generals: deal 6 damage to an enemy general. The lord's own guard — few against many, and the many broke.",
    },
  },

  // ================= 敵方鋪開(enemy)—— 此前只有 1 张 =================
  {
    id: 'strat-weishi-bique',
    collectorNo: 10445,
    name: { zh: '圍師必闕', en: 'Leave the Ring Open' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 4,
    keywords: [],
    // 「围师必阙」讲的正是**留一个口子**让对方走 —— 所以是弹回而不是消灭。
    // 【第一版还附带 aoe 1,实测 +10.2,越线】returnToHand 是归组表里最偏低的一档
    // (+6.7),单独一个就够;再叠一层 aoe 是在已经偏强的 op 上加码。
    spell: {
      ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }],
      condition: { ifBoardCount: { side: 'enemy', atLeast: 3 } },
    },
    text: {
      zh: '若敵方場上有 3 名或更多武將:將一名敵方武將彈回其手牌。圍師必闕,窮寇勿迫。',
      en: "If the enemy has three or more generals: return one to its owner's hand. Leave the ring open; do not press a cornered foe.",
    },
  },
  {
    id: 'strat-queyue-zhen',
    collectorNo: 10446,
    name: { zh: '卻月陣', en: 'The Crescent Formation' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'southern-northern',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    keywords: [],
    // 【这张改了三版,而**费用是根没用的杠杆**】
    //   一版 6 费 aoe 4  → +14.8(越线)
    //   二版 6 费 aoe 3  → +9.7 (仍越线)
    //   三版 7 费 aoe 3  → +8.8 (**抬一整费只买到 0.9pp**)
    // 抬费买不动是有道理的:AI 有法力就打,一费之差改变不了它打不打,
    // 只改变它第几回合打。真正决定这张牌值多少的是**它清掉多少身材**。
    // 所以退回 6 费,改动伤害那一头。aoeDamage 在归组表里是偏低的一档(+4.0),
    // 所以照曲线定的数会实测偏强 —— 这正是那张表说的「定价给这个 op 的分少了」。
    spell: {
      ops: [{ op: 'aoeDamage', amount: 2 }],
      condition: { ifBoardCount: { side: 'enemy', atLeast: 4 } },
    },
    text: {
      zh: '若敵方場上有 4 名或更多武將:對所有敵方武將造成 2 點傷害。卻月為陣,弩箭俱發,北騎大潰。',
      en: 'If the enemy has four or more generals: deal 2 damage to all enemy generals. The crescent closed, the crossbows loosed as one, and the northern horse broke.',
    },
  },
  {
    id: 'strat-simian-chuge',
    collectorNo: 10447,
    name: { zh: '四面楚歌', en: 'Songs of Chu on Every Side' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'chu-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    spell: {
      ops: [
        { op: 'aoeDamage', amount: 2 },
        { op: 'discardRandom', count: 1 },
      ],
      condition: { ifBoardCount: { side: 'enemy', atLeast: 3 } },
    },
    text: {
      zh: '若敵方場上有 3 名或更多武將:對所有敵方武將造成 2 點傷害,對手隨機棄 1 張牌。夜聞漢軍四面皆楚歌,項王乃大驚。',
      en: 'If the enemy has three or more generals: deal 2 damage to all enemy generals and your opponent discards a card at random. In the night he heard Chu songs on every side, and was greatly afraid.',
    },
  },
]

// 【收敛之后的读数(600 局 / 张,六张一起量,族错误率校正线 |Δ| > 7.6)】
//   卻月陣 +3.8 · 四面楚歌 +2.3 · 背嵬軍 −0.2 ·
//   陷陣營 −1.3 · 圍師必闕 −3.5 · 魚麗之陣 −6.5
// 最大 |Δ| 是 6.5,**一张都没越线**,也是这三包里收得最紧的一包。
//
// 【这一包学到的两条,都是前两包没遇到过的】
// 1. **费用不是有效杠杆。** 卻月陣 从 6 费抬到 7 费只买到 0.9pp ——
//    AI 有法力就打,一费之差改变不了它打不打,只改变它第几回合打。
//    真正决定一张清场牌值多少的是**它清掉多少身材**,所以最后动的是伤害。
// 2. **有些效果这把尺子根本量不到。** 背嵬軍 第一版是「手牌里的武将 -2 费」,
//    改门槛前后两次读数**逐位相同**(−12.7 / −12.7)—— 一个字都不差,
//    说明它对对局结果毫无影响。那是铁律 8:贪心 AI 对跨回合价值估值近乎为零。
//    诊断的方法值得记住:**两次不同的改动给出完全相同的读数 = 这张牌没参与对局。**
