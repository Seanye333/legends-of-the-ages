import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // server/ 不在 tsc 项目内(wrangler 用 esbuild 打包),但**逻辑仍然要能被单测覆盖**。
    // 此前 server 零单元测试,drive-test 是唯一防线,而它需要手动起 wrangler —— 注定会腐烂。
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
  },
})
