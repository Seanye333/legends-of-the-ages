import { describe, expect, it } from 'vitest'
import { planBanner, SAFE, type BannerGeom } from './bannerPlacement'

// 回合横幅的落点判据。
//
// 【为什么这条要单独验】
// 这一处按视口百分比挪过三轮,每一轮都是「这一档让开了、那一档压上了」——
// 而每一轮都是靠肉眼看一个视口确认的。判据里有**两个分支**
// (竖着装得下 → 坐进带子正中;装不下 → 横着让开),
// 只顾一边的改动在另一边会当场坏,所以两个方向都得有反例守着。
// 实测过一次:第一版把 getBoundingClientRect 当布局量用,五档全红。
//
// 下面的数字都是 2026-08-09 在 e2e 里量出来的真实布局坐标(相对 .screen)。

/** 844x390:两排令牌之间净空 34.9px,横幅高 18.4px —— 装得下。 */
const IPHONE: BannerGeom = {
  above: 139.6,
  below: 174.5,
  bannerW: 83,
  bannerH: 18.4,
  field: { top: 82, bottom: 229.3, left: 4, right: 840 },
  rows: [
    { top: 86, bottom: 144, left: 380.1, right: 463.9 },
    { top: 167.3, bottom: 225.3, left: 350.1, right: 493.9 },
  ],
}

/** 740x360:净空只有 20.2px,而横幅要 18.4 + 两头各 4 —— 装不下,得横着让。 */
const ANDROID: BannerGeom = {
  above: 135.4,
  below: 155.6,
  bannerW: 83,
  bannerH: 18.4,
  field: { top: 82, bottom: 206.2, left: 4, right: 736 },
  rows: [
    { top: 81.8, bottom: 139.8, left: 330.2, right: 409.8 },
    { top: 148.4, bottom: 206.4, left: 300.8, right: 439.2 },
  ],
}

describe('planBanner', () => {
  it('净空够:坐进两排之间的正中,水平不动', () => {
    const p = planBanner(IPHONE)
    expect(p.top).toBeCloseTo(157.05, 2)
    // undefined = 保持 CSS 的 left:50%。这里必须是 undefined 而不是某个算出来的值 ——
    // 空间够的档位上把提示赶去角落是没有理由的。
    expect(p.left).toBeUndefined()
  })

  it('净空够:横幅上下各留出的余量相等,且都 ≥ SAFE', () => {
    const p = planBanner(IPHONE)
    const up = p.top - IPHONE.bannerH / 2 - IPHONE.above
    const down = IPHONE.below - (p.top + IPHONE.bannerH / 2)
    expect(up).toBeCloseTo(down, 6)
    expect(up).toBeGreaterThanOrEqual(SAFE)
  })

  it('净空不够:横着让开,滑进较宽的那条空档', () => {
    const p = planBanner(ANDROID)
    // 竖向仍然坐在楚河汉界这条线上 —— 让开的是横向,不是把横幅挪去别的高度
    expect(p.top).toBeCloseTo(145.5, 2)
    expect(p.left).toBeDefined()
    // 让开之后横幅整个落在战线左边之外
    expect(p.left! + ANDROID.bannerW / 2).toBeLessThan(ANDROID.rows[1].left)
    expect(p.left! - ANDROID.bannerW / 2).toBeGreaterThan(ANDROID.field.left)
  })

  it('净空不够:哪边空档宽就往哪边让', () => {
    // 把两排整体推到左边,右边就成了更宽的那条空档
    const rightSide: BannerGeom = {
      ...ANDROID,
      rows: [
        { ...ANDROID.rows[0], left: 40, right: 119.6 },
        { ...ANDROID.rows[1], left: 20, right: 158.4 },
      ],
    }
    const p = planBanner(rightSide)
    expect(p.left).toBeDefined()
    expect(p.left! - rightSide.bannerW / 2).toBeGreaterThan(158.4)
  })

  it('净空不够、两侧空档也塞不下:维持居中,不做更差的事', () => {
    // 战线几乎占满战场宽度 —— 让无可让。
    // 这条守的是「退化时回到今天的行为」:横幅宁可压着,也不能跑出屏幕。
    const crowded: BannerGeom = {
      ...ANDROID,
      rows: [
        { ...ANDROID.rows[0], left: 20, right: 720 },
        { ...ANDROID.rows[1], left: 20, right: 720 },
      ],
    }
    expect(planBanner(crowded).left).toBeUndefined()
  })

  it('净空刚好等于横幅加两头余量:算装得下(边界取闭区间)', () => {
    const exact: BannerGeom = { ...ANDROID, below: ANDROID.above + 18.4 + 2 * SAFE }
    expect(planBanner(exact).left).toBeUndefined()
    // 少半个像素就得让开 —— 边界两侧都验,免得把 >= 写成 > 也照样绿
    const hair: BannerGeom = { ...exact, below: exact.below - 0.5 }
    expect(planBanner(hair).left).toBeDefined()
  })

  it('空排让出整排的高度:净空大到不必横着让', () => {
    // 敌方那排空着时 tokenEdge 返回行盒的**上**沿(空排没什么需要让开的),
    // 于是净空从 20.2 张到 73.8 —— 同一个判据自然就走回居中那条分支。
    const foeEmpty: BannerGeom = { ...ANDROID, above: ANDROID.rows[0].top }
    expect(planBanner(foeEmpty).left).toBeUndefined()
  })
})
