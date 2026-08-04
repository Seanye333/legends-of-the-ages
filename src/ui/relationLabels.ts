import type { RelEdge } from '../content/generated/lore.gen'

// 关系类型的译名。**两处在用**(卡牌详情的关系列表、列传索引的牵连链),
// 所以它住在这里而不是任何一屏里 —— 抄第二份就是「两套事实」的开头。
// era = 「同時」:生平里同框出现,但看不出更具体的关系。
//
// 类型钉成 Record<RelEdge['kind'],…>:加一种关系忘了补译名,tsc 会拦。
// 颜色那一半在 CardInspect.module.css 的 .rel_*,CSS 没有类型,
// 由 relationKinds.test 去数(见那个文件的说明)。
export const REL_KIND: Record<RelEdge['kind'], { zh: string; en: string }> = {
  kin: { zh: '親族', en: 'Kin' },
  mentor: { zh: '師承', en: 'Taught' },
  liege: { zh: '君臣', en: 'Served' },
  foe: { zh: '敵對', en: 'Foe' },
  friend: { zh: '交好', en: 'Friend' },
  era: { zh: '同時', en: 'Contemporary' },
}
