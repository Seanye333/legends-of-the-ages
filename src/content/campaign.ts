// 只 import 真正用到的那一片 —— 其余三片留给玩家在对战里自己打出来(见 BOSS_FIELDS 的说明)
import { FIELD_SNOW } from './overrides/pack19'
import type {
  BattleObjective,
  CardDef,
  Doctrine,
  HeroPowerDef,
  FieldRule,
  FieldState,
  LocalizedText,
  RunModifiers,
} from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import type { EvalWeights } from '../ai/greedy'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'

// 冒险模式「群雄逐鹿」。
//
// 此前单人内容只有「随便打一局 AI」和一场脚本化教程 —— 没有任何有终点的挑战。
// 现在是**两章共十六场**关底战,每一场是一个**规则不对称**的对手:更高的血量、
// 一个比玩家更强的主公技、一套主题卡组。玩家用自己的卡组去打,所以它同时是构筑的试金石。
//
// 第一章「汉末群雄」张角→曹操,第二章「逐鹿千年」白起→徐达,
// 第三章「山河永寂」谢玄→郑成功 —— 前两章的主角是**去取天下的人**,
// 第三章换成**守住一条线不让它断的人**。共 24 关。
// 解锁是**全局线性**的(通了曹操才进白起),但难度按章各自成曲线:第二章开章时
// 玩家已成军,不必再像张角那样友好。sim-campaign 按 chapter 分段校验每章的曲线。
//
// 为什么用「加血 + 强技能」而不是「给 Boss 作弊卡」:
// 引擎是权威且对称的,给 Boss 特权卡等于要在引擎里开后门。
// 而 heroHps / heroPowers 本来就是 GameConfig 的一部分(主公技上线时就打通了),
// 用它们做难度曲线不需要动引擎一行代码。
//
// 难度曲线的三个旋钮,以及它们各自有多大用(都是 sim-campaign 实测出来的):
//   1. **卡组曲线 deckTier —— 强旋钮。** 同一个张角,tier 0 → 0.75,
//      玩家胜率从 35% 变成 97%。注意它**换过一次含义**:卡池重做费用曲线后,
//      身材变成了费用的函数,「同档挑身材最好的」失效,tier 改为移动曲线本身
//      (低平 ↔ 顶重)。见 bossDeck 里的第三版说明。
//   2. 主公技 —— 中等且极不线性。每回合铺两个 1/1 远强于每回合 3 点伤害,
//      因为贪心 AI 的胜负主要由场面交换决定。
//   3. **血量 —— 弱旋钮。** 张角从 30 血压到 23 血,胜率只从 35% 挪到 37%;
//      主帅血量只在最后几回合才成为瓶颈。所以血量只用来做递增的仪式感,
//      真正定难度的是 deckTier(用 npm run tune-campaign 二分搜出来)。
// **对局用玩家自己选的难度档**(设置里的新兵/宿将/名将),不是固定档 ——
// 这一行以前写的是「固定用名将」,那是错的,一直没人对过。
//
// 曲线是拿 sim-campaign 的基准尺(AI_NORMAL,双方同档)调出来的。
//
// **2026-08 又一次重新定标**(铁律 9:AI_NORMAL 一动,历史数字全部作废)
//
// 这次动的是 AI_NORMAL 的估值本身:加了「威胁存续」项,让潜行/铁壁/
// 高血量/治疗的跨回合价值第一次可见(详见 ai/greedy.ts)。
// 新尺子对旧尺子 54.6%(864 局,z = 2.7),也就是说 AI 真的变强了。
//
// 重新量下来:
//   · sim-balance   仍然全绿(总胜率 40-60、无对位出 30-70)—— 卡组矩阵扛住了换尺子
//   · sim-campaign  GAMES=240 全绿。**但 GAMES=60 那一跑报了「第 2 章曲线太平:
//     前半 48% vs 后半 46%」** —— 而它自己的置信半宽是 ±13pp。
//     2 个点的差被当成结论,差点据此去调关卡。
//     **教训:这个脚本默认的 60 局撑不起它自己的判定,下结论一律用 GAMES=240。**
//   · sim-history   换尺子前后都是红的(6 场太送),不是这次改出来的
//
// 同一轮还发现另外两道闸门有同样的毛病:sim-ai-tiers 的验收线是写死的
// `rate > 55`(和样本量无关,144 局时 56% 的 z 只有 1.4,纯噪声)——
// 已换成真的 z 检验;sim-hero-mirror 每对位只跑 100 局(SE 5pp)却按
// ±10pp 的区间判定 —— 已提到 400 局并打印标准误。
//
// **2026-08-04 收尾:上面那条「教训」当时只写进了注释,脚本本身没改。**
// 后果是它又咬了一次 —— 默认仍是 60 局、CI 也钉着 GAMES: 60,于是 main 上
// 长期挂着一次纯噪声的红,而 ROADMAP 把它当成真问题写进了待办第一条
// (「先修这个再做别的」),差点据此重搜一轮 deckTier。**照做就会把噪声
// 焊进难度曲线。** 这次是真改了:
//   · 判定从「点估计 vs 写死阈值」换成显著性检验(z>2 才算越界)
//   · 默认 60 → 240;60 局下「落差 ≥8」那一条即使真实落差为 0 也只有 z=1.8,
//     也就是**根本不可能红** —— 一道既误报又抓不到真问题的闸门比没有更糟
//   · 判定逻辑抽到 scripts/campaignGate.ts,配一份两个方向都验的单测
//     (该红时红、不该红时不红),不必跑十分钟模拟就能验
// 教训的教训:**把结论写进注释不等于修好了**。闸门的毛病要改在闸门里。
//
// **2026-07 重新定标**(同上,上一次):
// 修好了斩杀搜索「看不见守护墙」那个洞 —— 从前遇到守护直接判定打不穿,
// 也就是说结构上看不见「先清墙再斩杀」,而那是这游戏最常见的一条斩杀线
// (全池 261 张带守护,每套预组 12 张)。修完之后:
//   第一章 80 / 62 / 65 / 65 / 37 / 50 / 57 / 35 %
//   第二章 75 / 72 / 50 / 52 / 32 / 55 / 50 / 23 %
//   第三章 58 / 48 / 62 / 58 / 42 / 42 / 58 / 20 %
// 修之前那一组(留作对照):
//   第一章 78 / 48 / 55 / 50 / 32 / 40 / 32 / 33 %
//   第二章 72 / 68 / 40 / 40 / 28 / 40 / 28 / 15 %
//   第三章 58 / 47 / 43 / 35 / 22 / 27 / 33 / 17 %
//
// **顺带治好了新手墙**:第一关→第二关从「78% → 48%」(一关掉 30 个点)
// 变成「80% → 62%」。原因是修复对玩家侧同样生效,而第二关的曲线本来
// 就卡在「玩家有斩杀线但 AI 看不见」那一档上。这不是调出来的,是修出来的。
//
// 真人玩家强于贪心 AI,所以这组数字是**下限**,实际体感会更松一些。
//
// 这套 tier 重搜过两轮:一轮是机制播种重做,一轮是**预组骨架名将补专属技**
// (张飞、张辽、孙策、许褚…)。后者尤其要留神:预组卡同时也在 bossDeck 的抽取池里,
// 所以改预组会**同时**动 sim-balance 的矩阵和 sim-campaign 的曲线,两个都得重跑。
//
// 播种重做把带效果的卡从 55% 提到 80%,
// 而效果是从身材里买的 —— Boss 抽到的卡整体变软,旧的一组 tier 直接失效
// (趙匡胤从 32% 飙到 87%、李世民从 20% 到 53%)。这不是 bug:
// **卡池一动,冒险曲线就得重调**,sim-campaign 就是干这个的。
//
// 重搜时把 tune-campaign 从二分改成了**网格扫描** —— tier→强度非单调
// (孫策的关系甚至是反的),二分会顺着局部斜率跑偏,报出来的建议填回去就是凸点。
// 另外 60 局的噪声有 ±6%,单点异常先加样本量复测再动手:呂布用 60 局量到 38%、
// 90 局量到 57%,差的那 19 个点全是噪声。
//
// **换成名将档(多一层前瞻)整条曲线会压平**,实测 `BOSS_AI=general`:
//   52 / 47 / 48 / 43 / 50 / 48 / 25 / 23 %
// 前六关全挤在 43~52%,第一关也从 60% 掉到 52%。原因是前瞻对**低 tier 的软卡组**
// 帮助最大 —— 牌本身不强的时候,「别在能被斩杀的场面上收手」这一条价值最高。
// 不为此重调:选名将的玩家要的就是这个。但别拿两组数字互相印证,它们不是一回事。

