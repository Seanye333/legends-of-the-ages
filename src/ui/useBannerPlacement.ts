import { useLayoutEffect, type RefObject } from 'react'
import { planBanner, type Box } from './bannerPlacement'

// 回合横幅的落点 —— **由战场几何算出来,不再猜百分比**。
//
// 【为什么百分比一定解不了】
// 这一处按视口百分比挪过三轮:38% 压着敌方那排 → 48% 压着我方那排 → 40%。
// 每一轮都是「这一档让开了,那一档压上了」,因为两排令牌的位置由
// `.row` 的 min-height: clamp(58px,13vh,100px)、令牌自身的 clamp(50px,11.5vh,112px),
// 以及顶栏/手牌吃掉多少高度共同决定 —— 它在 (宽,高) 平面上**不对应任何一个固定百分比**。
// 2026-08-09 实测四档(净空 = 两排令牌之间容得下东西的那条带子):
//   740x360 → 16.6px    844x390 → 34.9px    900x420 → 39.4px    926x428 → 36.7px
// 一个固定百分比要同时落进 16.6px 和 39.4px 两条带子的正中,无解。
//
// 【所以改成量】两排各自的令牌摞出上下沿,横幅落在净空正中 —— 那也是间隙最大的位置。
// 净空竖着装不下时(360 高的机器就是装不下,那是安卓横屏最常见的一档),
// 横幅**横着让开**:滑进战线左右两侧较宽的那条空档,仍然坐在楚河汉界这条线上。
// 让开的方向是横的而不是竖的,因为竖着确实没有地方了 —— 上是顶栏,下是手牌。

// 判据本身在 ./bannerPlacement —— 那个文件一行 DOM 都不碰,才进得了单测。
// 这里只负责**取数**:把 DOM 量成判据要的那几个数字。

/** 只在矮视口接管。高屏保持 CSS 里的 38%:那里空间够,而桌面观感是定过的。 */
export const SHORT_VIEWPORT = 430

/**
 * 相对 `stop`(横幅的包含块 `.screen`)的**布局**坐标。
 *
 * 【必须用 offsetTop/offsetLeft,不能用 getBoundingClientRect】
 * 后者含 transform,而横幅挂上来的那一刻令牌入场动画正在跑 ——
 * 量到的是某一帧,于是净空看起来比实际大,横幅当场坐到敌方那排上。
 * 第一版就是这么错的:五档全红,压的全是上面那排。
 * offsetTop 是布局量,动画一概不影响;offsetTop 的基准是 offsetParent 的
 * padding box,而绝对定位的 top/left 也是,两者本来就在同一套坐标里。
 */
function layoutBox(el: HTMLElement, stop: Element): Box {
  let x = 0
  let y = 0
  let n: HTMLElement | null = el
  while (n && n !== stop) {
    x += n.offsetLeft
    y += n.offsetTop
    n = n.offsetParent as HTMLElement | null
  }
  return { top: y, bottom: y + el.offsetHeight, left: x, right: x + el.offsetWidth }
}

/** 一排的「令牌实际占到哪」。空排返回它**远端**的边 —— 空排没有什么需要让开的。 */
function tokenEdge(row: HTMLElement, stop: Element, side: 'bottom' | 'top'): number {
  const box = layoutBox(row, stop)
  const kids = [...row.children]
    .map((k) => layoutBox(k as HTMLElement, stop))
    .filter((b) => b.right > b.left)
  if (kids.length === 0) return side === 'bottom' ? box.top : box.bottom
  return side === 'bottom'
    ? Math.max(...kids.map((b) => b.bottom))
    : Math.min(...kids.map((b) => b.top))
}

export function useBannerPlacement(
  banner: RefObject<HTMLElement | null>,
  foeRow: RefObject<HTMLElement | null>,
  myRow: RefObject<HTMLElement | null>,
  /** 换一次值就重算一次(横幅每次都是新挂上来的元素) */
  key: unknown,
) {
  useLayoutEffect(() => {
    const place = () => {
      const el = banner.current
      const foe = foeRow.current
      const mine = myRow.current
      if (!el || !foe || !mine) return
      // 先还原再量:上一次写进去的落点会污染这一次的测量。
      el.style.top = ''
      el.style.left = ''
      if (window.innerHeight > SHORT_VIEWPORT) return
      const stop = el.offsetParent
      if (!stop || !foe.parentElement) return

      const plan = planBanner({
        above: tokenEdge(foe, stop, 'bottom'),
        below: tokenEdge(mine, stop, 'top'),
        bannerW: el.offsetWidth,
        bannerH: el.offsetHeight,
        field: layoutBox(foe.parentElement, stop),
        rows: [layoutBox(foe, stop), layoutBox(mine, stop)],
      })
      el.style.top = `${plan.top}px`
      if (plan.left !== undefined) el.style.left = `${plan.left}px`
    }

    place()

    // 【只在挂载那一刻算一次是不够的】
    // 横幅活 1.4 秒,而这 1.4 秒里布局还在动:字体从回退切到正式、立绘到货、
    // 手牌铺开都会改高度,而战场是 flex:1 —— 上下任何一块变高,两排就跟着挪。
    // 压力测试下实测过:平静时令牌是 42.6px 高,整套并行跑时同一个令牌量到 52px,
    // 于是按挂载那一帧算出来的落点当场只剩 0.6px 间隙。
    // 所以盯着尺寸变化重算。战场 + 两排都盯:顶栏变高不改行盒尺寸,但会改战场高度。
    const watch = [foeRow.current, myRow.current, foeRow.current?.parentElement]
    const ro = new ResizeObserver(place)
    for (const el of watch) if (el) ro.observe(el)
    let alive = true
    void document.fonts.ready.then(() => {
      if (alive) place()
    })
    window.addEventListener('resize', place)
    return () => {
      alive = false
      ro.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [banner, foeRow, myRow, key])
}
