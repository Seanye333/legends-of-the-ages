import { describe, expect, it } from 'vitest'
import { colorsIn, isOpaque, judgeFile, rank } from './themeAudit'

// 主题就绪度判定层的自检。**两个方向都验**(铁律 11)。
//
// 这把尺子最容易烂的方式是「把 1,889 处全报成债」——
// 那样它给出的结论就是「这事不可能做」,而那个结论是错的:
// 里面绝大多数是半透明叠加,换主题照样成立。
// 所以下面一半的用例在钉**什么不该被报出来**。

describe('不透明判定', () => {
  it('六位与三位十六进制是不透明的', () => {
    expect(isOpaque('#fff')).toBe(true)
    expect(isOpaque('#1d1913')).toBe(true)
  })

  it('带 alpha 的十六进制:满格才算不透明', () => {
    expect(isOpaque('#1d191380')).toBe(false)
    expect(isOpaque('#1d1913ff')).toBe(true)
    expect(isOpaque('#fff8')).toBe(false)
    expect(isOpaque('#ffff')).toBe(true)
  })

  it('rgba 看第四个数,rgb 一律不透明', () => {
    expect(isOpaque('rgba(0, 0, 0, 0.4)')).toBe(false)
    expect(isOpaque('rgba(0, 0, 0, 1)')).toBe(true)
    expect(isOpaque('rgb(12, 10, 7)')).toBe(true)
  })

  it('百分号写法也认得', () => {
    expect(isOpaque('hsla(40, 30%, 20%, 50%)')).toBe(false)
    expect(isOpaque('hsla(40, 30%, 20%, 100%)')).toBe(true)
  })

  it('**看不出透明度时当成不透明** —— 判据刻意保守,宁可多报一条债', () => {
    expect(isOpaque('rgba(var(--x))')).toBe(true)
  })
})

describe('扫描', () => {
  it('只有不透明的 color / background 算 blocking', () => {
    const hits = colorsIn(`
      .a { color: #e8dfc8; background: #14110c; }
      .b { box-shadow: 0 0 6px rgba(0, 0, 0, 0.5); border-color: #7a5a1e; }
      .c { background: rgba(60, 45, 20, 0.35); }
    `)
    expect(hits.filter((h) => h.blocking).map((h) => h.value)).toEqual(['#e8dfc8', '#14110c'])
  })

  it('**border-color 不算债** —— 描边在深浅两种底上都还是描边', () => {
    const r = judgeFile('x.css', '.a { border-color: #7a5a1e; }')
    expect(r.blocking).toBe(0)
    expect(r.soft).toBe(1)
  })

  it('**变量不算** —— 用了 var() 的地方正是已经还完的那些', () => {
    const r = judgeFile('x.css', '.a { color: var(--parchment); background: var(--ink-1); }')
    expect(r.blocking).toBe(0)
    expect(r.soft).toBe(0)
  })

  it('注释里的旧配色不算 —— 这是 deadCss 踩过的同一个坑', () => {
    const r = judgeFile('x.css', '/* 旧版是 color: #ff0000 */ .a { color: var(--gold); }')
    expect(r.blocking).toBe(0)
  })

  it('url() 里的十六进制串不算', () => {
    const r = judgeFile('x.css', '.a { background: url(/art/ab12cd34.webp) no-repeat; }')
    expect(r.blocking).toBe(0)
  })

  it('一条声明里多个颜色都数得到(渐变)', () => {
    const r = judgeFile('x.css', '.a { background: linear-gradient(#111111, #222222); }')
    expect(r.blocking).toBe(2)
  })

  it('**渐变里的半透明不算债** —— 它压在什么底上都成立', () => {
    const r = judgeFile(
      'x.css',
      '.a { background: linear-gradient(rgba(70,52,22,0.5), rgba(40,30,14,0.28)); }',
    )
    expect(r.blocking).toBe(0)
    expect(r.soft).toBe(2)
  })
})

describe('排序', () => {
  it('欠得最多的排前面,没欠的不进清单 —— 这是待办不是体检表', () => {
    const rs = [
      judgeFile('a.css', '.x { color: #111; }'),
      judgeFile('b.css', '.x { color: #111; background: #222; }'),
      judgeFile('c.css', '.x { color: var(--gold); }'),
    ]
    expect(rank(rs).map((r) => r.file)).toEqual(['b.css', 'a.css'])
  })
})
