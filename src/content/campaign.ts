import type { CardDef, Doctrine, HeroPowerDef, LocalizedText } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'

// 冒险模式「群雄逐鹿」。
//
// 此前单人内容只有「随便打一局 AI」和一场脚本化教程 —— 没有任何有终点的挑战。
// 现在是**两章共十六场**关底战,每一场是一个**规则不对称**的对手:更高的血量、
// 一个比玩家更强的主公技、一套主题卡组。玩家用自己的卡组去打,所以它同时是构筑的试金石。
//
// 第一章「汉末群雄」张角→曹操,第二章「逐鹿千年」白起→徐达沿中华战史一路往下打。
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
// 曲线是拿 sim-campaign 的基准尺(AI_NORMAL,双方同档)调出来的:
//   60 / 50 / 50 / 42 / 48 / 40 / 30 / 17 %
// 真人玩家强于贪心 AI,所以这组数字是**下限**,实际体感会更松一些。
// (第六卡包把大量势力/流派卡灌进了 Boss 抽取的池子,曲线被扰动过,已用
//  tune-campaign 重搜 + 手工平掉孫策的凸点重调。孫策的 tier→强度关系是反的
//  —— 卡池重做费用曲线后每个 Boss 各不相同,只能实测,不能靠 tier 大小推。)
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
    deckTier: 0.62,
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
    deckTier: 0.84,
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
    deckTier: 0.82,
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
    deckTier: 0.28,
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
    deckTier: 0.50,
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
    deckTier: 0.23,
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
    deckTier: 0.23,
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
    deckTier: 0.68,
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
    deckTier: 0.9, // 最软档:霸道深池太硬,开章需要它给到最弱
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
    deckTier: 0.79,
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
    title: { zh: '背水一戰', en: 'Battle with the River at His Back' },
    intro: {
      zh: '韓信將兵,多多益善。你清掉一波,他點出的下一波已在路上。',
      en: 'Han Xin commands troops: the more the merrier. Clear one wave and the next he has already counted out is on its way.',
    },
    doctrine: 'hegemonic',
    hp: 58,
    deckTier: 0.79,
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
    title: { zh: '封狼居胥', en: 'The Altar at Wolf Mountain' },
    intro: {
      zh: '匈奴未滅,何以家為。長驅二千里,他的刀鋒永遠越過你的前排,直取要害。',
      en: 'Two thousand li in a single drive — his blade always sweeps past your front rank to the throat behind it.',
    },
    doctrine: 'hegemonic',
    hp: 60,
    deckTier: 0.7,
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
    deckTier: 0.03,
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
    deckTier: 0.03,
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
    deckTier: 0.03,
    power: power(
      'bp-yuejiajun',
      { zh: '岳家軍', en: 'The Yue Army' },
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
    deckTier: 0.03,
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
