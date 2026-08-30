import type { CardDef } from '../../engine/types'

// 第三十二卡包 · 背水 —— 把一条**只有一张卡**的轴做成流派。
//
// 【这一包是第二十四包自己指出来的下一步】
// pack24 的头注里写着一句自我批评:
//
//   「一条轴只有一张卡,它就不是流派,是趣闻」
//
// 而它自己给九种孤儿条件各补了**一张**。一年后 `lint-content` 的 info 里
// 仍然挂着十二条 `thin-condition`(某条件全池只有 1 张卡在用)——
// 也就是说那九条轴至今还停在「趣闻」这一档。
//
// 这一包只动其中一条:`ifHeroHpBelow`(我方主公血量低于 N)。
// 挑它的三个理由,都是量出来的:
//   1. **主题最清楚** —— 「陷之死地而後生」是一句所有人都懂的话,
//      而残血反打是 CCG 里最有戏剧性的一种节奏。
//   2. **验得动** —— 它落在伤害 / 攻击 / 冲锋这几根轴上,而
//      `AI_NORMAL` 对护甲、治疗、潜行、跨回合价值的估值近乎为零(铁律 8)。
//      同样是补孤儿条件,补 `ifSupply` 就量不准,补这条量得准。
//   3. **定价表在这个费段是可信的** —— fit-price 按费用分档实测:
//      1 费 ρ=0.055(和随机没区别)、2 费 0.197,而 **3 费以上 0.30~0.42**。
//      所以这一包的六张里五张在 3 费及以上。
//
// 【为什么是锦囊,不是武将】
// 想过用 耿恭 / 李愬 / 劉錡 / 陳慶之 / 王玄策 / 張巡 这几位「绝境名将」——
// 一查**六位全都已经在池里**(`hist-*`),再造一遍就是双胞胎,
// 而「有双胞胎的武将 659 名 / 29%」本来就是 `audit-generals` 一直在报的问题。
// 改走锦囊的第二个理由:锦囊全池只有 155 张(6.3%),是三种类型里最薄的一档。
//
// 【设计上的自我约束,照抄 pack24 那两条】
// · **条件写严、收益写小。** 带条件的效果在定价表里打 0.75 折,而实测说明那个
//   折扣打反了(见 tuning1 的 候時而動)。宁可下一轮 sim-cards 说它们偏弱。
// · **门槛只有一档(< 20)。原来想做两档,实测把它否了。**
//   设计意图是「已经难受」(< 20)与「真的要死了」(< 15)各有牌可打。
//   600 局实测(六张一起量,族错误率校正线 |Δ| > 7.6):
//     < 20 那四张   +2.3 · −1.0 · −2.3 · −6.0   全在噪声内
//     < 15 那两张   **−13.3 · −13.5**(z 4.6 / 4.7)—— 越线,而且是往下越
//   主公起手 30 血,< 15 是掉到一半以下 —— 那一档**到得太少也太晚**,
//   牌在手里就是张废牌,代价实测是整套牌掉十三个点。
//   两张都提到 < 20 之后重量(见下面那条注释)。
//   记住的是方法不是数字:「给一条轴做纵深」听起来天经地义,而纵深的下沿
//   得先量出来「玩家真的到得了那儿吗」。
//
// 【而门槛并不是真正的原因 —— 第二次实测把这个也否了】
// 提到 < 20 之后重量:−12.2 / −13.2,几乎没动。真正的原因在**同一天量出来的
// 另一张表**里(见 ROADMAP 45「按效果归组的定价偏差」):
//     summon        z = −4.9   ← 全池实测最差的 op
//     grantKeyword  z = −3.6
// 而这两张卡正好一张用 summon、一张用了两次 grantKeyword ——
// 我拿全池最差的两个 op 造了这一包里最贵的两张牌。
// 改成量得好的那一批(returnToHand z=+6.7 · aoeDamage +4.0 · damage +3.7)之后
// 的读数见每张卡上的注释。
// 教训:**归组表不是拿来事后解释的,是拿来事前挑 op 的。**
//
// 【第三版:一以當十 换成 damage 打脸之后仍然 −12.5,而这一次的原因是主题】
// 这条轴的前提是「你已经残血」。残血时烧对面的脸救不了自己 ——
// 它是一张**领先时用不上、落后时不够用**的牌。
// 对照同一包的 哀兵必勝(同样条件、3 费、对武将 5 伤)实测 **+2.3**:
// 差别不在数值,在**移除 vs 拼刀**。
// 所以背水这一类的收益必须是**稳住场面**的:移除、弹回、清场。
// 改成 destroy(归组 z = +3.8,偏低那一档)之后的读数见下。
//
// 【出处】六个名字全部有确切出处,与 lore-quotes 同一条规矩(拿不准宁可不写):
//   殊死戰       《史記·淮陰侯列傳》井陘之戰「軍皆殊死戰,不可敗」
//   困獸猶鬥     《左傳·宣公十二年》「困獸猶鬥,況國相乎」
//   哀兵必勝     《老子》六十九章「抗兵相加,哀者勝矣」
//   一以當十     《史記·項羽本紀》鉅鹿之戰「楚戰士無不一以當十」
//   置之死地而後生《孫子·九地》「投之亡地然後存,陷之死地然後生」
//   背城借一     《左傳·成公二年》「請收合餘燼,背城借一」
//
// 【这一包**没有**解决的两件事,免得下一个人以为解决了】
// · 朝代分布:六张全落在春秋 / 戰國 / 楚漢,而真正薄的是秦 41 · 隋 58 ·
//   五代 66 · 元 74。往那四朝补要先找那四朝的典故,不能为了填数硬凑。
// · 主义分布:隱逸 143 张是最薄的一档,但「背水」跟隱逸不搭 ——
//   主题优先于配额,硬塞进隱逸只会让那个主义更没性格。
//
// 【收敛之后的读数(600 局 / 张,六张一起量,族错误率校正线 |Δ| > 7.6)】
//   哀兵必勝 +2.3 · 困獸猶鬥 −1.0 · 背城借一 −2.3 ·
//   置之死地而後生 −3.8 · 一以當十 −5.0 · 殊死戰 −6.0
// **一张都没越线。** 工具自己提醒:另有 3 张 |Δ|>4 但没越线,而纯随机下
// 本来就该有约 3 张落在这一档 —— 照着这一档继续调正是它警告过的事,所以停手。
//
// 整包偏负一点是**设计意图**(见上面那条自我约束),不是没调好:
// 带条件的牌在定价表里被打了 0.75 折,而实测说明那个折扣打反了;
// 宁可它们现在偏弱,也不要再造一批需要六轮才收得住的卡。
//
// 六张都**不进任何预组**,所以 sim-balance 不受影响。
// 但它们进全池,而 bossDeck / battleDeck 是从全池现建的 ——
// 所以 sim-campaign 与 sim-history 必须重跑(这一条踩过一次)。
export const PACK32_CARDS: CardDef[] = [
  {
    id: 'strat-shusi-zhan',
    collectorNo: 10430,
    name: { zh: '殊死戰', en: 'Fight to the Death' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'chu-han',
    rarity: 'common',
    archetype: 'warrior',
    cost: 1,
    keywords: [],
    // 一费只给抽牌:1 费档的定价表 ρ=0.055,和随机没区别 ——
    // 在量不准的档位上放复杂效果,等于放一张没人验得了的牌。
    spell: { ops: [{ op: 'draw', count: 2 }], condition: { ifHeroHpBelow: 20 } },
    text: {
      zh: '若我方主公血量低於 20:抽 2 張牌。軍皆殊死戰,不可敗。',
      en: 'If your lord is below 20 Health: draw 2 cards. Every soldier fought as one already dead — and they could not be broken.',
    },
  },
  {
    id: 'strat-kunshou-youdou',
    collectorNo: 10431,
    name: { zh: '困獸猶鬥', en: 'The Cornered Beast' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'spring-autumn',
    rarity: 'common',
    archetype: 'warrior',
    cost: 2,
    keywords: [],
    spell: {
      ops: [
        { op: 'buffStats', attack: 3, health: 0, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' },
      ],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 20:一名友方武將 +3/+0 並獲得突襲。困獸猶鬥,況國相乎。',
      en: 'If your lord is below 20 Health: a friendly general gains +3/+0 and Rush. A cornered beast still fights — how much more a statesman?',
    },
  },
  {
    id: 'strat-aibing-bisheng',
    collectorNo: 10432,
    name: { zh: '哀兵必勝', en: 'The Grieving Army' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'spring-autumn',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: {
      ops: [{ op: 'damage', amount: 5, target: 'chosenEnemyGeneral' }],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 20:對一名敵方武將造成 5 點傷害。抗兵相加,哀者勝矣。',
      en: 'If your lord is below 20 Health: deal 5 damage to an enemy general. When armies meet, the side that grieves prevails.',
    },
  },
  {
    id: 'strat-yi-yi-dang-shi',
    collectorNo: 10433,
    name: { zh: '一以當十', en: 'One Against Ten' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'chu-han',
    rarity: 'rare',
    archetype: 'warrior',
    cost: 4,
    keywords: [],
    // 【这张改了三版,每一版都是实测推的 —— 三版的读数都记在文件头】
    spell: {
      ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 20:摧毀一名敵方武將。楚戰士無不一以當十。',
      en: 'If your lord is below 20 Health: destroy an enemy general. Not one man of Chu who did not fight as ten.',
    },
  },
  {
    id: 'strat-zhizhi-sidi',
    collectorNo: 10434,
    name: { zh: '置之死地而後生', en: 'Ground of Death' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'warring-states',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 5,
    keywords: [],
    // 【第一版是「召唤两个 3/3」,实测 −13.3】
    // summon 是全池实测最差的一个 op(按效果归组 z = −4.9)。见文件头。
    spell: {
      ops: [
        { op: 'returnToHand', target: 'chosenEnemyGeneral' },
        { op: 'aoeDamage', amount: 2 },
      ],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 20:將一名敵方武將彈回其手牌,並對所有敵方武將造成 2 點傷害。投之亡地然後存,陷之死地然後生。',
      en: "If your lord is below 20 Health: return an enemy general to its owner's hand, then deal 2 damage to all enemy generals. Cast them onto dying ground and they live.",
    },
  },
  {
    id: 'strat-beicheng-jieyi',
    collectorNo: 10435,
    name: { zh: '背城借一', en: 'With the Wall at Our Backs' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'spring-autumn',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 6,
    keywords: [],
    spell: {
      ops: [{ op: 'aoeDamage', amount: 4 }],
      condition: { ifHeroHpBelow: 20 },
    },
    text: {
      zh: '若我方主公血量低於 15:對所有敵方武將造成 4 點傷害。請收合餘燼,背城借一。',
      en: 'If your lord is below 15 Health: deal 4 damage to all enemy generals. Let us gather the embers and stake everything with the wall at our backs.',
    },
  },
]

// 【加卡的连带,量出来的两处 —— 加卡不是「只加了六张卡」】
// bossDeck 与 battleDeck 都是从**全池现建**的,所以往池子里加六张
// 会把 32 个关底与 18 场名局的敌方牌组全部重洗一遍。实测:
//   · 笠澤之戰 64% → **72%**(超出 68 的带上沿)。整张 tune-history 网格
//     (7 档 tier × 3 档 hp)没有一格落进带里,最好的一格是 71% ——
//     数值旋钮救不了,最后给敌方开局加了一座 0/4 守护水寨(见 historyBattles)。
//   · 雍正(最终关)15.4% → **25.8%**(z=2.3,真的动了不是抖动)。
//     曲线闸门仍然过,所以没动它;记在这儿是因为「加了六张卡而最终关变简单了」
//     这件事,不写下来下一个人查不出来。
