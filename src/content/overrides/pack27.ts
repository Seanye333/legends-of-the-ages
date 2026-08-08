import type { CardDef } from '../../engine/types'

// 第二十七卡包 · 歸義 —— 降将这条轴的 payoff。
//
// 标签本身在 `overrides/defectors.ts`(65 个人,全部来自生平原文里的
// 「降曹操」「歸唐」「降清」那一句)。这一包是**吃那个标签的三张卡**。
//
// 【为什么只有三张】
// 一条部族轴的成员越多,payoff 卡就越该少而准 —— 65 张成员配三张 payoff,
// 每一张都得是「这套牌为什么值得组」的一个理由,而不是三张同形状的凑数卡。
// 所以三张走三个不同的方向:自己变大 / 指定一个变大 / 变成一次清场。
//
// 【定价:这三张的实测数字要打折看,原因写在这里免得下一个人照着调】
// `sim-cards` 把待测卡换进**主义匹配的预组**,而六套预组里的降将数是:
//   桃園仁德 0 · 魏武揮鞭 1(張遼)· 克己復禮 0 · 鷹視狼顧 0 · 坐斷東南 3 · 大隱於市 0
// 也就是说这条轴的 payoff 在尺子上**几乎永远只吃到 0~1 层**。
// 于是量出来的 Δ 说的是「在一副没为它构筑的牌里它有多差」,
// 那是一条**地板**(不该是死牌),不是这张卡的强度。
// 上限只能靠形状约束:三张都刻意避开「全体 × 每有一名」那种**二次方**形状 ——
// 单目标或自身,规模就只随降将数线性走,和卡池里既有的 `buffPer friendlyDynasty`
// 是同一档,不需要另立一条定价规则。
//
// 【最终实测(400 局,对照组区间 −4.8 ~ +6.7)】
//   五湖四海 +2.5 · 棄暗投明 +1.5 · 不念舊惡 −2.0
//
// 三张都回炉过一轮,收敛的方式**统一是同一条**:
// **印在卡面上的身材要按同费白板给足,部族那一层是纯粹的上不封顶。**
// 第一版三张都把部族收益当成身材的一部分预扣掉了,于是在 0 层的预组里
// 全部塌成死牌(−13.8 / −7.8 / −3.0)。那是部族卡最常见的死法:
// 为一个大多数牌组里不存在的收益提前付了钱。
//
// 顺带量到一条能直接用的:**五湖四海 5/6 → 6/7 一步从 −8.0 跳到 +2.5**(+10.5)。
// 同一张卡 4/5 → 5/6 那一步却几乎没动 —— 6 费段的身材不是线性的,
// 它有一个「够不够格站在这一档」的台阶。这和 ROADMAP 里
// 「6 费以上涨费基本失效,该削的是身材」是同一件事的正面。
//
// 【上限没有被这把尺子量到,所以用形状约束住】
// 三张都刻意避开「全体 × 每有一名」那种二次方形状,规模只随降将数线性走。
// 而降将数本身有天花板:场上七格,65 个人散在六个主义里,
// 一副真的降将牌能同时站住的大约四个 —— 上限大致是「+4/+4」那一档,
// 和卡池里既有的 `buffPer friendlyDynasty` 同档,不需要另立定价规则。
export const PACK27_CARDS: CardDef[] = [
  {
    id: 'gen-bunian-jiu-e',
    collectorNo: 10415,
    name: { zh: '不念舊惡', en: 'No Grudge Held' },
    type: 'general',
    doctrine: 'hegemonic',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'warrior',
    // 第一版 4 费 2/3 实测 **-13.8** —— 部族卡的地板问题,见头注。
    // 身材抬到接近同费白板:0 层时是一张能打的牌,降将是**上不封顶**那一半。
    cost: 4,
    attack: 4,
    health: 5,
    keywords: [],
    battlecry: {
      ops: [
        { op: 'buffPer', per: { kind: 'friendlyDefector' }, attack: 1, health: 1, target: 'self' },
      ],
    },
    text: {
      zh: '戰吼:我方每有一名降將,此牌 +1/+1。陳琳為袁紹作檄,罵及父祖;既降,曹操曰「可止於其身」。',
      en: "Battlecry: gain +1/+1 for each Defector you control. Chen Lin's manifesto cursed Cao Cao's father and grandfather — and when he surrendered, Cao Cao said: let it end with the man himself.",
    },
  },
  {
    id: 'strat-qi-an-tou-ming',
    collectorNo: 10416,
    name: { zh: '棄暗投明', en: 'Out of the Dark' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [
        // 先给一格**保底**,再按降将数叠 —— 第一版没有保底,0 层时是一张空牌(-3.0)。
        { op: 'buffStats', attack: 1, health: 1, target: 'chosenFriendlyGeneral' },
        {
          op: 'buffPer',
          per: { kind: 'friendlyDefector' },
          attack: 1,
          health: 1,
          target: 'chosenFriendlyGeneral',
        },
      ],
    },
    text: {
      zh: '使一名友方武將 +1/+1,我方每有一名降將再 +1/+1。良禽擇木而棲,賢臣擇主而事。',
      en: 'Give a friendly general +1/+1, plus another +1/+1 for each Defector you control. A good bird picks its tree; a wise minister picks his lord.',
    },
  },
  {
    id: 'gen-wuhu-sihai',
    collectorNo: 10417,
    name: { zh: '五湖四海', en: 'From the Four Seas' },
    type: 'general',
    doctrine: 'neutral',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'warrior',
    // 第一版 6 费 4/5 实测 -7.8(0~1 层时那个战吼约等于不存在)
    cost: 6,
    attack: 6,
    health: 7,
    keywords: [],
    battlecry: {
      ops: [
        {
          op: 'damagePer',
          per: { kind: 'friendlyDefector' },
          amount: 1,
          target: 'allEnemyGenerals',
        },
      ],
    },
    text: {
      zh: '戰吼:對所有敵方武將造成傷害,數值等於我方降將數。四方之士來歸者,不問其所從來。',
      en: 'Battlecry: deal damage to all enemy generals equal to the number of Defectors you control. Men came from every quarter, and no one asked where from.',
    },
  },
]
