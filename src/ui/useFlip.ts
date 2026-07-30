import { useLayoutEffect, useRef } from 'react'

// FLIP —— 让「有人倒下之后其余人合拢」这件事真的走过去,而不是瞬移。
//
// 【为什么非要 FLIP 不可】
// 战线是一行 flex。一个单位被移出数组之后,右边所有人的位置**在同一帧内**
// 就变了 —— 没有中间态可以被 transition 捕捉,因为变的是布局不是样式,
// 而布局变化本身不可动画。于是场面每死一个人就闪一下,
// 那是牌桌上第二频繁的事(仅次于攻击)。
//
// FLIP 的做法是把它翻过来:
//   First —— 变之前记下每个孩子的位置;
//   Last  —— 变之后再量一次;
//   Invert—— 用 transform 把它们**挪回**原位(此刻视觉上什么都没发生);
//   Play  —— 去掉 transform,让 transition 把它们送回新位置。
// 全程只用 transform,不碰布局,所以它既平滑又不会引发第二次重排。
//
// 【为什么按 key 记而不是按下标】
// 下标会在删除时整体左移,量出来的「位移」就全错了。key 用 iid ——
// 同一个单位在两帧里是同一个 key,位移才是它自己真的走了多远。
//
// 【尊重减少动效】
// 关掉的时候直接不做 —— 这里没有「降级动画」,瞬间到位本来就是原来的行为。
export function useFlip(
  containerRef: React.RefObject<HTMLElement | null>,
  deps: unknown[],
  enabled = true,
): void {
  const prev = useRef<Map<string, DOMRect>>(new Map())

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    const kids = Array.from(el.children) as HTMLElement[]
    const next = new Map<string, DOMRect>()
    for (const kid of kids) {
      const key = kid.dataset.flipKey
      if (key) next.set(key, kid.getBoundingClientRect())
    }

    if (enabled && prev.current.size > 0) {
      for (const kid of kids) {
        const key = kid.dataset.flipKey
        if (!key) continue
        const before = prev.current.get(key)
        const after = next.get(key)
        // 新入场的没有 before —— 它有自己的落地动画(tokenIn),别在这里插一脚
        if (!before || !after) continue
        const dx = before.left - after.left
        const dy = before.top - after.top
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue
        // Invert:先挪回原位,且**这一帧不要过渡**
        kid.style.transition = 'none'
        kid.style.transform = `translate(${dx}px, ${dy}px)`
        // 强制一次样式计算,否则下面两行会和上面两行被合并成「什么都没发生」
        void kid.offsetWidth
        kid.style.transition = 'transform 260ms cubic-bezier(0.22, 0.8, 0.3, 1)'
        kid.style.transform = ''
      }
    }

    prev.current = next
    // deps 由调用方给(场上 iid 的拼接串)—— 这个 hook 的全部意义就是
    // 「只在调用方说的那件事变了时才重排」,所以这里不该由 lint 去推依赖。
  }, deps)
}
