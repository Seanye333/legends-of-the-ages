import type { CardDef } from '../../engine/types'

// 战役名单的**假匹配**修正。
//
// 【怎么发现的】
// 2026-08-08 做「时代长卷标出战役」时按时代给战役归组,发现**明清那一块一场仗都没有**,
// 而明清有七张卡带着 `battles`。逐条一看,那七条全是名字撞车:
// 鄭和 在昆陽之戰、朱棣 在漠北之戰、李鴻章 在合肥·逍遙津。
//
// 【根因:生成层是按**字面**从生平原文里认战役的,而战役名多半是地名】
// 于是同一个地名把相隔一两千年的人编成了同袍。二十四场里有十场跨时代,
// 逐条查完是三类:
//
//   · **籍贯**   —— 楊行密 / 包拯 / 李鴻章 / 聶士成 都是**合肥人**;
//                  田豐 / 張角 是**鉅鹿人**;殷浩 是**陳郡長平**人;
//                  鄭和 是**昆陽**人;李白 卒于**采石**矶
//   · **同名不同代** —— 哥舒翰、封常清 打的是**756 年**那场潼關之戰,
//                  孫傳庭 打的是**1643 年**那场,盧象昇 战死于**1639 年**的鉅鹿;
//                  竇建德 打的是**621 年**的虎牢之戰。三场都是真的,但不是同一场
//   · **常用词**   —— 曹叡 与 石虎 进「土木堡之變」,是因为两人都以**大興土木**闻名
//
// 【为什么必须手查,不能按「取众数」自动清洗】
// 十条里有**三条是对的**,而且恰恰是众数会删错的那三条:
//   · 慕容垂 在淝水之戰 —— 他真的在前秦军中(朝代标签把他归到了另一块)
//   · 于謙 在土木堡之變 —— **他是唯一对的那个**,而众数是那两个「大興土木」
//   · 朱棣 / 王保保 在漠北之戰 —— 那份名单说的本来就是明初北征,不是霍去病那场
// 自动抽出来的关系不等于能直接用的关系(宿敌那一批也是同一条教训)。
//
// 【为什么修在覆盖层】
// 生成层(`cards.gen.ts`)禁止手改,而认战役的那段逻辑在姊妹仓库的导入脚本里,
// 这台机器上动不了。所以这里是一张**手查过的排除表**,和 `defectors.ts` 同一个形状。
//
// 【它影响的不只是长卷】
// `CountSource.friendlyBattle`(第二十八卡包)数的就是这份名单 ——
// 在修之前,「合肥舊人」里站着李鴻章和聶士成。
export const BATTLE_EXCLUSIONS: Record<string, readonly string[]> = {
  '合肥 · 逍遙津': ['hist-yang-xingmi', 'hist-bao-zheng', 'hist-li-hongzhang', 'hist-nie-shicheng'],
  鉅鹿之戰: ['tian-feng', 'zhang-jiao', 'hist-lu-xiangsheng'],
  長平之戰: ['hist-yin-hao'],
  潼關之戰: ['hist-geshu-han', 'hist-feng-changqing', 'hist-sun-chuanting'],
  土木堡之變: ['cao-rui', 'hist-shi-hu'],
  昆陽之戰: ['hist-zheng-he'],
  采石之戰: ['hist-li-bai'],
  虎牢關: ['hist-dou-jiande'],
}

/** 合并层的一趟 —— 和 applyDefector 同一个位置。 */
export function applyBattleFixes(card: CardDef): CardDef {
  if (!card.battles?.length) return card
  const kept = card.battles.filter((b) => !BATTLE_EXCLUSIONS[b]?.includes(card.id))
  if (kept.length === card.battles.length) return card
  // 一条都不剩就整个字段去掉 —— 留一个空数组会让 `battles?.length` 的判断
  // 到处多一种情况,而「他没参加过任何一场仗」和「他的名单被清空了」是同一件事。
  return kept.length > 0 ? { ...card, battles: kept } : { ...card, battles: undefined }
}
