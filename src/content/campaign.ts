import type { CardDef, Doctrine, HeroPowerDef, LocalizedText } from '../engine/types'
import { DECK_SIZE } from '../engine/types'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from './cards'

// 冒险模式「群雄逐鹿」。
//
// 此前单人内容只有「随便打一局 AI」和一场脚本化教程 —— 没有任何有终点的挑战。
// 八场关底战,每一场是一个**规则不对称**的对手:更高的血量、一个比玩家更强的主公技、
// 一套主题卡组。玩家用自己的卡组去打,所以它同时是构筑的试金石。
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
// AI 档位固定用最强的「名将」—— 关底战本来就该是能力检定,不该靠对手失误过关。
//
// 当前实测曲线(六套预组轮流上,60 局/关):63 / 52 / 50 / 42 / 50 / 45 / 30 / 18 %。
// 真人玩家强于贪心 AI,所以这组数字是**下限**,实际体感会更松一些。

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
    deckTier: 0.58,
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
    deckTier: 0.68,
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
    deckTier: 0.83,
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
    deckTier: 0.23,
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
    deckTier: 0.06,
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
    deckTier: 0.45,
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
    deckTier: 0.07,
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
    deckTier: 0.79,
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
