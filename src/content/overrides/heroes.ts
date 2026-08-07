import type { HeroDef, HeroPowerDef } from '../../engine/types'
import { START_HP } from '../../engine/types'

// 六主义主公,一主义一位。id 必须存在于武将花名册(立绘自动跟随)。
// 王道刘备、霸道曹操为既定;其余四位选型理由:
// - 礼教 孔子:礼教之宗,克己复礼——礼教主义的定义者本人。
// - 名利 司马懿:鹰视狼顾,隐忍一生只为名位权柄,名利路线的极致。
// - 割据 孙权:坐断东南战未休,凭长江割据一方的代表人物。
// - 隐逸 老子:道家始祖,出关而隐,隐逸主义的源头。
//
// ---- 主公技 ----
// 全部 2 费、每回合一次 —— 这是炉石验证了很多年的基线,别轻易动。
// 六个技能刻意落在六条**不同的资源轴**上,而不是「都是造成 X 点伤害,只有数字不同」:
//   王道=增益 / 霸道=点杀 / 礼教=换牌 / 名利=铺场 / 割据=守墙 / 隐逸=控场。
// 这样六个主义在还没发一张牌的时候就已经是六种打法了。
// 改数值必跑 `npm run sim-balance`:主公技每回合都能用,是全局触发频率最高的效果,
// 一点数值差在三十回合的对局里会被放大成压倒性优势。
const POWERS: Record<string, HeroPowerDef> = {
  'liu-bei': {
    id: 'hp-rende',
    name: { zh: '仁德', en: 'Benevolence' },
    // +1/+1 打出来只有 40.6%,而且被名利的铺场流压到 25%。
    // 补的是血而不是攻:王道输在自家武将被 1 点法伤和小兵换掉,不是输在打不出伤害。
    text: { zh: '使一名友方武將獲得+1/+2。', en: 'Give a friendly general +1/+2.' },
    cost: 2,
    script: {
      ops: [{ op: 'buffStats', attack: 1, health: 2, target: 'chosenFriendlyGeneral' }],
    },
  },
  'cao-cao': {
    id: 'hp-weicai',
    name: { zh: '唯才是舉', en: 'Merit Above All' },
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'hist-confucius': {
    id: 'hp-youjiao',
    name: { zh: '有教無類', en: 'Teaching Without Class' },
    text: {
      zh: '抽一張牌,你的主公受到 1 點傷害。',
      en: 'Draw a card. Your hero takes 1 damage.',
    },
    cost: 2,
    script: {
      ops: [
        { op: 'draw', count: 1 },
        { op: 'damage', amount: 1, target: 'friendlyHero' },
      ],
    },
  },
  'sima-yi': {
    id: 'hp-yingshi',
    name: { zh: '鷹視狼顧', en: 'Wolf’s Gaze' },
    text: { zh: '召喚一個 1/1 的死士。', en: 'Summon a 1/1 Retainer.' },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] },
  },
  'sun-quan': {
    id: 'hp-zhiheng',
    name: { zh: '制衡', en: 'Equilibrium' },
    text: {
      zh: '召喚一個 0/4 的江東水寨(守護)。',
      en: 'Summon a 0/4 Jiangdong Stockade with Guard.',
    },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }] },
  },
  'hist-laozi': {
    id: 'hp-wuwei',
    name: { zh: '無為', en: 'Non-Action' },
    // 试过「获得铁壁」(太强,64%)和「获得潜行」(太弱,27%)。
    // 冻结落在两者之间,而且「不战而屈人之兵」比给自己套盾更像隐逸。
    text: { zh: '凍結一名敵方武將。', en: 'Freeze an enemy general.' },
    cost: 2,
    script: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
  },

  // ---- 备选主公技(第六卡包:每个主义第二位主公) ----
  //
  // 设计原则:**每个备选主公技借用另一条轴上已经验证过的那一招**,不引入新的强度档。
  // 六个基准主公技都是 2 费、镜像约 50%(注释见上),把它们**换个主义**用,
  // 就给那个主义开了第二种打法:王道能玩控场、霸道能铺场、名利能过牌……
  // 而强度仍在证过的带里。改动必跑 hero-mirror 校验(scripts/sim-hero-mirror.ts)。
  //
  // 借用关系:王道→控场(隐逸)· 霸道→铺场(名利)· 礼教→增益(王道)·
  //           名利→过牌(礼教)· 割据→点杀(霸道)· 隐逸→守墙(割据)
  //
  // ⚠️ **下面每个技能注释里 2026-08-04 之前的镜像百分比一律作废。**
  // sim-hero-mirror 当时把先后手和座位绑死了,备选主公全程后手,
  // 那把尺子的中性点是约 26% 而不是 50%(详见 呂蒙 那一段的完整复盘,
  // 以及 scripts/simSeating.ts)。所以「XX% 太弱所以加码」这类推理
  // **多数是在补一个不存在的缺口** —— 朱熹被这样连加了两次,现在 70.8%。
  // 要引用数字,用修好之后重测的那一组。
  'hist-liu-xiu': {
    id: 'hp-rousao',
    name: { zh: '柔道', en: 'The Gentle Way' },
    text: { zh: '凍結一名敵方武將。', en: 'Freeze an enemy general.' },
    cost: 2,
    script: { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] },
  },
  'zhang-liao': {
    id: 'hp-xiaoyao',
    name: { zh: '威震逍遙津', en: 'Terror of Xiaoyao Ford' },
    // 召 1/1 在霸道攻势卡组里太软(镜像 25%);改召 2/1 冲锋的虎豹骑,能立刻换血/打脸。
    text: { zh: '召喚一個 2/1 衝鋒的虎豹騎。', en: 'Summon a 2/1 Tiger-Leopard Cavalry with Charge.' },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-hubao-qi', count: 1 }] },
  },
  'hist-zhu-xi': {
    id: 'hp-cunli',
    name: { zh: '格物致知', en: 'Investigate to Know' },
    // 增益在礼教控场卡组里太弱(镜像 31%);礼教要的是解场,改成对一个敌将 2 点。
    // 点杀 2 在礼教控场里差一口气(37%);加 1 护甲,礼教靠磨,续航更契合。
    //
    // 【2026-08-04:上面那两次加码都是在补一个不存在的缺口,现已回退一半】
    // 那个 31% 和 37% 是在坏掉的 sim-hero-mirror 上量的(备选主公全程后手,
    // 中性点约 26% 而非 50% —— 见 呂蒙 那一段)。换算回来,当年的「增益」约 53%、
    // 「纯点杀 2」约 59%,**本来就在带里**,根本不需要加码。
    // 两次加上去之后,用修好的尺子重测是 **70.8%** —— 六个备选里唯一出界的。
    //
    // 四个候选各 400 局实测(座位编排已修正):
    //   2 伤 + 1 护甲(加码后) 70.8%   ·  2 伤(只去护甲) 65.3%   ← 都出界
    //   **1 伤 + 1 护甲 46.5%**       ·  1 伤 45.5%              ← 都合格
    // 杠杆在伤害量不在护甲:2→1 掉约 20 个点,而护甲本身几乎不值钱
    // (46.5 vs 45.5,差在噪声里 —— 正是铁律 8「护甲在贪心 AI 评分里近乎为零」)。
    // 所以退掉伤害那一半、留下护甲那一半:数值回到带中央,
    // 「靠磨、续航」的风味和与曹操/郭嘉/呂蒙三家纯点杀的区分度都保住。
    text: { zh: '造成 1 點傷害,你的主公獲得 1 點護甲。', en: 'Deal 1 damage and gain 1 Armor.' },
    cost: 2,
    script: {
      ops: [
        { op: 'damage', amount: 1, target: 'chosenAny' },
        { op: 'gainArmor', amount: 1 },
      ],
    },
  },
  'guo-jia': {
    id: 'hp-yiji',
    name: { zh: '遺計', en: 'The Final Scheme' },
    // 名利预组是铺场/节奏向:纯抽牌太软(27%)、抽+点杀又太强(69%)。
    // 落在中间的是纯点杀 1 —— 遗计算无遗策,一箭定乾坤。
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    // 同呂蒙,2026-08-07 由 2 费改 3 费:加了后手补偿之后这一格量到 61.0%(带外 1.0,
    // 单侧标准误 2.5 —— 本身落在噪声里,但闸门的阈是硬的,而这个旋钮的效果已经量过:
    // 呂蒙 同样一改是 −8.3)。
    cost: 3,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'lu-meng': {
    id: 'hp-baiyi',
    name: { zh: '白衣渡江', en: 'Crossing in White' },
    // 【为什么这一份和曹操「唯才是舉」、郭嘉「遺計」逐字相同】
    // 不是没想过改。2026-07 试过把它改成主题上正确的东西 ——
    // 白衣渡江是伪装奇袭,所以给「+2/+0 并获得潜行」。
    // 实测 sim-hero-mirror:**38% 掉到 26%**。
    // 同一轮还试了把劉秀「柔道」从冻结改成「回血 2 + 护甲 1」(休养生息):
    // **40% 掉到 27%**。
    //
    // 两次都指向同一件事,也就是铁律 8:**贪心 AI 给治疗、护甲、潜行的估值
    // 近乎为零** —— 潜行的价值是「保住一个威胁到下回合」,而评估函数里
    // 没有任何跨回合的项。于是任何往防守/铺垫方向做的主公技,
    // 在这把尺子上量出来都是弱的,哪怕它对真人更好用。
    //
    // 结论:**主公技的差异化被测量工具卡住了,不是被设计卡住的。**
    // 要真正解决,得先让评估函数看得懂跨回合价值(见 ai/greedy.ts 的
    // holdValue 开关,那只是第一步),而不是继续在内容层试。
    //
    // ---- 2026-08:尺子修好了,主题版**还是不行** ----
    // 上面那个「等评估函数看得懂跨回合价值再回来试」的计划真的执行了:
    // greedy 的 evaluate 加了「威胁存续」项(attack × 活到下回合的概率),
    // 潜行/铁壁/高血量/治疗从此在尺子上是有价值的(单测钉在 ai/horizon.test.ts),
    // 而且 sim-hero-mirror 的样本从 100 局提到 400 局(标准误 5pp → 2.5pp ——
    // 当年那个「38% 掉到 26%」的结论,有相当一部分落在噪声里)。
    //
    // 用新尺子把「+2/+0 与潜行」换回来实测:**32.3% → 22.0%**。更差了。
    // 也就是说这一条我预测错了 —— 不是尺子看不见潜行,是这个技能确实更弱。
    //
    // 复盘之后真正的原因大概率不在呂蒙身上,在**对照组**:
    // 孫權「制衡」是「召唤一个 0/4 守护」,一个每回合白送的墙。
    // 同样一条「造成 1 点伤害」,郭嘉对上司馬懿的 1/1 召唤能打 40.0%,
    // 对上孫權的 0/4 守护只有 32.3% —— 差的 8 个点是**基准之间的差**,
    // 不是呂蒙的问题。要修得动孫權,而那是改基准,牵动的东西多得多。
    //
    // 所以维持现状,把数字留在这里:下次想动它的人先看这一段,别再试第三遍。
    //
    // ============================================================
    // 【2026-08-04 撤销上面整段结论 —— 尺子本身是坏的】
    //
    // sim-hero-mirror 把座位和先后手绑死了:`first: (seed & 1)`,而
    // seed = i*131+7 的奇偶与 altSeat 同步翻转,于是 first 恒等于 1-altSeat,
    // **备选主公 400 局全程后手,一局先手都没坐过**。
    // 而这游戏的先手优势有 20 多个百分点(自我对镜实测后手只有 24–29%,
    // 起手牌 3 vs 4 那一张补不回来)。也就是说这道闸门的中性点是**约 26%**,
    // 而它一直在拿 40–60% 判定 —— 上面每一个数字都是废的。
    //
    // 修好座位编排后重测(400 局,±2.5):
    //   呂蒙 32.3% → **57.8%**   劉秀 33.3% → 54.5%   張遼 32.3% → 52.5%
    //   莊周 25.0% → 53.3%       郭嘉 40.0% → 57.8%   朱熹 50.5% → **70.8%**
    //
    // 结论整个翻过来:呂蒙**从来没有偏弱**,现在 57.8% 稳稳在带里;
    // 真正出界的是当年唯一「合格」的朱熹。上面那两轮「越改越差」的实验
    // (潜行 22.0%、回血 27%)是在一把歪尺子上做的,它们的**绝对值**不能用;
    // 相对比较也只在「同样全程后手」的前提下才成立,别再拿来当依据。
    //
    // 座位编排的不变量现在钉在 scripts/simSeating.test.ts(含反向验证:
    // 复现当年那个写法,断言它确实会让被测方 0 局先手)。
    // 同一个 bug 在 sim-balance 里发生过、修过、把教训写在了那个文件顶部,
    // 但没有传到这里 —— 教训要写成断言,不能只写成注释。
    // ============================================================
    text: { zh: '造成 1 點傷害。', en: 'Deal 1 damage.' },
    // 3 费而不是 2 —— 2026-08-07 加了后手补偿、并把 陸抗 换进 坐斷東南 之后,
    // 这一格量到 66.0%(带外)。病根不在这个技能变强,在**对照组变弱**:
    // 孫權「制衡」白送一个 0/4 守护,而那套牌现在自带的守护够多了,
    // 那面墙变成冗余。同一条「造成 1 点」在郭嘉那边只有 61.0%。
    // 改基准(孫權)牵动的东西多得多,所以从这一侧收 —— 涨一费。
    cost: 3,
    script: { ops: [{ op: 'damage', amount: 1, target: 'chosenAny' }] },
  },
  'hist-zhuangzi': {
    id: 'hp-xiaoyaoyou',
    name: { zh: '逍遙遊', en: 'Free and Easy Wandering' },
    // 被动守护墙在隐逸卡组里太消极(镜像 25→24%);隐逸要主动养刺客,
    // 改成给一个友军 +2/+2 与潜行 —— 一手养出能一击致命的刺客。
    text: { zh: '使一名友方武將獲得 +2/+2 與潛行。', en: 'Give a friendly general +2/+2 and Stealth.' },
    cost: 2,
    script: {
      ops: [
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'stealth', target: 'chosenFriendlyGeneral' },
      ],
    },
  },
}

