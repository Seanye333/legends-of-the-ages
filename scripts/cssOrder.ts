// CSS Modules `composes` 的**层叠顺序闸门** —— 纯函数,不碰文件系统
//(运行器在 scripts/check-css-order.ts)。
//
// 【它守的是什么】
// `composes: btnGhost from '../uiKit.module.css'` 在产物里**不是继承**,
// 而是给元素挂上两个**平级**的类:
//
//   class="_btnGhost_zedng_87 _plainBtn_o3bay_293"
//
// 两者特异度完全相同(都是单个类选择器),所以同一个属性谁赢,
// **只看它们在样式表里谁写在后面**。
//
// 于是「各屏 composes 公共基件、再覆盖自己那两三条」这套写法,
// 整个建立在「打包器把 uiKit 的规则排在使用方前面」这一件事上。
// 今天它确实是这么排的 —— 我去 dist 里逐块量过,十三个含 uiKit 的 chunk
// 里使用方都在后面(LoreScreen 那块 uiKit 甚至排在 7718 字节处,
// 但它自己的规则仍在其后)。**可是没有任何东西守着这件事。**
//
// 【为什么值得单独装一道闸门】
// 顺序翻过来的后果是:覆盖**全部静默失效**,按钮变回基件的尺寸。
// 不报错、不崩、控制台干净 —— 只是十几个屏上的按钮悄悄变大了。
// 这正是本仓库列为最贵的一类 bug。而触发它不需要谁写错代码:
// 换个打包器版本、动一下 manualChunks、把某个屏改成同步 import,都可能。
//
// 而且这个风险**是随改动增长的**:在只 composes 不覆盖的时候(今天的
// `.backBtn { composes: backBtn }`),顺序错了也没有可见后果;
// 一旦开始「引过来再改 padding」,每一条覆盖都变成一个隐雷。
//
// 【怎么认出「哪一段是哪个模块」】
// 产物里的类名是 `_<local>_<hash>_<n>`,hash 按源文件走。
// 所以先把 chunk 里的类名按 hash 归堆,再拿每堆的名字集合去和源文件
// 声明的名字集合比对:**某个 hash 的名字全都出自某个源文件**,就认它。
// 认不出、或者同时像两个文件 —— 一律**报出来**,不猜。
// (perf-budget 的教训:认不出目标时只 warn,那条基线就永远不再守东西了。)
import { classesIn } from './deadCss'

/** 一条 `composes` 关系:本模块的 `localClass` 引了 `kitFile` 的 `kitClass`。 */
export interface ComposeLink {
  localClass: string
  kitClass: string
  /** composes 里写的那个路径(原样,含 `./` 或 `../`) */
  kitFile: string
}

/** 参与判定的一份 CSS Modules 源文件。 */
export interface SourceModule {
  /** 仓库内路径,用于和 composes 的相对路径对上号 */
  file: string
  /** 这份文件声明过的全部作用域名字(类名 + keyframes 名) */
  names: string[]
  links: ComposeLink[]
}

/** 一个打包产物 CSS 文件。 */
export interface Chunk {
  file: string
  css: string
}

export type IssueKind =
  /** uiKit 的规则排在了使用方**后面** —— 覆盖会全部失效 */
  | 'order'
  /** 一个 hash 同时像两个源文件,认不出是谁 —— 不猜,报出来 */
  | 'ambiguous'
  /** composes 指向的那个公共类在产物里根本不存在 */
  | 'missing-kit'

export interface OrderIssue {
  kind: IssueKind
  chunk: string
  localClass: string
  kitClass: string
  msg: string
}

export interface OrderVerdict {
  issues: OrderIssue[]
  /**
   * 真正比对过的 (chunk, composes) 对数。
   * **0 是要报警的** —— 一道一次都没查到东西的闸门等于没装。
   */
  checked: number
  /** 含有至少一条被检查关系的 chunk 数 */
  chunksWithLinks: number
}

