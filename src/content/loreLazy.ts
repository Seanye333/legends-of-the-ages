import type { CardLore, RelEdge } from './generated/lore.gen'
import { LORE_OVERRIDES } from './overrides/lore-quotes'

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
let traitCache: Record<string, { zh: string; en: string }> = {}
// 关系按 id 建反向索引:详情页问的永远是「这个人有哪些关系」,
// 每次去 2,620 条里 filter 一遍太浪费(详情页是长按就要弹出来的东西)。
let relCache: Record<string, RelEdge[]> = {}
let inflight: Promise<Record<string, CardLore>> | null = null

export function loadLore(): Promise<Record<string, CardLore>> {
  if (cache) return Promise.resolve(cache)
  if (!inflight) {
    inflight = import('./generated/lore.gen').then((m) => {
      // 手写补遗盖在生成层之上:名言与出战台词是**一条条核过出处**写的,
      // 而生成层那两项覆盖率只有 5% / 6.5%。合并放在这里而不是生成脚本里 ——
      // 生成物是「源头有什么」,手写是「我们补了什么」,两者混在一个文件里
      // 下次重跑 import-content 就会把手写的冲掉。
      const merged: Record<string, CardLore> = { ...m.LORE }
      for (const [id, ov] of Object.entries(LORE_OVERRIDES)) {
        merged[id] = { ...merged[id], ...ov }
      }
      cache = merged
      // 性格特质的译名和列传住在同一个 chunk —— **必须一起从这里取**,
      // 静态 import 会把 1.2MB 的列传拖回调用方的 chunk 里(懒加载白做)。
      traitCache = m.TRAIT_NAMES
      const idx: Record<string, RelEdge[]> = {}
      for (const e of m.RELATION_EDGES) {
        ;(idx[e.a] ??= []).push(e)
        ;(idx[e.b] ??= []).push(e)
      }
      relCache = idx
      return cache
    })
  }
  return inflight
}

// 某人的史料关系(生平里互相点到名的那些人)。没加载完之前是空数组。
export function relationsNow(id: string): RelEdge[] {
  return relCache[id] ?? []
}

// 性格特质译名。没加载完之前是空表,调用点回落到原始 id(不会渲染成 undefined)。
export function traitNamesNow(): Record<string, { zh: string; en: string }> {
  return traitCache
}

// 已经加载过就同步给,没加载过给空表 —— 调用点按「暂时没有列传」渲染即可。
export function loreNow(): Record<string, CardLore> {
  return cache ?? {}
}
