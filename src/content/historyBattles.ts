import type { Doctrine, HeroPowerDef, LocalizedText, RunModifiers } from '../engine/types'
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
// 「守 N 回合 / 斩指定将」这类特殊目标(那些要动引擎,见 content-roadmap)。
// 难度沿用 campaign 三个旋钮里最强的那个:deckTier(卡组曲线)+ hp + 主公技,
// **外加**双方开局修正。所以它复用 bossDeck / GameConfig.modifiers / heroPowers,
// 一行引擎都不用碰。
//
// ⚠️ 这里的 hp / deckTier 是**手估的起点,未过 sim-campaign**。上线前应像 campaign
// 那样跑一遍平衡校验;原型阶段先验证「设定局」的手感对不对。
//
// 选人只挑**有立绘**的历史名将(heroId 必须在花名册里,否则关底是个首字兜底)。
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
  rewardMerit: number
  rewardPacks: number
}

export const HISTORY_BATTLES: HistoryBattle[] = [
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
      zh: '秦军合围:敌方开局带两名 1/3 守护的丹阳兵,主公披 4 甲。',
      en: 'Encircled: the enemy opens with two 1/3 Guard Danyang Levies and 4 Armor.',
    },
    heroId: 'hist-bai-qi',
    doctrine: 'hegemonic',
    hp: 46,
    deckTier: 0.6,
    power: power(
      'hbp-changping',
      { zh: '長平', en: 'Changping' },
      { zh: '對隨機一名敵方武將造成 2 點傷害。', en: 'Deal 2 damage to a random enemy general.' },
      [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
    ),
    enemyModifiers: { startTokens: ['token-danyang-bing', 'token-danyang-bing'], startArmor: 4 },
    rewardMerit: 200,
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
    deckTier: 0.75,
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
      zh: '铁索连舟 vs 借东风:敌方开局带三名 2/2 铁骑;你披 3 甲、多抽两张(火攻先机)。',
      en: 'Chained fleet vs. the east wind: the enemy opens with three 2/2 Ironclad Cavalry; you take 3 Armor and draw two extra cards.',
    },
    heroId: 'cao-cao',
    doctrine: 'hegemonic',
    hp: 44,
    deckTier: 0.55,
    power: power(
      'hbp-weiwu',
      { zh: '魏武揮鞭', en: 'The Tyrant’s Lash' },
      { zh: '造成 3 點傷害。', en: 'Deal 3 damage.' },
      [{ op: 'damage', amount: 3, target: 'chosenAny' }],
    ),
    enemyModifiers: { startTokens: ['token-tie-qi', 'token-tie-qi', 'token-tie-qi'] },
    playerModifiers: { startArmor: 3, bonusHandSize: 2 },
    rewardMerit: 320,
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
