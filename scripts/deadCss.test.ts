import { describe, expect, it } from 'vitest'
import {
  classesIn,
  composesOf,
  hasDynamicAccess,
  importIdentFor,
  judgeModule,
  usedIn,
} from './deadCss'

describe('classesIn', () => {
  it('抽出类名,去重排序', () => {
    expect(classesIn('.b{}.a{}.b:hover{}')).toEqual(['a', 'b'])
  })

  it('不把数值当类名', () => {
    // `transition: all 0.5s` 里的 `.5s`、`1.2em` 都会被 `\.\w+` 命中。
    // 类名不能以数字开头,靠这条规则挡掉。
    const css = '.card{transition:all 0.5s ease;margin:1.2em;opacity:.75}'
    expect(classesIn(css)).toEqual(['card'])
  })

  it(':global(...) 里的类名不算这个模块的', () => {
    // 那些是给别人用的,在本模块的 tsx 里当然找不到 —— 不挖掉就是稳定误报。
    expect(classesIn('.mine{}:global(.theirs){}:global( .other .deep ){}')).toEqual(['mine'])
  })

  it('认得带连字符和下划线的类名', () => {
    expect(classesIn('.a-b{}._c{}.-d{}')).toEqual(['-d', '_c', 'a-b'])
  })

  it('url() 里的文件后缀不是类名', () => {
    // 第一版报出来的「死样式」有一半是这个:webp / plist / png 整整齐齐排在清单上,
    // 长得跟真结果一模一样。
    expect(classesIn('.bg{background:url(/art/foo.webp) no-repeat}')).toEqual(['bg'])
    expect(classesIn('.a{background:url("/x/y.png")}')).toEqual(['a'])
  })

  it('composes 的路径不是类名', () => {
    // `composes: x from './y.module.css'` 会贡献 `.module` 和 `.css` 两个假类名。
    expect(classesIn(`.a{composes: base from './Shared.module.css'}`)).toEqual(['a'])
  })

  it('引号里和注释里的东西不算定义', () => {
    expect(classesIn(`.a{content:"."}`)).toEqual(['a'])
    expect(classesIn(`/* .oldName 删掉了 */ .a{}`)).toEqual(['a'])
  })
})

describe('usedIn', () => {
  it('点取用和字符串下标都算', () => {
    const src = `<div className={styles.head}/>; s2 = styles['foot']; x = styles["mid"]`
    expect([...usedIn(src, 'styles')].sort()).toEqual(['foot', 'head', 'mid'])
  })

  it('认标识符名,不是写死的 styles', () => {
    // 有人写 import s from './x.module.css'
    expect([...usedIn('s.head', 's')]).toEqual(['head'])
    expect([...usedIn('s.head', 'styles')]).toEqual([])
  })

  it('不被别的以 styles 结尾的变量骗到', () => {
    // \b 边界必须在前面 —— 否则 myStyles.foo 会被算成 styles.foo
    expect([...usedIn('myStyles.foo', 'styles')]).toEqual([])
  })
})

describe('hasDynamicAccess', () => {
  it('模板串、变量、函数调用都算动态', () => {
    expect(hasDynamicAccess('styles[`tier${n}`]', 'styles')).toBe(true)
    expect(hasDynamicAccess('styles[key]', 'styles')).toBe(true)
    expect(hasDynamicAccess('styles[fn(x)]', 'styles')).toBe(true)
  })

  it('字符串字面量下标不算动态', () => {
    expect(hasDynamicAccess(`styles['head']`, 'styles')).toBe(false)
    expect(hasDynamicAccess('styles["head"]', 'styles')).toBe(false)
    expect(hasDynamicAccess('styles.head', 'styles')).toBe(false)
  })
})

