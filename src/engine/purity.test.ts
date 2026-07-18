import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// 引擎纯度守卫:除 ESLint 围栏外的第二道防线。
// 引擎源码里出现任何非确定性来源或外部依赖,直接测试失败。
const ENGINE_DIR = dirname(fileURLToPath(import.meta.url))

const FORBIDDEN = [
  'Math.random',
  'Date.now',
  'new Date',
  'performance.',
  'setTimeout',
  'setInterval',
  'crypto.',
  "from 'react",
  "from 'zustand",
]

describe('engine purity', () => {
  const sources = readdirSync(ENGINE_DIR).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.test.ts'),
  )

  it('has engine source files', () => {
    expect(sources.length).toBeGreaterThan(0)
  })

  for (const file of sources) {
    it(`${file} is deterministic and dependency-free`, () => {
      const text = readFileSync(join(ENGINE_DIR, file), 'utf8')
      for (const token of FORBIDDEN) {
        expect(text.includes(token), `${file} must not contain "${token}"`).toBe(false)
      }
      // 只允许引擎内部相对导入
      for (const line of text.split('\n')) {
        const m = line.match(/from\s+'([^']+)'/)
        if (m) {
          expect(m[1].startsWith('./'), `${file} imports outside engine: ${m[1]}`).toBe(true)
        }
      }
    })
  }
})
