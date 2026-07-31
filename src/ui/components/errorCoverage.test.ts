import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { matchErrorText } from './errorText'

// 错误码必须能翻成人话。
//
// 【为什么需要这道闸门】
// 2026-07 把全库的错误码扫出来对了一遍:**23 条没有映射**,
// 会把 kebab-case 原样怼给玩家(matchErrorText 的兜底就是 `return { zh: code }`)。
// 其中 `room-not-found` / `room-taken` 是房间码打错一个字符就必然撞到的 ——
// 也就是说这条路径每天都有人走,而他们看到的是字面量。
//
// 这类缺失人工发现不了:它不崩、不报错,只是文案难看,
// 而写代码的人自己永远不会去输错房间码。所以让机器去扫。

const ROOT = join(new URL('.', import.meta.url).pathname, '..', '..')

// 从源码里抠错误码:引擎/服务端一律用 `error: 'kebab-case'` 或 `{ ok: false, error: '...' }`
function scanCodes(dir: string, out: Set<string>): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === 'generated') continue
      scanCodes(p, out)
      continue
    }
    if (!name.endsWith('.ts') && !name.endsWith('.tsx')) continue
    if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) continue
    const src = readFileSync(p, 'utf8')
    for (const m of src.matchAll(/error:\s*'([a-z][a-z0-9-]{2,})'/g)) out.add(m[1])
  }
}

describe('错误码都要有人话', () => {
  it('引擎与应用层抛出的每一个错误码都能翻译', () => {
    const codes = new Set<string>()
    scanCodes(join(ROOT, 'engine'), codes)
    scanCodes(join(ROOT, 'app'), codes)
    // 这些不是给玩家看的:要么是内部哨兵,要么由调用方自己处理
    const internal = new Set(['deck-too-small', 'deck-too-large'])
    const missing: string[] = []
    for (const code of codes) {
      if (internal.has(code)) continue
      const text = matchErrorText(code)
      // 兜底分支会原样返回 code —— 那就是「没有映射」
      if (text.zh === code || text.en === code) missing.push(code)
    }
    expect(
      missing.sort(),
      `这些错误码会把内部码原样显示给玩家,请在 errorText.ts 里补上`,
    ).toEqual([])
  })

  it('复合码(带冒号)取前缀也能翻', () => {
    expect(matchErrorText('illegal-deck: 只有 28 张').zh).not.toContain('illegal-deck')
  })

  it('确实不认识的码仍然原样透出(能截图报 bug 好过吞掉)', () => {
    const weird = 'totally-unknown-code-xyz'
    expect(matchErrorText(weird).zh).toBe(weird)
  })
})
