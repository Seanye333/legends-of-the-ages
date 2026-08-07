// cssDupes 的自检 —— 每条判据两个方向各验一遍。
//
// 和 deadCss 同一个理由:**一把会误报的尺子比没有尺子更危险**。
// 这份报告要是把布局规则、状态规则、已经接上基件的规则也算进去,
// 分布图就会变成噪声,读两次之后没人再读 —— 那时候真正的漂移也跟着被无视了。
import { describe, expect, it } from 'vitest'
import { attrSpans, buttonClasses, driftReport, exactDupes, isSurface, rulesIn, shapeOf } from './cssDupes'

describe('attrSpans', () => {
  it('取出属性文本', () => {
    expect(attrSpans('<button className={s.a}>x</button>', 'button')).toEqual([' className={s.a}'])
  })

  it('箭头函数里的 > 不算标签结束 —— 这是不能用 [^>]* 的原因', () => {
    const src = '<button onClick={() => go()} className={s.a}>x</button>'
    expect(attrSpans(src, 'button')[0]).toContain('s.a')
  })

  it('比较运算符也不算', () => {
    const src = '<button disabled={n > 3} className={s.a}>x</button>'
    expect(attrSpans(src, 'button')[0]).toContain('s.a')
  })

  it('跨行也取得到', () => {
    const src = '<button\n  onClick={() => go()}\n  className={s.a}\n>x</button>'
    expect(attrSpans(src, 'button')[0]).toContain('s.a')
  })

  it('多个标签各取一段', () => {
    expect(attrSpans('<button a>1</button><button b>2</button>', 'button')).toHaveLength(2)
  })

  it('别的标签不取', () => {
    expect(attrSpans('<div className={s.a}>x</div>', 'button')).toEqual([])
  })
})

describe('buttonClasses', () => {
  it('认出挂在 button 上的类', () => {
    expect([...buttonClasses('<button className={styles.go}>x</button>', 'styles')]).toEqual(['go'])
  })

  it('模板串里的多个类都认', () => {
    const src = '<button className={`${styles.a} ${on ? styles.b : styles.c}`}>x</button>'
    expect([...buttonClasses(src, 'styles')].sort()).toEqual(['a', 'b', 'c'])
  })

  it('方括号取用也认', () => {
    expect([...buttonClasses(`<button className={styles['go']}>x</button>`, 'styles')]).toEqual(['go'])
  })

  it('挂在 div 上的不算 —— 卡片和格子不是按钮', () => {
    expect(buttonClasses('<div className={styles.heroCard}>x</div>', 'styles').size).toBe(0)
  })

  it('写在标签体里(不是属性里)的不算', () => {
    expect(buttonClasses('<button>{styles.notAClassName}</button>', 'styles').size).toBe(0)
  })

  it('变量名不叫 styles 时按传进来的认', () => {
    expect([...buttonClasses('<button className={s.go}>x</button>', 's')]).toEqual(['go'])
  })
})

