// 主题就绪度的判定层 —— 纯函数,不碰文件系统(运行器在 scripts/theme-audit.ts)。
//
// 【为什么先做尺子,而不是直接做亮色主题】
// 调色板确实是集中的(`src/index.css` 里 15 个颜色变量),照理说
// 加一组 `:root[data-theme='light']` 覆盖就行。而实际一量:
// **56 个 CSS 模块里有 1,889 处写死的颜色,一个模块都没漏掉。**
// 只翻那 15 个变量,得到的是一个「深色底的字压在浅色底上」的亮色模式 ——
// 一个字都读不清,而且没有任何东西会报错。
//
// 所以这条按仓库自己的规矩来(uiKit 那一轮的原话:「先装闸门再动按钮」):
// 先把「还差多少」变成一个**能数、会降**的数字,再谈动手。
//
// 【判定的全部难点:哪些写死的颜色真的会坏】
// 1,889 处里绝大多数是**半透明的叠加**(`rgba(0,0,0,.4)` 的阴影、
// `rgba(180,150,90,.3)` 的描边)。它们在浅底上照样成立 —— 阴影还是阴影,
// 金描边还是金描边。真正会坏的只有**不透明的 `color` 与 `background`**:
// 那两样直接决定「字读不读得出来」。
//
// 于是判定分两档:
//   · blocking —— 不透明的 color / background(-color) 字面量。换主题必坏。
//   · soft     —— 其余(阴影、描边、渐变里的半透明、border-color…)。多半没事。
// 报的时候两档分开。**把 1,889 直接摆出来只会让人觉得这事不可能做**,
// 而 blocking 那一档才是真正要还的债。
export interface ColorHit {
  prop: string
  value: string
  blocking: boolean
}

export interface ThemeReport {
  file: string
  blocking: number
  soft: number
  hits: ColorHit[]
}

// 颜色字面量:#rgb / #rrggbb / #rrggbbaa / rgb() / rgba() / hsl() / hsla()
const COLOR = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)/g

// 只有这几个属性能决定「字读不读得出来」。
// `border-color` **不算**:描边在深浅两种底上都还是描边,读不读得出来不靠它。
const BLOCKING_PROPS = new Set(['color', 'background', 'background-color'])

/**
 * 这个颜色值是不是不透明。
 *
 * 半透明的叠加在深浅两种底上都成立,所以它不算债。
 * 判据刻意**保守**:看不出透明度就当成不透明(宁可多报一条要还的债,
 * 也不要漏掉一处真的会读不清的地方)。
 */
export function isOpaque(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (v.startsWith('#')) {
    // #rgba(4) 与 #rrggbbaa(8) 带 alpha;其余都是不透明
    const hex = v.slice(1)
    if (hex.length === 4) return hex[3] === 'f'
    if (hex.length === 8) return hex.slice(6) === 'ff'
    return true
  }
  const m = v.match(/^(?:rgba|hsla)\(([^)]*)\)/)
  if (!m) return true // rgb() / hsl() 没有 alpha 通道
  const parts = m[1].split(/[,/]/).map((s) => s.trim())
  if (parts.length < 4) return true
  const a = Number(parts[3].replace('%', ''))
  if (!Number.isFinite(a)) return true
  return parts[3].includes('%') ? a >= 100 : a >= 1
}

/**
 * 扫一份 CSS,找出写死的颜色。
 *
 * 【先挖注释与 url()】—— 和 deadCss 同一个教训:注释里写着的旧配色、
 * 路径里的十六进制串,都会被当成真的颜色报出来,而且长得一模一样。
 */
export function colorsIn(css: string): ColorHit[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/url\s*\([^)]*\)/gi, ' ')
  const out: ColorHit[] = []
  // 逐条声明看:属性名要跟着值一起判,否则分不出 color 和 box-shadow
  for (const decl of clean.split(/[;{}]/)) {
    const i = decl.indexOf(':')
    if (i < 0) continue
    const prop = decl.slice(0, i).trim().toLowerCase()
    const value = decl.slice(i + 1)
    for (const m of value.matchAll(COLOR)) {
      const v = m[0]
      out.push({ prop, value: v, blocking: BLOCKING_PROPS.has(prop) && isOpaque(v) })
    }
  }
  return out
}

/** 一份文件的报告。 */
export function judgeFile(file: string, css: string): ThemeReport {
  const hits = colorsIn(css)
  return {
    file,
    blocking: hits.filter((h) => h.blocking).length,
    soft: hits.filter((h) => !h.blocking).length,
    hits,
  }
}

/** 汇总排序:欠得最多的排前面 —— 这份清单是**待办**,不是体检表。 */
export function rank(reports: ThemeReport[]): ThemeReport[] {
  return [...reports]
    .filter((r) => r.blocking > 0)
    .sort((a, b) => b.blocking - a.blocking || a.file.localeCompare(b.file))
}
