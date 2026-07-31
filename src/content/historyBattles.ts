import type {
  BattleObjective,
  Doctrine,
  HeroPowerDef,
  LocalizedText,
  RunModifiers,
} from '../engine/types'
import { CARDS_BY_ID } from './cards'
import { bossDeck } from './campaign'

// 历史名战「名局重现」—— 单人内容的第三条腿(campaign 之外)。
//
// campaign 是一条**线性登顶**的难度阶梯:对手只有「血更厚 + 主公技更强 + 卡组更好」的
// 抽象差别,开局永远是干净的对称一盘。历史名战反过来:每一场是一个**具体的历史战役**,
// 靠**开局态势**(RunModifiers)把战场摆出来 —— 连环战船、秦军合围、十面埋伏 ——
// 这正是 campaign 做不到、而残局/修正系统天生能做的「设定局」。
//
// **软版本,零引擎。** 胜负仍是「谁的主公先掉到 0」(reducer 只认这一条),没有
// 「守 N 回合 / 斩指定将」这类特殊目标(那些要动引擎)。难度沿用 campaign 三个旋钮里
// 最强的那个:deckTier(卡组曲线)+ hp + 主公技,**外加**双方开局修正。所以它复用
// bossDeck / GameConfig.modifiers / heroPowers,一行引擎都不用碰。
//
// 十一场按编年铺开:笠泽(春秋)→ 长平·番吾(战国)→ 垓下(楚汉)→
// 官渡·白马·赤壁·长坂坡(三国)→ 睢阳(唐)→ 黄天荡(南宋)→ 鄱阳湖(元末)。
// 不做线性解锁,想打哪场打哪场。
//
// 三种胜负目标(objective,引擎在 checkGameEnd 判):
//   · 普通:斩敌方主公(不给 objective);
//   · 守成 survive:撑过 N 回合(睢阳);
//   · 斩将 assassinate:阵斩敌方指定单位(白马·斩顏良,目标带守护逼你啃穿);
//   · 护送 protect:我方指定单位不能死(长坂坡·护幼主,0 攻后排 VIP)。
// **注意:斩将/护送的贪心 AI 不懂目标**,sim-history 只能观察不能当准绳(见该脚本注释),
// 这俩的难度靠单位形态(守护/0攻)顺着 AI 的天性拱,外加人工试玩,别过度信 sim 数字。
//
// **难度是用 `npm run sim-history` 调实的**(六套预组轮流去打,带开局态势):
// 每场玩家胜率落在 35–68% 的「打得过但要认真打」带里(贪心 AI 基准尺,真人更松)。
// 调参教训(与 balance-tuning-is-ai-shaped 一致):
//   · deckTier 是强旋钮(0=最强/最快 … 1=最弱/最慢),tier 往 1 拨最能救「太难」;
//   · **敌方 startTokens 是隐藏的大杠杆** —— 开局三名 2/2 就能把胜率打到个位数;
//   · 每回合召 3/3 的主公技(鄱阳湖初版)= 强压制,降成召 2/2 才拉回带内;
//   · 护甲/守护墙对贪心 AI 近乎无压制:韩世忠的 0/4 水寨墙初版反而 78% 太送,
//     靠**压低 tier**(卡组更强)而不是加甲才压回来。
// 改任何一场的 hp/tier/modifiers/主公技,都要重跑 sim-history。
//
// 选人只挑**有随包立绘**的历史名将(否则关底是个首字兜底,见 high-visual-quality-bar)。
// 玩家用自己的卡组出战(和 campaign 一致),历史的一侧是 foe + 开局态势。

// 敌方主公技:直接沿用 campaign 里同一位名将已调过的那一招(同 ops),不新造强度档。
const power = (
  id: string,
  name: LocalizedText,
  text: LocalizedText,
  ops: HeroPowerDef['script']['ops'],
): HeroPowerDef => ({ id, name, text, cost: 2, script: { ops } })

export interface HistoryBattle {
  id: string
  name: LocalizedText // 战役名
  era: LocalizedText // 年代 / 纪年
  foeName: LocalizedText // 对手
  foeTitle: LocalizedText // 对手称号
  intro: LocalizedText // 开场旁白
  situation: LocalizedText // 一句话战场态势(把开局修正翻成人话)
  heroId: string // 敌方 heroId —— 立绘/名字自动跟随
  doctrine: Doctrine // 敌方卡组主义(bossDeck 取池用)
  hp: number // 敌方主公血量
  deckTier: number // 敌方卡组曲线分位(0=最快最强 … 1=最顶重最弱)
  power: HeroPowerDef // 敌方主公技
  playerModifiers?: RunModifiers // 我方开局态势(座位 0)
  enemyModifiers?: RunModifiers // 敌方开局态势(座位 1)
  objective?: BattleObjective // 特殊胜负目标(可选;不给=普通「主公归零」)
  rewardMerit: number
  rewardPacks: number
}

