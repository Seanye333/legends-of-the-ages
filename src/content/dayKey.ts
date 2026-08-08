// 日期小工具。**刻意单独成文件,不许 import 任何内容数据。**
//
// 【为什么拆出来】
// 这两个函数原本住在 dailyPuzzle.ts 里,而那个文件 import 了 dailyPuzzles.ts ——
// 60 道残局、57KB 的生成数据。于是标题页、稽古、觀星、每日一将这些
// **只想知道「今天是哪天」**的地方,每一处都把整个谜题池拖进了首屏包。
// 实测:拆开之前首屏预算余量只剩 2.5KB,拆开之后回到 20KB 以上。
//
// 规矩:这个文件永远只放纯日期运算。谁要往里加内容依赖,先想想是不是
// 又要把某个几十 KB 的数据表拖到首屏来。

// 本地日期 YYYY-MM-DD(应用层允许非确定性;测试传入固定值)
export function dayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 两个 YYYY-MM-DD 相差几天(用 UTC 解析避开时区/夏令时)。b 晚于 a 为正。
export function daysBetween(a: string, b: string): number {
  const pa = Date.parse(`${a}T00:00:00Z`)
  const pb = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(pa) || Number.isNaN(pb)) return NaN
  return Math.round((pb - pa) / 86_400_000)
}

// 每日谜题的题数。放在这里而不是 dailyPuzzle.ts:lethalStore 只为了这个常量
// 就会把谜题池拖进来,而它本身跟残局数据没有任何关系。
export const DAILY_SLOTS = 3

// FNV-1a。放在这里而不是 dailyPuzzle 里,是因为**每日轮换不止一样东西** ——
// 谁需要「按日期确定性地挑一个」,都该用同一个哈希,否则两处轮换会各走各的节奏。
// (dailyPuzzle 里那份是先写的,留着不动:它已经决定了历史上每一天的题面,
// 改哈希等于把所有人的「连续 N 天」记录重排一遍。)
export function dayHash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h >>> 0)
}
