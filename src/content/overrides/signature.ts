import type { CardDef } from '../../engine/types'

// 签名卡手工调校层:覆盖生成公式的默认值。
// 键 = 武将 id(与姊妹仓库一致)。这里只放与生成值不同的字段。
// 效果(战吼/遗计/单挑)Phase 1 随效果 DSL 一起加入。
export const SIGNATURE_OVERRIDES: Record<string, Partial<CardDef>> = {
  'liu-bei': { dynasty: 'shu', doctrine: 'royal' },
  'cao-cao': { dynasty: 'wei', doctrine: 'hegemonic' },
  'sun-quan': { dynasty: 'wu' },
  'guan-yu': { dynasty: 'shu', doctrine: 'royal', rarity: 'legendary' },
  'zhang-fei': { dynasty: 'shu' },
  'zhao-yun': { dynasty: 'shu' },
  'zhuge-liang': { dynasty: 'shu', doctrine: 'royal', rarity: 'legendary' },
  // 吕布五维偏科,名望公式只给 rare —— 必传奇名单的第一个成员
  'lu-bu': { dynasty: 'qun', rarity: 'legendary' },
  'diaochan': { dynasty: 'qun' },
  'zhou-yu': { dynasty: 'wu', rarity: 'legendary' },
}
