// 冒险关底的**轻量索引** —— 只有 id、奖励数、试炼奖励。
//
// 【它为什么单独存在】
// `campaign.ts` 是 61.8KB,首屏主包里最大的一块内容数据(关底定义:主公技脚本、
// 开场白与收场白、牌组曲线、试炼规则、傳承曲线)。而**三个 store 都是首屏加载的**,
// 三个都只从里面取一点点:
//   · `campaignStore`  —— 关数、这一关排第几、通关发多少功勋/卡包、有没有试炼
//   · `bossRushStore`  —— 只要 `BOSSES.length`
//   · `expeditionStore` —— 只要 `BOSSES.length`
// 主公技脚本、开场白、牌组曲线,三个 store 一个字段都没碰。
// 见 ROADMAP 第 51 条;同一个路子的还有 `historyIndex.ts` / `lethalIndex.ts`。
//
// 【为什么不怕它和真数据走样】
// 手写的表会烂,所以 `campaignIndex.test.ts` 逐关逐字段双向对拍:
// 多一关、少一关、奖励改了、新加了试炼而索引没跟上,都是红的。
// 走样的表现全是不崩不红的那一类 —— 关数少一关时最后一关永远解锁不了,
// 奖励抄错时通关默默少发功勋。

export interface CampaignIndexEntry {
  /** 首通发的功勋(傳承轮次会在此基础上按 cycle 放大) */
  merit: number
  /** 首通发的卡包 */
  packs: number
  /** 试炼的功勋;没有这一项 = 这一关没有试炼 */
  trial?: number
}

export const CAMPAIGN_INDEX: Record<string, CampaignIndexEntry> = {
  'boss-zhang-jiao': { merit: 60, packs: 1, trial: 150 },
  'boss-dong-zhuo': { merit: 80, packs: 1, trial: 180 },
  'boss-lu-bu': { merit: 100, packs: 1, trial: 200 },
  'boss-yuan-shao': { merit: 120, packs: 1, trial: 200 },
  'boss-sun-ce': { merit: 150, packs: 2, trial: 220 },
  'boss-zhou-yu': { merit: 180, packs: 2, trial: 220 },
  'boss-zhuge-liang': { merit: 220, packs: 2, trial: 250 },
  'boss-cao-cao': { merit: 400, packs: 3, trial: 280 },
  'boss-bai-qi': { merit: 450, packs: 2, trial: 280 },
  'boss-xiang-yu': { merit: 520, packs: 2, trial: 300 },
  'boss-han-xin': { merit: 600, packs: 3, trial: 300 },
  'boss-huo-qubing': { merit: 700, packs: 3, trial: 320 },
  'boss-tang-taizong': { merit: 820, packs: 3, trial: 340 },
  'boss-zhao-kuangyin': { merit: 960, packs: 4, trial: 360 },
  'boss-yue-fei': { merit: 1150, packs: 4, trial: 380 },
  'boss-xu-da': { merit: 1500, packs: 5, trial: 400 },
  'boss-xie-xuan': { merit: 500, packs: 2, trial: 300 },
  'boss-an-lushan': { merit: 580, packs: 2, trial: 320 },
  'boss-di-qing': { merit: 670, packs: 2, trial: 340 },
  'boss-yu-yunwen': { merit: 780, packs: 2, trial: 360 },
  'boss-wen-tianxiang': { merit: 900, packs: 2, trial: 380 },
  'boss-chen-youliang': { merit: 1050, packs: 3, trial: 400 },
  'boss-yu-qian': { merit: 1250, packs: 3, trial: 420 },
  'boss-zheng-chenggong': { merit: 1700, packs: 4, trial: 500 },
  'boss-guan-zhong': { merit: 1800, packs: 4, trial: 520 },
  'boss-shang-yang': { merit: 1900, packs: 4, trial: 540 },
  'boss-li-si': { merit: 2000, packs: 4, trial: 560 },
  'boss-sang-hongyang': { merit: 2100, packs: 4, trial: 580 },
  'boss-wang-meng': { merit: 2200, packs: 5, trial: 600 },
  'boss-wang-anshi': { merit: 2300, packs: 5, trial: 620 },
  'boss-zhang-juzheng': { merit: 2400, packs: 5, trial: 640 },
  'boss-yongzheng': { merit: 2600, packs: 6, trial: 700 },
}

/**
 * 关底 id,**按闯关顺序**。
 * 「这一关排第几」是解锁判定的依据(通了 n 关就开第 n+1 关),
 * 所以顺序在这里是数据的一部分,不是排版。
 */
export const CAMPAIGN_BOSS_IDS: readonly string[] = Object.keys(CAMPAIGN_INDEX)

/** 冒险总关数 —— 标题页那个「12/32」的分母,也是远征/无尽的循环长度。 */
export const CAMPAIGN_BOSS_COUNT = CAMPAIGN_BOSS_IDS.length
