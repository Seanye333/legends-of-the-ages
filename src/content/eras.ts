import type { DynastyTag, LocalizedText } from '../engine/types'

// 時代塊 —— 把 18 个朝代归并成六块。
//
// 【为什么归并】
// 逐个朝代配内容既写不完也调不动(37~161 张一档,单个朝代撑不起一个主题)。
// 归并的依据是史不是凑数:每一块内部的战争形态与名将画像相近。
//   先秦     百家争鸣、士与刺客 —— 谋略、说客、暗杀
//   秦汉     军功爵、郡县、大兵团远征 —— 重骑、铺场、护甲
//   三国两晋  势力对峙 —— 同势力协同是这一块独有的题眼
//   隋唐五代  府兵与藩镇 —— 骑将冲阵,先手压制
//   宋元     一边城防重甲,一边骑射长驱 —— 守护/铁壁 与 冲锋/碾压并存
//   明清     火器、水师、边军 —— 群体杀伤与阵地
//
// 【为什么放在 src/content 而不是 scripts】
// 这张表原来只在 scripts/seed-mechanics.ts 里,因为当时只有播种要用它。
// 后来战前檄文也需要判「这两个人是不是同一个时代」—— 而 src 不能 import scripts
// (那是构建期脚本,不在应用的 tsconfig 里)。表搬到内容层,脚本反过来 import,
// 方向才是对的:内容是真相,脚本是消费者。
export type Era = 'pre-qin' | 'qin-han' | 'three-kingdoms' | 'sui-tang' | 'song-yuan' | 'ming-qing'

export const ERA_OF: Record<DynastyTag, Era> = {
  'spring-autumn': 'pre-qin',
  'warring-states': 'pre-qin',
  qin: 'qin-han',
  'chu-han': 'qin-han',
  'western-han': 'qin-han',
  wei: 'three-kingdoms',
  shu: 'three-kingdoms',
  wu: 'three-kingdoms',
  qun: 'three-kingdoms',
  jin: 'three-kingdoms',
  'southern-northern': 'sui-tang',
  sui: 'sui-tang',
  tang: 'sui-tang',
  'five-dynasties': 'sui-tang',
  song: 'song-yuan',
  yuan: 'song-yuan',
  ming: 'ming-qing',
  qing: 'ming-qing',
}

export const ERA_NAME: Record<Era, LocalizedText> = {
  'pre-qin': { zh: '先秦', en: 'Pre-Qin' },
  'qin-han': { zh: '秦漢', en: 'Qin and Han' },
  'three-kingdoms': { zh: '三國兩晉', en: 'Three Kingdoms' },
  'sui-tang': { zh: '隋唐五代', en: 'Sui and Tang' },
  'song-yuan': { zh: '宋元', en: 'Song and Yuan' },
  'ming-qing': { zh: '明清', en: 'Ming and Qing' },
}
