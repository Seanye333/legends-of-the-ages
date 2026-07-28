import type { CardLore } from './generated/lore.gen'

// 列传按需加载。
//
// 【为什么要有这一层】
// `lore.gen.ts` 是 144KB 的生成文件(2,211 条列传:生平、名言、单挑台词)。
// 它此前被 `CardInspect` 静态 import,而 `CardInspect` 又被 `MatchScreen` 静态 import ——
// 于是**每一个首次打开游戏的玩家,都在下载全部两千多条传记**,而首屏一个字都不显示。
//
// 【为什么不直接把 CardInspect 也懒加载】
// 试过,不行:它是长按卡牌立刻要弹出来的东西,懒加载会在长按和弹窗之间插一段空白。
// 真正该懒的是**数据**不是组件 —— 组件几 KB,数据 144KB。
//
// 【同步访问器的用处】
// 首次加载后模块级缓存住,`loreNow()` 立刻返回。第二次打开任何一张卡的详情
// 就不再有那一帧的空档了 —— 只有全程第一次会看到列传区域晚一帧出现。
let cache: Record<string, CardLore> | null = null
let inflight: Promise<Record<string, CardLore>> | null = null

export function loadLore(): Promise<Record<string, CardLore>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = import('./generated/lore.gen').then((m) => {
      cache = m.LORE
      return cache
    })
  }
  return inflight
}

// 已经加载过就同步给,没加载过给空表 —— 调用点按「暂时没有列传」渲染即可。
export function loreNow(): Record<string, CardLore> {
  return cache ?? {}
}
