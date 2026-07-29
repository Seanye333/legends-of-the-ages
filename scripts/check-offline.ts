// 离线自检 —— 断网之后这个游戏还剩下什么。
// 运行:npm run build && npm run check-offline
//
// 【为什么需要一道自检而不是「试一下」】
// 离线坏掉的方式是**局部**的:app shell 还在,所以打得开、点得动、能开局,
// 只是牌桌底图变成一片黑、标题页的英雄不见了。人手试的时候多半是在有网的机器上
// 按一下 devtools 的 offline,而 Service Worker 那时早就把该缓存的都缓存了,
// 看起来一切正常。真正会挂的是**从没访问过那一屏的新玩家**在地铁里打开。
//
// 这个脚本读 workbox 生成的 precache 清单,逐条核对:
//   1. index.html 引用的每一个 js / css 都在清单里(app shell 完整);
//   2. dist/art 下的每一张底图都在清单里(四屏底图没有兜底 ——
//      立绘缺了还有拓印,底图缺了就是黑屏);
//   3. index.html 自己在清单里(否则冷启动连 HTML 都拿不到);
//   4. 图标在清单里(装到主屏之后图标是唯一的入口)。
//
// 立绘(.webp)**刻意不在清单里**:27MB 随包立绘一次性下载会让首次访问
// 变成一场灾难。它们走 runtimeCaching 的 CacheFirst —— 看过的能离线看,
// 没看过的退到拓印兜底。这是有意的取舍,所以这里不检查它们。
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'
const SW = join(DIST, 'sw.js')

if (!existsSync(SW)) {
  console.error('✗ 找不到 dist/sw.js —— 先跑 npm run build。')
  console.error('  (Tauri 构建会整体跳过 PWA 插件,那种产物不需要也不会有 sw.js。)')
  process.exit(1)
}

// workbox 把清单写成 precacheAndRoute([{revision,url},…])。
// **产物是压缩过的**,所以键名没有引号(`url:"index.html"`)—— 第一版按
// `"url":"…"` 匹配,一条都没解析出来。两种写法都认。
const swSrc = readFileSync(SW, 'utf8')
const precached = new Set(
  [...swSrc.matchAll(/"?url"?\s*:\s*"([^"]+)"/g)].map((m) => m[1].replace(/^\//, '')),
)

if (precached.size === 0) {
  console.error('✗ sw.js 里没解析出任何 precache 条目 —— workbox 的输出格式可能变了。')
  process.exit(1)
}

const missing: string[] = []
const check = (path: string, why: string) => {
  if (!precached.has(path.replace(/^\//, ''))) missing.push(`${path} —— ${why}`)
}

// 1 & 3:index.html 自己,以及它引用的一切
const html = readFileSync(join(DIST, 'index.html'), 'utf8')
check('index.html', '冷启动连 HTML 都拿不到')
for (const m of html.matchAll(/<script[^>]+src="([^"]+)"/g)) check(m[1], 'app shell 的脚本')
for (const m of html.matchAll(/rel="stylesheet"[^>]+href="([^"]+)"/g)) check(m[1], 'app shell 的样式')
for (const m of html.matchAll(/rel="modulepreload"[^>]+href="([^"]+)"/g)) {
  check(m[1], 'app shell 预载的模块')
}

// 2:底图
const artDir = join(DIST, 'art')
const art = existsSync(artDir) ? readdirSync(artDir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f)) : []
if (art.length === 0) {
  missing.push('dist/art/ —— 一张底图都没有,构建可能没把 public/art 拷过去')
}
for (const f of art) check(`art/${f}`, '四屏底图,没有兜底')

// 4:图标
for (const icon of ['favicon-192.png', 'apple-touch-icon.png']) {
  if (existsSync(join(DIST, icon))) check(icon, '装到主屏之后的入口')
}

// 报告一下按需缓存的那一层,免得读的人以为立绘也进了清单
const webpRule = /qiangu-portraits/.test(swSrc)

console.log(`离线自检:precache 清单 ${precached.size} 条`)
console.log(`  app shell + 底图 ${art.length} 张 + 图标`)
console.log(
  `  立绘:${webpRule ? '走 runtimeCaching(CacheFirst,看过的能离线看)' : '✗ 没找到立绘的缓存规则'}`,
)

if (missing.length > 0) {
  console.error(`\n✗ ${missing.length} 项不在离线清单里:`)
  for (const m of missing) console.error(`  ${m}`)
  console.error('\n断网打开时这些会 404 —— 而 app shell 还在,所以表现是「局部黑」而不是打不开。')
  process.exit(1)
}

if (!webpRule) {
  console.error('\n✗ 立绘的 runtimeCaching 规则不见了 —— 看过的卡离线也会变成拓印兜底。')
  process.exit(1)
}

console.log('\n✓ 断网可玩:HTML、脚本、样式、四屏底图、图标全部在离线清单里。')
