import type { LocalizedText, RunModifiers } from '../engine/types'

// 觀星臺 —— 今夜的天象。
//
// 【它想解决什么】
// 这个游戏已经有一堆「每日」了(每日一将、每日军令、每日三题、连日到营),
// 但它们全是**任务**:去做一件事,领一份奖励。做完之后今天就没别的了。
//
// 观星不是任务,是**今天的底色**:一进游戏就告诉你今夜是什么天象,
// 以及它对你今天的每一局意味着什么。不用点、不用领、没法刷 ——
// 它只是在那儿,像天气一样。
//
// 【为什么它配得上这个卡池】
// 天象在中国战争史里从来不是装饰:荧惑守心要改元,彗星见于东方要罢兵,
// 观星台上那个人说的话能决定明天出不出兵。这套卡池讲的就是那段历史,
// 而在此之前它一个字都没提到过天。
//
// 【为什么修正必须很小】
// 玩家不能选今天是什么天象,所以任何**大**的修正都会变成「今天不适合玩」。
// 每一条都压在「开局多两点护甲」这个量级 —— 它够让人注意到,
// 但绝不会让人为了躲开它而不打。
// 而且**双方同吃**(和战场环境同一个原则):天象是天的事,不是谁的技能。
//
// 【为什么是确定性的】
// 由日期哈希推出,不掷骰 —— 这样「今天是什么星」对所有人是同一个答案,
// 玩家之间能对得上话。和每日谜题、每日一将同一条路子。

export interface Omen {
  id: string
  name: LocalizedText
  // 星象本身的一句话 —— 史书口吻,不解释规则
  sign: LocalizedText
  // 它今天做什么 —— 规则口吻,说人话
  effect: LocalizedText
  // 双方同吃的开局修正。刻意复用远征宝物那套结构化字段:
  // 纯、可测、可复现,而且平衡好推。
  modifiers: RunModifiers
}

export const OMENS: Omen[] = [
  {
    id: 'omen-yinghuo',
    name: { zh: '熒惑守心', en: 'Mars Lingers in the Heart' },
    sign: {
      zh: '熒惑逆行,留於心宿。太史令夜叩宮門,言:主大凶,宜罷兵。',
      en: 'Mars turns retrograde and rests in the Heart. The court astronomer knocks at the palace gate by night: a great ill omen — put down your arms.',
    },
    effect: {
      zh: '今日對局:雙方開局各得 3 點護甲 —— 人人都在等,誰也不敢先動手。',
      en: "Today both sides start with 3 Armor — everyone waits, and no one wants to strike first.",
    },
    modifiers: { startArmor: 3 },
  },
  {
    id: 'omen-changxing',
    name: { zh: '長星竟天', en: 'A Long Star Crosses the Sky' },
    sign: {
      zh: '有長星出於西方,竟天,月餘乃滅。是歲,名將星落。',
      en: 'A long star rose in the west and spanned the whole sky; it faded only after a month. That year, a great general fell.',
    },
    effect: {
      zh: '今日對局:雙方起手各多抽一張 —— 大事将至,人人都在备牌。',
      en: 'Today both sides draw one extra opening card — something is coming, and everyone is preparing.',
    },
    modifiers: { bonusHandSize: 1 },
  },
  {
    id: 'omen-wuxing',
    name: { zh: '五星連珠', en: 'Five Planets in a Line' },
    sign: {
      zh: '五星如連珠,日月若合璧。占曰:天下同心,兵不血刃。',
      en: 'The five planets strung like pearls, sun and moon paired like jade discs. The reading: all under heaven of one mind — swords need not be bloodied.',
    },
    effect: {
      zh: '今日對局:雙方起手全部手牌 -1 費 —— 万事俱备。',
      en: 'Today both sides pay 1 less for every opening-hand card — everything is ready.',
    },
    modifiers: { handCostDelta: -1 },
  },
  {
    id: 'omen-taibai',
    name: { zh: '太白經天', en: 'Venus Crosses at Noon' },
    sign: {
      zh: '太白晝見,經天。占曰:兵起,強國弱,小國強。',
      en: 'Venus shows itself in daylight and crosses the sky. The reading: war begins — the strong grow weak and the weak grow strong.',
    },
    effect: {
      zh: '今日對局:雙方主公技各便宜 1 費 —— 谁都比平时敢动手。',
      en: 'Today both Hero Powers cost 1 less — everyone is bolder than usual.',
    },
    modifiers: { heroPowerCostDelta: -1 },
  },
  {
    id: 'omen-beidou',
    name: { zh: '北斗指東', en: 'The Dipper Points East' },
    sign: {
      zh: '斗柄東指,天下皆春。農時將至,不利遠征。',
      en: 'The Dipper handle points east; spring comes to all under heaven. The season of planting is near — a poor time for a long campaign.',
    },
    effect: {
      zh: '今日對局:雙方開局各得 2 點糧道 —— 仓廪先实。',
      en: 'Today both sides start with 2 Supply — the granaries fill first.',
    },
    modifiers: { startSupply: 2 },
  },
  {
    id: 'omen-tiangu',
    name: { zh: '天鼓鳴', en: 'The Drum of Heaven Sounds' },
    sign: {
      zh: '無雲而雷,聲如天鼓。三軍聞之,不待令而起。',
      en: 'Thunder without cloud, like a drum struck in heaven. The armies heard it and rose before the order came.',
    },
    effect: {
      zh: '今日對局:雙方開局士氣 +1 —— 人心先动。',
      en: 'Today both sides start with 1 Morale — the blood is already up.',
    },
    modifiers: { startMorale: 1 },
  },
  {
    id: 'omen-yueshi',
    name: { zh: '月食既', en: 'The Moon Wholly Eaten' },
    sign: {
      zh: '月食既,夜如墨。將軍按劍不語,至天明。',
      en: 'The moon was wholly eaten; the night went to ink. The general kept his hand on his sword and said nothing until dawn.',
    },
    effect: {
      zh: '今日對局:雙方開局士氣 -1 —— 谁都不踏实。',
      en: 'Today both sides start at -1 Morale — no one is easy.',
    },
    modifiers: { startMorale: -1 },
  },
  {
    id: 'omen-qingming',
    name: { zh: '天象清明', en: 'The Heavens Are Clear' },
    sign: {
      zh: '是夜無風,星漢皎然。太史令無事可奏。',
      en: 'No wind that night; the River of Stars stood bright and plain. The astronomer had nothing to report.',
    },
    effect: {
      zh: '今日對局:一切如常 —— 没有天象可依,只能靠自己。',
      en: 'Today nothing is changed — no omen to lean on, only yourself.',
    },
    modifiers: {},
  },
]

export const OMENS_BY_ID: Record<string, Omen> = Object.fromEntries(
  OMENS.map((o) => [o.id, o]),
)

// 日期 → 今夜的天象。和每日谜题同一套 FNV-1a,理由也一样:
// 确定性 ⇒ 所有人今天看到的是同一颗星,玩家之间对得上话。
export function omenFor(dateStr: string): Omen {
  let h = 2166136261
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return OMENS[Math.abs(h >>> 0) % OMENS.length]
}