export interface BossDef {
  id: string
  heroId: string // 用花名册里的 id,立绘自动跟随
  name: LocalizedText
  title: LocalizedText
  intro: LocalizedText
  doctrine: Doctrine
  hp: number
  deckTier: number // 卡组曲线分位,0=最快(最强) 1=最顶重(最弱);见 bossDeck
  power: HeroPowerDef
  rewardMerit: number
  rewardPacks: number
  chapter?: number // 章节归属(缺省=1)。解锁仍是全局线性,章节只用来分组与分段校验曲线
}

// 章节号,缺省视作第一章。sim-campaign 按它分段校验难度曲线,
// CampaignScreen 按它插入章节分隔。
export function bossChapter(b: BossDef): number {
  return b.chapter ?? 1
}

// 章节标题:CampaignScreen 在每章第一关前插一条分隔。
export const CHAPTER_TITLES: Record<number, LocalizedText> = {
  1: { zh: '第一章 · 漢末群雄', en: 'Chapter I · Warlords of Han’s Fall' },
  2: { zh: '第二章 · 逐鹿千年', en: 'Chapter II · A Thousand Years of Contenders' },
  3: { zh: '第三章 · 山河永寂', en: 'Chapter III · The Silent Land' },
}

const power = (
  id: string,
  name: LocalizedText,
  text: LocalizedText,
  cost: number,
  ops: HeroPowerDef['script']['ops'],
): HeroPowerDef => ({ id, name, text, cost, script: { ops } })