/**
 * 剥掉注释。注释里写着的旧类名不算声明,也不该被当成 composes。
 */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/**
 * `@keyframes foo` 里的 `foo` 在 CSS Modules 里**也是被作用域化的**,
 * 产物里同样长成 `_foo_hash_n`。不把它算进声明集合,
 * 带动画的模块就会因为「产物里有源文件里找不到的名字」而认不出来 ——
 * 那是一个**静默跳过**,比报错难发现得多。
 */
export function keyframeNames(css: string): string[] {
  const out: string[] = []
  for (const m of stripComments(css).matchAll(/@(?:-\w+-)?keyframes\s+([A-Za-z_][\w-]*)/g)) {
    out.push(m[1])
  }
  return out
}

/** 一份模块声明过的全部作用域名字。 */
export function declaredNames(css: string): string[] {
  return [...new Set([...classesIn(css), ...keyframeNames(css)])].sort()
}

/**
 * 抽出 `composes` 关系,**连带它挂在哪个本地类上**。
 *
 * deadCss 里的 `composesOf` 只回答「引了哪些公共类」,不关心是谁引的;
 * 这里要比对顺序,就必须知道本地那一头叫什么。
 */
export function composeLinks(css: string): ComposeLink[] {
  const src = stripComments(css)
  const out: ComposeLink[] = []
  // 逐个「选择器 { 声明 }」块扫。声明体里不允许再有花括号,
  // 所以 @media 之类的外层不会被误当成一个块(它的内层规则会各自匹配到)。
  for (const block of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1]
    const body = block[2]
    if (!/composes\s*:/.test(body)) continue
    // 只认「逗号分隔的裸类选择器」。composes 本来就只在这种选择器上合法,
    // 别的形态(`.a .b`、`.a:hover`)不该被当成一条关系。
    const locals: string[] = []
    for (const part of selector.split(',')) {
      const m = /^\s*\.([A-Za-z_][\w-]*)\s*$/.exec(part)
      if (m) locals.push(m[1])
    }
    if (locals.length === 0) continue
    for (const decl of body.matchAll(/composes\s*:\s*([^;{}]+?)\s+from\s+['"]([^'"]+)['"]/g)) {
      const kitFile = decl[2]
      for (const kitClass of decl[1].split(/[\s,]+/)) {
        if (!kitClass) continue
        for (const localClass of locals) out.push({ localClass, kitClass, kitFile })
      }
    }
  }
  return out
}

export interface ScopedSpan {
  /** 该 (名字, hash) 第一次出现的字节偏移 */
  first: number
  /** 最后一次 —— 比顺序要用「公共块整个在前」,所以看它的末位 */
  last: number
}

/**
 * 把产物 CSS 里的作用域类名 `_<local>_<hash>_<n>` 归堆。
 * 返回 hash → (名字 → 出现区间)。
 *
 * hash 恒为 5 位字母数字,`n` 恒为数字,所以非贪婪的 local 不会把
 * hash 吃进去(`_backBtn_zedng_17` 只有 local=`backBtn` 一种切法)。
 * 前提是本地名里不含下划线 —— 这个仓库全是 camelCase,成立。
 */
export function scopedSpans(css: string): Map<string, Map<string, ScopedSpan>> {
  const out = new Map<string, Map<string, ScopedSpan>>()
  for (const m of css.matchAll(/\._(.+?)_([a-z0-9]{5})_(\d+)\b/g)) {
    const [local, hash] = [m[1], m[2]]
    const at = m.index ?? 0
    let byName = out.get(hash)
    if (!byName) out.set(hash, (byName = new Map()))
    const cur = byName.get(local)
    if (cur) cur.last = at
    else byName.set(local, { first: at, last: at })
  }
  return out
}

/**
 * 在一个 chunk 里认出某个源模块对应的 hash。
 *
 * 判据:该 hash 名下的名字**全部**出自这份源文件。
 * 认不出返回 null;同时像两个文件返回 'ambiguous' —— 交给上层报出来,不猜。
 */