export const HISTORY_BATTLES: HistoryBattle[] = [
  // ---------- 春秋 · 前 478 ----------
  {
    id: 'hb-lize',
    name: { zh: '笠澤之戰', en: 'The Battle of Lize' },
    era: { zh: '春秋 · 周元王元年', en: 'Spring & Autumn · 478 BC' },
    foeName: { zh: '勾踐', en: 'Goujian' },
    foeTitle: { zh: '臥薪嘗膽', en: 'Sleeping on Brushwood' },
    intro: {
      zh: '会稽之耻,一尝二十年。今日笠泽夹水而阵,越甲三千 —— 该雪的,总要雪。',
      en: 'Twenty years he tasted gall for the shame of Kuaiji. Now the armies face off across the Lize — three thousand Yue blades, and a debt long overdue.',
    },
    situation: {
      zh: '会稽雪耻:敌方主公开局披 2 甲(卧薪之积);你披 3 甲、多抽一张。',
      en: 'The debt repaid: the enemy hero opens with 2 Armor; you take 3 Armor and draw a card.',
    },
    heroId: 'hist-goujian',
    doctrine: 'separatist',
    hp: 36,
    deckTier: 0.7,
    power: power(
      'hbp-woxin',
      { zh: '臥薪嘗膽', en: 'Sleeping on Brushwood' },
      { zh: '召喚一個 0/4 的江東水寨(守護)。', en: 'Summon a 0/4 Jiangdong Stockade with Guard.' },
      [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }],
    ),
    enemyModifiers: { startArmor: 2 },
    playerModifiers: { startArmor: 3, bonusHandSize: 1 },
    rewardMerit: 160,
    rewardPacks: 1,
  },
  // ---------- 战国 · 前 260 ----------
  {
    id: 'hb-changping',
    name: { zh: '長平之戰', en: 'The Battle of Changping' },
    era: { zh: '戰國 · 秦昭襄王四十七年', en: 'Warring States · 260 BC' },
    foeName: { zh: '白起', en: 'Bai Qi' },
    foeTitle: { zh: '人屠', en: 'The Butcher of Men' },
    intro: {
      zh: '秦军已绝赵军粮道,四十六日不得食。你退无可退 —— 唯一的活路是趁围合未死之前,凿穿它。',
      en: 'The Qin have cut your supply lines; forty-six days without food. There is no retreat — the only way out is to break the encirclement before it closes for good.',
    },
    situation: {
      zh: '秦军合围:敌方开局带一名 1/3 守护的丹阳兵、披 2 甲;你披 2 甲、多抽一张。',
      en: 'Encircled: the enemy opens with a 1/3 Guard Danyang Levy and 2 Armor; you take 2 Armor and draw a card.',
    },
    heroId: 'hist-bai-qi',
    doctrine: 'hegemonic',
    hp: 42,
    deckTier: 0.8,
    power: power(
      'hbp-changping',
      { zh: '長平', en: 'Changping' },
      { zh: '對隨機一名敵方武將造成 2 點傷害。', en: 'Deal 2 damage to a random enemy general.' },
      [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
    ),
    enemyModifiers: { startTokens: ['token-danyang-bing'], startArmor: 2 },
    playerModifiers: { startArmor: 2, bonusHandSize: 1 },
    rewardMerit: 200,
    rewardPacks: 1,
  },
  // ---------- 战国 · 前 232 ----------
  {
    id: 'hb-fanwu',
    name: { zh: '番吾之戰', en: 'The Battle of Fanwu' },
    era: { zh: '戰國 · 秦王政十五年', en: 'Warring States · 232 BC' },
    foeName: { zh: '李牧', en: 'Li Mu' },
    foeTitle: { zh: '趙之長城', en: 'The Wall of Zhao' },
    intro: {
      zh: '李牧在,秦师不敢东向。番吾一线,赵边骑坚阵以待 —— 你要碰的,是一堵会反击的墙。',
      en: 'While Li Mu lived, Qin dared not march east. At Fanwu the border cavalry stand in tight array — you face a wall that strikes back.',
    },
    situation: {
      zh: '赵边骑坚阵:敌方主公开局披 3 甲(坚壁);你多抽一张。',
      en: 'The border array: the enemy hero opens with 3 Armor; you draw an extra card.',
    },
    heroId: 'hist-li-mu',
    doctrine: 'hegemonic',
    hp: 42,
    deckTier: 0.82,
    power: power(
      'hbp-quexin',
      { zh: '堅陣卻秦', en: 'The Unbroken Line' },
      { zh: '使一名友方武將+0/+3並獲得守護。', en: 'Give a friendly general +0/+3 and Guard.' },
      [
        { op: 'buffStats', attack: 0, health: 3, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    enemyModifiers: { startArmor: 3 },
    playerModifiers: { bonusHandSize: 1 },
    rewardMerit: 220,
    rewardPacks: 1,
  },
  // ---------- 战国 · 前 259 ----------
  {
    id: 'hb-handan',
    name: { zh: '邯鄲之戰', en: 'The Siege of Handan' },
    era: { zh: '戰國 · 秦昭襄王四十八年', en: 'Warring States · 259 BC' },
    foeName: { zh: '廉頗', en: 'Lian Po' },
    foeTitle: { zh: '趙之堅壁', en: 'The Bulwark of Zhao' },
    intro: {
      zh: '长平之后,赵国只剩一座邯郸。廉颇筑垒深壁,坚守不出 —— 你要撞开的是一位老将三十年的耐心。',
      en: 'After Changping, Zhao has only Handan left. Lian Po digs in and refuses battle — what you must break is thirty years of an old general’s patience.',
    },
    situation: {
      zh: '深壁坚守:敌方主公开局披 6 甲,并有一座 0/4 守护壁垒;你多抽一张。',
      en: 'Dug in: the enemy hero opens with 6 Armor behind a 0/4 Guard rampart; you draw an extra card.',
    },
    heroId: 'hist-lian-po',
    doctrine: 'hegemonic',
    hp: 44,
    deckTier: 0.9,
    power: power(
      'hbp-jianbi',
      { zh: '堅壁清野', en: 'Fortify the Walls' },
      { zh: '使一名友方武將+0/+3並獲得守護。', en: 'Give a friendly general +0/+3 and Guard.' },
      [
        { op: 'buffStats', attack: 0, health: 3, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    enemyModifiers: { startArmor: 6, startTokens: ['token-shui-zhai'] },
    playerModifiers: { bonusHandSize: 1 },
    rewardMerit: 240,
    rewardPacks: 1,
  },
  // ---------- 楚汉 · 前 202 ----------
  {
    id: 'hb-gaixia',
    name: { zh: '垓下之戰', en: 'The Battle of Gaixia' },
    era: { zh: '楚漢 · 漢五年', en: 'Chu–Han · 202 BC' },
    foeName: { zh: '項羽', en: 'Xiang Yu' },
    foeTitle: { zh: '西楚霸王', en: 'Hegemon-King of Western Chu' },
    intro: {
      zh: '四面皆楚歌,霸王夜起帐中。你已将他围于垓下 —— 十面埋伏已成,只等他自乱。',
      en: 'Songs of Chu rise on every side; the Hegemon stirs in his tent. You have him ringed at Gaixia — the ambush is laid. Now let him break.',
    },
    situation: {
      zh: '十面埋伏:你开局带三名 1/1 乡勇,并多抽一张牌(四面楚歌乱其心)。',
      en: 'Tenfold ambush: you open with three 1/1 Village Levies and draw an extra card.',
    },
    heroId: 'hist-xiang-yu',
    doctrine: 'hegemonic',
    hp: 52,
    deckTier: 0.5,
    power: power(
      'hbp-pofu',
      { zh: '破釜沉舟', en: 'Burn the Boats' },
      { zh: '使一名友方武將+2/+2。', en: 'Give a friendly general +2/+2.' },
      [{ op: 'buffStats', attack: 2, health: 2, target: 'chosenFriendlyGeneral' }],
    ),
    playerModifiers: {
      startTokens: ['token-xiangyong', 'token-xiangyong', 'token-xiangyong'],
      bonusHandSize: 1,
    },
    rewardMerit: 260,
    rewardPacks: 1,
  },
  // ---------- 新莽 · 23 ----------
  {
    id: 'hb-kunyang',
    name: { zh: '昆陽之戰', en: 'The Battle of Kunyang' },
    era: { zh: '新莽 · 地皇四年', en: 'Xin Dynasty · AD 23' },
    foeName: { zh: '劉秀', en: 'Liu Xiu' },
    foeTitle: { zh: '位面之子', en: 'Favored of Heaven' },
    intro: {
      zh: '四十二万新军围昆阳,城中不过八千。刘秀引三千敢死自城外突阵 —— 而后天雷助阵,风雨如晦。',
      en: 'Four hundred thousand besiege Kunyang; eight thousand hold it. Liu Xiu charges from outside with three thousand — and then the storm itself takes his side.',
    },
    situation: {
      zh: '以少击众:敌方虽少却锐,开局带一名 3/3 敢死;你众而钝,开局 5 甲、多抽一张。',
      en: 'Few but fierce: the enemy opens with a 3/3; your host is many but slow — you take 5 Armor and an extra card.',
    },
    heroId: 'hist-liu-xiu',
    doctrine: 'royal',
    hp: 38,
    deckTier: 0.88,
    power: power(
      'hbp-tianlei',
      { zh: '天雷助陣', en: 'Heaven’s Own Thunder' },
      { zh: '造成 2 點傷害。', en: 'Deal 2 damage.' },
      [{ op: 'damage', amount: 2, target: 'chosenAny' }],
    ),
    enemyModifiers: { startTokens: ['token-jin-jun'] },
    playerModifiers: { startArmor: 5, bonusHandSize: 1 },
    rewardMerit: 260,
    rewardPacks: 1,
  },
  // ---------- 三国 · 200 ----------
  {
    id: 'hb-guandu',
    name: { zh: '官渡之戰', en: 'The Battle of Guandu' },
    era: { zh: '三國 · 建安五年', en: 'Three Kingdoms · AD 200' },
    foeName: { zh: '袁紹', en: 'Yuan Shao' },
    foeTitle: { zh: '四世三公', en: 'Four Generations of Excellency' },
    intro: {
      zh: '袁绍带甲十万,粮草如山,列于官渡之北。你兵少粮尽 —— 唯有夜袭乌巢,一把火烧掉他的底气。',
      en: 'Yuan Shao fields a hundred thousand and grain like mountains north of Guandu. You are few and near starving — the only stroke left is to burn Wuchao by night.',
    },
    situation: {
      zh: '众寡悬殊 vs 奇袭乌巢:敌方开局带两名 1/1 门客、披 3 甲;你起手手牌费用 -1(抢节奏)。',
      en: 'Outnumbered vs. the night raid: the enemy opens with two 1/1 Retainers and 3 Armor; your opening hand costs 1 less.',
    },
    heroId: 'yuan-shao',
    doctrine: 'royal',
    hp: 46,
    deckTier: 0.55,
    power: power(
      'hbp-menke',
      { zh: '門生故吏', en: 'Clients and Retainers' },
      { zh: '召喚兩個 1/1 的門客。', en: 'Summon two 1/1 Retainers.' },
      [{ op: 'summon', defId: 'token-si-shi', count: 2 }],
    ),
    enemyModifiers: { startTokens: ['token-si-shi', 'token-si-shi'], startArmor: 3 },
    playerModifiers: { handCostDelta: -1 },
    rewardMerit: 280,
    rewardPacks: 1,
  },
  // ---------- 三国 · 200(目标版:斩将)----------
  // **斩将**样板:不斩敌方主公,而是阵斩其先锋顏良。顏良带守护 —— 逼你(与 sim 里的
  // 贪心玩家)必须先啃穿它,斩将自然发生;敌方主公血厚难撼,断了「直接打脸」这条路。
  {
    id: 'hb-baima',
    name: { zh: '白馬之戰', en: 'The Battle of Baima' },
    era: { zh: '三國 · 建安五年', en: 'Three Kingdoms · AD 200' },
    foeName: { zh: '袁紹', en: 'Yuan Shao' },
    foeTitle: { zh: '河北之師', en: 'The Host of Hebei' },
    intro: {
      zh: '白马津头,颜良勒马阵前,河北军望之披靡。万军之中 —— 取其首级。',
      en: 'At the Baima ford, Yan Liang reins in before his host and Hebei quails at the sight. Amid ten thousand blades — take his head.',
    },
    situation: {
      zh: '斩将:阵斩敌方先锋顏良(3/7 守护)即胜。袁绍中军血厚难撼;你多抽一张。',
      en: 'Slay the champion: kill Yan Liang (3/7 Guard) to win. Yuan Shao’s host is too thick to race; you draw an extra card.',
    },
    heroId: 'yuan-shao',
    doctrine: 'hegemonic',
    hp: 60,
    deckTier: 0.5,
    power: power(
      'hbp-hebei',
      { zh: '河北壓境', en: 'The Hebei Advance' },
      { zh: '造成 2 點傷害。', en: 'Deal 2 damage.' },
      [{ op: 'damage', amount: 2, target: 'chosenAny' }],
    ),
    enemyModifiers: { startTokens: ['token-yan-liang', 'token-tie-qi'] },
    playerModifiers: { bonusHandSize: 1 },
    objective: {
      kind: 'assassinate',
      targetSide: 1,
      targetDefId: 'token-yan-liang',
      targetName: { zh: '顏良', en: 'Yan Liang' },
    },
    rewardMerit: 300,
    rewardPacks: 2,
  },
  // ---------- 三国 · 208 ----------
  {
    id: 'hb-chibi',
    name: { zh: '赤壁之戰', en: 'The Battle of Red Cliff' },
    era: { zh: '三國 · 建安十三年', en: 'Three Kingdoms · AD 208' },
    foeName: { zh: '曹操', en: 'Cao Cao' },
    foeTitle: { zh: '魏武', en: 'The Martial Ancestor' },
    intro: {
      zh: '北军铁索连舟,列于江北,旌旗蔽空。谈笑间,你只等东风 —— 万事俱备。',
      en: 'The northern fleet lies chained together across the river, banners blotting the sky. Amid talk and laughter you wait on one thing only — the east wind. All else is ready.',
    },
    situation: {
      zh: '铁索连舟 vs 借东风:敌方开局带一名 2/2 铁骑;你披 3 甲、多抽两张(火攻先机)。',
      en: 'Chained fleet vs. the east wind: the enemy opens with a 2/2 Ironclad Cavalry; you take 3 Armor and draw two extra cards.',
    },
    heroId: 'cao-cao',
    doctrine: 'hegemonic',
    hp: 40,
    deckTier: 0.72,
    power: power(
      'hbp-weiwu',
      { zh: '魏武揮鞭', en: 'The Tyrant’s Lash' },
      { zh: '造成 3 點傷害。', en: 'Deal 3 damage.' },
      [{ op: 'damage', amount: 3, target: 'chosenAny' }],
    ),
    enemyModifiers: { startTokens: ['token-tie-qi'] },
    playerModifiers: { startArmor: 3, bonusHandSize: 2 },
    rewardMerit: 320,
    rewardPacks: 2,
  },
  // ---------- 三国 · 208(目标版:护送)----------
  // **护送**样板:正常击败敌军取胜,但**幼主(0/5)不能死**。幼主 0 攻会留在后排(贪心
  // AI 不拿它送死),敌方追骑与「乱军中直取一人」的主公技可能够到它 —— 这就是护送的张力。
  {
    id: 'hb-changban',
    name: { zh: '長坂坡之戰', en: 'The Battle of Changban' },
    era: { zh: '三國 · 建安十三年', en: 'Three Kingdoms · AD 208' },
    foeName: { zh: '曹操', en: 'Cao Cao' },
    foeTitle: { zh: '虎豹追騎', en: 'The Tiger-Leopard Cavalry' },
    intro: {
      zh: '长坂坡前,曹军追骑漫野。赵云怀抱幼主,七进七出 —— 只要他还在,汉室就还在。',
      en: 'At Changban the pursuing cavalry blanket the field. Zhao Yun rides through them clutching the young lord — while the child lives, Han lives.',
    },
    situation: {
      zh: '护送:保住幼主(0/6)直到击败敌军。敌方追骑压上、每回合乱军中直取一人 —— 清掉威胁,别让他够到幼主。',
      en: 'Escort: keep the Young Lord (0/6) alive until you win. Pursuers press in and a rider strikes someone each turn — clear the threats before they reach him.',
    },
    heroId: 'cao-cao',
    doctrine: 'hegemonic',
    hp: 44,
    deckTier: 0.6,
    power: power(
      'hbp-zhuiqi',
      { zh: '虎豹突陣', en: 'The Cavalry Charge' },
      { zh: '對隨機一名敵方武將造成 2 點傷害。', en: 'Deal 2 damage to a random enemy general.' },
      [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
    ),
    enemyModifiers: { startTokens: ['token-tie-qi', 'token-tie-qi'] },
    playerModifiers: { startTokens: ['token-you-zhu'], startArmor: 2 },
    objective: {
      kind: 'protect',
      targetSide: 0,
      targetDefId: 'token-you-zhu',
      targetName: { zh: '幼主', en: 'The Young Lord' },
    },
    rewardMerit: 300,
    rewardPacks: 2,
  },
  // ---------- 唐 · 757(目标版:守成)----------
  // 这一场是**目标版胜负条件**的样板:不是斩杀敌方主公,而是「撑过约定回合数」。
  // 张巡以数千守睢阳孤城,敌方每回合直取城头 —— 你只需活到援军北上。
  // 敌方血厚(难以斩杀)+ 高压制,逼你真去守而不是拼刀。survive 回合数由 sim-history 调实。
  {
    id: 'hb-suiyang',
    name: { zh: '睢陽之戰', en: 'The Siege of Suiyang' },
    era: { zh: '唐 · 至德二載', en: 'Tang · AD 757' },
    foeName: { zh: '安祿山', en: 'An Lushan' },
    foeTitle: { zh: '燕帝', en: 'The Rebel Emperor' },
    intro: {
      zh: '睢阳弹尽粮绝,张巡犹守。城在人在 —— 只要撑到江淮援军北上,你就赢了。',
      en: 'Suiyang is out of arrows and grain, yet Zhang Xun holds. Hold the city until relief marches from the south, and you have won.',
    },
    situation: {
      zh: '守成:撑过 14 回合即胜。敌方每回合直取城头 2 点、血厚难斩;你据城墙(0/4 守护)、披 4 甲。',
      en: 'Endure: survive 14 turns to win. The enemy strikes the walls for 2 each turn and is hard to kill; you hold a 0/4 Guard rampart and 4 Armor.',
    },
    heroId: 'hist-an-lushan',
    doctrine: 'hegemonic',
    hp: 55,
    deckTier: 0.35,
    power: power(
      'hbp-yashan',
      { zh: '叛軍壓城', en: 'The Rebel Host' },
      { zh: '對敵方主公造成 2 點傷害。', en: 'Deal 2 damage to the enemy hero.' },
      [{ op: 'damage', amount: 2, target: 'enemyHero' }],
    ),
    enemyModifiers: { startTokens: ['token-tie-qi', 'token-tie-qi'] },
    playerModifiers: { startTokens: ['token-shui-zhai'], startArmor: 4 },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 340,
    rewardPacks: 2,
  },
  // ---------- 南宋 · 1130 ----------
  {
    id: 'hb-huangtiandang',
    name: { zh: '黃天蕩之戰', en: 'The Battle of Huangtiandang' },
    era: { zh: '南宋 · 建炎四年', en: 'Southern Song · AD 1130' },
    foeName: { zh: '韓世忠', en: 'Han Shizhong' },
    foeTitle: { zh: '中興名將', en: 'Savior of the Dynasty' },
    intro: {
      zh: '八千宋军,困你十万金骑于黄天荡四十八日。韩世忠据江死守 —— 你能凿穿这道水上长城吗?',
      en: 'Eight thousand Song troops pinned your hundred thousand horse for forty-eight days. Han Shizhong holds the river to the death — can you break this wall of water?',
    },
    situation: {
      zh: '据江死守:敌方开局带一座 0/4 守护水寨、披 4 甲 —— 一堵不还手却极难凿穿的墙。',
      en: 'Holding the river: the enemy opens with a 0/4 Guard Stockade and 4 Armor — a wall that never strikes but scarcely breaks.',
    },
    heroId: 'hist-han-shizhong',
    doctrine: 'royal',
    hp: 52,
    deckTier: 0.3,
    power: power(
      'hbp-jugu',
      { zh: '據江死守', en: 'Hold the River' },
      { zh: '使一名友方武將+0/+2並獲得守護。', en: 'Give a friendly general +0/+2 and Guard.' },
      [
        { op: 'buffStats', attack: 0, health: 2, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    enemyModifiers: { startTokens: ['token-shui-zhai'], startArmor: 4 },
    rewardMerit: 360,
    rewardPacks: 2,
  },
  // ---------- 元末 · 1363 ----------
  {
    id: 'hb-poyang',
    name: { zh: '鄱陽湖之戰', en: 'The Battle of Lake Poyang' },
    era: { zh: '元末 · 至正二十三年', en: 'Late Yuan · AD 1363' },
    foeName: { zh: '陳友諒', en: 'Chen Youliang' },
    foeTitle: { zh: '漢王', en: 'King of Han' },
    intro: {
      zh: '陈友谅巨舰连江,楼船高十丈,甲士六十万。你舟小而捷 —— 又是一场以火破舰的赌局。',
      en: 'Chen Youliang’s tower ships chain across the lake, ten zhang high, six hundred thousand aboard. Your boats are small and swift — another gamble to break a fleet by fire.',
    },
    situation: {
      zh: '巨舰连江 vs 小舟火攻:敌方主公开局披 2 甲、每回合召来一名甲士;你披 3 甲、多抽一张。',
      en: 'Tower ships vs. fireboats: the enemy opens with 2 Armor and summons a marine each turn; you take 3 Armor and draw an extra card.',
    },
    heroId: 'hist-chen-youliang',
    doctrine: 'separatist',
    hp: 44,
    deckTier: 0.9,
    power: power(
      'hbp-loushi',
      { zh: '樓船甲士', en: 'Tower-Ship Marines' },
      { zh: '召喚一個 2/2 的甲士。', en: 'Summon a 2/2 marine.' },
      [{ op: 'summon', defId: 'token-tie-qi', count: 1 }],
    ),
    enemyModifiers: { startArmor: 2 },
    playerModifiers: { startArmor: 3, bonusHandSize: 1 },
    rewardMerit: 420,
    rewardPacks: 2,
  },
  // ---------- 明 · 1561 ----------
  {
    id: 'hb-taizhou',
    name: { zh: '台州九捷', en: 'Nine Victories at Taizhou' },
    era: { zh: '明 · 嘉靖四十年', en: 'Ming · AD 1561' },
    foeName: { zh: '戚繼光', en: 'Qi Jiguang' },
    foeTitle: { zh: '鴛鴦陣', en: 'Mandarin Duck Formation' },
    intro: {
      zh: '倭寇纵横海上数十年,直到戚家军列出鸳鸯阵。长短相济,十二人如一人 —— 一月九战九捷。',
      en: 'The raiders ruled the coast for decades — until the Qi army formed the Mandarin Duck. Long and short arms as one body: nine battles, nine victories, in a single month.',
    },
    situation: {
      zh: '鸳鸯阵:敌方开局带两名 1/3 守护(长短相济、阵不可破);你多抽两张抢先手。',
      en: 'The formation: the enemy opens with two 1/3 Guards; you draw two extra cards to strike first.',
    },
    heroId: 'hist-qi-jiguang',
    doctrine: 'royal',
    hp: 40,
    deckTier: 0.75,
    power: power(
      'hbp-yuanyang',
      { zh: '鴛鴦陣', en: 'Mandarin Duck Formation' },
      { zh: '使一名友方武將+1/+1並獲得守護。', en: 'Give a friendly general +1/+1 and Guard.' },
      [
        { op: 'buffStats', attack: 1, health: 1, target: 'chosenFriendlyGeneral' },
        { op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' },
      ],
    ),
    enemyModifiers: { startTokens: ['token-danyang-bing', 'token-danyang-bing'] },
    playerModifiers: { bonusHandSize: 2 },
    rewardMerit: 460,
    rewardPacks: 2,
  },
]

export const BATTLES_BY_ID: Record<string, HistoryBattle> = Object.fromEntries(
  HISTORY_BATTLES.map((b) => [b.id, b]),
)

// 敌方卡组:复用 campaign 的 bossDeck(同一条曲线旋钮),确定性、可复现。
export function battleDeck(b: HistoryBattle): string[] {
  return bossDeck(b.doctrine, b.deckTier)
}

// 座位修正:座位 0 = 玩家,座位 1 = 敌方历史名将。
export function battleModifiers(
  b: HistoryBattle,
): [RunModifiers | undefined, RunModifiers | undefined] {
  return [b.playerModifiers, b.enemyModifiers]
}

// heroId 必须真实存在于花名册,否则立绘与名字都会退化(historyBattles.test 断言)。
export function battleHeroExists(b: HistoryBattle): boolean {
  return Boolean(CARDS_BY_ID[b.heroId])
}

// ============================================================
// 逆位挑戰 —— 用歷史上輸的那一方打贏。
//
// 【这个模式的问题在于「对手是谁」】
// 名局的数据结构里,敌方是完整定义的(heroId / 主公技 / 血量 / 卡组分位),
// 而**玩家那一侧只有「你自己的卡组」** —— 没有历史胜方的任何数据。
// 所以逆位不是把两边的字段对调就能得到的:它需要一个新的对手。
//
// 【解法:历史上的胜方多半就是冒险的关底 Boss】
// 曹操、韩信、白起、周瑜、朱元璋 —— 这五个人本来就在 BOSSES 里,
// 有血量、有主公技、有调好的卡组分位。逆位因此只要**引用那个 boss id**,
// 一个新对手都不用编。没有对应 Boss 的九场就不做逆位 ——
// 硬编一个「历史胜方」出来,既没有立绘也没有调过的数值,不如不做。
//
// 【玩家拿什么】
// 拿**原本那个敌方**的主公技与开局态势 —— 你现在就是袁绍、就是项羽。
// 卡组仍然是你自己的(这是名局一贯的口径:历史给你处境,牌你自己带)。
export interface ReverseBattle {
  battleId: string // 对应的正位名局
  bossId: string // 对手 = 冒险里的这个关底(历史胜方)
  name: LocalizedText
  intro: LocalizedText
  rewardMerit: number
}

export const REVERSE_BATTLES: ReverseBattle[] = [
  {
    battleId: 'hb-guandu',
    bossId: 'boss-cao-cao',
    name: { zh: '官渡 · 逆位', en: 'Guandu, Reversed' },
    intro: {
      zh: '这一次你是袁绍。带甲十万、粮草如山,而乌巢的火还没烧起来 —— 守住它。',
      en: 'This time you are Yuan Shao: a hundred thousand men, grain like mountains, and Wuchao not yet burning. Keep it that way.',
    },
    rewardMerit: 320,
  },
  {
    battleId: 'hb-gaixia',
    bossId: 'boss-han-xin',
    name: { zh: '垓下 · 逆位', en: 'Gaixia, Reversed' },
    intro: {
      zh: '这一次你是项羽。四面楚歌,乌骓不逝 —— 但天不一定要亡你。',
      en: 'This time you are Xiang Yu: songs of Chu on every side. Heaven need not end you tonight.',
    },
    rewardMerit: 360,
  },
  {
    battleId: 'hb-changping',
    bossId: 'boss-bai-qi',
    name: { zh: '長平 · 逆位', en: 'Changping, Reversed' },
    intro: {
      zh: '这一次你是赵军。四十万人的性命压在你这一战上 —— 白起在对面。',
      en: 'This time you command Zhao. Four hundred thousand lives ride on this — and Bai Qi stands opposite.',
    },
    rewardMerit: 380,
  },
  {
    battleId: 'hb-chibi',
    bossId: 'boss-zhou-yu',
    name: { zh: '赤壁 · 逆位', en: 'Red Cliffs, Reversed' },
    intro: {
      zh: '这一次你是曹操。八十万众列于江北,只要不让那把火起来。',
      en: 'This time you are Cao Cao, eight hundred thousand along the north bank. Just do not let the fire start.',
    },
    rewardMerit: 340,
  },
  // ---- 第二批(2026-07)----
  // 逆位的前置条件是「对面那个人得先在 BOSSES 里」(不然没有立绘也没有调过的数值)。
  // 写下那句话时 BOSSES 只有 16 关,而它已经扩到 24 —— 下面四场是**扩章的直接红利**,
  // 一行新数值都不用调:借的就是那一关已经调好的 Boss。
  {
    battleId: 'hb-baima',
    bossId: 'boss-yuan-shao',
    name: { zh: '白馬 · 逆位', en: 'Baima, Reversed' },
    intro: {
      zh: '这一次你是袁绍。颜良在阵前,而关羽正从万军之中直取过来 —— 这一回,别让他得手。',
      en: 'This time you are Yuan Shao. Yan Liang holds the van, and Guan Yu is already riding through your ranks. Not this time.',
    },
    rewardMerit: 300,
  },
  {
    battleId: 'hb-changban',
    bossId: 'boss-cao-cao',
    name: { zh: '長坂 · 逆位', en: 'Changban, Reversed' },
    intro: {
      zh: '这一次你是曹操。虎豹骑一日一夜三百里,当阳桥就在前头 —— 一个抱着孩子的人挡在那儿。',
      en: 'This time you are Cao Cao. Your Tiger Cavalry has ridden three hundred li in a day and a night. One man stands on the bridge, holding a child.',
    },
    rewardMerit: 340,
  },
  {
    battleId: 'hb-suiyang',
    bossId: 'boss-an-lushan',
    name: { zh: '睢陽 · 逆位', en: 'Suiyang, Reversed' },
    intro: {
      zh: '这一次你是叛军。睢阳孤城已经守了十个月,城里再没有一粒米 —— 而张巡还站在城头。',
      en: 'This time you command the rebels. Suiyang has held ten months and has no grain left — and Zhang Xun is still on the wall.',
    },
    rewardMerit: 360,
  },
  {
    battleId: 'hb-poyang',
    bossId: 'boss-chen-youliang',
    name: { zh: '鄱陽 · 逆位', en: 'Poyang, Reversed' },
    intro: {
      zh: '这一次你是陈友谅。六十万水师、楼船连江十余里 —— 而对面只有小舟与东风。',
      en: 'This time you are Chen Youliang: six hundred thousand men and a wall of tower ships. Facing you: small boats, and the east wind.',
    },
    rewardMerit: 380,
  },
]

export const REVERSE_BY_BATTLE: Record<string, ReverseBattle> = Object.fromEntries(
  REVERSE_BATTLES.map((r) => [r.battleId, r]),
)

// ============================================================
// 史實分歧點 —— 「如果那一件事沒有發生」。
//
// 【它和逆位不是一回事】
// 逆位换的是**你站在哪一边**:这一次你是袁绍、你是项羽。
// 分歧点不换边 —— 你还是原来那一方,变的是**战场的条件**:
// 东风没来、许攸没叛、廉颇没被换掉。
//
// 每一个分歧点都钉在一件**史书上真有记载的偶然**上,而不是随便编一个「如果」。
// 那些偶然恰恰是这些战役至今还被人反复讲的原因:赤壁赢在一阵风,
// 官渡赢在一个人半夜跑过来。把风拿掉、把那个人留下,仗立刻是另一场。
//
// 【为什么它是「疯的」那一档里最有价值的一个】
// 这套卡池的全部卖点是「这是真历史」。分歧点是唯一一个**利用了这一点**的玩法 ——
// 它只有在玩家知道原本发生了什么的时候才成立,而这个游戏的玩家恰好知道。
//
// 【实现上零新机制】
// 复用 HistoryBattle 的全部字段:改 modifiers、改 objective、改 hp/tier。
// 引擎一行不动,只是把同一场仗的条件换一套。
export interface Divergence {
  battleId: string
  name: LocalizedText
  // 「如果」本身 —— 史料口吻,说清被拿掉/被保留的是哪一件事
  premise: LocalizedText
  // 这一版战场变成什么样(把下面的修正翻成人话)
  situation: LocalizedText
  hp?: number
  deckTier?: number
  playerModifiers?: RunModifiers
  enemyModifiers?: RunModifiers
  objective?: BattleObjective
  rewardMerit: number
}

export const DIVERGENCES: Divergence[] = [
  {
    battleId: 'hb-chibi',
    name: { zh: '赤壁 · 若無東風', en: 'Red Cliff — Without the East Wind' },
    premise: {
      zh: '建安十三年冬,江上刮的是西北风。黄盖的火船顺流而下,烧的是自己人 —— 史书里那阵反常的东南风,这一次没有来。',
      en: 'Winter of 208: the wind on the river blows from the northwest, as winter winds do. Huang Gai’s fire ships would burn their own. The freak southeasterly of the histories never came.',
    },
    situation: {
      zh: '火攻不成:你没有开局态势,而曹军的连环船完好 —— 敌方开局 6 甲、多抽两张。',
      en: 'No fire: you open with nothing, while the chained fleet stands intact — the enemy takes 6 Armor and two extra cards.',
    },
    hp: 46,
    playerModifiers: {},
    enemyModifiers: { startArmor: 6, bonusHandSize: 2 },
    rewardMerit: 420,
  },
  {
    battleId: 'hb-guandu',
    name: { zh: '官渡 · 若許攸不叛', en: 'Guandu — If Xu You Had Not Defected' },
    premise: {
      zh: '许攸的家人在邺城下狱,他连夜奔向曹营,带去了乌巢屯粮的位置。这一次他忍了下来 —— 乌巢的粮,一石都没少。',
      en: 'Xu You’s family was jailed in Ye; that night he rode to Cao Cao’s camp with the location of the Wuchao granary. This time he swallowed it. Not one picul of that grain was lost.',
    },
    situation: {
      zh: '粮道未断:敌方开局 8 点粮道、4 甲 —— 你只能硬啃。',
      en: 'The supply line holds: the enemy opens with 8 Supply and 4 Armor — you will have to grind through.',
    },
    hp: 52,
    deckTier: 0.25,
    enemyModifiers: { startSupply: 8, startArmor: 4 },
    rewardMerit: 400,
  },
  {
    battleId: 'hb-changping',
    name: { zh: '長平 · 若廉頗不去', en: 'Changping — If Lian Po Had Stayed' },
    premise: {
      zh: '赵孝成王中了反间计,用赵括换下了坚壁三年的廉颇。这一次那道诏书没有发出 —— 壁垒还在,老将也还在。',
      en: 'King Xiaocheng of Zhao fell for the plant and replaced Lian Po — three years behind his walls — with Zhao Kuo. This time the edict was never sent. The walls stand, and so does the old general.',
    },
    situation: {
      zh: '坚壁不出:你只要撑过 14 个回合就算赢 —— 廉颇要的从来不是胜,是不败。',
      en: 'Hold the walls: survive 14 turns and the day is yours. Lian Po never wanted to win — only not to lose.',
    },
    playerModifiers: { startArmor: 8 },
    objective: { kind: 'survive', turns: 14 },
    rewardMerit: 380,
  },
  {
    battleId: 'hb-gaixia',
    name: { zh: '垓下 · 若渡烏江', en: 'Gaixia — If He Had Crossed the Wu' },
    premise: {
      zh: '乌江亭长舣船而待,曰:江东虽小,亦足王也。项羽笑而不渡 —— 这一次,他上了那条船。',
      en: 'The ferryman waited with his boat: "Jiangdong is small, but it is enough to be king of." Xiang Yu laughed and did not cross. This time, he stepped aboard.',
    },
    situation: {
      zh: '江东再起:你开局多抽两张、手牌全部 -1 费,但敌方也已成军 —— 血厚、卡组更强。',
      en: 'Jiangdong rises again: two extra cards and every opening card 1 cheaper — but the enemy is a finished army now, with more health and a sharper deck.',
    },
    hp: 58,
    deckTier: 0.15,
    playerModifiers: { bonusHandSize: 2, handCostDelta: -1 },
    rewardMerit: 440,
  },
  {
    battleId: 'hb-suiyang',
    name: { zh: '睢陽 · 若援軍至', en: 'Suiyang — If the Relief Column Had Come' },
    premise: {
      zh: '张巡守睢阳十月,食尽而无援。临淮的贺兰进明拥兵不救;城破之日,守军只剩四百人。这一次,援军来了。',
      en: 'Zhang Xun held Suiyang for ten months until the food ran out and no one came. He Lanjinming sat at Linhuai with his army and did not move. On the day the walls fell, four hundred defenders remained. This time, the relief column arrived.',
    },
    situation: {
      zh: '不再是守城:你开局 5 甲、带两队援军,目标从「撑住」变成「打赢」。',
      en: 'No longer a siege: you open with 5 Armor and two relief units, and the objective changes from holding out to winning outright.',
    },
    hp: 44,
    playerModifiers: { startArmor: 5, startTokens: ['token-shui-zhai', 'token-shui-zhai'] },
    // objective 明确给成 undefined 读起来不明显,所以这里靠「不给」表示回到普通判定 ——
    // 而正位的睢阳是 survive。分歧点覆盖字段时**必须逐字段覆盖**,见 historyStore 的合并。
    rewardMerit: 400,
  },
]

export const DIVERGENCE_BY_BATTLE: Record<string, Divergence> = Object.fromEntries(
  DIVERGENCES.map((d) => [d.battleId, d]),
)
