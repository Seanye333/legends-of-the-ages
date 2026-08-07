// `composes` 层叠顺序闸门的运行器 —— `npm run css-order`(要先 `npm run build`)。
//
// 判定层在 scripts/cssOrder.ts,配 cssOrder.test.ts 两个方向逐条验过。
// 这里只负责:扫源里的 composes 关系、扫 dist 里的 CSS 分块、排版、退出码。
//
// 【为什么必须量产物而不是源码】
// 源码里看不出顺序。顺序是**打包器**排出来的,而且是**每个 chunk 各排一次** ——
// 十三个含 uiKit 的分块里,LoreScreen 那块的 uiKit 就排在 7718 字节处
// (前面是关系图谱那几个组件),和其它十二块完全不一样。
// 所以「看一眼源码觉得没问题」在这件事上没有任何保证力。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { checkChunkOrder, composeLinks, declaredNames, type Chunk, type SourceModule } from './cssOrder'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')
const DIST = join(ROOT, 'dist', 'assets')

function walk(dir: string, hit: (p: string) => void): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, hit)
    else hit(p)
  }
}

// ---- 源:哪些模块 composes 了别人 ----
const modules: SourceModule[] = []
walk(SRC, (p) => {
  if (!p.endsWith('.module.css')) return
  const css = readFileSync(p, 'utf8')
  modules.push({
    file: relative(ROOT, p).replace(/\\/g, '/'),
    names: declaredNames(css),
    links: composeLinks(css),
  })
})

const linkCount = modules.reduce((n, m) => n + m.links.length, 0)

// ---- 产物 ----
let chunks: Chunk[] = []
try {
  statSync(DIST)
  chunks = readdirSync(DIST)
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ file: f, css: readFileSync(join(DIST, f), 'utf8') }))
} catch {
  console.error('✗ 没有 dist/assets —— 先跑 npm run build')
  process.exit(1)
}

const v = checkChunkOrder(chunks, modules)

console.log(
  `扫了 ${modules.length} 份 CSS Modules(${linkCount} 条 composes)、` +
    `${chunks.length} 个产物分块:在 ${v.chunksWithLinks} 块里比对了 ${v.checked} 对。`,
)
// 比对数远小于 composes 数是**正常的**,而且这个差值本身有意义:
// `.backBtn { composes: backBtn; }` 这种「只引不改」的本地类没有自己的声明,
// 空规则被压掉了,产物里根本没有它 —— 也就没有会失效的覆盖,不需要守。
// 换句话说:**比对数 = 真正押了注的覆盖条数**,它会随「引过来再改两条」的写法一起涨。
if (v.checked < linkCount) {
  console.log(
    `  (另外 ${linkCount - v.checked} 条只引不改 —— 本地类没有自己的声明,没有会失效的覆盖)`,
  )
}

// 一次都没查到东西 = 这道闸门已经不守任何东西了(perf-budget 的教训:
// 那次基线正则失配只 warn 不红,于是它默默停工了很久都没人发现)
if (v.checked === 0) {
  console.error(
    '\n✗ 一对都没比到 —— 要么 composes 全没了,要么产物类名格式变了。' +
      '\n  这道闸门现在不守任何东西,要么修判据要么删掉它,别让它默默失效。',
  )
  process.exit(1)
}

if (v.issues.length === 0) {
  console.log('✓ 每一块里公共基件都排在使用方前面 —— 各屏的覆盖都生效。')
  process.exit(0)
}

const KIND: Record<string, string> = {
  order: '顺序反了(覆盖会失效)',
  ambiguous: '认不出模块',
  'missing-kit': 'composes 目标不存在',
}
for (const kind of ['order', 'missing-kit', 'ambiguous'] as const) {
  const list = v.issues.filter((i) => i.kind === kind)
  if (list.length === 0) continue
  console.error(`\n✗ ${KIND[kind]} —— ${list.length} 条`)
  for (const i of list.slice(0, 12)) console.error(`  [${i.chunk}] ${i.msg}`)
  if (list.length > 12) console.error(`  …… 还有 ${list.length - 12} 条`)
}
process.exit(1)
