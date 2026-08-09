// 远征宝物的**轻量索引** —— 只有 id 和稀有度。
//
// 【它为什么单独存在】
// `relics.ts` 是 9.7KB(23 件宝物的名字、说明、加血、开局修正)。
// 而 `expeditionStore` 从里面只做一件事:**按稀有度加权抽三件没拿过的**。
// 名字、说明、修正一个字段都没碰 —— 那些是展示与结算时才要的,而那两处
// (`ExpeditionScreen`)是懒加载的。
// store 却是首屏就要加载的(`matchStore` 与 `useWarMerit` 都引它),
// 于是 9.7KB 跟着进了主包。同 `historyIndex.ts` / `campaignIndex.ts` 一个路子,
// 见 ROADMAP 第 51 条。
//
// ⚠️ **顺序是数据,不是排版。**
// 抽取用的是一个从 `rngState` 推出来的 LCG,它**按数组顺序**走过候选池累加权重。
// 顺序一变,同一个 rngState 抽到的就是另外三件 —— 也就是进行中的远征
// 在玩家眼前换了一批宝物,而且没有任何东西会报错。
// `relicIndex.test.ts` 逐位钉住它和 `relics.ts` 的顺序。

/** 稀有度。写成单字母是因为这份表进浏览器包,而它只是抽取用的权重键。 */
export type RelicRarityCode = 'r' | 'e' | 'l'

export interface RelicIndexEntry {
  id: string
  rarity: RelicRarityCode
}

/** 与 `RELICS` **逐位同序**。 */
export const RELIC_INDEX: readonly RelicIndexEntry[] = (
  [
    ['relic-hufu', 'e'],
    ['relic-liangdao', 'r'],
    ['relic-aibing', 'l'],
    ['relic-jinpai', 'r'],
    ['relic-tuncang', 'e'],
    ['relic-tiebi', 'e'],
    ['relic-liangcao', 'r'],
    ['relic-qinbing', 'r'],
    ['relic-chuanxi', 'e'],
    ['relic-jiangwei', 'r'],
    ['relic-bingfu', 'r'],
    ['relic-shenji', 'e'],
    ['relic-junshi', 'e'],
    ['relic-yuxi', 'e'],
    ['relic-tianming', 'l'],
    ['relic-chuqi', 'l'],
    ['relic-tunjia', 'r'],
    ['relic-tieqi', 'e'],
    ['relic-qishi', 'e'],
    ['relic-jinjun', 'l'],
    ['relic-zhongzhicheng', 'l'],
    ['relic-fujiang-mou', 'e'],
    ['relic-fujiang-xian', 'e'],
  ] as const
).map(([id, rarity]) => ({ id, rarity }))

/** 抽取权重。稀有的多、传说的少 —— 与 relics.ts 的稀有度一一对应。 */
export const RELIC_RARITY_WEIGHT: Record<RelicRarityCode, number> = { r: 6, e: 3, l: 1 }