// 备选主公:每个主义的第二位。同主义共享卡池,只换主公技(= 换打法)。
export const ALT_HEROES: HeroDef[] = [
  { id: 'hist-liu-xiu', name: { zh: '劉秀', en: 'Liu Xiu' }, doctrine: 'royal', hp: START_HP, power: POWERS['hist-liu-xiu'] },
  { id: 'zhang-liao', name: { zh: '張遼', en: 'Zhang Liao' }, doctrine: 'hegemonic', hp: START_HP, power: POWERS['zhang-liao'] },
  { id: 'hist-zhu-xi', name: { zh: '朱熹', en: 'Zhu Xi' }, doctrine: 'ritual', hp: START_HP, power: POWERS['hist-zhu-xi'] },
  { id: 'guo-jia', name: { zh: '郭嘉', en: 'Guo Jia' }, doctrine: 'fame', hp: START_HP, power: POWERS['guo-jia'] },
  { id: 'lu-meng', name: { zh: '呂蒙', en: 'Lu Meng' }, doctrine: 'separatist', hp: START_HP, power: POWERS['lu-meng'] },
  { id: 'hist-zhuangzi', name: { zh: '莊周', en: 'Zhuangzi' }, doctrine: 'reclusion', hp: START_HP, power: POWERS['hist-zhuangzi'] },
]

