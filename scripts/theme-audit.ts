// 主题就绪度清单 —— 还有多少写死的颜色挡着亮色主题。
// 运行:npm run theme-audit
//
// 【为什么有这个东西】
// 调色板是集中的(`src/index.css` 里 15 个颜色变量),照理说加一组
// `:root[data-theme='light']` 覆盖就完事。而一量:**56 个 CSS 模块里
// 有近两千处写死的颜色,一个模块都没漏掉。** 只翻那 15 个变量,
// 得到的是「深色底的字压在浅色底上」—— 一个字都读不清,而且不报任何错。
//
// 所以照仓库自己的规矩:先把「还差多少」变成一个能数、会降的数字。
// 判定层在 scripts/themeAudit.ts,带 13 条测试。
//
// 【为什么是清单不是闸门】
// 同 dead-css / price-cards:它报的是**债**,而债是慢慢还的。
// 做成 CI 红线只会逼人把颜色搬进一个叫 `--misc-7` 的变量里糊弄过去。
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { judgeFile, rank, type ThemeReport } from './themeAudit'

const ROOT = 'src'

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.css')) out.push(p)
  }
  return out
}

const files = walk(ROOT)
const reports: ThemeReport[] = files.map((f) => judgeFile(relative(ROOT, f), readFileSync(f, 'utf8')))

const blocking = reports.reduce((n, r) => n + r.blocking, 0)
const soft = reports.reduce((n, r) => n + r.soft, 0)
const clean = reports.filter((r) => r.blocking === 0).length

console.log(`\n主题就绪度 —— 扫了 ${files.length} 份样式表\n`)
console.log(`  挡路的(不透明的 color / background 字面量)  ${blocking}`)
console.log(`  不挡路的(阴影、描边、半透明叠加)            ${soft}`)
console.log(`  已经不欠债的文件                              ${clean} / ${files.length}\n`)

const ranked = rank(reports)
if (ranked.length === 0) {
  console.log('✓ 一处挡路的写死颜色都没有 —— 亮色主题现在只差一组变量覆盖。')
} else {
  console.log('欠得最多的十份:')
  for (const r of ranked.slice(0, 10)) {
    console.log(`  ${String(r.blocking).padStart(4)}  ${r.file}`)
  }
  console.log(`\n还有 ${Math.max(0, ranked.length - 10)} 份没列出来。`)
  console.log(
    '\n注:「不挡路」那一档**不用还** —— 半透明的阴影与描边在深浅两种底上都成立。\n' +
      '要还的只有上面这一档:它们直接决定「字读不读得出来」。',
  )
}
