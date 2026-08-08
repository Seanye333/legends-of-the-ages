import type { CardDef } from '../../engine/types'

// 第二十八卡包 · 同袍 —— 让 `CountSource.friendlyBattle` 真正上桌。
//
// 【背景:一条做好了却没人用的轴】
// 142 张卡带 `battles`(生平原文里点到的那几场仗,24 场 / 150 人次),
// 而**数它的卡只有两张**(凌統、張弘範)。ROADMAP 里那句诊断是对的:
// 带战役名单的人绝大多数是签名卡,而签名卡完全手写、不参与播种 ——
// 所以这条轴不是播种能补的,只能手写几张吃它的卡。
//
// 【关键的实现约束:吃这条轴的卡,自己也得带 `battles`】
// `friendlyBattle` 数的是「与**来源卡**同赴过一场仗的友军」,
// 所以来源卡自己没有名单的话恒为 0 —— 一张读不到自己的卡。
// 于是这一包三张全是**以那一场仗为名的锦囊**,`battles` 写的就是它自己那一场。
// 语义上稍微拧一点(那个字段本来读作「这个人打过哪些仗」),
// 但它换来的是**零引擎改动**,而且卡面读起来完全自洽:
// 「你场上每有一名赤壁的老兵……」
//
// 【选哪三场:按名单人数和预组渗透一起挑】
//   官渡之戰 13 人(预组里 **0**)· 赤壁之戰 15 人(预组里 5)· 合肥逍遙津 11 人(预组里 3)
// 官渡那张的 Δ 会最干净(基准里一个同袍都没有,量到的就是纯地板);
// 赤壁那张会最高(坐斷東南 里现成五个)。**两个数放在一起才读得出这条轴的斜率。**
//
// 【定价照第二十七卡包那条教训】
// 印在卡面上的部分要能自己站住,部族那一层是纯上不封顶 ——
// 降将那一包三张全是先把部族收益预扣进身材,结果在 0 层的牌里全塌成死牌。
//
// 【最终实测(600 局,对照组区间 −4.8 ~ +6.7)】
//   威震逍遙津 +2.5 · 官渡相持 +0.2 · 同舟 −4.2
//
// 【这一包最值得记的是「先证明它在数,再看它多强」】
// 动手调数值之前先写了 `engine/battleCount.test.ts`:`friendlyBattle` 有一个
// 别的计数都没有的前置 —— **来源卡自己得带 `battles`**,否则恒为 0。
// 那种卡不报错不崩,只是效果永远停在 0 层,而模拟只会告诉你「它偏弱」,
// **不会告诉你它根本没在工作**(壁中書 第一版就是这么白调了三轮)。
// 顺带钉住这三张的名单串对得上真实卡池 —— 名单差一个字就恒为 0。
//
// 【第二条:我一度在追噪声】
// 中途连做三次改动,Δ 分别动了 0.7 / 4.0 / 0.5,而 400 局下两次测量之差的
// 标准误就是 ±3.5 —— 那三次「变化」一次都不算数。后面改用 600 局,
// 并且**一次只动一张卡**,数字才开始说话:
//   威震逍遙津 5 费 −9.3 → 4 费 −10.0 → 4 费/4 点 −6.7 → **3 费 +2.5**
// 最后那一步 +9.2,远大于「+1 费 ≈ −5.0pp」那条通则 —— 低费点杀是超线性的。
//
// 【第三条:两张卡的 Δ 量的是完全不同的东西】
// 逐套查过每场仗在预组里的人数:
//   官渡之戰 六套**全是 0** · 赤壁之戰 2/0/2/2/2/1 · 合肥逍遙津 0/2/0/0/1/0
// 所以 官渡相持 的 Δ 是**纯地板**(一个同袍都没有,那就是「3 费抽两张」),
// 而 威震逍遙津 的 −6.7 是**吃到 2 层之后**的数 —— 后者说明这把尺子对「打脸」
// 估值偏低(和铁律 8 对护甲/治疗的偏差同源:贪心 AI 只看当前场面差)。
// 收工的方式因此不一样:地板那张把地板做实(抽 1 → 抽 2),
// 吃到层数那张则**同时降费和砍每层收益** —— 降费做实地板,砍每层压住上限,
// 免得五个同袍时变成「3 费十点脸」的斩杀跳板。
export const PACK28_CARDS: CardDef[] = [
  {
    id: 'strat-guandu-xiangchi',
    collectorNo: 10418,
    name: { zh: '官渡相持', en: 'The Standoff at Guandu' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 3 费实测 -5.3。魏武揮鞭 里**一个官渡舊人都没有**,所以那个数字量的是
    // 纯地板:「3 费抽一张」。地板降到 2 费(变成一张真正的走马灯)。
    cost: 3,
    keywords: [],
    battles: ['官渡之戰'],
    spell: {
      ops: [
        { op: 'draw', count: 2 },
        {
          op: 'buffPer',
          per: { kind: 'friendlyBattle' },
          attack: 1,
          health: 1,
          target: 'chosenFriendlyGeneral',
        },
      ],
    },
    text: {
      zh: '抽兩張牌。我方每有一名官渡舊人,使一名友方武將 +1/+1。相持百餘日,河南百姓疲乏,多叛應紹。',
      en: 'Draw two cards. Give a friendly general +1/+1 for each veteran of Guandu you control. They faced each other a hundred days.',
    },
  },
  {
    id: 'strat-chibi-tongzhou',
    collectorNo: 10419,
    name: { zh: '同舟', en: 'Same Boat' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'wu',
    rarity: 'rare',
    archetype: 'strategist',
    // 第一版 4 费实测 -3.3(全体版)/ -7.3(单体版)—— 两次之差 4.0 落在噪声里,
    // 别当成「单体版更弱」。真正的问题是地板:4 费只买 3 点护甲,
    // 而护甲正是铁律 8 说这把尺子系统性低估的那一档。降一费。
    cost: 3,
    keywords: [],
    battles: ['赤壁之戰'],
    spell: {
      ops: [
        { op: 'gainArmor', amount: 3 },
        {
          op: 'buffPer',
          per: { kind: 'friendlyBattle' },
          attack: 0,
          health: 2,
          target: 'chosenFriendlyGeneral',
        },
      ],
    },
    text: {
      zh: '我方主公獲得 3 點護甲。我方每有一名赤壁舊人,使一名友方武將 +0/+2。夫吳人與越人相惡也,當其同舟而濟,遇風,其相救也如左右手。',
      en: 'Your hero gains 3 Armor. Give a friendly general +0/+2 for each veteran of Red Cliffs you control. Wu and Yue hate each other — but in one boat, in a storm, they help each other like the left hand helps the right.',
    },
  },
  {
    id: 'strat-xiaoyaojin',
    collectorNo: 10420,
    name: { zh: '威震逍遙津', en: 'The Terror of Xiaoyao Ford' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'epic',
    archetype: 'warrior',
    // 第一版 5 费实测 -9.3;地板(3 点点杀)在 5 费上撑不住,降一格。
    // 5 费 -9.3 -> 4 费 -10.0 -> 4 费/4 点 -6.7。注意它在 魏武揮鞭 里**本来就吃到 2 层**
    // (樂進、李典),所以那个 -6.7 不是纯地板 —— 说明这把尺子对「打脸」估值偏低
    // (和铁律 8 对护甲/治疗的偏差同源:贪心 AI 只看当前场面差)。
    // 最后一版:降到 3 费把地板做实(3 费 4 点点杀是好价),同时把每层从 2 点砍到 1 点
    // 压住上限 —— 五个同袍时是「3 费:4 点点杀 + 5 点脸」,不是十点脸的斩杀跳板。
    cost: 3,
    keywords: [],
    battles: ['合肥 · 逍遙津'],
    spell: {
      ops: [
        // 3 点 -> 4 点:地板要在 4 费上自己站得住(降费那一步实测没动,见上面注释)
        { op: 'damage', amount: 4, target: 'chosenEnemyGeneral' },
        {
          op: 'damagePer',
          per: { kind: 'friendlyBattle' },
          amount: 1,
          target: 'enemyHero',
        },
      ],
    },
    text: {
      zh: '對一名敵方武將造成 4 點傷害;我方每有一名合肥舊人,對敵方主公造成 1 點傷害。八百人破十萬眾,自旦戰至日中,吳人奪氣。',
      en: 'Deal 4 damage to an enemy general; deal 1 damage to the enemy hero for each veteran of Hefei you control. Eight hundred broke a hundred thousand — from dawn to noon, until Wu lost heart.',
    },
  },
]
