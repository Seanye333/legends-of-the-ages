// 「同一个东西在各屏长得不一样」的检测 —— 纯函数,不碰文件系统
//(运行器在 scripts/css-dupes.ts)。
//
// 【为什么要有这一份】
// uiKit.module.css 存在的全部理由就是这句话:同一个东西在不同屏上长得不一样,
// 而且每次改都得改十六个地方。可是**发现**它一直是手工活 ——
// 2026-08-06 那一轮按钮归并里,「九处胶囊、其中四处逐字节相同」
// 是我一个个 grep 出来的,不是任何工具报出来的。
//
// 手工发现的问题不在于慢,在于**它不会再发生第二次**:
// 下一个人加第十处胶囊时,没有任何东西会告诉他前面已经有九处了。
// dead-css 是这个道理,这一份也是。
//
// 【报两样东西,它们的含义完全不同】
//
//   1. 逐字节相同的规则跨文件重复 —— **纯去重机会,零视觉风险**。
//      那一轮的乱斗规则钮 / 关底选卡组 / 构筑筛选 / 设置分区就是这样被认出来的:
//      四处连选中态都一模一样,收进基件是逐像素无变化的。
//
//   2. 长相属性的**取值分布** —— 「漂移」。
//      同样是那九处胶囊:padding 九处九种写法、border 四种、background 四种。
//      这一类不能自动合,因为差异里混着有意的(设置页那排是拇指要点的分区页签,
//      所以更高)。但**分布本身就是结论**:某个属性只有一两种写法,
//      说明它其实已经统一了;九处九种,说明从来没有人管过。
//
//   最有价值的一格往往是「几乎没人写」的那种:
//   `-webkit-tap-highlight-color` 九处胶囊里一处都没有 —— 那是个真 bug,
//   手机上点每一下都会闪系统蓝框,而没有任何一屏的作者意识到。
//
// 【为什么是清单不是闸门】
// 同 dead-css / price-cards:差异里有正当的那一部分,做成红线只会逼人糊弄它。

export interface Rule {
  file: string
  /** 规范化后的选择器(逗号分隔的裸类名) */
  selector: string
  /** 已排序、已折空白的声明 */
  decls: Array<[string, string]>
  /** 这条规则是不是已经 composes 了公共基件 —— 已接上的不必再报 */
  composed: boolean
}

/** 判断「长相」用的属性。布局属性(display/gap/margin)不算 —— 那些本来就该各屏不同。 */
export const LOOK_PROPS = [
  'border',
  'border-color',
  'background',
  'background-color',
  'color',
  'border-radius',
  'box-shadow',
  'padding',
  'font-size',
  'font-family',
  'font-weight',
  'letter-spacing',
  'transition',
  '-webkit-tap-highlight-color',
] as const

const SURFACE_PROPS = ['border', 'background', 'background-color', 'color', 'border-radius']

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/**
 * 抽出「裸类选择器」的规则。
 *
 * 只认 `.a` / `.a, .b` 这种形态:带伪类、后代、属性选择器的那些是状态和例外,
 * 把它们混进来只会让分布图变成噪声。
 */
export function rulesIn(css: string, file: string): Rule[] {
  const out: Rule[] = []
  for (const m of stripComments(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const parts = m[1].split(',').map((p) => p.trim())
    if (parts.length === 0) continue
    const names: string[] = []
    let ok = true
    for (const p of parts) {
      const hit = /^\.([A-Za-z_][\w-]*)$/.exec(p)
      if (!hit) {
        ok = false
        break
      }
      names.push(hit[1])
    }
    if (!ok || names.length === 0) continue

    const decls: Array<[string, string]> = []
    let composed = false
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':')
      if (i < 0) continue
      const prop = d.slice(0, i).trim()
      const value = d.slice(i + 1).trim().replace(/\s+/g, ' ')
      if (!prop) continue
      if (prop === 'composes') {
        composed = true
        continue
      }
      decls.push([prop, value])
    }
    // 空规则不要 —— 但**只引不改**的那种要留下:它没有声明,却是「已经接上基件」
    // 的证据。丢掉它,报告里的「已 composes 基件 N 条」就会小得离谱
    // (十六个屏的 `.backBtn { composes: backBtn }` 全部消失)。
    if (decls.length === 0 && !composed) continue
    decls.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    out.push({ file, selector: names.map((n) => `.${n}`).join(', '), decls, composed })
  }
  return out
}

/**
 * 从一段 JSX 里取出某个标签的属性文本。
 *
 * 不能用 `<button[^>]*>` —— 属性里几乎一定有箭头函数
 * (`onClick={() => ...}`),那个 `>` 会把匹配提前截断,
 * 于是写在 onClick 后面的 className 全部漏掉。所以按括号深度扫。
 */
