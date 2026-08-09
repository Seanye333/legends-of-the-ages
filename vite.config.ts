import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Tauri(桌面/iOS)从自定义协议加载本地文件,Service Worker 在 tauri://、
// capacitor 式的非 http(s) 源上不可用(注册会直接抛错),而且离线缓存对已经
// 完全打进包里的资源毫无意义。所以 PWA 只在 web 构建里挂载:
// `npx tauri build` / `tauri ios build` 会设 TAURI_ENV_PLATFORM,
// 这里据此整体跳过插件,产物里连 sw.js 和注册脚本都不会出现。
const isTauri = !!(process.env.TAURI_ENV_PLATFORM ?? process.env.TAURI_PLATFORM)

export default defineConfig({
  // ⛔ **别加 server.warmup**(2026-08-09 量过,反效果)
  // 动机是对的:dev 下 vite 按请求现转,而各模式的内容数据现在是懒加载的,
  // 这笔冷启动开销正好落在「点进模式 → 进对局」这一步 —— e2e 断言最密的地方。
  // 但 `warmup: { clientFiles: [...screens, ...content] }` 实测让情况更糟:
  //   刚启的 server,无 warmup → 4 条要靠重试才过(3.9 min)
  //   刚启的 server,有 warmup → **7 条**(4.1 min)
  //   模块热了之后          → 81/81(2.6 min)
  // 因为 warmup 是在**服务端进程里**转换的,而 Playwright 探到端口能响应就开跑了 ——
  // 于是它不是把开销挪走,是让测试去和一个正忙的 server 抢 CPU。
  // 真要治得让**测试开跑之前**这件事就做完(globalSetup),见 ROADMAP 第 49 条。
  server: { port: 5174 },
  build: {
    rollupOptions: {
      output: {
        // 拆掉 1.4MB 的单一主 chunk:第三方库单独成块(稳定、可长缓存),
        // 生成卡池(2261 张,体量最大)再单独一块 —— 应用代码改动不再让整包失效。
        manualChunks(id) {
          if (id.includes('node_modules')) return 'vendor'
          // 列传单独一块。**必须在 content 之前判**:
          // 生成目录下有两个大文件 —— cards.gen(卡池,首屏必需)与 lore.gen
          // (2,211 条传记/台词,144KB,只有列传页与卡牌详情要)。
          // 归成同一个 chunk 的话,`loreLazy.ts` 那层动态 import 会解析到
          // **同一个文件**,懒加载被打包规则原地抵消 —— 代码写着懒加载、
          // 产物里首屏照样下载,而且没有任何地方会报错。
          if (id.includes('/content/generated/lore.gen')) return 'lore'
          if (id.includes('/content/generated/')) return 'content'
          // ⛔ **别把 overrides 也归到 content**(2026-08-09 量过,反效果)
          // 动机是合理的:上面那条基线的标签写着「内容层(卡池 + 覆盖表)」,
          // 而规则只收 generated/,覆盖表其实一直待在首屏主包里,
          // 把主包顶到贴着 190KB 的上限(189.8)。
          // 但加一行 `if (id.includes('/content/overrides/')) return 'content'`
          // 实测:主包 189.8 → 109.9,内容层 128.7 → **233.1**,合计 390 → 411.5KB,
          // 反而超总预算 11.5KB。覆盖表挨着 cards.gen 那一整串 JSON 压得更差 ——
          // gzip 是**按 chunk 各压各的**,分开反而各自有更合身的字典。
          // 也就是说现在这个分法不是历史遗留,是它本来就更省。
        },
      },
    },
  },
  plugins: [
    react(),
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate', // 新版本上线自动替换旧缓存
            injectRegister: 'auto', // 注册脚本由插件注入,不用改 main.tsx
            includeAssets: ['favicon-32.png', 'favicon-192.png', 'favicon-512.png', 'apple-touch-icon.png'],
            manifest: {
              name: '千古名将 Legends of the Ages',
              short_name: '千古名将',
              description: '全朝代名将卡牌对战 —— 炉石类 1v1 CCG,2,250 张卡横跨 18 个朝代。',
              lang: 'zh-CN',
              theme_color: '#12100c',
              background_color: '#12100c',
              display: 'standalone',
              orientation: 'any',
              // 512 是 PWA 的硬要求(Chrome 安装横幅、Android 启动图标都读它),
              // 此前 public/ 里最大只有 192 —— 装出来的图标是放大糊的。
              icons: [
                { src: 'favicon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'favicon-512.png', sizes: '512x512', type: 'image/png' },
                { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
                { src: 'favicon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
              categories: ['games', 'entertainment'],
              id: '/',
            },
            workbox: {
              // 卡池 JSON 内嵌在主 bundle 里,远超 workbox 默认 2MB 上限
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
              // 只 precache app shell —— 立绘(.webp)一律不进 precache,
              // 否则随包的 27MB 签名卡立绘会在首次访问时被一次性下载。
              //
              // **但 art/*.webp 必须进**(5 张,JPG 转 WebP 后共 0.65MB):
              // 它们是标题、牌桌、调度、结算这四屏的底图 —— 缺了它们离线打开的
              // 不是「少几张立绘的游戏」,而是四块黑屏。立绘缺了还有拓印兜底,
              // 底图没有兜底。这 0.65MB 发生在首屏**之后**(precache 是 SW 装完
              // 才跑),所以 perf-budget 量的首屏预算一个字节都不受影响。
              // 注意:下面立绘的 runtimeCaching 也按 .webp 匹配 —— art/ 这五张
              // 会先被 precache 命中,不会落进 LRU 的立绘桶,两者不冲突。
              globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}', 'art/*.webp'],
              navigateFallbackDenylist: [/^\/api\//],
              cleanupOutdatedCaches: true,
              runtimeCaching: [
                {
                  // 立绘按需缓存:随包的(同源 /portraits/)和 CDN 的(跨源)都命中,
                  // 用扩展名匹配,这样换 CDN 基址不用改这里。
                  // art/ 底图也是 .webp,但它们已被 precache 抢先接住(见上)。
                  urlPattern: /\.webp(\?.*)?$/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'qiangu-portraits',
                    // 2,250 张卡 × 最多 2 张图,但正常玩家不会翻遍全池;
                    // 800 张 ≈ 80MB 上限,LRU 淘汰,不至于把手机塞爆。
                    expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 60 },
                    // 0 = 跨源 CDN 未开 CORS 时的 opaque 响应也存
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ],
            },
            // 开发期永不注册 SW —— 否则改一行代码要清缓存
            devOptions: { enabled: false },
          }),
        ]),
  ],
})
