import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  LIGHT_SCOPE,
  PINNED_IN_LIGHT,
  ROOT_SCOPE,
  declaredVars,
  isRampVar,
  usedVars,
} from './paletteScope'

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
  it('色阶名算,**三位数的也算**', () => {
    expect(isRampVar('--brass-42')).toBe(true)
    expect(isRampVar('--ash-99')).toBe(true)
    // 明度撞档时生成器会 bump 到三位。原来的正则只匹配两位,
    // 于是 --brass-100 起那十几个被整道闸门跳过了。
    expect(isRampVar('--brass-100')).toBe(true)
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
  const decls = all.flatMap(({ file, css }) =>
    declaredVars(css)
      .filter((d) => isRampVar(d.name))
      .map((d) => ({ ...d, file })),
  )

  it('色阶变量只出现在**两个**作用域里:暗色 :root 与亮色覆盖', () => {
    const bad = decls
      .filter((d) => d.scope !== ROOT_SCOPE && d.scope !== LIGHT_SCOPE)
      .map((d) => `${d.file}: ${d.name} 定义在 ${d.scope}`)
    // 组件里再覆盖一次的话,「var(--x) 处处解析成同一个值」这条推理就作废了,
    // 而表现是「某一屏的颜色悄悄和别处不一样」—— 不崩不红。
    expect(bad).toEqual([])
  })

  it('每个作用域里每个变量最多一条 —— 同一层写两遍是后一条静默生效', () => {
    for (const scope of [ROOT_SCOPE, LIGHT_SCOPE]) {
      const seen = new Map<string, number>()
      for (const d of decls.filter((x) => x.scope === scope))
        seen.set(d.name, (seen.get(d.name) ?? 0) + 1)
      expect([...seen].filter(([, n]) => n > 1).map(([n]) => `${scope} ${n}`)).toEqual([])
    }
  })

  it('**每个色阶都得有亮色的值** —— 漏一个就是亮色下那一格还是深色', () => {
    // 这是整条亮色主题里最容易静默坏掉的地方:漏写不报错,只是那一处
    // 在浅底上还印着深色底 —— 正是 ROADMAP 30 开头说的「做出一个坏的亮色模式」。
    const dark = new Set(decls.filter((d) => d.scope === ROOT_SCOPE).map((d) => d.name))
    const light = new Set(decls.filter((d) => d.scope === LIGHT_SCOPE).map((d) => d.name))
    const missing = [...dark].filter((n) => !light.has(n) && !PINNED_IN_LIGHT.has(n))
    expect(missing, '这些色阶没有亮色覆盖,也不在「故意钉住」名单里').toEqual([])
  })

  it('「故意钉住」名单里的都确实没有亮色覆盖 —— 名单不能是摆设', () => {
    const light = new Set(decls.filter((d) => d.scope === LIGHT_SCOPE).map((d) => d.name))
    const contradicted = [...PINNED_IN_LIGHT].filter((n) => light.has(n))
    expect(contradicted, '名单说钉住,亮色里却给了覆盖值').toEqual([])
  })

  it('名单里的每一个都真的存在 —— 改了名字而名单没跟上,钉住就落空了', () => {
    const dark = new Set(decls.filter((d) => d.scope === ROOT_SCOPE).map((d) => d.name))
    expect([...PINNED_IN_LIGHT].filter((n) => !dark.has(n))).toEqual([])
  })

  it('用到的色阶变量都定义过 —— 打错一个字母是渲染不出颜色,不是报错', () => {
    const defined = new Set(decls.map((d) => d.name))
    const missing = new Set<string>()
    for (const { css } of all)
      for (const u of usedVars(css)) if (isRampVar(u) && !defined.has(u)) missing.add(u)
    expect([...missing]).toEqual([])
  })

  it('定义了的都用得上 —— 没人用的色阶只是一行待腐烂的数字', () => {
    const used = new Set(all.flatMap(({ css }) => usedVars(css)))
    const dead = decls.filter((d) => d.scope === ROOT_SCOPE && !used.has(d.name)).map((d) => d.name)
    expect([...new Set(dead)]).toEqual([])
  })
})