export function attrSpans(src: string, tag: string): string[] {
  const out: string[] = []
  for (const m of src.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    let i = (m.index ?? 0) + m[0].length
    const start = i
    let depth = 0
    let quote = ''
    for (; i < src.length; i++) {
      const c = src[i]
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = ''
        continue
      }
      if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{' || c === '(' || c === '[') depth++
      else if (c === '}' || c === ')' || c === ']') depth--
      else if (c === '>' && depth === 0) break
    }
    out.push(src.slice(start, i))
  }
  return out
}

/**
 * 真正挂在 `<button>` 上的类名。
 *
 * 【为什么要这一步】
 * 只按 CSS 判断的话,「可点的面」有 93 条,里面混着一大批**卡片和格子**
 * (`.heroCard` / `.bookCard` / `.node` / `.face`)—— 它们也有 cursor:pointer、
 * 也有描边底色,但它们和按钮不是一类东西,混在一起算「取值分布」纯属制造噪声。
 *
 * 这个仓库全用 CSS Modules(`styles.foo` 是属性取用),所以「这个类挂在什么标签上」
 * 静态就能对上号 —— 和 deadCss 能做得很确定是同一个理由。
 */
export function buttonClasses(src: string, ident: string): Set<string> {
  const esc = ident.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const dot = new RegExp(`\\b${esc}\\.([A-Za-z_][\\w$]*)`, 'g')
  const idx = new RegExp(`\\b${esc}\\[\\s*['"]([^'"]+)['"]\\s*\\]`, 'g')
  const out = new Set<string>()
  for (const attrs of attrSpans(src, 'button')) {
    for (const m of attrs.matchAll(dot)) out.add(m[1])
    for (const m of attrs.matchAll(idx)) out.add(m[1])
  }
  return out
}

/** 可点的「面」:有 cursor:pointer,且至少写了三样长相属性。 */
export function isSurface(r: Rule): boolean {
  if (!r.decls.some(([p, v]) => p === 'cursor' && v === 'pointer')) return false
  const n = r.decls.filter(([p]) => SURFACE_PROPS.includes(p)).length
  return n >= 3
}

/** 形制分档:胶囊 / 方角。分开看,否则筛选片和出征键的圆角会混成一团。 */
export function shapeOf(r: Rule): 'pill' | 'boxy' {
  const radius = r.decls.find(([p]) => p === 'border-radius')?.[1] ?? ''
  return /999px|var\(--r-pill\)/.test(radius) ? 'pill' : 'boxy'
}

export interface Where {
  file: string
  selector: string
}

export interface ExactGroup {
  decls: Array<[string, string]>
  where: Where[]
}

/**
 * 逐字节相同、且跨**不同文件**出现的规则。
 * 同一份文件里的重复不算 —— 那通常是有意的一组变体。
 */
export function exactDupes(rules: Rule[], minDecls = 4): ExactGroup[] {
  const byKey = new Map<string, Rule[]>()
  for (const r of rules) {
    if (r.decls.length < minDecls) continue
    const key = r.decls.map(([p, v]) => `${p}:${v}`).join(';')
    const arr = byKey.get(key) ?? []
    arr.push(r)
    byKey.set(key, arr)
  }
  const out: ExactGroup[] = []
  for (const arr of byKey.values()) {
    if (new Set(arr.map((r) => r.file)).size < 2) continue
    out.push({
      decls: arr[0].decls,
      where: arr.map((r) => ({ file: r.file, selector: r.selector })),
    })
  }
  return out.sort((a, b) => b.where.length - a.where.length || b.decls.length - a.decls.length)
}

export interface PropSpread {
  prop: string
  /** 每种写法各是谁在用;`未写` 那一档单列 */
  values: Array<{ value: string; who: Where[] }>
  missing: Where[]
}

export interface DriftReport {
  shape: 'pill' | 'boxy'
  members: Where[]
  spread: PropSpread[]
}

/**
 * 某一档形制里,各个长相属性的取值分布。
 *
 * 排序按「写法种数」降序 —— 种数最多的那个属性就是漂得最远的那个。
 * `missing` 单列是刻意的:「九处里只有一处写了 tap-highlight」这种发现,
 * 只看已写的那几种值是看不出来的。
 */
export function driftReport(rules: Rule[], shape: 'pill' | 'boxy'): DriftReport {
  const members = rules.filter((r) => shapeOf(r) === shape)
  const spread: PropSpread[] = []
  for (const prop of LOOK_PROPS) {
    const byVal = new Map<string, Where[]>()
    const missing: Where[] = []
    for (const r of members) {
      const where: Where = { file: r.file, selector: r.selector }
      const hit = r.decls.find(([p]) => p === prop)
      if (!hit) {
        missing.push(where)
        continue
      }
      const arr = byVal.get(hit[1]) ?? []
      arr.push(where)
      byVal.set(hit[1], arr)
    }
    if (byVal.size === 0) continue
    spread.push({
      prop,
      values: [...byVal]
        .map(([value, who]) => ({ value, who }))
        .sort((a, b) => b.who.length - a.who.length),
      missing,
    })
  }
  spread.sort((a, b) => b.values.length - a.values.length)
  return { shape, members: members.map((r) => ({ file: r.file, selector: r.selector })), spread }
}
