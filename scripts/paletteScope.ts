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

/** 允许出现色阶声明的两个作用域:暗色(默认)与亮色覆盖。别的都算窄作用域覆盖。 */
export const ROOT_SCOPE = ':root'
export const LIGHT_SCOPE = ":root[data-theme='light']"

/**
 * 卡面稀有度与费用宝石 —— **印在物件上的东西**,亮色下不翻转,
 * 所以它们**故意**没有亮色覆盖行。写在这里而不是靠「谁没写就算故意」:
 * 后者分不出「有意钉住」和「忘了写」,而忘了写的表现是
 * 亮色模式下那一格还是深色 —— 不崩、不红。
 */
export const PINNED_IN_LIGHT = new Set([
  '--amethyst-34', '--amethyst-63', '--amethyst-70',
  '--ash-41', '--ash-68', '--ash-71',
  '--azure-17', '--azure-23', '--azure-24', '--azure-32', '--azure-34',
  '--azure-37', '--azure-46', '--azure-48', '--azure-56', '--azure-61', '--azure-70',
  '--brass-56', '--brass-74',
])

/** 色阶变量的命名前缀 —— 只管这一批,不管 `--gold-mid` 那些既有的语义名。 */
export const RAMP_PREFIXES = ['ash', 'brass', 'cinnabar', 'jade', 'cyan', 'azure', 'amethyst']

// 【这里原来只匹配两位数,而那是个洞】
// 明度撞档时生成器会 bump 到三位(--brass-100 起有十几个),于是那一批被这道闸门
// **整个跳过**了 —— 一道有覆盖不到的地方的闸门比没有闸门更糟:它让人以为验过了。
export function isRampVar(name: string): boolean {
  return RAMP_PREFIXES.some((p) => new RegExp(`^--${p}-\\d{2,3}$`).test(name))
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
