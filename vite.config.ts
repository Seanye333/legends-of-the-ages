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
  server: { port: 5174 },
  plugins: [
    react(),
    ...(isTauri
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate', // 新版本上线自动替换旧缓存
            injectRegister: 'auto', // 注册脚本由插件注入,不用改 main.tsx
            includeAssets: ['favicon-32.png', 'favicon-192.png', 'apple-touch-icon.png'],
            manifest: {
              name: '千古名将 Legends of the Ages',
              short_name: '千古名将',
              description: '全朝代名将卡牌对战 —— 炉石类 1v1 CCG,2,250 张卡横跨 18 个朝代。',
              lang: 'zh-CN',
              theme_color: '#12100c',
              background_color: '#12100c',
              display: 'standalone',
              orientation: 'any',
              icons: [
                { src: 'favicon-192.png', sizes: '192x192', type: 'image/png' },
                { src: 'apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
                { src: 'favicon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
              ],
            },
            workbox: {
              // 卡池 JSON 内嵌在主 bundle 里,远超 workbox 默认 2MB 上限
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
              // 只 precache app shell —— 立绘(.webp)一律不进 precache,
              // 否则随包的 27MB 签名卡立绘会在首次访问时被一次性下载。
              globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}'],
              navigateFallbackDenylist: [/^\/api\//],
              cleanupOutdatedCaches: true,
              runtimeCaching: [
                {
                  // 立绘按需缓存:随包的(同源 /portraits/)和 CDN 的(跨源)都命中,
                  // 用扩展名匹配,这样换 CDN 基址不用改这里。全站只有立绘是 .webp。
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
