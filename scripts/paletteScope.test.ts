import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { declaredVars, isRampVar, usedVars } from './paletteScope'

// 色阶变量的作用域闸门。
//
// 它守的是一句话:**把颜色字面量换成 `var(--brass-42)` 是零视觉变化的**。
// 那句话成立的前提是「变量只在 :root 定义过一次、没有窄作用域覆盖」——
// 这里把前提钉死。前提一破,338 处替换的正确性论证当场作废,
// 而表现是「某一屏的颜色悄悄和别处不一样了」,不崩不红。

// ---------- 判定层:合成样本,两个方向 ----------
describe('declaredVars', () => {
  it('认得出 :root 里的声明', () => {
    expect(declaredVars(':root { --brass-42: #8a6c26; }')).toEqual([
      { name: '--brass-42', scope: ':root' },
    ])
  })

  it('认得出**窄作用域**的覆盖 —— 这正是它要抓的东西', () => {
    const css = ':root { --brass-42: #8a6c26; }\n.panel { --brass-42: #111; }'
    expect(declaredVars(css).map((d) => d.scope)).toEqual([':root', '.panel'])
  })

  it('注释里的假声明不算', () => {
    expect(declaredVars('/* .x { --brass-42: #000; } */ :root { --ash-08: #14100a; }')).toEqual([
      { name: '--ash-08', scope: ':root' },
    ])
  })

  it('嵌套(媒体查询里的 :root)算的是最内层那一层', () => {
    const css = '@media (max-width: 400px) { :root { --ash-08: #000; } }'
    expect(declaredVars(css)).toEqual([{ name: '--ash-08', scope: ':root' }])
  })

  it('普通属性不当成变量', () => {
    expect(declaredVars('.a { color: #fff; }')).toEqual([])
  })
})

describe('isRampVar', () => {
  it('色阶名算', () => {
    expect(isRampVar('--brass-42')).toBe(true)
    expect(isRampVar('--ash-99')).toBe(true)
  })
  it('既有的语义名不算 —— 这道闸门不管它们', () => {
    expect(isRampVar('--gold-mid')).toBe(false)
    expect(isRampVar('--parchment-dim')).toBe(false)
    expect(isRampVar('--brass-mid')).toBe(false)
  })
})

describe('usedVars', () => {
  it('取得到引用,连带空格写法', () => {
    expect(usedVars('a { color: var(--brass-42); background: var( --ash-08 ); }')).toEqual([
      '--brass-42',
      '--ash-08',
    ])
  })
})

// ---------- 真数据 ----------
const files: string[] = []
const walk = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) walk(p)
    else if (p.endsWith('.css')) files.push(p)
  }
}
walk('src')

const all = files.map((f) => ({ file: f, css: readFileSync(f, 'utf8') }))

describe('色阶变量 · 全站', () => {
  it('每个色阶变量**只定义一次,且在 :root** —— 零视觉变化那句话的前提', () => {
    const bad: string[] = []
    const count = new Map<string, number>()
    for (const { file, css } of all) {
      for (const d of declaredVars(css)) {
        if (!isRampVar(d.name)) continue
        count.set(d.name, (count.get(d.name) ?? 0) + 1)
        if (d.scope !== ':root') bad.push(`${file}: ${d.name} 定义在 ${d.scope}`)
      }
    }
    expect(bad, '色阶变量被窄作用域覆盖了').toEqual([])
    const dup = [...count].filter(([, n]) => n > 1).map(([n]) => n)
    expect(dup, '色阶变量定义了不止一次').toEqual([])
  })

  it('用到的色阶变量都定义过 —— 打错一个字母是渲染不出颜色,不是报错', () => {
    const defined = new Set(
      all.flatMap(({ css }) => declaredVars(css).map((d) => d.name)).filter(isRampVar),
    )
    const missing = new Set<string>()
    for (const { css } of all)
      for (const u of usedVars(css)) if (isRampVar(u) && !defined.has(u)) missing.add(u)
    expect([...missing]).toEqual([])
  })

  it('定义了的都用得上 —— 没人用的色阶只是一行待腐烂的数字', () => {
    const used = new Set(all.flatMap(({ css }) => usedVars(css)))
    const dead = all
      .flatMap(({ css }) => declaredVars(css).map((d) => d.name))
      .filter((n) => isRampVar(n) && !used.has(n))
    expect([...new Set(dead)]).toEqual([])
  })
})
