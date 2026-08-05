// 平衡基线:把每次模拟的结果落盘,下次自动对比,并且**只在超过噪声时才提**。
//
// 【为什么需要它】
// 这个仓库判断「刚才那一改动了什么没有」的方式,一直是人肉去比对源码注释里
// 记的历史数字(campaign.ts 顶部那几段就是)。三个问题:
//   1. 注释会过期 —— 而且过期了没人知道。这一轮就发现 heroes.ts 里
//      一整批数字是在坏掉的尺子上量的,它们看起来和真数字一模一样。
//   2. 人比数字时不带标准误。这个仓库已经**两次**把噪声当成结论。
//   3. 记的是「当时那一版」,不是「上一次跑」,中间隔了多少改动没人说得清。
//
// 所以:结果落到 .balance-baseline.json,下次跑自动 diff,
// 并且逐项按标准误判断「这个变化算不算数」。
//
// 【它不是闸门】不 exit 1。闸门管「越没越线」,这个管「动没动」——
// 两件不同的事:一个改动可以完全没越线,却把整条曲线挪了 5 个点。
//
// 用法(在别的脚本里):
//   import { loadBaseline, saveBaseline, diffAgainst } from './baseline'
// 或直接看上一次存了什么:
//   npm run baseline
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '.balance-baseline.json')

/** 一次模拟的一组具名读数,单位一律百分点 */
export interface Snapshot {
  /** 哪个脚本 */
  sim: string
  /** 每项的样本量(用来算标准误) */
  games: number
  /** 名字 → 百分数 */
  values: Record<string, number>
  /** 记录时间,由调用方传入(引擎/脚本里不该直接摸时钟的地方就别摸) */
  stampedAt?: string
}

type Store = Record<string, Snapshot>

export function loadBaseline(): Store {
  if (!existsSync(FILE)) return {}
  try {
    return JSON.parse(readFileSync(FILE, 'utf8')) as Store
  } catch {
    // 存坏了不该让模拟跑不起来 —— 它只是个便利,不是数据源
    return {}
  }
}

export function saveBaseline(snap: Snapshot): void {
  const store = loadBaseline()
  store[snap.sim] = snap
  writeFileSync(FILE, JSON.stringify(store, null, 2) + '\n', 'utf8')
}

export interface Change {
  name: string
  before: number
  after: number
  delta: number
  /** 变化幅度 / 差值标准误 */
  z: number
}

/**
 * 与上一次对比。只返回**超过 2 个标准误**的变化 ——
 * 小于那个的差值本来就不该拿来下结论(这个仓库两次教训都在这里)。
 */
export function diffAgainst(prev: Snapshot | undefined, cur: Snapshot): Change[] {
  if (!prev) return []
  const out: Change[] = []
  for (const [name, after] of Object.entries(cur.values)) {
    const before = prev.values[name]
    if (before === undefined) continue
    // 两次独立测量之差的标准误:各自方差相加。用保守的 p=0.5。
    const seBefore = Math.sqrt(0.25 / Math.max(1, prev.games)) * 100
    const seAfter = Math.sqrt(0.25 / Math.max(1, cur.games)) * 100
    const se = Math.sqrt(seBefore ** 2 + seAfter ** 2)
    const delta = after - before
    const z = Math.abs(delta) / se
    if (z > 2) out.push({ name, before, after, delta, z })
  }
  return out.sort((a, b) => b.z - a.z)
}

/** 给脚本末尾用的一段现成输出 */
export function reportDiff(prev: Snapshot | undefined, cur: Snapshot): string[] {
  const lines: string[] = []
  if (!prev) {
    lines.push(`(基线:这是 ${cur.sim} 的第一次记录,下次跑就能自动对比了)`)
    return lines
  }
  const changes = diffAgainst(prev, cur)
  if (changes.length === 0) {
    lines.push(`(与上一次基线相比,没有超过噪声的变化${prev.stampedAt ? ` —— 上次记于 ${prev.stampedAt}` : ''})`)
    return lines
  }
  lines.push(`⚠ 与上一次基线相比,${changes.length} 项变化超过 2 个标准误:`)
  for (const c of changes) {
    lines.push(
      `   ${c.name}: ${c.before.toFixed(1)}% → ${c.after.toFixed(1)}% ` +
        `(${c.delta >= 0 ? '+' : ''}${c.delta.toFixed(1)}, z=${c.z.toFixed(1)})`,
    )
  }
  lines.push('   这些是**真的动了**,不是抖动 —— 如果你没打算动它们,回头查改了什么。')
  return lines
}
