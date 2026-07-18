import type { HeroDef } from '../../engine/types'
import { START_HP } from '../../engine/types'

// 六主义主公,一主义一位。id 必须存在于武将花名册(立绘自动跟随)。
// 王道刘备、霸道曹操为既定;其余四位选型理由:
// - 礼教 孔子:礼教之宗,克己复礼——礼教主义的定义者本人。
// - 名利 司马懿:鹰视狼顾,隐忍一生只为名位权柄,名利路线的极致。
// - 割据 孙权:坐断东南战未休,凭长江割据一方的代表人物。
// - 隐逸 老子:道家始祖,出关而隐,隐逸主义的源头。
export const HEROES: HeroDef[] = [
  { id: 'liu-bei', name: { zh: '劉備', en: 'Liu Bei' }, doctrine: 'royal', hp: START_HP },
  { id: 'cao-cao', name: { zh: '曹操', en: 'Cao Cao' }, doctrine: 'hegemonic', hp: START_HP },
  { id: 'hist-confucius', name: { zh: '孔子', en: 'Confucius' }, doctrine: 'ritual', hp: START_HP },
  { id: 'sima-yi', name: { zh: '司馬懿', en: 'Sima Yi' }, doctrine: 'fame', hp: START_HP },
  { id: 'sun-quan', name: { zh: '孫權', en: 'Sun Quan' }, doctrine: 'separatist', hp: START_HP },
  { id: 'hist-laozi', name: { zh: '老子', en: 'Laozi' }, doctrine: 'reclusion', hp: START_HP },
]

export const HEROES_BY_ID: Record<string, HeroDef> = Object.fromEntries(
  HEROES.map((h) => [h.id, h]),
)