describe('rulesIn', () => {
  it('抽出裸类规则,声明按属性名排好序', () => {
    const rules = rulesIn('.a { color: red; background: blue }', 'x.css')
    expect(rules).toHaveLength(1)
    expect(rules[0].selector).toBe('.a')
    expect(rules[0].decls).toEqual([
      ['background', 'blue'],
      ['color', 'red'],
    ])
  })

  it('逗号选择器保留成一条', () => {
    expect(rulesIn('.a, .b { color: red }', 'x.css')[0].selector).toBe('.a, .b')
  })

  it('带伪类的不算 —— 那是状态不是长相', () => {
    expect(rulesIn('.a:hover { color: red }', 'x.css')).toEqual([])
  })

  it('后代选择器不算', () => {
    expect(rulesIn('.a .b { color: red }', 'x.css')).toEqual([])
  })

  it('属性选择器不算', () => {
    expect(rulesIn(".a input[type='checkbox'] { color: red }", 'x.css')).toEqual([])
  })

  it('注释里的规则不算', () => {
    expect(rulesIn('/* .a { color: red } */', 'x.css')).toEqual([])
  })

  it('值里的多余空白折成一格 —— 否则同一个值会被当成两种写法', () => {
    const a = rulesIn('.a { border: 1px  solid   red }', 'x.css')[0]
    const b = rulesIn('.b {\n  border: 1px solid red;\n}', 'y.css')[0]
    expect(a.decls).toEqual(b.decls)
  })

  it('composes 记成标记,不当成一条声明', () => {
    const r = rulesIn(`.a { composes: k from './k.module.css'; color: red }`, 'x.css')[0]
    expect(r.composed).toBe(true)
    expect(r.decls).toEqual([['color', 'red']])
  })

  it('没有 composes 时 composed 是 false', () => {
    expect(rulesIn('.a { color: red }', 'x.css')[0].composed).toBe(false)
  })

  it('空规则不产出', () => {
    expect(rulesIn('.a { }', 'x.css')).toEqual([])
  })

  it('**只引不改**的规则要留下 —— 它是「已接上基件」的证据', () => {
    // 丢掉它,「已 composes 基件 N 条」会小得离谱:
    // 十六个屏的 `.backBtn { composes: backBtn }` 会全部消失
    const r = rulesIn(`.backBtn { composes: backBtn from '../uiKit.module.css'; }`, 'x.css')
    expect(r).toHaveLength(1)
    expect(r[0].composed).toBe(true)
    expect(r[0].decls).toEqual([])
  })

  it('只引不改的规则不会被当成可点的面', () => {
    const r = rulesIn(`.backBtn { composes: backBtn from '../uiKit.module.css'; }`, 'x.css')[0]
    expect(isSurface(r)).toBe(false)
  })

  it('媒体查询里的规则照样抽得到', () => {
    const rules = rulesIn('@media (max-width: 400px) { .a { color: red } }', 'x.css')
    expect(rules.map((r) => r.selector)).toEqual(['.a'])
  })
})

const SURFACE = rulesIn(
  '.chip { cursor: pointer; border: 1px solid gold; background: black; color: tan; border-radius: 999px }',
  'a.css',
)[0]

describe('isSurface', () => {
  it('可点 + 三样长相属性 —— 算', () => {
    expect(isSurface(SURFACE)).toBe(true)
  })

  it('没有 cursor:pointer —— 不算(那是徽章不是按钮)', () => {
    const r = rulesIn('.badge { border: 1px solid gold; background: black; color: tan }', 'a.css')[0]
    expect(isSurface(r)).toBe(false)
  })

  it('可点但只有布局属性 —— 不算', () => {
    const r = rulesIn('.row { cursor: pointer; display: flex; gap: 8px; padding: 4px }', 'a.css')[0]
    expect(isSurface(r)).toBe(false)
  })

  it('长相属性只有两样 —— 不算', () => {
    const r = rulesIn('.x { cursor: pointer; color: tan; background: black }', 'a.css')[0]
    expect(isSurface(r)).toBe(false)
  })
})

describe('shapeOf', () => {
  it('999px 是胶囊', () => {
    expect(shapeOf(SURFACE)).toBe('pill')
  })

  it('var(--r-pill) 也是胶囊 —— 同一个值的两种写法不该分成两档', () => {
    const r = rulesIn('.x { cursor: pointer; border-radius: var(--r-pill) }', 'a.css')[0]
    expect(shapeOf(r)).toBe('pill')
  })

  it('别的圆角是方角档', () => {
    const r = rulesIn('.x { cursor: pointer; border-radius: 8px }', 'a.css')[0]
    expect(shapeOf(r)).toBe('boxy')
  })

  it('没写圆角也归方角档', () => {
    expect(shapeOf(rulesIn('.x { cursor: pointer }', 'a.css')[0])).toBe('boxy')
  })
})