export const HEROES: HeroDef[] = [
  {
    id: 'liu-bei',
    name: { zh: '劉備', en: 'Liu Bei' },
    doctrine: 'royal',
    hp: START_HP,
    power: POWERS['liu-bei'],
  },
  {
    id: 'cao-cao',
    name: { zh: '曹操', en: 'Cao Cao' },
    doctrine: 'hegemonic',
    hp: START_HP,
    power: POWERS['cao-cao'],
  },
  {
    id: 'hist-confucius',
    name: { zh: '孔子', en: 'Confucius' },
    doctrine: 'ritual',
    hp: START_HP,
    power: POWERS['hist-confucius'],
  },
  {
    id: 'sima-yi',
    name: { zh: '司馬懿', en: 'Sima Yi' },
    doctrine: 'fame',
    hp: START_HP,
    power: POWERS['sima-yi'],
  },
  {
    id: 'sun-quan',
    name: { zh: '孫權', en: 'Sun Quan' },
    doctrine: 'separatist',
    hp: START_HP,
    power: POWERS['sun-quan'],
  },
  {
    id: 'hist-laozi',
    name: { zh: '老子', en: 'Laozi' },
    doctrine: 'reclusion',
    hp: START_HP,
    power: POWERS['hist-laozi'],
  },
]

