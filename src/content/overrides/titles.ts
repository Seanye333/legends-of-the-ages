import type { CardDef } from '../../engine/types'

// 爵位与尊号的英文译名。**只覆盖 name.en,不碰任何数值或效果。**
//
// 【为什么单独一层】
// 英文名来自源数据的 officer.name.en,而源数据的重新导入是破坏性的
// (见 import-content.ts 顶部那段警告)—— 不能靠改上游修。
// 覆盖层是浅合并的 Partial<CardDef>,name 照样能盖,于是把这一类问题
// 集中在一个文件里,谁改了什么一眼可见。
//
// 【判断标准:这个字是爵位,还是名字的一部分】
// 中文里同一个字两种身份,这是全部误判的来源:
//   · 卓文君 / 王昭君 / 駱賓王 —— 「君」「王」在名里,音译是对的
//   · 信陵君 / 蘭陵王 —— 「君」「王」是封号,必须译出来
// 判据是**前面那部分能不能单独当地名或氏**:蘭陵是地名(高長恭封蘭陵王),
// 昭君不是。所以只有前者要译。
//
// 【池子里已经立好的惯例,新增时照抄】
//   · 諡号帝王:漢靈帝 → Emperor Ling(不是 Han Lingdi)
//   · 清代年号帝王:道光帝 → Daoguang Emperor(清帝按年号称呼,是另一套,也是对的)
//   · 战国四公子:信陵君 → Lord Xinling
//   · 春秋诸侯:齊桓公 → Duke Huan of Qi
// 这一层修的全是**没照这套惯例走的那些**。
export const TITLE_OVERRIDES: Record<string, Partial<CardDef>> = {
  // 音译把封号和地名黏成一个词,英文读者既读不出也查不到。
  // 高長恭封蘭陵王 —— 蘭陵是地名,和「信陵君 → Lord Xinling」是同一个结构。
  'hist-lanlingwang': { name: { zh: '蘭陵王', en: 'Prince of Lanling' } },

  // 諡号帝王:同一个池子里漢靈帝已经是 Emperor Ling,漢武帝却是 Han Wudi。
  // 「Wudi」对英文读者是一个不透明的音节 —— 而 Wu 是諡号、di 是「帝」,
  // 把「帝」音译掉等于把这个人的身份信息删了。
  'hist-han-wudi': { name: { zh: '漢武帝', en: 'Emperor Wu of Han' } },
  'hist-yuan-shundi': { name: { zh: '元順帝', en: 'Emperor Shun of Yuan' } },

  // 「大王」是南中诸部首领的称号,整个丢掉之后这两位就只剩一个音译名字,
  // 看不出他们是谁。木鹿大王此前连称号带姓只剩「Mu Lu」。
  'mu-lu': { name: { zh: '木鹿大王', en: 'King Mulu' } },
  duosi: { name: { zh: '朵思大王', en: 'King Duosi' } },

  // 「公」在这里是敬称不是爵位,和信陵君同构 —— 池子里已经译成 Lord。
  // 音译成 Mao Gong 会被读成「姓毛名公」。
  'hist-mao-gong': { name: { zh: '毛公', en: 'Lord Mao' } },
  'hist-xue-gong': { name: { zh: '薛公', en: 'Lord Xue' } },
  'hist-ding-gong': { name: { zh: '丁公', en: 'Lord Ding' } },

  // 黃石公:授張良《太公兵法》的那位老人。音译成 Huangshigong 是三重损失 ——
  // 「黃石」是这个传说的**核心信物**(他约张良十三年后到穀城山下见一块黄石),
  // 「公」是敬称,而黏成一个词之后英文读者连断词都做不到。
  // 这一条是新写的闸门抓出来的,我自己三筛的时候把它当成了名字。
  'hist-huangshigong': { name: { zh: '黃石公', en: 'Lord Yellowstone' } },

  // 佘太君:「太君」是对年高有封诰的命妇的尊称,音译成 Taijun 读者无从判断
  // 这是名字还是头衔。她是杨家将里的老祖母 —— Grand Dame 兼顾了尊称与年齿。
  'hist-she-taijun': { name: { zh: '佘太君', en: 'Grand Dame She' } },
}
