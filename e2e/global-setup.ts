import type { FullConfig } from '@playwright/test'

// e2e 开跑之前,先把 dev server 的「按请求现转」这笔账付掉。
//
// 【为什么需要它】(2026-08-09 受控实验)
// dev 下 vite 是按请求转换模块的:某一屏第一次被打开时,它和它的依赖才被转换。
// 而各模式的内容数据现在是懒加载的(见 content/campaignIndex.ts 那一层的理由),
// 于是这笔开销正好落在「点进模式 → 进对局」这一步 —— e2e 断言最密的地方。
//
//   刚启的 server / 刚改过源码 → 4~11 条要靠重试才过(3.9~6.5 min)
//   同样那几条**单独**跑        → 全过,22 秒
//   紧接着再跑一次(模块热了)  → 81/81(2.6 min)
//
// 报错永远是 `toBeVisible failed` / `element not found` / `click timeout`,
// 从来不是「内容不对」—— 判断它不是回归的依据就是这一条。
//
// 【为什么不是 vite 的 server.warmup】
// 试过,**反效果**:4 条变 7 条。warmup 是在服务端进程里转换的,
// 而 Playwright 探到端口能响应就开跑了 —— 不是把开销挪走,
// 是让测试去抢一个正忙的 server 的 CPU。
// 关键在「**开跑之前**」这四个字,而 globalSetup 正是唯一能保证这一点的地方。
//
// 【为什么爬模块图,而不是用浏览器点一遍各模式入口】
// 点按钮等于把用例的选择器再抄一份:文案一改,预热就悄悄不工作了,
// 而表现只是「e2e 又开始偶尔红了」—— 这个仓库最贵的那类 bug。
// 沿 vite 重写过的 import 说明符爬,不依赖任何界面细节:
// 它拿的就是 dev server 会被要求转换的那批东西本身。

/** 同时发几个请求。太高会把 server 压住,反而变慢 —— 8 是量出来还算稳的一档。 */
const CONCURRENCY = 8

/** 跑飞了的兜底(正常大约三百多个模块)。 */
const MAX_MODULES = 4000

/**
 * 少于这个数就认为**爬虫自己坏了**(vite 换了写法、入口改名……),
 * 直接红,而不是「预热了个寂寞」然后让 e2e 继续偶尔翻红。
 * 一道会默默停止工作的预热比没有更糟。
 */
const MIN_EXPECTED = 150

const ENTRY = '/src/main.tsx'

/** vite 把 import 说明符重写成了绝对路径,顺着它们爬就是。 */
const SPEC_RE = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g

/**
 * 只等「端口起来了」这一件事,故意不探 ENTRY ——
 * dev server 对 /src/ 下不存在的路径也会 200,拿它当就绪判据等于什么都没验。
 * 「入口还在不在」由下面的 MIN_EXPECTED 管,两件事分开才说得清是哪一头坏了。
 *
 * globalSetup 与 webServer 的启动次序在 playwright 各版本间变过,所以这里自己等。
 */
async function waitForServer(base: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(base + '/')
      if (r.ok) return
    } catch {
      // server 还没起来,继续等
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`预热:${base} 上的 dev server 一分钟内没起来`)
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const base = config.projects[0]?.use?.baseURL
  if (!base) throw new Error('预热:配置里没有 baseURL')

  const t0 = Date.now()
  await waitForServer(base)

  const seen = new Set<string>([ENTRY])
  const queue = [ENTRY]

  while (queue.length > 0 && seen.size < MAX_MODULES) {
    const batch = queue.splice(0, CONCURRENCY)
    const found = await Promise.all(
      batch.map(async (url) => {
        try {
          const r = await fetch(base + url)
          if (!r.ok) return []
          const text = await r.text()
          return [...text.matchAll(SPEC_RE)].map((m) => m[1])
        } catch {
          // 单个模块拿不到不算事:预热是尽力而为,爬不动的那个自然会在用例里被现转。
          return []
        }
      }),
    )
    for (const spec of found.flat()) {
      // 只爬源码。node_modules 下的是 vite 预打包过的,本来就便宜;
      // /@vite/client 之类的虚拟模块也不用管。
      if (!spec.startsWith('/src/')) continue
      const clean = spec.split('#')[0]
      if (seen.has(clean)) continue
      seen.add(clean)
      queue.push(clean)
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1)
  if (seen.size < MIN_EXPECTED) {
    throw new Error(
      `预热只爬到 ${seen.size} 个模块(至少该有 ${MIN_EXPECTED})—— ` +
        `爬虫多半坏了(vite 改了重写写法?入口不是 ${ENTRY} 了?)。` +
        `修它,别删它:预热悄悄不工作的表现只是「e2e 又开始偶尔红」。`,
    )
  }
  console.log(`预热:转换了 ${seen.size} 个模块,${secs}s`)
}