export const BOSSES: BossDef[] = [
  {
    id: 'boss-zhang-jiao',
    heroId: 'zhang-jiao',
    name: { zh: '張角', en: 'Zhang Jiao' },
    title: { zh: '蒼天已死', en: 'The Blue Heaven Is Dead' },
    intro: {
      zh: '黃巾蔽野,太平道眾自四方而起。他不缺兵,只缺時間。',
      en: 'Yellow scarves blanket the fields. He does not lack men — only time.',
    },
    doctrine: 'fame',
    hp: 30,
    deckTier: 0.0,
    power: power(
      'bp-taiping',
      { zh: '太平要術', en: 'Way of Great Peace' },
      { zh: '召喚一個 1/1 的黃巾力士。', en: 'Summon a 1/1 Yellow Scarf.' },
      2,
      [{ op: 'summon', defId: 'token-si-shi', count: 1 }],
    ),
    rewardMerit: 60,
    rewardPacks: 1,
  },
  {
    id: 'boss-dong-zhuo',
    heroId: 'dong-zhuo',
    name: { zh: '董卓', en: 'Dong Zhuo' },
    title: { zh: '焚京之火', en: 'The Burning of the Capital' },
    intro: {
      zh: '洛陽火起三日不絕。他不在乎守得住什麼,只在乎誰也別想得到。',
      en: 'Luoyang burned for three days. He never meant to hold it — only to leave nothing behind.',
    },
    doctrine: 'hegemonic',
    hp: 34,
    deckTier: 0.3,
    power: power(
      'bp-fenjing',
      { zh: '焚城', en: 'Raze' },
      { zh: '對隨機一名敵方武將造成 2 點傷害。', en: 'Deal 2 damage to a random enemy general.' },
      2,
      [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
    ),
    rewardMerit: 80,
    rewardPacks: 1,
  },
  {
    id: 'boss-lu-bu',
    heroId: 'lu-bu',
    name: { zh: '呂布', en: 'Lü Bu' },
    title: { zh: '人中呂布', en: 'Peerless' },
    intro: {
      zh: '三英戰之而不下。他不需要陣法,他自己就是陣法。',
      en: 'Three heroes could not bring him down. He needs no formation — he is one.',
    },
    doctrine: 'hegemonic',
    hp: 36,
    deckTier: 0.0,
    power: power(
      'bp-wushuang',
      { zh: '無雙', en: 'Peerless Might' },
      { zh: '使一名友方武將獲得+2/+0與衝鋒。', en: 'Give a friendly general +2/+0 and Charge.' },
      2,
      [
        { op: 'buffStats', attack: 2, health: 0, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'charge', target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 100,
    rewardPacks: 1,
  },
  {
    id: 'boss-yuan-shao',
    heroId: 'yuan-shao',
    name: { zh: '袁紹', en: 'Yuan Shao' },
    title: { zh: '四世三公', en: 'Four Generations of Excellency' },
    intro: {
      zh: '兵多將廣,糧草如山。他輸的從來不是本錢。',
      en: 'Endless men, endless grain. What he lacked was never resources.',
    },
    doctrine: 'royal',
    hp: 38,
    deckTier: 0.45,
    // 这一关的调校记录(结论已并入 bossDeck 的注释,这里只留因果):
    // 原技能是「抽一张牌 + 2 点护甲」,实测玩家胜率 75%,比第 1 关还好打。
    // 换成「召唤 1 个 1/1 + 2 护甲」后仍是 77% —— 说明瓶颈不在技能。
    // 真正的原因是卡组构造函数当时按「有没有效果」排序,而效果是用身材换的,
    // 于是效果卡最多的王道池反而产出最软的一套牌。修好排序后这一关才立得住。
    // 技能最终定为「每回合两个 1/1」:场面增量才是贪心 AI 真正会怕的东西。
    power: power(
      'bp-sishi',
      { zh: '門生故吏', en: 'Clients and Retainers' },
      { zh: '召喚兩個 1/1 的門客。', en: 'Summon two 1/1 Retainers.' },
      2,
      [{ op: 'summon', defId: 'token-si-shi', count: 2 }],
    ),
    rewardMerit: 120,
    rewardPacks: 1,
  },
  {
    id: 'boss-sun-ce',
    heroId: 'sun-ce',
    name: { zh: '孫策', en: 'Sun Ce' },
    title: { zh: '江東小霸王', en: 'The Little Conqueror' },
    intro: {
      zh: '轉鬥千里,盡有江東。二十六歲,已經來不及慢慢打了。',
      en: 'A thousand li of running battle won him all of Jiangdong. At twenty-six, there was no time to be slow.',
    },
    doctrine: 'separatist',
    hp: 40,
    deckTier: 0.45,
    power: power(
      'bp-xiaoba',
      { zh: '小霸王', en: 'Conqueror’s Charge' },
      { zh: '使一名友方武將獲得突襲並+1/+1。', en: 'Give a friendly general Rush and +1/+1.' },
      2,
      [
        { op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' },
        { op: 'buffStats', attack: 1, health: 1, target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 150,
    rewardPacks: 2,
  },
  {
    id: 'boss-zhou-yu',
    heroId: 'zhou-yu',
    name: { zh: '周瑜', en: 'Zhou Yu' },
    title: { zh: '赤壁東風', en: 'The East Wind at Red Cliff' },
    intro: {
      zh: '談笑間,檣櫓灰飛煙滅。火起時,你才明白風是什麼時候轉的。',
      en: 'Amid talk and laughter the fleet turned to ash. Only when it burned did you see when the wind had changed.',
    },
    doctrine: 'separatist',
    hp: 42,
    deckTier: 0.0,
    power: power(
      'bp-huogong',
      { zh: '火攻', en: 'Fire Attack' },
      { zh: '對所有敵方武將造成 1 點傷害。', en: 'Deal 1 damage to all enemy generals.' },
      2,
      [{ op: 'aoeDamage', amount: 1 }],
    ),
    rewardMerit: 180,
    rewardPacks: 2,
  },
  {
    id: 'boss-zhuge-liang',
    heroId: 'zhuge-liang',
    name: { zh: '諸葛亮', en: 'Zhuge Liang' },
    title: { zh: '出師未捷', en: 'The Campaign Unfinished' },
    intro: {
      zh: '六出祁山,鞠躬盡瘁。他算得到每一步,只算不到天時。',
      en: 'Six campaigns from Qishan, spent to the last breath. He foresaw every move but the weather.',
    },
    doctrine: 'ritual',
    hp: 45,
    deckTier: 0.0,
    power: power(
      'bp-bagua',
      { zh: '八陣圖', en: 'Stone Sentinel Maze' },
      { zh: '凍結一名敵方武將,並抽一張牌。', en: 'Freeze an enemy general and draw a card.' },
      2,
      [
        { op: 'freeze', target: 'chosenEnemyGeneral' },
        { op: 'draw', count: 1 },
      ],
    ),
    rewardMerit: 220,
    rewardPacks: 2,
  },
  {
    id: 'boss-cao-cao',
    heroId: 'cao-cao',
    name: { zh: '曹操', en: 'Cao Cao' },
    title: { zh: '設使天下無孤', en: 'Were It Not for Me' },
    intro: {
      zh: '「設使國家無有孤,不知當幾人稱帝,幾人稱王。」最後一戰,沒有僥倖。',
      en: '“Were it not for me, how many would have called themselves emperor?” The last battle allows no luck.',
    },
    doctrine: 'hegemonic',
    hp: 52,
    deckTier: 0.45,
    power: power(
      'bp-weiwu',
      { zh: '魏武揮鞭', en: 'The Tyrant’s Lash' },
      { zh: '造成 3 點傷害。', en: 'Deal 3 damage.' },
      2,
      [{ op: 'damage', amount: 3, target: 'chosenAny' }],
    ),
    rewardMerit: 400,
    rewardPacks: 3,
  },

  // ============================================================
  // 第二章「逐鹿千年」—— 走出三国,沿着中华战史往下打。
  // 八位横跨战国→楚汉→西汉→唐→两宋→明的名将,一条编年的登顶之路:
  //   白起 · 項羽 · 韓信 · 霍去病 · 李世民 · 趙匡胤 · 岳飛 · 徐達。
  // 解锁仍是全局线性(通了曹操才进白起),但难度是**一段新曲线**:
  // 玩家此时已成军、有卡包,所以开章不必像张角那样友好(约 40%),再一路收紧到收官。
  // 血量与战利延续第一章继续攀升(试金石越往后越重)。
  // 选人只挑**有立绘**的:关底该是一张脸,不是一个首字兜底(见 high-visual-quality-bar)。
  // deckTier 由 sim-campaign 分章校验、tune-campaign 二分搜出;tier→强度非单调,只能实测。
  // ============================================================
  {
    id: 'boss-bai-qi',
    heroId: 'hist-bai-qi',
    name: { zh: '白起', en: 'Bai Qi' },
    title: { zh: '人屠', en: 'The Butcher of Men' },
    intro: {
      zh: '長平一夜,四十萬降卒盡坑。人屠所至,從不留俘,也從不留路。',
      en: 'In one night at Changping, four hundred thousand were buried. The Butcher takes no prisoners — and leaves no road back.',
    },
    doctrine: 'hegemonic',
    hp: 52, // 与曹操持平(单调不破);白起要当开章软目标,血量这条弱旋钮也一并往下压
    // 0.9 → 0.75:家族上线后卡池身材整体抬了一点(455 张同族在场多 1 血),
    // 关底 Boss 的牌是贪心 AI 从全池里选的,于是这一关从 35% 掉到 33%,
    // 掉出了「开章不劝退」那道闸门。tune-campaign 实测 0.75 档 ≈ 54%,
    // 正好落回这一格的设计目标(第二章开章 52%)—— 它本来就该是开章软目标,
    // 上面那条注释写着「≈40%」而实际一直只有 33%,这次一并归位。
    deckTier: 0.75,
    // 长平的「歼灭」本想给 3 点,但白起 = 霸道深池 + 每回合稳定点杀,实测哪怕最软卡组
    // 玩家胜率也压不过 33%,当不成开章的软目标;降到 2 点(与董卓同机制)+ 最软档 ≈ 40%。
    power: power(
      'bp-changping',
      { zh: '長平', en: 'Changping' },
      { zh: '對隨機一名敵方武將造成 2 點傷害。', en: 'Deal 2 damage to a random enemy general.' },
      2,
      [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
    ),
    rewardMerit: 450,
    rewardPacks: 2,
    chapter: 2,
  },
  {
    id: 'boss-xiang-yu',
    heroId: 'hist-xiang-yu',
    name: { zh: '項羽', en: 'Xiang Yu' },
    title: { zh: '力拔山兮', en: 'Might to Uproot Mountains' },
    intro: {
      zh: '力拔山兮氣蓋世。他從不守,只是一次次把你的陣線正面撞碎。',
      en: 'His strength could uproot mountains. He never defends — he simply shatters your line head-on, again and again.',
    },
    doctrine: 'hegemonic',
    hp: 56,
    deckTier: 0.0,
    power: power(
      'bp-pofu',
      { zh: '破釜沉舟', en: 'Burn the Boats' },
      { zh: '使一名友方武將+2/+2。', en: 'Give a friendly general +2/+2.' },
      2,
      [{ op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' }],
    ),
    rewardMerit: 520,
    rewardPacks: 2,
    chapter: 2,
  },
  {
    id: 'boss-han-xin',
    heroId: 'hist-han-xin',
    name: { zh: '韓信', en: 'Han Xin' },
    title: { zh: '背水一戰', en: 'Backs to the River' },
    intro: {
      zh: '韓信將兵,多多益善。你清掉一波,他點出的下一波已在路上。',
      en: 'Han Xin commands troops: the more the merrier. Clear one wave and the next he has already counted out is on its way.',
    },
    doctrine: 'hegemonic',
    hp: 58,
    deckTier: 0.45,
    power: power(
      'bp-duoduo',
      { zh: '多多益善', en: 'The More the Merrier' },
      { zh: '召喚一個 2/2 的鐵騎。', en: 'Summon a 2/2 Ironclad Cavalry.' },
      2,
      [{ op: 'summon', defId: 'token-tie-qi', count: 1 }],
    ),
    rewardMerit: 600,
    rewardPacks: 3,
    chapter: 2,
  },
  {
    id: 'boss-huo-qubing',
    heroId: 'hist-huo-qubing',
    name: { zh: '霍去病', en: 'Huo Qubing' },
    title: { zh: '封狼居胥', en: 'The Altar at Langjuxu' },
    intro: {
      zh: '匈奴未滅,何以家為。長驅二千里,他的刀鋒永遠越過你的前排,直取要害。',
      en: 'Two thousand li in a single drive — his blade always sweeps past your front rank to the throat behind it.',
    },
    doctrine: 'hegemonic',
    hp: 60,
    deckTier: 0.45,
    power: power(
      'bp-fenglang',
      { zh: '長驅直入', en: 'Deep Strike' },
      { zh: '對敵方主公造成 2 點傷害。', en: 'Deal 2 damage to the enemy hero.' },
      2,
      [{ op: 'damage', amount: 2, target: 'enemyHero' }],
    ),
    rewardMerit: 700,
    rewardPacks: 3,
    chapter: 2,
  },
  {
    id: 'boss-tang-taizong',
    heroId: 'hist-tang-taizong',
    name: { zh: '李世民', en: 'Emperor Taizong of Tang' },
    title: { zh: '天可汗', en: 'The Heavenly Khan' },
    intro: {
      zh: '玄甲鐵騎,所向無前。他讓你選:讓開中路,還是被鑿穿中路。',
      en: 'His black-armored horse smashes any line. He offers you a choice: yield the center, or be driven through it.',
    },
    doctrine: 'royal',
    hp: 62,
    deckTier: 0.45,
    // 王道深池已到最强档(tier 0.03)仍只把玩家压到 ~44%,当不成第 13 关的坡度,
    // 反成中段的凸点;把 +1/+1 提到 +2/+2(仍带冲锋)让它真能一波带走,回落到 ~34%。
    power: power(
      'bp-tiankehan',
      { zh: '天可汗', en: 'The Heavenly Khan' },
      { zh: '使一名友方武將+2/+2並獲得衝鋒。', en: 'Give a friendly general +2/+2 and Charge.' },
      2,
      [
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'charge', target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 820,
    rewardPacks: 3,
    chapter: 2,
  },
  {
    id: 'boss-zhao-kuangyin',
    heroId: 'hist-zhao-kuangyin',
    name: { zh: '趙匡胤', en: 'Emperor Taizu of Song' },
    title: { zh: '黃袍加身', en: 'The Yellow Robe' },
    intro: {
      zh: '陳橋一夜,黃袍加身。一條盤龍棍打下四百軍州 —— 他要的不是一場,是全盤。',
      en: 'One night at Chenqiao, the yellow robe was thrown over him. With a single cudgel he won four hundred prefectures — he wants not a battle but the whole board.',
    },
    doctrine: 'royal',
    hp: 64,
    deckTier: 0.45,
    power: power(
      'bp-huangpao',
      { zh: '黃袍加身', en: 'The Yellow Robe' },
      { zh: '使所有友方武將+1/+0。', en: 'Give all friendly generals +1/+0.' },
      2,
      [{ op: 'buffStats', attack: 1, health: 0, target: 'allFriendlyGenerals' }],
    ),
    rewardMerit: 960,
    rewardPacks: 4,
    chapter: 2,
  },
  {
    id: 'boss-yue-fei',
    heroId: 'hist-yue-fei',
    name: { zh: '岳飛', en: 'Yue Fei' },
    title: { zh: '精忠報國', en: 'Utmost Loyalty to the Realm' },
    intro: {
      zh: '撼山易,撼岳家軍難。凍死不拆屋,餓死不擄掠 —— 你打不散一支沒有弱點的軍隊。',
      en: 'Easier to move a mountain than the Yue army. Frozen, they tear down no home; starving, they loot nothing — you cannot break a host with no weakness.',
    },
    doctrine: 'royal',
    hp: 66,
    deckTier: 0.45,
    power: power(
      'bp-yuejiajun',
      { zh: '岳家軍', en: 'The Yue Family Army' },
      { zh: '使一名友方武將+0/+3並獲得守護。', en: 'Give a friendly general +0/+3 and Guard.' },
      2,
      [
        { op: 'buffStats', attack: 0, health: 3, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 1150,
    rewardPacks: 4,
    chapter: 2,
  },
  {
    id: 'boss-xu-da',
    heroId: 'hist-xu-da',
    name: { zh: '徐達', en: 'Xu Da' },
    title: { zh: '驅逐胡虜', en: 'Expel the Invaders' },
    intro: {
      zh: '驅逐胡虜,恢復中華。他從江南一路打到大都,十年不曾走錯一步。最後一戰,沒有僥倖。',
      en: 'Expel the invaders, restore the realm. From the south he marched to the Yuan capital without a single misstep. The last battle allows no luck.',
    },
    doctrine: 'royal',
    hp: 70,
    deckTier: 0.45,
    power: power(
      'bp-beifa',
      { zh: '北伐', en: 'The Northern Expedition' },
      { zh: '召喚一個 3/3 的禁軍。', en: 'Summon a 3/3 Imperial Guard.' },
      2,
      [{ op: 'summon', defId: 'token-jin-jun', count: 1 }],
    ),
    rewardMerit: 1500,
    rewardPacks: 5,
    chapter: 2,
  },

  // ============================================================
  // 第三章「山河永寂」—— 从淝水到台湾,守土者与逐鹿者。
  //
  // 前两章是「汉末群雄」与「逐鹿千年」,主角都是**开局的人**:曹操、白起、韩信。
  // 第三章刻意换一批人 —— 谢玄、虞允文、文天祥、于谦、郑成功,
  // 他们多数不是去取天下的,而是**守住一条线不让它断**。这一章的对手因此更硬:
  // 血更厚、主公技偏防守与消耗,逼玩家真的去解决问题而不是拼刀。
  //
  // 全部选**有立绘的签名卡**(见 high-visual-quality-bar):
  // 关底简报是一整屏全身立绘,占位图会直接砸掉这一屏。
  // 主义分布 royal×3 / separatist×2 / ritual×2 / hegemonic×1 ——
  // 名利与隐逸在这一段历史里找不到有立绘的合适人选,不硬凑。
  //
  // deckTier 由 `ONLY=... npm run tune-campaign` 网格扫描搜出来,
  // 再用 sim-campaign 验收(章内前后半差 ≥8、开章友好、收官有压力)。
  {
    id: 'boss-xie-xuan',
    heroId: 'hist-xie-xuan',
    name: { zh: '謝玄', en: 'Xie Xuan' },
    title: { zh: '北府之鋒', en: 'Blade of the Northern Garrison' },
    intro: {
      zh: '八千北府兵列于淝水之南。投鞭断流的百萬之眾就在对岸 —— 他等的是对方后退半步。',
      en: 'Eight thousand of the Northern Garrison stand south of the Fei. A million men wait across the water; he waits for half a step back.',
    },
    doctrine: 'royal',
    hp: 46,
    deckTier: 0.45,
    power: power(
      'bp-beifu',
      { zh: '北府兵', en: 'The Northern Garrison' },
      { zh: '使一名友方武將獲得+1/+1與守護。', en: 'Give a friendly general +1/+1 and Guard.' },
      2,
      [
        { op: 'buffStats', attack: 1, health: 1, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 500,
    rewardPacks: 2,
    chapter: 3,
  },
  {
    id: 'boss-an-lushan',
    heroId: 'hist-an-lushan',
    name: { zh: '安祿山', en: 'An Lushan' },
    title: { zh: '漁陽鼙鼓', en: 'Drums of Yuyang' },
    intro: {
      zh: '渔阳鼙鼓动地来,惊破霓裳羽衣曲。三镇节度使反了,而长安还在唱歌。',
      en: 'The drums of Yuyang shook the earth. Three commands rose in revolt while Chang’an was still singing.',
    },
    doctrine: 'separatist',
    hp: 48,
    deckTier: 0.6,
    power: power(
      'bp-yuyang',
      { zh: '漁陽鼙鼓', en: 'Drums of Yuyang' },
      { zh: '召喚兩個 2/2 的鐵騎。', en: 'Summon two 2/2 Ironclad Cavalry.' },
      2,
      [{ op: 'summon', defId: 'token-tie-qi', count: 2 }],
    ),
    rewardMerit: 580,
    rewardPacks: 2,
    chapter: 3,
  },
  {
    id: 'boss-di-qing',
    heroId: 'hist-di-qing',
    name: { zh: '狄青', en: 'Di Qing' },
    title: { zh: '面涅將軍', en: 'The Tattooed General' },
    intro: {
      zh: '脸上刺着字的行伍出身,一路做到枢密使。昆仑关那一夜他没打灯,天亮时关已经在手里。',
      en: 'A tattooed conscript who rose to command the empire’s armies. He took Kunlun Pass in the dark and held it by dawn.',
    },
    doctrine: 'hegemonic',
    hp: 50,
    deckTier: 0.45,
    power: power(
      'bp-kunlun',
      { zh: '昆侖夜襲', en: 'Night Attack at Kunlun' },
      { zh: '使一名友方武將獲得突襲並+2/+0。', en: 'Give a friendly general Rush and +2/+0.' },
      2,
      [
        { op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' },
        { op: 'buffStats', attack: 2, health: 0, target: 'chosenFriendlyGeneral' },
      ],
    ),
    rewardMerit: 670,
    rewardPacks: 2,
    chapter: 3,
  },
  {
    id: 'boss-yu-yunwen',
    heroId: 'hist-yu-yunwen',
    name: { zh: '虞允文', en: 'Yu Yunwen' },
    title: { zh: '采石一書生', en: 'The Scholar at Caishi' },
    intro: {
      zh: '他本是去劳军的文官。到了采石才发现主帅未至、军无斗志 —— 于是他自己站上了江岸。',
      en: 'He came only to deliver supplies. Finding no commander and no will to fight, the clerk took the riverbank himself.',
    },
    doctrine: 'ritual',
    hp: 52,
    deckTier: 0.45,
    power: power(
      'bp-caishi',
      { zh: '采石卻敵', en: 'Turning Them at Caishi' },
      { zh: '抽一張牌,並獲得 3 點護甲。', en: 'Draw a card and gain 3 Armor.' },
      2,
      [
        { op: 'draw', count: 1 },
        { op: 'gainArmor', amount: 3 },
      ],
    ),
    rewardMerit: 780,
    rewardPacks: 2,
    chapter: 3,
  },
  {
    id: 'boss-wen-tianxiang',
    heroId: 'hist-wen-tianxiang',
    name: { zh: '文天祥', en: 'Wen Tianxiang' },
    title: { zh: '零丁洋裡', en: 'On the Lonely Sea' },
    intro: {
      zh: '惶恐滩头说惶恐,零丁洋里叹零丁。宋已经没有了,他还在打。',
      en: 'Song had already fallen. He went on fighting anyway.',
    },
    doctrine: 'royal',
    hp: 54,
    deckTier: 0.45,
    power: power(
      'bp-danxin',
      { zh: '丹心照汗青', en: 'A Red Heart in the Histories' },
      { zh: '使全體友方武將獲得+0/+1,並獲得 2 點護甲。', en: 'Give all friendly generals +0/+1 and gain 2 Armor.' },
      2,
      [
        { op: 'buffStats', attack: 0, health: 1, target: 'allFriendlyGenerals' },
        { op: 'gainArmor', amount: 2 },
      ],
    ),
    rewardMerit: 900,
    rewardPacks: 2,
    chapter: 3,
  },
  {
    id: 'boss-chen-youliang',
    heroId: 'hist-chen-youliang',
    name: { zh: '陳友諒', en: 'Chen Youliang' },
    title: { zh: '鄱陽舟師', en: 'The Fleet at Poyang' },
    intro: {
      zh: '六十万众,楼船连锁数十里。中国史上最大的水战,他是兵多的那一边。',
      en: 'Six hundred thousand men and towered ships chained for tens of li. In the largest naval battle in Chinese history, he had the numbers.',
    },
    doctrine: 'separatist',
    hp: 56,
    deckTier: 0.45,
    power: power(
      'bp-loushi',
      { zh: '樓船連鎖', en: 'Ships Chained Abreast' },
      { zh: '召喚一個 3/3 的禁軍,並使其獲得守護。', en: 'Summon a 3/3 Imperial Guard with Guard.' },
      2,
      [
        { op: 'summon', defId: 'token-jin-jun', count: 1 },
        { op: 'grantKeyword', keyword: 'guard', target: 'randomFriendlyGeneral' },
      ],
    ),
    rewardMerit: 1050,
    rewardPacks: 3,
    chapter: 3,
  },
  {
    id: 'boss-yu-qian',
    heroId: 'hist-yu-qian',
    name: { zh: '于謙', en: 'Yu Qian' },
    title: { zh: '社稷為重', en: 'The Altars Come First' },
    intro: {
      zh: '皇帝被俘,群臣议南迁。他说言南迁者可斩 —— 然后关上城门,守了北京。',
      en: 'The emperor captured, the court urging flight south. "Whoever speaks of fleeing may be executed," he said — then shut the gates and held Beijing.',
    },
    doctrine: 'ritual',
    hp: 58,
    deckTier: 0.0,
    power: power(
      'bp-shouji',
      { zh: '九門禦敵', en: 'Nine Gates Held' },
      { zh: '召喚一個 1/3 的守軍(守護),並對敵方生命最低的武將造成 2 點傷害。', en: 'Summon a 1/3 Guard defender and deal 2 damage to the enemy general with the lowest health.' },
      2,
      // 【为什么从「0/4 守护 + 2 护甲」改成「1/3 守护 + 2 点伤害」】
      // 实测 tune-campaign 网格:于謙**每一档 deckTier 玩家胜率都在 81–100%**,
      // 也就是说卡组质量根本救不了他 —— 问题在主公技。
      // 0 攻的守军对贪心 AI 是**零威胁**:它只会一直垒墙,永远打不死人;
      // 而护甲在 AI 的评分里近乎为零(割据主公技上交过同样的学费)。
      // 换成「有攻击的身体 + 一点点点杀」之后,他终于会赢了 —— 主题没变,
      // 九门御敌仍然是守城,只是城头上现在有人放箭。
      [
        { op: 'summon', defId: 'token-danyang-bing', count: 1 },
        { op: 'damage', amount: 2, target: 'weakestEnemyGeneral' },
      ],
    ),
    rewardMerit: 1250,
    rewardPacks: 3,
    chapter: 3,
  },
  {
    id: 'boss-zheng-chenggong',
    heroId: 'hist-zheng-chenggong',
    name: { zh: '鄭成功', en: 'Koxinga' },
    title: { zh: '海上孤忠', en: 'The Last Loyalist at Sea' },
    intro: {
      zh: '大陆已经没有他的立足之地。他带着最后的船队渡海,把一座岛变成了最后一片明土。',
      en: 'No ground left on the mainland. He took the last fleet across the strait and made an island the last of Ming.',
    },
    doctrine: 'royal',
    hp: 62,
    deckTier: 0.45,
    power: power(
      'bp-kaitai',
      { zh: '開臺', en: 'Across the Strait' },
      { zh: '使一名友方武將獲得+2/+2,並抽一張牌。', en: 'Give a friendly general +2/+2 and draw a card.' },
      2,
      [
        { op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'draw', count: 1 },
      ],
    ),
    rewardMerit: 1700,
    rewardPacks: 4,
    chapter: 3,
  },
]

// Boss 卡组:从该主义 + 中立池里按曲线取满 30 张,**优先带关键词或效果的卡**。
// 确定性(按 collectorNo 排序后逐个取),所以同一个 Boss 每次都是同一套牌 ——
// 玩家可以针对性重组卡组再来,这正是关底战该有的体验。
//
// 不复用预组:预组是给玩家的平衡基线,Boss 应该打得比它更凶一点。
// tier:卡组质量分位,0 = 每档取最强的牌,1 = 取最弱的牌。这是**卡组强度**旋钮。
//
// 两版教训:
// 1. 第一版一律按最强选,Boss 卡组总身材 243(玩家预组约 215),
//    张角血量压到 23 玩家胜率还只有 37% —— 光靠血量根本救不回前几关。
// 2. 第二版用「跳过前 N 张」,但卡池太密,跳一位换来的下一张强度几乎一样,
//    八关总身材只在 222~244 之间摆动,等于没有旋钮。
// 现在按**分位**取:从每个费用档排序后的第 `tier` 分位开始拿,杠杆才真正打开。
export function bossDeck(doctrine: Doctrine, tier = 0): string[] {
  // 打分必须**以身材为主**、效果为辅。
  // 第一版只按「有没有效果」排序,结果是效果卡越多的主义选出来的卡组越软 ——
  // 因为关键词与效果本来就是从身材里扣点数买的(见 import-content.ts 的 payFor)。
  // 王道池最深、效果卡最多,反而产出总身材 167 的最软 Boss 卡组,
  // 第 4 关比第 1 关还好打。改成身材加权后五个主义拉平到 190 上下。
  const score = (c: CardDef) =>
    (c.attack ?? 0) +
    (c.health ?? 0) * 0.9 +
    (c.keywords.includes('guard') ? 1.5 : 0) +
    (c.keywords.length > 0 ? 1 : 0) +
    (c.battlecry || c.deathrattle ? 1 : 0) +
    (c.aura ? 1.5 : 0)
  const pool = COLLECTIBLE_CARDS.filter(
    (c) => c.doctrine === doctrine || c.doctrine === 'neutral',
  ).sort((a, b) => a.cost - b.cost || score(b) - score(a) || a.collectorNo - b.collectorNo)

  const deck: string[] = []
  const copies = new Map<string, number>()
  // 第三版:tier 主要移动的是**费用曲线**,而不再是同档内的分位。
  //
  // 卡池重做曲线之后,身材总点数变成了费用的函数(见 import-content.ts 的
  // statBudget:攻+血 ≈ 2×费+1)。于是「同一费用档里挑身材最好的」这个
  // 从前很管用的旋钮**直接失效**了 —— 同档卡的身材本来就一样。
  // 实测八个 Boss 的卡组曲线一模一样、总身材只在 222~245 之间抖动,
  // 难度曲线被 sim-campaign 判为「太平」(前四关均 53% vs 后四关均 51%)。
  //
  // 身材既然锁死在费用上,卡组强度就几乎只剩**曲线**说了算:
  // 压得低的卡组能抢节奏,顶得高的卡组前四回合无事可做、场面直接被打崩。
  // 所以现在在「低平曲线」和「顶重曲线」之间按 tier 插值;
  // 同档内的分位保留一点(权重减半),让效果密度也跟着变,不至于八套牌雷同。
  const FAST: [number, number, number][] = [
    [0, 2, 7],
    [3, 3, 7],
    [4, 4, 6],
    [5, 5, 5],
    [6, 7, 4],
    [8, 10, 1],
  ]
  const SLOW: [number, number, number][] = [
    [0, 2, 4],
    [3, 3, 4],
    [4, 4, 5],
    [5, 5, 5],
    [6, 7, 7],
    [8, 10, 5],
  ]
  const bands: [number, number, number][] = FAST.map(([lo, hi, fast], i) => [
    lo,
    hi,
    Math.round(fast + (SLOW[i][2] - fast) * tier),
  ])
  for (const [lo, hi, want] of bands) {
    const band = pool.filter((c) => c.cost >= lo && c.cost <= hi)
    // 从分位处起手,留出足够余量把这一档填满
    const start = Math.max(0, Math.min(band.length - want, Math.floor(band.length * tier * 0.5)))
    let taken = 0
    for (const c of band.slice(start)) {
      if (taken >= want || deck.length >= DECK_SIZE) break
      const n = copies.get(c.id) ?? 0
      const limit = c.rarity === 'legendary' ? 1 : 2
      if (n >= limit) continue
      copies.set(c.id, n + 1)
      deck.push(c.id)
      taken++
    }
  }
  // 曲线没填满(某些主义高费断档)时,用剩下的补齐
  for (const c of pool) {
    if (deck.length >= DECK_SIZE) break
    const n = copies.get(c.id) ?? 0
    const limit = c.rarity === 'legendary' ? 1 : 2
    if (n >= limit) continue
    copies.set(c.id, n + 1)
    deck.push(c.id)
  }
  return deck.slice(0, DECK_SIZE)
}

// Boss 的 heroId 必须真实存在于花名册,否则立绘与名字都会退化。
// 这条在 campaign.test.ts 里断言。
export function bossHeroExists(b: BossDef): boolean {
  return Boolean(CARDS_BY_ID[b.heroId])
}

// ============================================================
// 關底試煉 —— 同一个 Boss,换一个赢法。
//
// 引擎里的 `BattleObjective`(守成 / 斩将 / 护送)此前**只有名局重现在用**:
// 一层写好、测好、有 UI 指示器的能力,只服务了十四场固定战役。
// 试炼把它接到冒险上 —— 十六关每关多一个打法,内容翻倍,引擎零改动。
//
// **刻意做成「首通之后才解锁的第二种打法」,而不是改关底本身的胜负条件。**
// BOSSES 那条难度曲线是 tune-campaign 网格扫描出来的(见文件顶部),
// 给它换个胜负条件等于把十六个数字全作废,还得重搜一轮。试炼是**加法**:
// sim-campaign 不看它,曲线不受影响。
//
// 难度旋钮与关底不同:这里靠**目标形态**而不是 tier。
//   · 守成 —— 回合数。12 回合是「顶住三板斧」,16 回合是「熬过中期爆发」。
//   · 斩将 —— 目标带守护,你得先啃穿它。血越高越难。
//   · 护送 —— 0 攻高血,AI 懒得打它,但 AOE 会误伤。最松的一档。
// 目标单位靠 startTokens 摆上场,`targetDefId` 必须与摆上去的那张对得上,
// 对不上就是「目标永不触发」的静默失败(createGame 解析不到 iid)——
// campaign.test 有一条闸门专门钉这个。
export interface TrialDef {
  id: string
  name: LocalizedText
  text: LocalizedText
  objective: BattleObjective
  playerModifiers?: RunModifiers // 护送类:目标单位摆在**我方**场上
  bossModifiers?: RunModifiers // 斩将类:目标单位摆在**敌方**场上
  rewardMerit: number
}

const slay = (name: LocalizedText, tokenId: string) =>
  ({
    objective: {
      kind: 'assassinate' as const,
      targetSide: 1 as const,
      targetDefId: tokenId,
      targetName: name,
    },
    bossModifiers: { startTokens: [tokenId] },
  })

const escort = (name: LocalizedText, tokenId: string) =>
  ({
    objective: {
      kind: 'protect' as const,
      targetSide: 0 as const,
      targetDefId: tokenId,
      targetName: name,
    },
    playerModifiers: { startTokens: [tokenId] },
  })

export const TRIALS: Record<string, TrialDef> = {
  'boss-zhang-jiao': {
    id: 'trial-zhang-jiao',
    name: { zh: '蒼天已死', en: 'The Blue Heaven Is Dead' },
    text: {
      zh: '守成:黄巾漫野,不必斩其渠帅 —— 撑过 12 回合,乱民自散。',
      en: 'Endure: you need not kill their prophet. Survive 12 turns and the mob disperses.',
    },
    objective: { kind: 'survive', turns: 12 },
    rewardMerit: 150,
  },
  'boss-dong-zhuo': {
    id: 'trial-dong-zhuo',
    name: { zh: '溫酒斬華雄', en: 'The Wine Still Warm' },
    text: {
      zh: '斩将:酒且斟下,某去便来 —— 阵斩华雄即胜,不必理会董卓。',
      en: 'Slay: pour the wine and keep it warm. Cut down Hua Xiong and the trial is yours.',
    },
    ...slay({ zh: '華雄', en: 'Hua Xiong' }, 'token-hua-xiong'),
    rewardMerit: 180,
  },
  'boss-lu-bu': {
    id: 'trial-lu-bu',
    name: { zh: '三英戰呂布', en: 'Three Against Lü Bu' },
    text: {
      zh: '守成:人中吕布,马中赤兔 —— 谁也杀不了他,撑过 14 回合就算你赢。',
      en: 'Endure: no one kills Lü Bu. Survive 14 turns and call it a victory.',
    },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 200,
  },
  'boss-yuan-shao': {
    id: 'trial-yuan-shao',
    name: { zh: '火燒烏巢', en: 'The Granaries at Wuchao' },
    text: {
      zh: '斩将:袁绍的粮在乌巢,守粮的是淳于琼 —— 斩了他,河北自乱。',
      en: 'Slay: Yuan Shao’s grain lies at Wuchao. Cut down its keeper and his host unravels.',
    },
    ...slay({ zh: '淳于瓊', en: 'Chunyu Qiong' }, 'token-chunyu-qiong'),
    rewardMerit: 200,
  },
  'boss-sun-ce': {
    id: 'trial-sun-ce',
    name: { zh: '糧道不絕', en: 'Keep the Grain Road Open' },
    text: {
      zh: '护送:小霸王来得快,你的粮车走得慢 —— 车在,你就没输。',
      en: 'Escort: the Little Conqueror moves fast and your grain cart does not. Keep it alive.',
    },
    ...escort({ zh: '糧車', en: 'Grain Cart' }, 'token-liang-che'),
    rewardMerit: 220,
  },
  'boss-zhou-yu': {
    id: 'trial-zhou-yu',
    name: { zh: '東風未至', en: 'Before the East Wind' },
    text: {
      zh: '守成:火攻要等东风。撑过 14 回合,风自己会来。',
      en: 'Endure: fire needs the east wind. Survive 14 turns and it will come.',
    },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 220,
  },
  'boss-zhuge-liang': {
    id: 'trial-zhuge-liang',
    name: { zh: '木門道', en: 'The Wooden Gate Trail' },
    text: {
      zh: '斩将:退兵之路设伏,一员主将授首 —— 丞相自会退兵。',
      en: 'Slay: an ambush on the retreat road. Take their commander and the army withdraws.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 250,
  },
  'boss-cao-cao': {
    id: 'trial-cao-cao',
    name: { zh: '官渡對峙', en: 'The Standoff at Guandu' },
    text: {
      zh: '守成:兵少粮尽也要顶住。撑过 16 回合,变数自来。',
      en: 'Endure: fewer men, less grain, and you must still hold. Survive 16 turns.',
    },
    objective: { kind: 'survive', turns: 16 },
    rewardMerit: 280,
  },
  'boss-bai-qi': {
    id: 'trial-bai-qi',
    name: { zh: '長平糧道', en: 'The Road to Changping' },
    text: {
      zh: '护送:白起最擅长的从来不是决战,是断你的粮。车没了,四十万就没了。',
      en: 'Escort: Bai Qi never needed a decisive battle — only your supply line.',
    },
    ...escort({ zh: '糧車', en: 'Grain Cart' }, 'token-liang-che'),
    rewardMerit: 280,
  },
  'boss-xiang-yu': {
    id: 'trial-xiang-yu',
    name: { zh: '垓下合圍', en: 'The Ring at Gaixia' },
    text: {
      zh: '斩将:十面埋伏,先破其一。拿下当面的主将,合围才收得拢。',
      en: 'Slay: ten ambushes, one at a time. Break the commander before you the ring can close.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 300,
  },
  'boss-han-xin': {
    id: 'trial-han-xin',
    name: { zh: '背水一戰', en: 'Backs to the River' },
    text: {
      zh: '守成:置之死地而后生 —— 退无可退,撑过 14 回合。',
      en: 'Endure: no ground left to give. Survive 14 turns with the river at your back.',
    },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 300,
  },
  'boss-huo-qubing': {
    id: 'trial-huo-qubing',
    name: { zh: '封狼居胥', en: 'The Altar at Langjuxu' },
    text: {
      zh: '斩将:千里奔袭,只为阵前那一个人。',
      en: 'Slay: a thousand li of hard riding for one man in the enemy line.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 320,
  },
  'boss-tang-taizong': {
    id: 'trial-tang-taizong',
    name: { zh: '虎牢死守', en: 'Holding Hulao' },
    text: {
      zh: '守成:三千五百骑挡十万,你只要不倒。撑过 16 回合。',
      en: 'Endure: three thousand horse against a hundred thousand. Just do not fall. 16 turns.',
    },
    objective: { kind: 'survive', turns: 16 },
    rewardMerit: 340,
  },
  'boss-zhao-kuangyin': {
    id: 'trial-zhao-kuangyin',
    name: { zh: '護周室', en: 'Guard the Young Emperor' },
    text: {
      zh: '护送:陈桥驿黄袍加身那一夜,周室的幼主还在你手上。',
      en: 'Escort: on the night the yellow robe was raised at Chenqiao, the child emperor was still yours to protect.',
    },
    ...escort({ zh: '幼主', en: 'The Young Lord' }, 'token-you-zhu'),
    rewardMerit: 360,
  },
  'boss-yue-fei': {
    id: 'trial-yue-fei',
    name: { zh: '拐子馬', en: 'The Linked Cavalry' },
    text: {
      zh: '斩将:重甲连环,专砍马足 —— 先把领头那个拿下来。',
      en: 'Slay: armored horse chained three abreast. Take down the one who leads them.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 380,
  },
  // ---- 第三章 · 山河永寂 ----
  // 这一章多是守土者,试炼因此偏「守成」与「护送」——
  // 斩将那一类留给主动进攻的那几个(安禄山、狄青、陈友谅)。
  'boss-xie-xuan': {
    id: 'trial-xie-xuan',
    name: { zh: '八千北府', en: 'Eight Thousand of the Garrison' },
    text: {
      zh: '守成:以少击众,撑过 14 回合 —— 风声鹤唳的是对面。',
      en: 'Endure: outnumbered, hold for 14 turns. It is the other side that hears cranes in the wind.',
    },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 300,
  },
  'boss-an-lushan': {
    id: 'trial-an-lushan',
    name: { zh: '睢陽孤城', en: 'The Lone City of Suiyang' },
    text: {
      zh: '斩将:叛军阵中有一员主将,斩了他,鼙鼓就停了。',
      en: 'Slay: cut down the commander in the rebel line and the drums fall silent.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 320,
  },
  'boss-di-qing': {
    id: 'trial-di-qing',
    name: { zh: '昆侖關', en: 'Kunlun Pass' },
    text: {
      zh: '斩将:关前那员大将不倒,这一夜就过不去。',
      en: 'Slay: the pass does not open while their commander still stands.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 340,
  },
  'boss-yu-yunwen': {
    id: 'trial-yu-yunwen',
    name: { zh: '采石糧道', en: 'The Supply Line at Caishi' },
    text: {
      zh: '护送:一个文官守江，粮车比刀更要紧。',
      en: 'Escort: a clerk holding a river needs the grain more than the blade.',
    },
    ...escort({ zh: '糧車', en: 'Grain Cart' }, 'token-liang-che'),
    rewardMerit: 360,
  },
  'boss-wen-tianxiang': {
    id: 'trial-wen-tianxiang',
    name: { zh: '零丁洋', en: 'The Lonely Sea' },
    text: {
      zh: '守成:大势已去,撑过 16 回合 —— 你要的从来不是赢。',
      en: 'Endure: the tide has turned. Hold 16 turns. Winning was never the point.',
    },
    objective: { kind: 'survive', turns: 16 },
    rewardMerit: 380,
  },
  'boss-chen-youliang': {
    id: 'trial-chen-youliang',
    name: { zh: '火燒連環', en: 'Burn the Chains' },
    text: {
      zh: '斩将:楼船连锁,先斩了指挥连锁的那个人。',
      en: 'Slay: the ships are chained. Cut down the one who chained them.',
    },
    ...slay({ zh: '敵軍主將', en: 'Enemy Commander' }, 'token-di-zhu-jiang'),
    rewardMerit: 400,
  },
  'boss-yu-qian': {
    id: 'trial-yu-qian',
    name: { zh: '九門不開', en: 'Nine Gates Shut' },
    text: {
      zh: '守成:皇帝没了,城还在。撑过 16 回合。',
      en: 'Endure: the emperor is gone; the city is not. Hold 16 turns.',
    },
    objective: { kind: 'survive', turns: 16 },
    rewardMerit: 420,
  },
  'boss-zheng-chenggong': {
    id: 'trial-zheng-chenggong',
    name: { zh: '最後一船', en: 'The Last Ship' },
    text: {
      zh: '护送:最后的船队渡海,这一船不能丢。',
      en: 'Escort: the last fleet crosses the strait. This one ship cannot be lost.',
    },
    ...escort({ zh: '糧車', en: 'Grain Cart' }, 'token-liang-che'),
    rewardMerit: 500,
  },
  'boss-xu-da': {
    id: 'trial-xu-da',
    name: { zh: '大漠孤軍', en: 'Alone in the Desert' },
    text: {
      zh: '守成:孤军深入,粮尽援绝。撑过 16 回合,就能带人回去。',
      en: 'Endure: deep in the desert, out of grain and out of reach. Survive 16 turns and lead them home.',
    },
    objective: { kind: 'survive', turns: 16 },
    rewardMerit: 400,
  },
}

export function bossTrial(bossId: string): TrialDef | undefined {
  return TRIALS[bossId]
}

// ============================================================
// 傳承 —— 通关之后的第二轮、第三轮……
//
// 24 关打完之后,冒险模式就彻底没了 —— 而那恰恰是玩家卡池最全、
// 最想再打一遍的时候。傳承把它变成一个圈:再启新局,关卡重置,
// 但**双方都变强了**。
//
// 【为什么两边一起加,而不是只加 Boss】
// 只加 Boss 血量的话,第二轮就是同一场仗打得更久 —— 更久不等于更难,
// 只等于更烦。傳承同时给玩家一份开局资本(护甲 / 多抽 / 主公技减费),
// 于是第二轮的**节奏**是不一样的:你开局就有本钱,但对面也扛得住你那一波。
//
// 【为什么这两条曲线的形状不同】
// Boss 每轮 +18% 血,是连续的;玩家的傳承是**台阶**(第 1 轮护甲、第 2 轮多抽、
// 第 3 轮主公技减费)。连续对连续会变成纯数值追赶,谁都感觉不到变化;
// 台阶让每一轮开局时有一件**具体的新东西**,那才是「这一轮不一样」。
//
// 【为什么不影响 sim-campaign】
// cycle 恒为 0 时两条曲线都退化成恒等式 —— 首轮的难度曲线一个数都没动,
// 闸门测的还是原来那 24 关。
export const LEGACY_HP_PER_CYCLE = 0.18

export function bossHpFor(baseHp: number, cycle: number): number {
  if (cycle <= 0) return baseHp
  return Math.round(baseHp * (1 + LEGACY_HP_PER_CYCLE * cycle))
}

// 玩家这一轮带着的傳承。台阶式:每一轮多一件具体的东西。
export function legacyModifiers(cycle: number): RunModifiers | undefined {
  if (cycle <= 0) return undefined
  const mod: RunModifiers = {}
  // 护甲随轮次线性涨,但封顶 —— 12 点护甲已经相当于多半条命,再多就不是「资本」
  // 而是「免打」了。
  mod.startArmor = Math.min(12, 3 * cycle)
  if (cycle >= 2) mod.bonusHandSize = 1
  if (cycle >= 3) mod.heroPowerCostDelta = -1
  return mod
}

// 傳承轮次的名字。中文用「重」(第二重、第三重),英文用 New Game+ 那套约定。
export function legacyName(cycle: number): LocalizedText {
  if (cycle <= 0) return { zh: '初陣', en: 'First Battle' }
  const ZH = ['', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  return {
    zh: `第${ZH[cycle] ?? cycle}重`,
    en: `New Game +${cycle}`,
  }
}

// ============================================================
// Boss 性格 —— 同一套 AI,不同的「什么叫局面好」。
//
// 关底战此前只有三个旋钮:血更厚、主公技更强、卡组更好。三样都是**数值**,
// 于是十六个对手的打法完全一样:一律按贪心分数换场面。打到第八关时,
// 玩家面对的其实还是第一关那个对手,只是数字大了一圈。
//
// 性格改的是 AI 评分的权重(ai/greedy.ts 的 EvalWeights),不是规则:
// 引擎照旧对称,Boss 一张特权卡都没有,变的只是它眼里什么算赚。
//   · board 高 → 压场,宁可亏血也要清干净(曹操、白起)
//   · foeHp 高 / myHp 低 → 不换场面只顾打脸,自己掉血无所谓(吕布、项羽)
//   · myHp 高 → 苟,先把自己摘干净(赵匡胤、徐达)
//   · hand 高 → 惜牌,愿意为资源让一步场面(诸葛亮、韩信)
//
// **偏移刻意控制在 ±0.25 以内**:再大就不是性格而是难度了,
// 而难度曲线是 tune-campaign 网格扫出来的,不该被性格顺手改掉。
// 改完必须重跑 sim-campaign —— 权重会影响胜率,只是幅度小于 deckTier。
export const BOSS_PERSONALITIES: Record<string, Partial<EvalWeights>> = {
  // 第一章 · 汉末群雄
  'boss-zhang-jiao': { board: 1.2, foeHp: 0.45 }, // 蚁附而进 —— 只管铺满场面
  'boss-dong-zhuo': { foeHp: 0.8, myHp: 0.45 }, // 暴虐 —— 不在乎自己掉多少血
  'boss-lu-bu': { foeHp: 0.85, myHp: 0.4, board: 0.85 }, // 有勇无谋 —— 见脸就打
  'boss-yuan-shao': { board: 1.2, hand: 0.55 }, // 四世三公 —— 兵多粮足,靠资源碾
  'boss-sun-ce': { foeHp: 0.8, myHp: 0.5 }, // 小霸王 —— 抢攻
  'boss-zhou-yu': { board: 1.15, hand: 0.5 }, // 谈笑破敌 —— 先把场面理干净
  'boss-zhuge-liang': { hand: 0.6, board: 1.1, myHp: 0.7 }, // 谋定后动 —— 惜牌、稳
  'boss-cao-cao': { board: 1.15, hand: 0.55 }, // 挟天子 —— 场面与资源双吃

  // 第二章 · 逐鹿千年
  'boss-bai-qi': { board: 1.25, foeHp: 0.45 }, // 人屠 —— 只求歼灭,不急着推脸
  'boss-xiang-yu': { foeHp: 0.9, myHp: 0.4, board: 0.85 }, // 力拔山兮 —— 一路平推
  'boss-han-xin': { hand: 0.55, board: 1.1 }, // 兵仙 —— 精算,什么都要一点
  'boss-huo-qubing': { foeHp: 0.85, myHp: 0.5 }, // 长驱直入 —— 闪击
  'boss-tang-taizong': { board: 1.1, myHp: 0.65, hand: 0.5 }, // 天策上将 —— 全面
  'boss-zhao-kuangyin': { myHp: 0.85, board: 1.05 }, // 杯酒释兵权 —— 先立于不败
  'boss-yue-fei': { board: 1.15, myHp: 0.7 }, // 岳家军 —— 阵不乱
  'boss-xu-da': { myHp: 0.75, board: 1.1 }, // 持重 —— 稳扎稳打

  // 第三章 · 山河永寂 —— 这一章多是守土者,权重整体偏「先立于不败」
  'boss-xie-xuan': { board: 1.15, myHp: 0.7 }, // 北府之锋 —— 以少击众,阵不能乱
  'boss-an-lushan': { foeHp: 0.85, myHp: 0.45 }, // 渔阳鼙鼓 —— 叛军只管往前压
  'boss-di-qing': { foeHp: 0.8, board: 0.9 }, // 昆仑夜袭 —— 突袭见血
  'boss-yu-yunwen': { myHp: 0.85, hand: 0.55 }, // 采石书生 —— 守住并且续上
  'boss-wen-tianxiang': { myHp: 0.9, board: 1.05 }, // 丹心 —— 苟到最后一刻
  'boss-chen-youliang': { board: 1.25, foeHp: 0.5 }, // 楼船连锁 —— 靠体量碾
  'boss-yu-qian': { myHp: 0.9, board: 1.1 }, // 九门御敌 —— 纯守城
  'boss-zheng-chenggong': { board: 1.15, hand: 0.55 }, // 海上孤忠 —— 场面与资源双吃
}

export function bossPersonality(bossId: string): Partial<EvalWeights> | undefined {
  return BOSS_PERSONALITIES[bossId]
}

// ============================================================
// 關底戰場(地利)—— 有些仗的地形本身就是那一仗。
//
// 第十九卡包把「战场环境」做成了引擎的一层(GameState.field),
// 冒险因此可以给关卡配地形,而**不违反「不给 Boss 特权卡」的铁律**:
// 环境双方同吃,引擎照旧对称 —— 变的是这一局的天时地利,不是谁的规则。
//
// 【最后只留了一关。这是实测的结论,不是偷懒 —— 记下来免得下次再试一遍。】
//
// 第一版给五关配了地形(赤壁烈焰 / 江河天險 / 平原走馬 ×2 / 大雪封山),
// sim-campaign 量出来的失真远超预期:
//   孫策 32%→20%   周瑜 40%→58%   霍去病 43%→18%   徐達 15%→5%   岳飛 22%→28%
//
// 原因不是「环境不对称」——它对双方一字不差。原因是**双方卡组的构成本来就不对称**:
// Boss 的牌是 bossDeck 从全池按曲线切出来的(骑兵占池 25%),
// 而六套预组是跨很多轮 sim-balance 手搭的、骑兵极少。于是
// **兵种加成型战场系统性偏袒 Boss** —— 平原走馬 一片就把霍去病从 43% 压到 18%。
// 烈焰是另一个方向:它惩罚铺场,而 Boss 的高费大身材比玩家的小怪更耐烧,
// 结果反而是玩家占便宜(周瑜 +18 个点)。
//
// tune-campaign 重搜过一轮,但 tier→胜率本来就非单调,叠上地形之后曲线更乱
// (孫策 0.15 档 78%、0.30 档 14%),搜出来的建议不可信。
//
// 所以只留下失真落在噪声内(±6%)的那一关:岳飛的大雪封山 —— 它是**全体同吃**的
// 数值型环境,不挑兵种,双方卡组构成的差异吃不进去。
// 兵种加成型战场留给**玩家自己打出来**(第十九卡包那四张锦囊):
// 在对战里它是双方现算的赌局,不像关底那样固定偏向一边。
export const BOSS_FIELDS: Record<string, FieldRule> = {
  'boss-yue-fei': FIELD_SNOW, // 朱仙镇:天寒难进,却也难破
}

export function bossField(bossId: string): FieldState | undefined {
  const rule = BOSS_FIELDS[bossId]
  return rule ? { rule } : undefined
}
