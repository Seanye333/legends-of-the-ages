import type { CardDef } from '../../engine/types'

// 降将 —— 史料里明确写着换过阵营的 65 个人。
//
// 【为什么这条轴只有这个题材做得出来】
// 势力、兵种、主义都是**设计出来的**分组:先想好要几档,再把人塞进去。
// 「他降过」不是 —— 它是生平原文里现成的一句话:「降曹操」「歸唐」「降清」。
// 于是这一档天然横跨一切分组:六个主义都有,从三国一直到清初,
// 唯一的共同点是那个人在某一天换了主子。这种部族别家 CCG 编不出来,
// 因为编出来的分组一定是齐整的,而历史不齐整。
//
// 【名单为什么是写死的常量,而不是运行时从 lore 读】
// `defected` 那个字段在 `generated/lore.gen.ts` 里,而那份史料是**懒加载**的
// (见 loreLazy.ts)。让 `cards.ts` import 它等于把整份 lore 拖进首屏 ——
// `npm run perf-budget` 会当场红。所以这里是一份 committed 的 id 名单,
// 抽取方式记在下面,重新生成一次几秒钟的事。
//
// 重新生成(需要读 lore.gen,跑一次贴回来即可):
//   遍历 LORE,取有 `defected` 且在 COLLECTIBLE_CARDS 里的 id。
//
// 【注释里保留那句史料原文】和 lore-quotes.ts 一个规矩:
// 拿不准的宁可不写。这 65 条每一条都是生平里的原话,不是我判断出来的。
//
// ⚠️ 名单**只贴标签,不改任何数值** —— 65 张卡的费用身材效果一个字都没动。
// 吃这条标签的是第二十七卡包的那几张 payoff 卡。
export const DEFECTOR_IDS: readonly string[] = [
  'zhang-he', // 張郃(6 费 5/6 hegemonic)—— 降曹操
  'huang-gai', // 黃蓋(6 费 4/4 neutral)—— 降曹操
  'ma-chao', // 馬超(7 费 5/5 hegemonic)—— 歸劉備
  'pang-tong', // 龐統(7 费 4/4 fame)—— 歸劉備
  'xu-huang', // 徐晃(8 费 7/5 hegemonic)—— 降曹操
  'pang-de', // 龐德(7 费 6/4 hegemonic)—— 降劉備
  'tian-yu', // 田豫(4 费 4/3 separatist)—— 歸曹操
  'zhang-liao', // 張遼(6 费 6/5 hegemonic)—— 歸曹操
  'gan-ning', // 甘寧(7 费 4/5 separatist)—— 歸孫權
  'gao-lan', // 高覽(4 费 3/3 neutral)—— 降曹操
  'cao-xing', // 曹性(2 费 3/1 fame)—— 歸呂布
  'song-xian', // 宋憲(1 费 1/1 fame)—— 降曹操
  'hou-cheng', // 侯成(1 费 1/1 neutral)—— 降曹操
  'meng-da', // 孟達(3 费 3/2 neutral)—— 降劉備
  'wu-yi', // 吳懿(4 费 4/3 separatist)—— 降劉備
  'zhang-xiu', // 張繡(6 费 5/3 separatist)—— 降曹操
  'liu-du', // 劉度(1 费 2/1 neutral)—— 降劉備
  'li-yan', // 李嚴(3 费 4/3 neutral)—— 降劉備
  'yang-qiu', // 楊秋(1 费 1/1 fame)—— 降曹操
  'shi-xie', // 士燮(5 费 4/5 separatist)—— 降孫權
  'chen-lin', // 陳琳(2 费 1/2 neutral)—— 歸曹操
  'wang-can', // 王粲(2 费 1/2 royal)—— 歸曹操
  'jiao-chu', // 焦觸(2 费 3/1 neutral)—— 降曹操
  'zhang-song', // 張松(2 费 2/1 neutral)—— 歸劉備
  'liu-mao', // 劉瑁(1 费 1/1 neutral)—— 降曹操
  'zhang-wei', // 張衛(2 费 3/1 neutral)—— 降曹操
  'zhang-yang', // 張楊(2 费 3/2 neutral)—— 歸袁紹
  'hu-zhen', // 胡軫(1 费 1/1 fame)—— 降曹操
  'xu-sheng-wu', // 徐盛(5 费 5/4 neutral)—— 投孫權
  'zhang-yan', // 張燕(5 费 4/6 separatist)—— 降曹操
  'xin-pi', // 辛毗(4 费 3/6 neutral)—— 降曹操
  'zhu-ling', // 朱靈(4 费 5/3 neutral)—— 歸曹操
  'shen-dan', // 申耽(2 费 3/2 neutral)—— 降劉備
  'fan-jiang', // 范疆(1 费 1/1 neutral)—— 降孫權
  'su-shuang', // 蘇雙(1 费 1/2 neutral)—— 降曹操
  'yang-ang', // 楊昂(2 费 2/1 neutral)—— 降曹操
  'xianyu-fu', // 鮮于輔(3 费 2/2 separatist)—— 歸曹操
  'wang-zhong', // 王忠(2 费 3/1 fame)—— 降曹操
  'yu-digen', // 于氐根(1 费 1/1 neutral)—— 降曹操
  'hist-li-mi-sui', // 李密(8 费 6/6 separatist)—— 投唐
  'hist-du-fuwei', // 杜伏威(6 费 5/5 separatist)—— 降唐
  'hist-qutu-tong', // 屈突通(6 费 5/5 hegemonic)—— 降唐
  'hist-shan-xiongxin', // 單雄信(7 费 10/4 hegemonic)—— 降唐
  'hist-luo-yi', // 羅藝(6 费 5/4 neutral)—— 降唐
  'hist-fu-gongshi', // 輔公祏(4 费 5/3 separatist)—— 降唐
  'hist-liu-wuzhou', // 劉武周(5 费 4/4 separatist)—— 歸唐
  'hist-li-ji', // 李勣(8 费 7/7 royal)—— 歸唐
  'hist-qin-qiong', // 秦瓊(6 费 5/5 hegemonic)—— 歸唐
  'hist-yuchi-gong', // 尉遲恭(9 费 5/5 hegemonic)—— 歸唐
  'hist-cheng-yaojin', // 程咬金(7 费 8/5 hegemonic)—— 歸唐
  'hist-heichi-changzhi', // 黑齒常之(7 费 10/5 hegemonic)—— 降唐
  'hist-fan-lihua', // 樊梨花(8 费 7/6 hegemonic)—— 降唐
  'hist-zhu-wen', // 朱溫(6 费 7/6 hegemonic)—— 降唐
  'hist-li-yu', // 李煜(4 费 4/4 separatist)—— 降宋
  'hist-meng-chang', // 孟昶(3 费 2/5 neutral)—— 降宋
  'hist-gao-baorong', // 高保融(3 费 3/2 neutral)—— 降宋
  'hist-yang-ye', // 楊業(8 费 6/5 hegemonic)—— 降宋
  'hist-zhang-shicheng', // 張士誠(5 费 4/5 separatist)—— 降元
  'hist-fang-guozhen', // 方國珍(5 费 4/5 separatist)—— 降明
  'hist-hong-chengchou', // 洪承疇(6 费 5/5 separatist)—— 降清
  'hist-zheng-zhilong', // 鄭芝龍(6 费 6/5 hegemonic)—— 降清
  'hist-sun-kewang', // 孫可望(4 费 4/3 neutral)—— 降清
  'hist-shi-lang', // 施琅(6 费 6/5 hegemonic)—— 降清
  'hist-geng-jingzhong', // 耿精忠(4 费 3/3 separatist)—— 降清
  'hist-shang-kexi', // 尚可喜(5 费 4/4 neutral)—— 降清
]

const SET: ReadonlySet<string> = new Set(DEFECTOR_IDS)

// 合并层的一趟 —— 和 deriveTroop 同一个位置、同一个理由:
// 生成层不存这个字段,而覆盖层是逐字段浅合并的,贴在这里最省事也最难漏。
export function applyDefector(card: CardDef): CardDef {
  return SET.has(card.id) ? { ...card, defector: true } : card
}
