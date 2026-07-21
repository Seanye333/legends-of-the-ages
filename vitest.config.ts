import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // server/ 不在 tsc 项目内(wrangler 用 esbuild 打包),但**逻辑仍然要能被单测覆盖**。
    // 此前 server 零单元测试,drive-test 是唯一防线,而它需要手动起 wrangler —— 注定会腐烂。
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'server/**/*.test.ts'],
    // 默认 node:引擎/内容/服务端的测试跑得更快,也顺带保证它们不依赖 DOM。
    // 需要 DOM 的组件测试在文件头写 `// @vitest-environment jsdom` 自行切换
    // (environmentMatchGlobs 已废弃,docblock 是现在的推荐做法)。
  },
})
