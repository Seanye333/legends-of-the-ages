import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'

// 覆盖表撞键 —— 全仓库统一一道闸门。
//
// 【为什么必须是源码级的】
// 这些表全是 `Record<string, T>` 的对象字面量。同一个 id 写两次时:
//   · tsc **不报错**(Record 的键是 string,不是字面量联合)
//   · 运行时后写的整条盖掉先写的,不抛不警告
//   · 表现是「有东西不见了」—— 名言表上实测把孙坚的台词整条冲掉过,
//     同一轮里又冲掉了魏文侯 / 李悝 / 西門豹三条已有的名言
// 也就是说,唯一能发现它的办法是**去数源码里那个键出现了几次**。
//
// 加新覆盖表不需要改这个文件:它扫的是整个 overrides/ 目录。
const DIR = new URL('./overrides/', import.meta.url)

/**
 * 从一份覆盖表源码里找出撞键。
 *
 * **按表分段数,不按文件数** —— 一个文件里常常有好几张表
 * (pack19.ts 同时有 PACK19_TROOP_PINS 与 LESSON_STAT_PINS),
 * 同一个 id 在两张表里各出现一次是正常的、也是必要的。
 * 第一版按整份文件数,当场把这三条正常的报成了撞键 ——
 * 一个总在报假阳性的闸门,下次真撞了也不会有人看。
 */
export function duplicateKeys(src: string): string[] {
  const out: string[] = []
  // 顶层 `export const X ... = {` 处切段
  const heads = [...src.matchAll(/^export const \w+[^\n]*=\s*\{$/gm)]
  const segments = heads.length
    ? heads.map((h, i) => src.slice(h.index!, heads[i + 1]?.index ?? src.length))
    : [src]
  for (const seg of segments) {
    const seen = new Map<string, number>()
    for (const m of seg.matchAll(/^ {2}'([^']+)':/gm)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1)
    for (const [k, n] of seen) if (n > 1) out.push(k)
  }
  return out
}

const FILES = readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))

describe('内容覆盖表', () => {
  it('闸门自检:这个检测器真的认得出撞键', () => {
    // 一道从没验过会不会红的闸门等于没有闸门 —— 拿合成输入正反各验一次
    expect(duplicateKeys(`  'a': { x: 1 },\n  'b': { x: 2 },\n`)).toEqual([])
    expect(duplicateKeys(`  'a': { x: 1 },\n  'b': { x: 2 },\n  'a': { x: 3 },\n`)).toEqual(['a'])
    // 嵌套的同名键不算(缩进更深)
    expect(duplicateKeys(`  'a': {\n    'a': 1,\n  },\n  'b': { y: 1 },\n`)).toEqual([])
    // **同一个文件里的两张表**共用一个 id 是正常的(pack19 的兵种钉与身材钉)
    expect(
      duplicateKeys(
        `export const A: X = {\n  'a': 1,\n}\n\nexport const B: Y = {\n  'a': 2,\n}\n`,
      ),
    ).toEqual([])
    // 但同一张表里写两次要抓住
    expect(
      duplicateKeys(`export const A: X = {\n  'a': 1,\n  'b': 2,\n  'a': 3,\n}\n`),
    ).toEqual(['a'])
  })

  it('扫到的文件有规模 —— 目录改名时不能静默通过', () => {
    expect(FILES.length).toBeGreaterThan(20)
  })

  it('每张覆盖表里都没有重复的 id', () => {
    const bad: string[] = []
    for (const f of FILES) {
      for (const k of duplicateKeys(readFileSync(new URL(f, DIR), 'utf8'))) bad.push(`${f}: ${k}`)
    }
    expect(bad).toEqual([])
  })
})
