// 死样式检测的判定层 —— 纯函数,不碰文件系统(运行器在 scripts/dead-css.ts)。
//
// 【为什么这件事在这个仓库里做得成】
// 一般项目的死 CSS 检测很不靠谱:全局样式表加上运行时拼出来的类名,
// 静态扫描只能瞎猜,于是要么漏报要么一堆误报,最后没人看。
// 这个仓库全用 CSS Modules(`styles.foo`),类名是**被当成属性名取用的** ——
// 静态就能对上号。所以这里的判定可以做得很确定。
//
// 【唯一会骗到它的写法:动态取用】
//   styles[`tier${n}`]   styles[key]   clsx(styles[variant])
// 这时候类名根本不在源码里出现。**遇到就整个模块跳过,而不是照报不误** ——
// 一个会误报的清单读两次就没人读了,那时候真正的死样式也跟着被无视。
// 跳过的模块会单独列出来,让人知道这里有个盲区,而不是假装扫过了。

/**
 * 从一份 CSS Modules 文件里抽出定义过的类名。
 *
 * 【这里踩过的坑 —— 第一版报出来的「死样式」有一半是文件后缀】
 * `url(/art/foo.webp)` 里的 `.webp`、`composes: x from './y.module.css'` 里的
 * `.module` 和 `.css`,统统被当成了类名。它们当然「没人取用」,于是稳定误报,
 * 而且长得跟真结果一模一样。所以**先把字符串和 url() 挖掉,再找类名**。
 */
export function classesIn(css: string): string[] {
  const scoped = css
    // 注释先挖 —— 注释里写着的旧类名不算定义
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    // url(...) 里是路径不是选择器
    .replace(/url\s*\([^)]*\)/gi, ' ')
    // 引号里的东西一律不是选择器:composes 的路径、content: "." 、字体名……
    .replace(/'[^']*'|"[^"]*"/g, ' ')
    // :global(...) 整段挖掉 —— 那里面的类名不归这个模块管,
    // 它们是给别人用的,在本模块的 tsx 里当然找不到。
    .replace(/:global\s*\([^)]*\)/g, ' ')
  const out = new Set<string>()
  // 类名不能以数字开头,这条规则正好挡掉 `0.5s`、`1.2em` 里的小数。
  for (const m of scoped.matchAll(/\.(-?[A-Za-z_][\w-]*)/g)) out.add(m[1])
  return [...out].sort()
}

/**
 * 源码里静态取用到的类名 —— `styles.foo` / `styles['foo']` / `styles["foo"]`。
 * 变量名不一定叫 styles(有人写 `import s from './x.module.css'`),所以传进来。
 */
export function usedIn(src: string, ident: string): Set<string> {
  const out = new Set<string>()
  const esc = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const m of src.matchAll(new RegExp(`\\b${esc}\\.([A-Za-z_][\\w$]*)`, 'g'))) out.add(m[1])
  for (const m of src.matchAll(new RegExp(`\\b${esc}\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g'))) {
    out.add(m[1])
  }
  return out
}

/**
 * 源码里有没有**动态**取用这个模块的类名。
 * 有的话这个模块整个不做判断 —— 见文件头。
 */
export function hasDynamicAccess(src: string, ident: string): boolean {
  const esc = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // `styles[` 后面不是引号字面量的,一律算动态:模板串、变量、三元、函数调用……
  return new RegExp(`\\b${esc}\\[\\s*(?!['"])`).test(src)
}

/**
 * 从 `import styles from './Foo.module.css'` 里取出那个标识符。
 * 没 import 这个模块就返回 null。
 */
export function importIdentFor(src: string, moduleFile: string): string | null {
  const esc = moduleFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const m = src.match(new RegExp(`import\\s+(\\w+)\\s+from\\s+['"][^'"]*${esc}['"]`))
  return m ? m[1] : null
}

/**
 * 另一份 CSS 通过 `composes: a, b from './Foo.module.css'` 取用了哪些类名。
 *
 * 【这条是补上一个真 bug 的】
 * 第一版只认 tsx 里的 `styles.foo`,于是 `ui/uiKit.module.css` 被判成
 * 「没有任何源码 import —— 整个文件都是死的」。**它其实是全站共用的基件**,
 * 十六个屏通过 composes 引它,只是没有一个 tsx 直接 import。
 * 照那份清单删下去会当场删掉标题栏和三个按钮变体。
 * 一把会把共用文件报成死文件的尺子,比没有尺子更危险。
 */
export function composesOf(css: string, moduleFile: string): string[] {
  const esc = moduleFile.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const out: string[] = []
  const re = new RegExp(`composes\\s*:\\s*([^;{}]+?)\\s+from\\s+['"][^'"]*${esc}['"]`, 'g')
  for (const m of css.matchAll(re)) {
    for (const name of m[1].split(/[\s,]+/)) if (name) out.push(name)
  }
  return out
}

export interface ModuleReport {
  /** css 文件路径 */
  file: string
  /** 定义了但没人取用的类名 */
  dead: string[]
  /** 定义的类名总数 */
  total: number
  /** 有动态取用,整个模块跳过判断 */
  skipped: boolean
  /** 没有任何 tsx 引入这个模块 —— 整个文件都是死的 */
  orphan: boolean
}

/**
 * 判定一个模块。`consumers` 是所有 import 了它的源码文件内容。
 *
 * 注意 consumers 可能不止一个:同一份 module.css 被两个组件共用是允许的,
 * 只要**任意一个**用到了,这个类名就不算死。
 */
export function judgeModule(
  file: string,
  css: string,
  consumers: { src: string; ident: string }[],
  /** 别的 CSS 通过 composes 引走的类名 —— 那也算被取用 */
  composed: string[] = [],
): ModuleReport {
  const defined = classesIn(css)
  // composes 引它也算有人用 —— uiKit 那种「全站基件、没有一个 tsx 直接 import」
  // 的文件正是这么活着的。
  if (consumers.length === 0 && composed.length === 0) {
    return { file, dead: defined, total: defined.length, skipped: false, orphan: true }
  }
  if (consumers.some((c) => hasDynamicAccess(c.src, c.ident))) {
    return { file, dead: [], total: defined.length, skipped: true, orphan: false }
  }
  const used = new Set<string>(composed)
  for (const c of consumers) for (const u of usedIn(c.src, c.ident)) used.add(u)
  return {
    file,
    dead: defined.filter((k) => !used.has(k)),
    total: defined.length,
    skipped: false,
    orphan: false,
  }
}
