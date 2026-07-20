import type { CardDef, LocalizedText } from '../engine/types'

// 主义名。放在 content 而不是 ui —— 它是内容数据,不是表现层的东西。
//
// 这张表原来只存在于 `ui/doctrineColors.ts`,于是 `app/questStore.ts` 自己
// 又抄了一份(DOCTRINE_ZH / DOCTRINE_EN),两份各改各的迟早会飘。
// 现在这里是唯一来源,ui 与 app 都从这里取。
export const DOCTRINE_NAME: Record<CardDef['doctrine'], LocalizedText> = {
  royal: { zh: '王道', en: 'Royal' },
  hegemonic: { zh: '霸道', en: 'Hegemony' },
  ritual: { zh: '礼教', en: 'Ritual' },
  fame: { zh: '名利', en: 'Fame' },
  separatist: { zh: '割据', en: 'Separatist' },
  reclusion: { zh: '隐逸', en: 'Reclusion' },
  neutral: { zh: '中立', en: 'Neutral' },
}
