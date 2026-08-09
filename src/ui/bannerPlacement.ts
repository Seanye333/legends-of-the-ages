// 回合横幅落点的**判据**。这里一行 DOM 都不碰 —— 这是它单独成文件的全部理由:
// tsconfig.test.json 的 lib 只有 ES2022(单测层有意不带 DOM),
// 判据留在 useBannerPlacement.ts 里就没法进单测,而这条判据恰恰有两个分支,
// 只验一边等于没验(第一版只顾了一边,五档全红)。
// 取数(量令牌、量行盒)在 useBannerPlacement.ts,那边才需要 DOM。

/** 令牌盒之外还有描边/角标探出来一点(实测最多 3.2px),两头各留 4px。 */
export const SAFE = 4

export interface Box {
  top: number
  bottom: number
  left: number
  right: number
}

export interface BannerGeom {
  /** 敌方那排令牌摞出来的下沿 */
  above: number
  /** 我方那排令牌摞出来的上沿 */
  below: number
  /** 横幅的布局尺寸(offsetWidth/Height,不含入场动画的 scale) */
  bannerW: number
  bannerH: number
  /** 战场容器 */
  field: Box
  /** 两排的行盒 —— 横着让开时要绕过的是它们 */
  rows: [Box, Box]
}

/**
 * 落点判据。
 *
 * 返回值单位是相对 `.screen` 的像素;横幅带着 translate(-50%,-50%),
 * 所以给的是它的**中心**。left 为 undefined 表示保持 CSS 的水平居中 ——
 * 空间够的档位上把提示赶去角落是没有理由的。
 *
 * 见 bannerPlacement.test.ts:两个分支、边界的两侧、以及退化情形都有反例守着。
 */
export function planBanner(g: BannerGeom): { top: number; left?: number } {
  const top = (g.above + g.below) / 2
  // 竖着装得下就坐进正中 —— 那也是间隙最大的位置。
  if (g.below - g.above >= g.bannerH + 2 * SAFE) return { top }

  // 竖着没地方了(上是顶栏、下是手牌),所以往横里让:
  // 滑进战线左右两侧较宽的那条空档,仍然坐在楚河汉界这条线上。
  const leftGut = Math.min(g.rows[0].left, g.rows[1].left) - g.field.left
  const rightGut = g.field.right - Math.max(g.rows[0].right, g.rows[1].right)
  // 两侧都塞不下就维持居中 —— 那是今天的行为,不比今天更差。
  if (Math.max(leftGut, rightGut) < g.bannerW + 2 * SAFE) return { top }
  return {
    top,
    left: leftGut >= rightGut ? g.field.left + leftGut / 2 : g.field.right - rightGut / 2,
  }
}
