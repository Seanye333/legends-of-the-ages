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

// 年代跨度与一句话画像。
//
// 这两张表原来只**写在上面那段注释里** —— 也就是说只有读源码的人看得到。
// 时代长卷要把六块时代摆成一条路给玩家看,那段判断(每一块的战争形态)
// 正是长卷唯一值得说的东西,所以把它从注释提成数据。
export const ERA_SPAN: Record<Era, LocalizedText> = {
  'pre-qin': { zh: '前 770 — 前 221', en: '770–221 BC' },
  'qin-han': { zh: '前 221 — 220', en: '221 BC – AD 220' },
  'three-kingdoms': { zh: '184 — 420', en: 'AD 184–420' },
  'sui-tang': { zh: '420 — 960', en: 'AD 420–960' },
  'song-yuan': { zh: '960 — 1368', en: 'AD 960–1368' },
  'ming-qing': { zh: '1368 — 1912', en: 'AD 1368–1912' },
}

export const ERA_BLURB: Record<Era, LocalizedText> = {
  'pre-qin': {
    zh: '百家爭鳴,士與刺客。一句話能換一座城,一把匕首能改一國之運。',
    en: 'A hundred schools, wandering scholars, and assassins. A sentence could buy a city; a dagger could redirect a state.',
  },
  'qin-han': {
    zh: '軍功爵與郡縣。大兵團遠征三千里,重騎踏出的路就是版圖。',
    en: 'Rank by merit, rule by commandery. Armies marched three thousand li, and the road the cavalry cut became the border.',
  },
  'three-kingdoms': {
    zh: '勢力對峙。這是唯一一個「他站在誰那邊」比「他多能打」更要緊的時代。',
    en: 'Three powers in deadlock — the one age where whose side a man stood on mattered more than how well he fought.',
  },
  'sui-tang': {
    zh: '府兵與藩鎮。騎將衝陣,先動手的那一方通常也就贏了。',
    en: 'Militia armies and warlord provinces. Cavalry charged, and whoever moved first usually won.',
  },
  'song-yuan': {
    zh: '一邊是城防重甲,一邊是騎射長驅。守與破在這裡打了四百年。',
    en: 'Walls and heavy armour on one side, horse archers on the other. Four centuries of siege against speed.',
  },
  'ming-qing': {
    zh: '火器、水師、邊軍。殺傷第一次不再取決於一個人有多強。',
    en: 'Guns, fleets, frontier garrisons. For the first time, killing power no longer depended on how strong one man was.',
  },
}

export const ERA_NAME: Record<Era, LocalizedText> = {
  'pre-qin': { zh: '先秦', en: 'Pre-Qin' },
  'qin-han': { zh: '秦漢', en: 'Qin and Han' },
  'three-kingdoms': { zh: '三國兩晉', en: 'Three Kingdoms' },
  'sui-tang': { zh: '隋唐五代', en: 'Sui and Tang' },
  'song-yuan': { zh: '宋元', en: 'Song and Yuan' },
  'ming-qing': { zh: '明清', en: 'Ming and Qing' },
}
