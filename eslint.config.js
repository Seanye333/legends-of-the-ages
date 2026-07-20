import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'src/content/generated',
      'src-tauri',
      'server/.wrangler', // wrangler 的打包中间产物,不是源码
      'portraits-cdn', // 立绘 CDN 导出目录(见 scripts/export-portraits.ts)
      'playwright-report',
      'test-results',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // 浏览器侧:src/ 全部跑在 DOM 环境
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  // Node 侧:构建脚本、e2e、serverless 函数
  {
    files: ['scripts/**/*.{ts,mjs,js}', 'e2e/**/*.ts', 'api/**/*.js', '*.config.{ts,js,mjs}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  // Cloudflare Workers 侧:workerd 运行时全局(WebSocket/Response/crypto/DurableObjectState…)
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      globals: { ...globals.worker, ...globals.browser, DurableObjectNamespace: 'readonly', DurableObjectState: 'readonly' },
    },
  },
  {
    // 引擎纯度围栏:确定性是联网对战的生命线。
    // 引擎内禁止墙钟、非种子随机数,以及任何对 UI/应用层/React 的依赖。
    files: ['src/engine/**/*.ts'],
    ignores: ['src/engine/**/*.test.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: 'Engine must be deterministic — no wall clock.' },
        { name: 'performance', message: 'Engine must be deterministic — no timers.' },
        { name: 'crypto', message: 'Engine must use the seeded RNG in rng.ts.' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Engine must use the seeded RNG in rng.ts.' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-*', 'zustand', '**/ui/*', '**/app/*', '**/content/*', '**/ai/*'],
              message: 'Engine must stay pure — it may only import within src/engine/.',
            },
          ],
        },
      ],
    },
  },
)
