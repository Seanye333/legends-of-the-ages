import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// 会打包进浏览器的代码里,不许出现 node 专有的全局。
//
// 【为什么需要机器来查:这一条能穿过所有现有闸门】
// 2026-08 我在 src/ai/greedy.ts 的 AI_NORMAL 里写了
// `process.env.RULER === 'legacy' ? 0 : 0.35`,想留一个新旧尺子的对照开关。
//   · tsc 过了 —— @types/node 在,process 是合法标识符
//   · 980 个单测过了 —— **vitest 跑在 node 里,那里真的有 process**
//   · lint 过了、构建过了、首屏预算过了
// 而真实浏览器里模块求值那一刻就抛 `process is not defined`,
// 标题页一个按钮都渲染不出来 —— 整个应用打不开。
// 最后是 e2e 抓到的(而且报的是「找不到某个按钮」,离根因很远)。
//
// 也就是说:**在 node 环境里测浏览器代码,天然测不出这一类问题。**
// 所以这里不跑代码,直接扫源码。
//
// 【为什么盯的是这几个】
// process / __dirname / require / Buffer —— node 独有,浏览器里一律是 ReferenceError,
// 而且都是「写的时候顺手、tsc 不拦」的那种。global 不查:它在某些打包配置下有别名。
const ROOT = join(new URL('.', import.meta.url).pathname, '..')

// 只扫会进浏览器包的目录。scripts/ 和 server/ 不在此列(它们本来就跑在别处)
const SHIPPED = ['engine', 'ai', 'app', 'ui', 'content']

const BANNED: Array<[RegExp, string]> = [
  [/\bprocess\s*\.\s*env\b/, 'process.env'],
  [/\bprocess\s*\.\s*(argv|cwd|exit|platform)\b/, 'process.*'],
  [/\b__dirname\b/, '__dirname'],
  [/\b__filename\b/, '__filename'],
  [/\bBuffer\s*\.\s*from\b/, 'Buffer.from'],
  [/(?<!\/\/.*)\brequire\s*\(/, 'require()'],
]

function walk(dir: string, out: string[]): void {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules') continue
      walk(p, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(name)) continue
    // 测试文件本来就只跑在 node 里
    if (/\.test\.(ts|tsx)$/.test(name)) continue
    out.push(p)
  }
}

describe('浏览器代码里不许有 node 全局', () => {
  it('src/{engine,ai,app,ui,content} 一律干净', () => {
    const files: string[] = []
    for (const d of SHIPPED) walk(join(ROOT, d), files)
    expect(files.length, '一个文件都没扫到,说明路径写错了').toBeGreaterThan(50)

    const hits: string[] = []
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      const lines = src.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // 注释里提到这些词是允许的(比如这道闸门自己的说明)
        const code = line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')
        for (const [re, label] of BANNED) {
          if (re.test(code)) {
            hits.push(`${f.slice(ROOT.length + 1)}:${i + 1} 用了 ${label}`)
          }
        }
      }
    }
    expect(
      hits,
      '这些会在浏览器里抛 ReferenceError,而 tsc 与 vitest(跑在 node 里)都发现不了',
    ).toEqual([])
  })

  it('import.meta.env 是允许的 —— 那是 Vite 注入的,不是 node', () => {
    // 反面样例:确认闸门不会误伤正当写法(protocol.ts 就是这么读构建期变量的)
    const src = "const v = (import.meta as unknown as { env?: Record<string, string> }).env"
    for (const [re] of BANNED) expect(re.test(src)).toBe(false)
  })
})
