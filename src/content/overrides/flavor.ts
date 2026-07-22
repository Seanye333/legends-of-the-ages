import type { CardDef } from '../../engine/types'

// 风味文本补漏。
//
// 卡面风味绝大多数由 lore.gen.ts 生成得很好(史料/诗词口吻),这里只补生成器漏掉的
// 那几个有名有姓的传奇 —— 历史题材,顶级传奇不该是白文案。content.test 里有守卫:
// 所有可收集传奇武将都必须有中文风味文本,红了就说明又漏了。
export const FLAVOR_OVERRIDES: Record<string, Pick<CardDef, 'text'>> = {
  'hist-jin-wen-gong': {
    text: { zh: '退避三舍,一戰而霸。', en: 'He yielded three marches, then won it all at Chengpu.' },
  },
  'hist-qin-mugong': {
    text: { zh: '用五羖大夫,遂霸西戎。', en: 'With the Five-Ram minister, he mastered the western tribes.' },
  },
  'hist-shang-yang': {
    text: { zh: '徙木立信,秦法始行;作法自斃,身死道存。', en: 'He moved a pole to prove his word — his law outlived him, though it took his life.' },
  },
  'hist-cao-can': {
    text: { zh: '蕭規曹隨,清靜而治。', en: 'He followed Xiao He’s rules to the letter, and governed by stillness.' },
  },
  'hist-wang-meng': {
    text: { zh: '捫蝨而談天下,功業比諸葛。', en: 'Picking lice as he discussed the realm — a statesman to rival Zhuge Liang.' },
  },
  'hist-muqali': {
    text: { zh: '太師國王,為汗經略中原。', en: 'Grand Preceptor and Prince, he held the Central Plains for the Khan.' },
  },
}
