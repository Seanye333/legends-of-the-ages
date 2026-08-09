import { bossDeck } from './campaign'
import type { TowerFloorSpec } from './tower'

// 登樓每一层敌人的卡组(确定性)。
//
// 【为什么这三行要单独一个文件】
// 它是 `tower.ts` 里**唯一**用到 `campaign.ts` 的东西 —— 而 `towerFloor()`
// 是纯数学(层数 → 血量/分位/态势),一个关底定义都不需要。
// 放在一起的时候,`towerStore` 只为了读 `towerFloor(n).rewardMerit`
// 就把 61.8KB 的关底定义拽进了首屏主包(store 是首屏加载的)。
//
// 拆开之后:算层数走 `tower.ts`(轻),真要开打时才引这里(重)。
// 调用它的只有登樓那一屏,而那一屏是懒加载的。
export function towerDeck(spec: TowerFloorSpec): string[] {
  return bossDeck(spec.doctrine, spec.deckTier)
}