export function hashFor(
  spans: Map<string, Map<string, ScopedSpan>>,
  names: Set<string>,
): string | null | 'ambiguous' {
  const hits: string[] = []
  for (const [hash, byName] of spans) {
    if (byName.size === 0) continue
    if ([...byName.keys()].every((n) => names.has(n))) hits.push(hash)
  }
  if (hits.length === 0) return null
  if (hits.length > 1) return 'ambiguous'
  return hits[0]
}

/** composes 里写的相对路径 → 仓库内路径的尾巴(只比文件名就够,基件全站唯一)。 */
function baseName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/**
 * 判定:每一条 composes 关系,在每个同时含有两头的 chunk 里,
 * **公共类的整段规则必须排在本地类的第一条规则之前**。
 */
export function checkChunkOrder(chunks: Chunk[], modules: SourceModule[]): OrderVerdict {
  const issues: OrderIssue[] = []
  let checked = 0
  let chunksWithLinks = 0

  const byBase = new Map<string, SourceModule>()
  for (const m of modules) byBase.set(baseName(m.file), m)
  const nameSets = new Map<string, Set<string>>()
  for (const m of modules) nameSets.set(m.file, new Set(m.names))

  for (const chunk of chunks) {
    const spans = scopedSpans(chunk.css)
    if (spans.size === 0) continue
    // 每个 chunk 只解析一次 hash,别对每条关系都重算
    const resolved = new Map<string, string | null | 'ambiguous'>()
    const resolve = (mod: SourceModule) => {
      let r = resolved.get(mod.file)
      if (r === undefined) {
        r = hashFor(spans, nameSets.get(mod.file) ?? new Set())
        resolved.set(mod.file, r)
      }
      return r
    }

    let any = false
    for (const mod of modules) {
      if (mod.links.length === 0) continue
      const localHash = resolve(mod)
      if (localHash === null) continue // 这个模块不在这一块里
      if (localHash === 'ambiguous') {
        issues.push({
          kind: 'ambiguous',
          chunk: chunk.file,
          localClass: '—',
          kitClass: '—',
          msg: `认不出 ${mod.file} 对应哪个 hash(有多个 hash 的类名都出自它)—— 不猜,请改判据`,
        })
        continue
      }
      const localNames = spans.get(localHash)!

      for (const link of mod.links) {
        const kitMod = byBase.get(baseName(link.kitFile))
        if (!kitMod) continue
        const kitHash = resolve(kitMod)
        if (kitHash === null) continue
        if (kitHash === 'ambiguous') {
          issues.push({
            kind: 'ambiguous',
            chunk: chunk.file,
            localClass: link.localClass,
            kitClass: link.kitClass,
            msg: `认不出公共模块 ${link.kitFile} 对应哪个 hash —— 不猜,请改判据`,
          })
          continue
        }
        if (kitHash === localHash) continue // 同一份文件内部的 composes,无所谓顺序

        const kit = spans.get(kitHash)!.get(link.kitClass)
        const local = localNames.get(link.localClass)
        if (!local) continue // 本地这条规则被压掉了(比如只剩 composes 没有别的声明)
        if (!kit) {
          issues.push({
            kind: 'missing-kit',
            chunk: chunk.file,
            localClass: link.localClass,
            kitClass: link.kitClass,
            msg: `.${link.localClass} composes 的 .${link.kitClass} 在产物里不存在 —— composes 目标改名了?`,
          })
          continue
        }

        any = true
        checked++
        if (kit.last > local.first) {
          issues.push({
            kind: 'order',
            chunk: chunk.file,
            localClass: link.localClass,
            kitClass: link.kitClass,
            msg:
              `.${link.kitClass} 的规则排在 .${link.localClass} 之后` +
              `(公共 @${kit.last} > 本地 @${local.first})—— ` +
              `两者特异度相同,本地的覆盖会全部失效`,
          })
        }
      }
    }
    if (any) chunksWithLinks++
  }

  return { issues, checked, chunksWithLinks }
}
