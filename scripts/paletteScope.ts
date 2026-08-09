// 色阶变量的**作用域**判定 —— 支撑「把字面量换成 var() 是零视觉变化」这句话。
//
// 【为什么这句话需要证明】
// 507 处挡路的颜色里,338 处是同一批重复值,已经换成了 `var(--brass-42)` 这样的引用。
// 这一步之所以敢在没有截图对拍的情况下做,靠的是一条**可证**的性质:
//   变量只在 `:root` 定义过一次、没有任何窄作用域覆盖
//   → `var(--brass-42)` 处处解析成同一个值
//   → 而那个值与替换前逐位相同
//   → 所以计算样式一个像素都没变。
// 三条里前两条是静态的,这个文件负责钉住第一条。
// 一旦有人在某个模块里写了 `.foo { --brass-42: … }`,上面那条推理当场作废,
// 而表现是「某一屏的颜色悄悄和别处不一样了」—— 不崩、不红。
//
// 判定层单独抽出来是为了能喂合成样本双向验(见 paletteScope.test.ts)。

export interface VarDecl {
  name: string
  /** 声明所在那一层的选择器。`:root` 之外的都算窄作用域。 */
  scope: string
}

/** 色阶变量的命名前缀 —— 只管这一批,不管 `--gold-mid` 那些既有的语义名。 */
export const RAMP_PREFIXES = ['ash', 'brass', 'cinnabar', 'jade', 'cyan', 'azure', 'amethyst']

export function isRampVar(name: string): boolean {
  return RAMP_PREFIXES.some((p) => new RegExp(`^--${p}-\\d{2}$`).test(name))
}

/**
 * 扫出一份 CSS 里所有自定义属性的声明,连同它所在那一层的选择器。
 *
 * 手写的极简扫描而不是上一个 CSS 解析器:这里只需要「花括号深度 + 上一个选择器」,
 * 而多一个依赖就多一份要跟着升级的东西。注释与 url() 先剔掉,免得里面的
 * 花括号或冒号把深度算歪。
 */
export function declaredVars(css: string): VarDecl[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/url\s*\([^)]*\)/gi, ' ')
  const out: VarDecl[] = []
  const stack: string[] = []
  let buf = ''
  for (const ch of clean) {
    if (ch === '{') {
      stack.push(buf.trim().replace(/\s+/g, ' '))
      buf = ''
    } else if (ch === '}') {
      stack.pop()
      buf = ''
    } else if (ch === ';') {
      const i = buf.indexOf(':')
      if (i > 0) {
        const name = buf.slice(0, i).trim()
        if (name.startsWith('--')) out.push({ name, scope: stack[stack.length - 1] ?? '' })
      }
      buf = ''
    } else {
      buf += ch
    }
  }
  return out
}

/** 一份 CSS 里用到的所有 `var(--x)` 名字。 */
export function usedVars(css: string): string[] {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, ' ')
  return [...clean.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1])
}
