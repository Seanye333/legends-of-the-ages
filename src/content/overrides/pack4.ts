import type { CardDef } from '../../engine/types'

// 第四卡包「伏兵與連擊」。
//
// 前三包做的是「场面上能发生什么」;这一包做的是**决策的时间轴**:
//   - 伏兵 secret:把一次决策提前一个回合下注,赌对手下一步走哪儿。
//     这是全游戏第一个「对手的动作会跑你的脚本」的机制。
//   - 连击 combo:同一张牌在回合里的**第几张**打出来,效果不同。
//     出牌顺序第一次有了意义。
//   - 过载 overload:向下个回合借水晶。第一个负债机制。
//
// 计价基线(延续第二、三包):身材/效果总价值 ≈ cost*2+1 点。
// 三个新机制各自的折算,都是**先定价再实测**,理由写在各段前面。

// ---------- 伏兵 ----------
//
// 定价:伏兵比同效果的即时锦囊**便宜约 1 费**,因为它有三重损耗 ——
//   1. 时间损耗:埋下的那个回合它什么也不做;
//   2. 触发不确定:对手可以选择不做那件事(虽然多数时候他必须做);
//   3. 只触发一次,而且顺序由埋下的先后决定,不由你临场挑。
// 反过来,它给的是**心理压力**:对手每一步都要先想「他埋了什么」。
// 这一层价值不进身材账,但它是这个机制真正的产出。
//
// 三个触发时机各配两张,好让「猜是哪一个」本身成为博弈:
// 对手看到你埋了伏兵,他知道有三类可能,但不知道是哪一类。
export const PACK4_SECRETS: CardDef[] = [
  // ---- enemyAttack:敌方武将发起攻击时(伤害结算之前) ----
  {
    id: 'secret-qing-jun-ru-weng',
    collectorNo: 9301,
    name: { zh: '請君入甕', en: 'Into the Cauldron' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'tang',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 4 点伤害在攻击结算**之前**落地,所以能直接把攻击者带走、
    // 这次攻击整个作废(见 combat.ts 里触发后的复检)。
    secret: {
      trigger: 'enemyAttack',
      script: { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] },
    },
    text: {
      zh: '伏兵:敵方武將發起攻擊時,對它造成 4 點傷害。請君入此甕中。',
      en: 'Secret: when an enemy general attacks, deal 4 damage to it. Please, step into the cauldron.',
    },
  },
  {
    id: 'secret-yi-yi-dai-lao',
    collectorNo: 9302,
    name: { zh: '以逸待勞', en: 'Rested Against the Weary' },
    type: 'stratagem',
    doctrine: 'reclusion',
    dynasty: 'warring-states',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 冻结不取消这一次攻击(伤害照打),但对手下个回合它动不了。
    // 和請君入甕刻意做成两种手感:一个是「你别想打」,一个是「你打完就别想再打」。
    secret: {
      trigger: 'enemyAttack',
      script: {
        ops: [
          { op: 'freeze', target: 'chosenEnemyGeneral' },
          { op: 'gainArmor', amount: 4 },
        ],
      },
    },
    text: {
      zh: '伏兵:敵方武將發起攻擊時,凍結它,我方主公獲得 4 點護甲。',
      en: 'Secret: when an enemy general attacks, freeze it and gain 4 Armor.',
    },
  },

  // ---- enemySummon:敌方武将入场后(战吼已结算) ----
  {
    id: 'secret-yu-qin-gu-zong',
    collectorNo: 9303,
    name: { zh: '欲擒故縱', en: 'Loose to Capture' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'shu',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    // 弹回而不是消灭:战吼已经结算过了,所以对手其实赚了一次战吼 ——
    // 代价是这一手的水晶白花、还得重打一次。定价上按「延迟一回合」算,不按「解场」算。
    secret: {
      trigger: 'enemySummon',
      script: { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] },
    },
    text: {
      zh: '伏兵:敵方武將登場後,將其彈回手牌。欲擒之,故縱之。',
      en: 'Secret: after an enemy general takes the field, return it to its owner’s hand.',
    },
  },
  {
    id: 'secret-man-tian-guo-hai',
    collectorNo: 9304,
    name: { zh: '瞞天過海', en: 'Cross the Sea by Deceit' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'sui',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    // 沉默入场的敌将:专治光环/亡语/关键词大哥。
    // 比弹回贵 1 费,因为它是**永久**的,而且对传奇最痛。
    secret: {
      trigger: 'enemySummon',
      script: { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] },
    },
    text: {
      zh: '伏兵:敵方武將登場後,沉默它。瞞過的不是海,是人心。',
      en: 'Secret: after an enemy general takes the field, silence it.',
    },
  },

  // ---- enemyStratagem:敌方锦囊结算后 ----
  {
    id: 'secret-da-cao-jing-she',
    collectorNo: 9305,
    name: { zh: '打草驚蛇', en: 'Beat the Grass, Startle the Snake' },
    type: 'stratagem',
    doctrine: 'fame',
    dynasty: 'qun',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 1,
    keywords: [],
    // 1 费换两张牌,条件是对手用锦囊。对锦囊流是暴击,对纯铺场卡组是废牌 ——
    // 这种「看对手卡组而定」的方差正是伏兵该有的味道。
    secret: {
      trigger: 'enemyStratagem',
      script: { ops: [{ op: 'draw', count: 2 }] },
    },
    text: {
      zh: '伏兵:敵方使用錦囊後,抽兩張牌。他一動,你就知道他在哪。',
      en: 'Secret: after the enemy plays a stratagem, draw two cards.',
    },
  },
  {
    id: 'secret-jia-dao-fa-guo',
    collectorNo: 9306,
    name: { zh: '假道伐虢', en: 'Borrow the Road' },
    type: 'stratagem',
    doctrine: 'royal',
    dynasty: 'spring-autumn',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    secret: {
      trigger: 'enemyStratagem',
      script: { ops: [{ op: 'damage', amount: 4, target: 'enemyHero' }] },
    },
    text: {
      zh: '伏兵:敵方使用錦囊後,對敵方主公造成 4 點傷害。借道者,滅之。',
      en: 'Secret: after the enemy plays a stratagem, deal 4 damage to the enemy hero.',
    },
  },
]