describe('importIdentFor', () => {
  it('取出 import 的标识符', () => {
    expect(importIdentFor(`import styles from './Foo.module.css'`, 'Foo.module.css')).toBe('styles')
    expect(importIdentFor(`import s from "../x/Foo.module.css"`, 'Foo.module.css')).toBe('s')
  })

  it('没引这个模块就返回 null', () => {
    expect(importIdentFor(`import styles from './Bar.module.css'`, 'Foo.module.css')).toBe(null)
  })
})

describe('composesOf', () => {
  it('取出 composes 引走的类名', () => {
    const css = `.a{composes: head from '../uiKit.module.css'}`
    expect(composesOf(css, 'uiKit.module.css')).toEqual(['head'])
  })

  it('一行引多个', () => {
    const css = `.a{composes: head title backBtn from '../uiKit.module.css'}`
    expect(composesOf(css, 'uiKit.module.css')).toEqual(['head', 'title', 'backBtn'])
    expect(composesOf(`.a{composes: x, y from './k.module.css'}`, 'k.module.css')).toEqual(['x', 'y'])
  })

  it('只认指定的那个模块', () => {
    const css = `.a{composes: head from '../uiKit.module.css'}.b{composes: foot from './Other.module.css'}`
    expect(composesOf(css, 'uiKit.module.css')).toEqual(['head'])
    expect(composesOf(css, 'Other.module.css')).toEqual(['foot'])
  })

  it('没有 composes 就是空', () => {
    expect(composesOf('.a{color:red}', 'uiKit.module.css')).toEqual([])
  })
})

describe('judgeModule', () => {
  const css = '.head{}.body{}.foot{}'

  it('报出定义了但没人用的', () => {
    const r = judgeModule('x.css', css, [{ src: 'styles.head; styles.body', ident: 'styles' }])
    expect(r.dead).toEqual(['foot'])
    expect(r.total).toBe(3)
  })

  it('多个使用方合并算 —— 任意一个用到就不算死', () => {
    // 同一份 module.css 被两个组件共用是允许的。只看单个文件会把另一半全报成死的。
    const r = judgeModule('x.css', css, [
      { src: 'styles.head', ident: 'styles' },
      { src: 'styles.body; styles.foot', ident: 'styles' },
    ])
    expect(r.dead).toEqual([])
  })

  it('有动态取用就整个模块跳过,而不是照报不误', () => {
    // 一个会误报的清单读两次就没人读了,那时候真正的死样式也跟着被无视。
    const r = judgeModule('x.css', css, [{ src: 'styles[`t${n}`]', ident: 'styles' }])
    expect(r.skipped).toBe(true)
    expect(r.dead).toEqual([])
  })

  it('一个使用方动态取用,别的静态取用 —— 仍然整个跳过', () => {
    const r = judgeModule('x.css', css, [
      { src: 'styles.head', ident: 'styles' },
      { src: 'styles[k]', ident: 'styles' },
    ])
    expect(r.skipped).toBe(true)
  })

  it('没有任何人引它 = 整个文件是死的', () => {
    const r = judgeModule('x.css', css, [])
    expect(r.orphan).toBe(true)
    expect(r.dead).toEqual(['body', 'foot', 'head'])
  })

  it('只被别的 CSS composes 引走的模块不算孤儿', () => {
    // 第一版把 ui/uiKit.module.css 报成「整个文件都是死的」——
    // 它其实是全站共用的基件,十六个屏 composes 引它,只是没有一个 tsx 直接 import。
    // 照那份清单删下去会当场删掉标题栏和三个按钮变体。
    const r = judgeModule('uiKit.css', css, [], ['head', 'body'])
    expect(r.orphan).toBe(false)
    expect(r.dead).toEqual(['foot'])
  })

  it('全用上了就一条都不报', () => {
    const r = judgeModule('x.css', css, [{ src: 'styles.head styles.body styles.foot', ident: 'styles' }])
    expect(r.dead).toEqual([])
    expect(r.skipped).toBe(false)
    expect(r.orphan).toBe(false)
  })
})
