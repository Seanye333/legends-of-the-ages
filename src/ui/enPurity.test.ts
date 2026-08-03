import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// 英文文案里混进汉字 —— 这一类**只在英文界面上看得见**,
// 而写代码的人自己一直开着中文,所以永远不会自己发现。
//
// `npm run audit-en` 早就能报它,但盘点脚本要有人主动去跑。
// 实测这一条会漏:同一轮里我自己写出了 `t('再加一名族人即成', 'one more kinsman to活')`
// —— 一个「活」字掉进英文串,build 过、tsc 过、测试全绿。
// 名言那边有同款闸门(loreQuotes.test 的「中文里不许混进英文单词」),
// 界面这边一直没有,补上。
const HAN = /[一-鿿㐀-䶿]/
const STR = String.raw`'((?:[^'\\]|\\.)*)'`
const T_CALL = new RegExp(String.raw`\bt\(\s*${STR}\s*,\s*${STR}\s*[,)]`, 'g')
const LOC_LIT = new RegExp(String.raw`\bzh:\s*${STR}\s*,\s*en:\s*${STR}`, 'g')
// 生成层是从姊妹仓库导来的,要修得回源头修;测试文件本身不算界面
const SKIP = /\/content\/generated\/|\.test\.tsx?$/

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe('英文文案', () => {
  const files = walk('src').filter((f) => !SKIP.test(f))

  it('扫到的双语串有规模 —— 正则失效时不能静默通过', () => {
    let n = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const re of [T_CALL, LOC_LIT]) {
        re.lastIndex = 0
        while (re.exec(src) !== null) n++
      }
    }
    expect(n).toBeGreaterThan(800)
  })

  it('英文那一半里没有汉字', () => {
    const bad: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const re of [T_CALL, LOC_LIT]) {
        re.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = re.exec(src)) !== null) {
          if (!HAN.test(m[2])) continue
          const line = src.slice(0, m.index).split('\n').length
          bad.push(`${relative('.', f)}:${line} en=「${m[2]}」`)
        }
      }
    }
    expect(bad).toEqual([])
  })
})