// ---------- 连击 ----------
//
// 定价:连击牌的**基础**效果按「比同费卡弱一档」定,连击效果按「比同费卡强一档」定。
// 平均下来是同费,但把强度挪到了「你能不能凑出第二张」这个决策上。
//
// 关键的一条:combo 是**改用**不是追加(见 reducer.ts 的注释)。
// 追加的话一张牌在连击时价值翻倍,曲线上就没法定价了。
export const PACK4_COMBO: CardDef[] = [
  {
    id: 'strat-lian-huan-ji-p4',
    collectorNo: 9311,
    name: { zh: '順手牽羊', en: 'Lead Away the Goat' },
    type: 'stratagem',
    doctrine: 'separatist',
    dynasty: 'qun',
    rarity: 'common',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    spell: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] },
    combo: { ops: [{ op: 'damage', amount: 4, target: 'chosenAny' }] },
    text: {
      zh: '造成 2 點傷害。連擊:改為造成 4 點。',
      en: 'Deal 2 damage. Combo: deal 4 instead.',
    },
  },
  {
    id: 'strat-tou-liang-huan-zhu',
    collectorNo: 9312,
    name: { zh: '偷梁換柱', en: 'Steal the Beams' },
    type: 'stratagem',
    doctrine: 'ritual',
    dynasty: 'wei',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    spell: { ops: [{ op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' }] },
    combo: {
      ops: [
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
        { op: 'draw', count: 1 },
      ],
    },
    text: {
      zh: '使一名友方武將獲得 +2/+2。連擊:額外獲得守護,並抽一張牌。',
      en: 'Give a friendly general +2/+2. Combo: it also gains Guard, and draw a card.',
    },
  },
]

// ---------- 过载 ----------
//
// 定价:过载 1 点 ≈ 白送 1 费的身材/效果,但**这一费是从下回合借的**。
// 借贷比赠与更值钱(这回合的节奏优势能直接换成场面),所以按 0.8 费折算,不按 1 费。
//
// 一条自我约束:**不做过载 3 以上的卡。** 过载 3 意味着下回合几乎跳过,
// 而「一整个回合什么都做不了」在对局里读起来不是刺激,是卡死。
export const PACK4_OVERLOAD: CardDef[] = [
  {
    id: 'strat-po-fu-chen-zhou-p4',
    collectorNo: 9322,
    name: { zh: '背水結陣', en: 'Formation at the River' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'western-han',
    rarity: 'rare',
    archetype: 'strategist',
    cost: 2,
    keywords: [],
    overload: 1,
    spell: {
      ops: [
        { op: 'buffStats', attack: 2, health: 0, target: 'allFriendlyGenerals' },
        { op: 'grantKeyword', keyword: 'rush', target: 'allFriendlyGenerals', duration: 'endOfTurn' },
      ],
    },
    text: {
      zh: '我方所有武將獲得 +2/+0,本回合獲得突襲。過載 (1)。',
      en: 'Give all friendly generals +2/+0 and Rush this turn. Overload (1).',
    },
  },
  {
    id: 'strat-lei-ting-yi-ji',
    collectorNo: 9323,
    name: { zh: '雷霆一擊', en: 'Thunderclap' },
    type: 'stratagem',
    doctrine: 'hegemonic',
    dynasty: 'qun',
    rarity: 'epic',
    archetype: 'strategist',
    cost: 3,
    keywords: [],
    overload: 2,
    spell: { ops: [{ op: 'aoeDamage', amount: 4 }] },
    text: {
      zh: '對所有敵方武將造成 4 點傷害。過載 (2)。',
      en: 'Deal 4 damage to all enemy generals. Overload (2).',
    },
  },
]

// ---------- 覆盖既有卡 ----------
//
// 这两个人**卡池里本来就有**。第一版我给他们各建了一张新卡,
// 结果图鉴里立刻出现两张「項羽」、两张「荊軻」—— 名字一样、身材不同、
// 立绘还只有旧的那张有(新 id 匹配不上立绘文件名)。
// 新机制该做成覆盖,不是新卡:同一个历史人物在一个卡池里只该有一个位置。
//
// 顺带一提,卡池里本来就有 40 组重名(生成卡 vs `hist-` 签名卡,如杜預/嵇康),
// 那是导入期两批花名册重叠留下的,不在这一包的范围内 —— 但确实该收拾。
export const PACK4_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 項羽:原本 10 费 9/8 单挑 —— 十费的白板大哥,登场即终局,没什么可玩的。
  // 改成 5 费 8/7 冲锋 + 过载 2:力拔山兮气盖世,然后就没有然后了。
  // 这是全卡池最能诠释「过载」的人。
  'hist-xiang-yu': {
    cost: 5,
    attack: 8,
    health: 7,
    keywords: ['charge'],
    overload: 2,
    battlecry: undefined,
    text: {
      zh: '衝鋒。過載 (2)。力拔山兮氣蓋世,時不利兮騅不逝。',
      en: 'Charge. Overload (2). His strength could uproot mountains — and then the tide turned.',
    },
  },
  // 荊軻:原本是「战吼造成 4 点伤害」。图穷匕见 —— 匕首出现在一连串动作的**最后**,
  // 这本来就是连击的形状,比战吼贴切。基础 4/3 白板(4 费的弱身材),
  // 连击给冲锋 + 潜行,等于「凑得出第二张就是一次 4 点直伤,凑不出就是张软牌」。
  'hist-jing-ke': {
    cost: 4,
    attack: 4,
    health: 3,
    rarity: 'legendary',
    battlecry: undefined,
    combo: {
      ops: [
        { op: 'grantKeyword', keyword: 'charge', target: 'self' },
        { op: 'grantKeyword', keyword: 'stealth', target: 'self' },
      ],
    },
    text: {
      zh: '連擊:獲得衝鋒與潛行。圖窮匕見,風蕭蕭兮易水寒。',
      en: 'Combo: gain Charge and Stealth. The map unrolls; the dagger appears.',
    },
  },
}

export const PACK4_CARDS: CardDef[] = [...PACK4_SECRETS, ...PACK4_COMBO, ...PACK4_OVERLOAD]
