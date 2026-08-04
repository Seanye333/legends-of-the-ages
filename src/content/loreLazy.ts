import type { CardLore as GenLore, RelEdge } from './generated/lore.gen'
import { LORE_OVERRIDES } from './overrides/lore-quotes'
import type { LoreOverride } from './overrides/lore-quotes'

// 对外的列传类型 = 生成层 ⊕ 手写补遗。
//
// **必须是这一份,不能是 lore.gen 的那一份** —— 手写层有生成层没有的字段
// (名言/台词/绝命诗/生平/兵器),而合并是在运行时做的:
// 用生成层的类型,tsc 会说「arms 不存在」,而更糟的是**反过来也不会报错** ——
// 直接读 lore.gen 的地方编译得过,只是手写的内容一个字都不显示。
// 列传屏就这么漏过:徐達那条手写的传写完了,而那一屏读的是生成层,还是空白。
export type CardLore = GenLore & LoreOverride

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
let battleCache: { name: { zh: string; en: string }; ids: string[] }[] = []
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
      battleCache = m.BATTLE_INDEX
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
// 战役索引:和列传同一个 chunk,所以必须从这里取(静态 import 会把 1.2MB 拖回来)
export function battlesNow(): { name: { zh: string; en: string }; ids: string[] }[] {
  return battleCache
}

// 两个人之间的最短关系链(广度优先)。
//
// 【为什么这个功能只有这个题材做得出来】
// 关系网的每一跳都带**出处原文** —— 所以链子不是「系统认为他们有关系」,
// 是「这句史料里他点了他的名」。别家 CCG 要先编三百年世界观才有这东西。
//
// 图是 1,566 个点 / 2,663 条边,BFS 一次不到一毫秒,不必预处理。
// 上限六跳:再远的链子读起来已经不像「有牵连」,像「都是中国人」。
export function relationPath(from: string, to: string): RelEdge[] | null {
  if (from === to) return []
  const prev = new Map<string, { via: RelEdge; from: string }>()
  let front = [from]
  const seen = new Set([from])
  for (let depth = 0; depth < 6 && front.length; depth++) {
    const next: string[] = []
    for (const id of front) {
      for (const e of relCache[id] ?? []) {
        const other = e.a === id ? e.b : e.a
        if (seen.has(other)) continue
        seen.add(other)
        prev.set(other, { via: e, from: id })
        if (other === to) {
          const path: RelEdge[] = []
          let cur = to
          while (cur !== from) {
            const step = prev.get(cur)!
            path.unshift(step.via)
            cur = step.from
          }
          return path
        }
        next.push(other)
      }
    }
    front = next
  }
  return null
}

export function loreNow(): Record<string, CardLore> {
  return cache ?? {}
}
