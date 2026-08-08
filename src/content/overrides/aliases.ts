import type { LocalizedText } from '../../engine/types'

// 卡面绰号 —— 37 位有绰号的人。
//
// 【为什么是一张写死的表,而不是运行时读 lore】
// 绰号在 `generated/lore.gen.ts` 里(`alias` 字段),而那份 144KB 是**懒加载**的。
// `CardFace` 是对局里每一帧都在渲染的组件,它 import 那个模块等于把整份列传
// 拖进首屏 —— `npm run perf-budget` 会当场红。和 `defectors.ts` 同一个理由、
// 同一个形状:抽一次,贴成常量。
//
// 重新生成:遍历 `LORE ⊕ LORE_OVERRIDES`,取有 `alias` 且在 COLLECTIBLE_CARDS 里的。
//
// 【英文是真的翻过的,不是回落到中文】
// 第一版图省事让 `en` 回落到 `zh`,想法是「三姓家奴翻过去既失典故也失节奏」——
// 而 `ui/enPurity.test.ts` 当场把 37 条全报了出来:**发了 en 字段就该是英文**,
// 「中英逐字相同」正是那道闸门在找的东西(它抓过一个掉进英文串里的「活」字)。
// 那条闸门是对的:回落读起来不是「保留了典故」,是「这里没做完」。
// 所以逐条译了。译法就近取已有的英译传统(独眼龙 → One-Eyed Dragon、
// 闯王 → The Dashing King),典故靠图鉴详情里的生平去解释,不靠卡面那一行。
export const CARD_ALIAS: Record<string, LocalizedText> = {
  'xiahou-yuan': { zh: '虎步關右', en: 'Tiger Stride of the Right' }, // 夏侯淵
  'lu-bu': { zh: '三姓家奴', en: 'Slave of Three Surnames' }, // 呂布
  'dian-wei': { zh: '古之惡來', en: 'The Elai of Our Age' }, // 典韋
  'jiao-chu': { zh: '角虎', en: 'The Horned Tiger' }, // 焦觸
  'hist-baili-xi': { zh: '五羖大夫', en: 'The Five Ramskins Minister' }, // 百里奚
  'hist-bai-qi': { zh: '人屠', en: 'The Butcher of Men' }, // 白起
  'hist-lu-buwei': { zh: '一字千金', en: 'A Thousand Gold a Word' }, // 呂不韋
  'hist-chuli-ji': { zh: '智囊', en: 'The Bag of Wits' }, // 樗里疾
  'hist-long-qu': { zh: '龍翥鳳翔', en: 'Dragon Soaring, Phoenix Wheeling' }, // 龍且
  'hist-cao-can': { zh: '蕭規曹隨', en: 'Follow the Rules Xiao He Set' }, // 曹參
  'hist-feng-yi': { zh: '大樹將軍', en: 'The General of the Great Tree' }, // 馮異
  'hist-ban-zhao': { zh: '曹大家', en: 'Lady Cao the Scholar' }, // 班昭
  'hist-huang-ba': { zh: '天下第一賢吏', en: 'First Among Honest Officials' }, // 黃霸
  'hist-shao-xinchen': { zh: '召父', en: 'Father Shao' }, // 召信臣
  'hist-zhou-yi': { zh: '三日僕射', en: 'Chancellor for Three Days' }, // 周顗
  'hist-hulu-guang': { zh: '落雕都督', en: 'The Eagle-Felling Commander' }, // 斛律光
  'hist-li-ji': { zh: '常勝將軍', en: 'The General Who Never Lost' }, // 李勣
  'hist-li-cunxiao': { zh: '飛虎將', en: 'The Flying Tiger' }, // 李存孝
  'hist-wang-yanzhang': { zh: '王鐵槍', en: 'Wang of the Iron Spear' }, // 王彥章
  'hist-li-keyong': { zh: '獨眼龍', en: 'The One-Eyed Dragon' }, // 李克用
  'hist-yelu-deguang': { zh: '帝羓', en: 'The Salted Emperor' }, // 耶律德光
  'hist-yang-ye': { zh: '楊無敵', en: 'Yang the Unbeatable' }, // 楊業
  'hist-jia-sidao': { zh: '蟋蟀宰相', en: 'The Cricket Chancellor' }, // 賈似道
  'hist-shao-yong': { zh: '安樂先生', en: 'The Master of Contentment' }, // 邵雍
  'hist-zonghan': { zh: '粘罕', en: 'Nianhan' }, // 完顏宗翰
  'hist-zongwang': { zh: '斡離不', en: 'Wolibu' }, // 完顏宗望
  'hist-zhao-bian': { zh: '鐵面御史', en: 'The Iron-Faced Censor' }, // 趙抃
  'hist-mi-youren': { zh: '小米', en: 'Little Mi' }, // 米友仁
  'hist-chang-yuchun': { zh: '常十萬', en: 'Chang of the Hundred Thousand' }, // 常遇春
  'hist-li-zicheng': { zh: '闖王', en: 'The Dashing King' }, // 李自成
  'hist-yao-guangxiao': { zh: '黑衣宰相', en: 'The Black-Robed Chancellor' }, // 姚廣孝
  'hist-yan-song': { zh: '青詞宰相', en: 'The Blue-Prayer Chancellor' }, // 嚴嵩
  'hist-wei-zhongxian': { zh: '九千歲', en: 'Nine Thousand Years' }, // 魏忠賢
  'hist-yan-shifan': { zh: '鬼影', en: 'The Ghost Shadow' }, // 嚴世蕃
  'hist-li-dingguo': { zh: '兩蹶名王', en: 'Breaker of Two Princes' }, // 李定國
  'hist-oboi': { zh: '滿洲第一勇士', en: 'First Warrior of Manchuria' }, // 鰲拜
  'hist-peng-yulin': { zh: '彭青天', en: 'Peng the Clear Sky' }, // 彭玉麟
}

// 卡面能放得下的字数上限。
//
// 卡面是**小尺寸三行布局**(名字 / 副名 / 身材),绰号占的是副名那一行。
// 超过这个长度就会挤掉名字或者折行,而折行会把整张卡的版面顶乱 ——
// 所以长的那两个(天下第一賢吏、滿洲第一勇士)**不上卡面**,
// 它们在图鉴详情里照样看得到。
// 写成常量而不是直接过滤掉那两条:表是数据,这是**版面**的约束,
// 两者不该混在一起 —— 以后卡面改宽了,改这一个数就行。
const FACE_MAX = 5

/** 卡面上要显示的绰号。太长的返回 undefined(见 FACE_MAX)。 */
export function faceAlias(id: string): LocalizedText | undefined {
  const a = CARD_ALIAS[id]
  if (!a || a.zh.length > FACE_MAX) return undefined
  return a
}