describe('exactDupes', () => {
  const BODY = '{ border: 1px solid gold; background: black; color: tan; border-radius: 999px }'

  it('跨文件的完全相同规则会被归到一组', () => {
    const rules = [
      ...rulesIn(`.knob ${BODY}`, 'a.css'),
      ...rulesIn(`.chip ${BODY}`, 'b.css'),
      ...rulesIn(`.tab ${BODY}`, 'c.css'),
    ]
    const groups = exactDupes(rules)
    expect(groups).toHaveLength(1)
    expect(groups[0].where.map((w) => w.file)).toEqual(['a.css', 'b.css', 'c.css'])
  })

  it('只在一份文件里重复 —— 不报(同一屏的一组变体是有意的)', () => {
    const rules = rulesIn(`.a ${BODY} .b ${BODY}`, 'a.css')
    expect(exactDupes(rules)).toEqual([])
  })

  it('差一条声明就不是完全相同', () => {
    const rules = [
      ...rulesIn(`.a ${BODY}`, 'a.css'),
      ...rulesIn('.b { border: 1px solid gold; background: black; color: tan }', 'b.css'),
    ]
    expect(exactDupes(rules)).toEqual([])
  })

  it('声明太少的不报 —— 两三条相同纯属巧合', () => {
    const rules = [
      ...rulesIn('.a { color: red; background: black }', 'a.css'),
      ...rulesIn('.b { color: red; background: black }', 'b.css'),
    ]
    expect(exactDupes(rules, 4)).toEqual([])
    expect(exactDupes(rules, 2)).toHaveLength(1)
  })

  it('重复得最多的排最前', () => {
    const OTHER = '{ border: 2px solid red; background: white; color: black; padding: 1px }'
    const rules = [
      ...rulesIn(`.a ${BODY}`, 'a.css'),
      ...rulesIn(`.b ${BODY}`, 'b.css'),
      ...rulesIn(`.c ${BODY}`, 'c.css'),
      ...rulesIn(`.d ${OTHER}`, 'd.css'),
      ...rulesIn(`.e ${OTHER}`, 'e.css'),
    ]
    expect(exactDupes(rules).map((g) => g.where.length)).toEqual([3, 2])
  })
})

describe('driftReport', () => {
  const rules = [
    ...rulesIn('.a { cursor: pointer; border-radius: 999px; padding: 4px; color: tan }', 'a.css'),
    ...rulesIn('.b { cursor: pointer; border-radius: 999px; padding: 5px; color: tan }', 'b.css'),
    ...rulesIn('.c { cursor: pointer; border-radius: 999px; padding: 6px }', 'c.css'),
    ...rulesIn('.d { cursor: pointer; border-radius: 8px; padding: 9px }', 'd.css'),
  ]

  it('只看同一档形制', () => {
    expect(driftReport(rules, 'pill').members.map((m) => m.selector)).toEqual(['.a', '.b', '.c'])
    expect(driftReport(rules, 'boxy').members.map((m) => m.selector)).toEqual(['.d'])
  })

  it('写法种数最多的属性排最前', () => {
    const r = driftReport(rules, 'pill')
    expect(r.spread[0].prop).toBe('padding')
    expect(r.spread[0].values.map((v) => v.value)).toEqual(['4px', '5px', '6px'])
  })

  it('「没写」单列 —— 这才看得见「九处里只有一处写了」那种发现', () => {
    const color = driftReport(rules, 'pill').spread.find((s) => s.prop === 'color')!
    expect(color.values).toHaveLength(1)
    expect(color.missing.map((w) => w.selector)).toEqual(['.c'])
  })

  it('一个人都没写的属性不出现在报告里', () => {
    expect(driftReport(rules, 'pill').spread.some((s) => s.prop === 'box-shadow')).toBe(false)
  })

  it('同一个值用得多的排前面', () => {
    const c = driftReport(rules, 'pill').spread.find((s) => s.prop === 'border-radius')!
    expect(c.values[0].who).toHaveLength(3)
  })
})
