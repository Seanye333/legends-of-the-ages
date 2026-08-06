// 死样式清单 —— 定义了但没人取用的 CSS Modules 类名。
// 运行:npm run dead-css
//
// 【为什么这件事在这个仓库里做得成】
// 一般项目的死 CSS 检测很不靠谱:全局样式表加上运行时拼出来的类名,
// 静态扫描只能瞎猜。这个仓库全用 CSS Modules(`styles.foo`),类名是
// **被当成属性名取用的** —— 静态就能对上号。判定层在 scripts/deadCss.ts,
// 带 25 条测试。
//
// 【为什么是清单不是闸门】
// 和 price-cards 同一个道理:动态取用的模块这里一律跳过,所以它的覆盖是有洞的;
// 而且刚写一半的组件、留给下一版的样式,都会正当地出现在清单上。
// 把它做成 CI 红线只会逼人去糊弄它。它是**给人看的**。
//
// 【全局样式表另算】
// src/index.css 是全局的,类名可能出现在任何地方(包括 dangerouslySetInnerHTML
// 的富文本里),静态判断不了 —— 这里只报它有多少个类名,不做死活判断。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename } from 'node:path'
import { classesIn, composesOf, importIdentFor, judgeModule, type ModuleReport } from './deadCss'

const ROOT = 'src'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const files = walk(ROOT)
const cssModules = files.filter((f) => f.endsWith('.module.css'))
const sources = files.filter((f) => /\.(tsx?|jsx?)$/.test(f) && !f.endsWith('.d.ts'))
const srcCache = new Map(sources.map((f) => [f, readFileSync(f, 'utf8')]))

// CSS 之间也会互相取用(`composes: head from '../uiKit.module.css'`)——
// 只认 tsx 的话,全站共用的基件会被报成「整个文件都是死的」。
const cssCache = new Map(cssModules.map((f) => [f, readFileSync(f, 'utf8')]))

const reports: ModuleReport[] = cssModules.map((cssFile) => {
  const name = basename(cssFile)
  const consumers: { src: string; ident: string }[] = []
  for (const [, src] of srcCache) {
    const ident = importIdentFor(src, name)
    if (ident) consumers.push({ src, ident })
  }
  const composed: string[] = []
  for (const [other, css] of cssCache) {
    if (other !== cssFile) composed.push(...composesOf(css, name))
  }
  return judgeModule(relative(ROOT, cssFile), cssCache.get(cssFile)!, consumers, composed)
})

const orphans = reports.filter((r) => r.orphan)
const skipped = reports.filter((r) => r.skipped)
const withDead = reports.filter((r) => !r.orphan && !r.skipped && r.dead.length > 0)
const totalClasses = reports.reduce((a, r) => a + r.total, 0)
const totalDead = withDead.reduce((a, r) => a + r.dead.length, 0)

console.log(
  `扫了 ${cssModules.length} 份 CSS Modules,共 ${totalClasses} 个类名` +
    `(源码 ${sources.length} 份)。\n`,
)

if (orphans.length > 0) {
  console.log(`✗ 没有任何源码 import 的模块 —— **整个文件都是死的**(${orphans.length} 份):`)
  for (const r of orphans) console.log(`  ${r.file}  (${r.total} 个类名)`)
  console.log('')
}

if (withDead.length > 0) {
  console.log(`· 定义了但没人取用的类名(${totalDead} 个,分布在 ${withDead.length} 份里):`)
  for (const r of withDead.sort((a, b) => b.dead.length - a.dead.length)) {
    console.log(`  ${r.file}  ${r.dead.length}/${r.total}`)
    console.log(`    ${r.dead.join(' · ')}`)
  }
  console.log('')
}

if (skipped.length > 0) {
  console.log(
    `· 有动态取用(styles[\`x\${n}\`] 之类),整个模块跳过判断 —— ` +
      `**这是覆盖的盲区,不是「干净」**(${skipped.length} 份):\n  ` +
      skipped.map((r) => r.file).join(' · ') +
      '\n',
  )
}

// 全局样式表:只报规模,不判死活。
const globalCss = files.filter((f) => f.endsWith('.css') && !f.endsWith('.module.css'))
for (const g of globalCss) {
  console.log(
    `· ${relative(ROOT, g)} 是全局样式表,${classesIn(readFileSync(g, 'utf8')).length} 个类名 —— ` +
      `**没有做死活判断**(全局类名可能出现在任何地方,静态判断不了)。`,
  )
}

if (orphans.length === 0 && withDead.length === 0) {
  console.log('✓ 没找到死样式。')
}
console.log(
  '\n注:这是清单不是闸门。刚写一半的组件、留给下一版的样式,都会正当地出现在上面 ——\n' +
    '删之前先确认它不是「还没接上」的那一类。',
)
