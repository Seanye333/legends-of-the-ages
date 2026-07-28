import { gzipSync } from 'node:zlib'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// 首屏体积闸门 —— `npm run perf-budget`(要先 `npm run build`)。
//
// 【为什么需要一道闸门而不是「偶尔看一眼」】
// 首屏体积是那种**只会单向恶化**的指标:每个人都只是加一个 import,
// 没有任何一次改动会让它变小,于是半年后它就是 3MB,而且找不到该怪谁。
// 装成闸门之后,把它撑破的那一次改动**当场**就知道是自己。
//
// 【量的是什么】
// 只量**首屏真正会下载的那几个文件**:index.html 里的 `<script>` 入口
// 加上所有 `modulepreload`。懒加载的 chunk(图鉴、构筑器、七个面板……)不算 ——
// 它们的加载藏在点击动作里,不影响「打开网页多久能看到东西」。
//
// 【为什么按 gzip 算】
// 线上一定开传输压缩(Vercel 默认 br/gzip),原始字节数不是玩家等待的那个数。
// 这里用 gzip 而不是 brotli:brotli 更慢也更省,用 gzip 算等于留了一点余量。
const DIST = join(process.cwd(), 'dist')

// 400KB gzip ≈ 慢速 4G 上 3 秒。这个数字是**实测出来的地板加一点余量**,不是拍的:
//
// 其中 172KB 是卡池本身(`content` chunk),而卡池**结构性地无法懒加载** ——
// 一开始以为标题页只要「卡池总数 / 朝代数 / 签名卡画廊」三样、可以异步补,
// 真去查依赖图才发现 `app/matchStore`(全局对局 store)和 `content/campaign`
// 都在模块顶层 import 卡池,而标题页必须同步用到这两个。
// 要拆就得让 `CARDS_BY_ID` 的六十多个同步引用点全部变成异步 —— 那是六十个新的
// 「还没加载好」分支,换 172KB 不划算。
//
// 所以剩下的两条真路子(将来真嫌慢了再动):
//   1. 把卡面的 `en` 字串拆成独立 chunk,只在英文模式加载(粗估省 60-70KB gzip)
//   2. 生成期把 JSON 换成更紧的列式编码(键名重复 2,261 次,gzip 之后仍有余量)
//
// 闸门的意义不在于「达到最优」,而在于**下一次谁把它撑破,当场知道是自己**。
const BUDGET_KB = 400

interface Entry {
  file: string
  raw: number
  gz: number
}

function measure(file: string): Entry | null {
  const path = join(DIST, file.replace(/^\//, ''))
  try {
    const buf = readFileSync(path)
    return { file, raw: statSync(path).size, gz: gzipSync(buf).length }
  } catch {
    return null
  }
}

const html = readFileSync(join(DIST, 'index.html'), 'utf8')

// 入口脚本 + modulepreload + 首屏样式表。三者都是渲染前必须到位的。
const eager = new Set<string>()
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) eager.add(m[1])
for (const m of html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g)) eager.add(m[1])
for (const m of html.matchAll(/rel="stylesheet"[^>]+href="([^"]+)"/g)) eager.add(m[1])

const entries = [...eager]
  .map(measure)
  .filter((e): e is Entry => e !== null)
  .sort((a, b) => b.gz - a.gz)

const totalGz = entries.reduce((n, e) => n + e.gz, 0)
const totalRaw = entries.reduce((n, e) => n + e.raw, 0)

const kb = (n: number) => (n / 1024).toFixed(1).padStart(7) + ' KB'

console.log('首屏必须下载的文件(按 gzip 后大小排序):\n')
for (const e of entries) {
  console.log(`  ${kb(e.gz)}  gzip   ${kb(e.raw)}  原始   ${e.file}`)
}
console.log(`\n  ${kb(totalGz)}  合计 gzip(预算 ${BUDGET_KB} KB)`)
console.log(`  ${kb(totalRaw)}  合计原始`)

const overKB = totalGz / 1024 - BUDGET_KB
if (overKB > 0) {
  console.error(`\n✗ 首屏超预算 ${overKB.toFixed(1)} KB。`)
  console.error('  先看上面最大的那一项:它是不是只有某一个界面才用得到?')
  console.error('  是的话就 lazy 掉(组件用 React.lazy,纯数据用动态 import)。')
  process.exit(1)
}
console.log(`\n✓ 首屏在预算内,余量 ${(-overKB).toFixed(1)} KB。`)