// 全部主公 = 六位基准 + 六位备选。HEROES_BY_ID 两者都收(引擎按 heroId 查主公技)。
export const ALL_HEROES: HeroDef[] = [...HEROES, ...ALT_HEROES]

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  ALL_HEROES.map((h) => [h.id, h]),
)

// ============================================================
// 主公技升階 —— **只在远征里发**,不进天梯与冒险。这是实测逼出来的边界,记清楚。
//
// 引擎侧的升阶(Command: UpgradeHeroPower)是干净的:一局一次、整份换掉、
// 不占「每回合一次」的额度、可选字段零迁移风险。真正的问题在**内容**。
//
// 【实测经过】把升阶挂到六个基准主公技上之后,sim-balance 当场炸:
//   克己復禮 vs 大隱於市 从 36% 掉到 **25%**(越界)。
// 改了四轮升阶内容(隐逸去伤害、礼教翻倍抽牌、礼教去自伤、全体降价到 3 费),
// **四次全是 25%,一格没动**;降价那次更糟,21%,连大隱於市的总胜率也顶到 60.2%。
//
// 决定性实验:把 AI 的升阶估值调成 0(它因此永不升阶),矩阵**逐格回到原样**。
// 所以 11 个点全部来自「AI 什么时候升」,与升阶内容无关 ——
// `evaluate` 里没有法力这个概念,升阶在它眼里是白送的分数,于是一到够钱的回合
// 就无脑升,把一整个回合的节奏扔掉。给那条命令单收机会成本也压不住:
// 只要净值为正,AI 就会在「这回合没好牌可打」时升,而那恰恰是节奏牌组最不该分心的时刻。
//
// 【结论】六个升阶**彼此不平衡**(隐逸的控场升阶在慢局里价值远高于礼教的过牌升阶),
// 要进天梯得走一轮和当初主公技同级别的调校(sim-hero-mirror + 逐个改数值)。
// 在那之前,把它发在**远征**里:那是单人 roguelike,难度靠一趟 run 自己成立,
// 没有平衡闸门,而「花一笔法力把主公技升上去」正是 roguelike 最想要的那种决策。
export const HERO_POWER_UPGRADES: Record<string, HeroPowerDef> = {
  'hp-rende': {
    id: 'hp-rende-2',
    name: { zh: '仁德佈於四海', en: 'Benevolence Spread Wide' },
    text: { zh: '使一名友方武將獲得+2/+3。', en: 'Give a friendly general +2/+3.' },
    cost: 2,
    script: { ops: [{ op: 'buffStats', attack: 2, health: 3, target: 'chosenFriendlyGeneral' }] },
  },
  'hp-weicai': {
    id: 'hp-weicai-2',
    name: { zh: '唯才是舉 · 廣納', en: 'Merit Above All · Wide Net' },
    text: { zh: '造成 2 點傷害。', en: 'Deal 2 damage.' },
    cost: 2,
    script: { ops: [{ op: 'damage', amount: 2, target: 'chosenAny' }] },
  },
  'hp-youjiao': {
    id: 'hp-youjiao-2',
    name: { zh: '有教無類 · 弟子三千', en: 'Teaching Without Class · Three Thousand' },
    text: { zh: '抽兩張牌。', en: 'Draw two cards.' },
    cost: 2,
    script: { ops: [{ op: 'draw', count: 2 }] },
  },
  'hp-yingshi': {
    id: 'hp-yingshi-2',
    name: { zh: '鷹視狼顧 · 蓄勢', en: 'Wolf’s Gaze · Gathering' },
    text: { zh: '召喚兩個 1/1 的死士。', en: 'Summon two 1/1 Retainers.' },
    cost: 2,
    script: { ops: [{ op: 'summon', defId: 'token-si-shi', count: 2 }] },
  },
  'hp-zhiheng': {
    id: 'hp-zhiheng-2',
    name: { zh: '制衡 · 深壘', en: 'Equilibrium · Deep Works' },
    text: {
      zh: '召喚一個 0/4 的江東水寨(守護),並獲得 2 點護甲。',
      en: 'Summon a 0/4 Jiangdong Stockade with Guard and gain 2 Armor.',
    },
    cost: 2,
    script: {
      ops: [
        { op: 'summon', defId: 'token-shui-zhai', count: 1 },
        { op: 'gainArmor', amount: 2 },
      ],
    },
  },
  'hp-wuwei': {
    id: 'hp-wuwei-2',
    name: { zh: '無為 · 不爭', en: 'Non-Action · Yielding' },
    text: {
      zh: '凍結一名敵方武將,我方主公獲得 2 點護甲。',
      en: 'Freeze an enemy general and gain 2 Armor.',
    },
    cost: 2,
    script: {
      ops: [
        { op: 'freeze', target: 'chosenEnemyGeneral' },
        { op: 'gainArmor', amount: 2 },
      ],
    },
  },
}

// 给一个主公技挂上它的升阶(有升阶版本时)。只有远征调它 —— 见上面那段说明。
export function withUpgrade(power?: HeroPowerDef, upgradeCost = 5): HeroPowerDef | undefined {
  if (!power) return power
  const up = HERO_POWER_UPGRADES[power.id]
  return up ? { ...power, upgrade: up, upgradeCost } : power
}
