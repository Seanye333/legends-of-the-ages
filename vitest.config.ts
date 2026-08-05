import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // server/ 不在 tsc 项目内(wrangler 用 esbuild 打包),但**逻辑仍然要能被单测覆盖**。
    // 此前 server 零单元测试,drive-test 是唯一防线,而它需要手动起 wrangler —— 注定会腐烂。
    // scripts/ 也纳进来:平衡闸门的**判定逻辑**是纯函数,值得单独钉住。
    // 闸门的价值全在「该红时红、不该红时不红」,而那一层此前只能靠人跑一遍
    // 十分钟的模拟去感受 —— 结果就是没人验,sim-campaign 的判定带着
    // 「样本量撑不起自己结论」的毛病活了很久(见 scripts/campaignGate.ts)。
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      'server/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
    // 默认 node:引擎/内容/服务端的测试跑得更快,也顺带保证它们不依赖 DOM。
    // 需要 DOM 的组件测试在文件头写 `// @vitest-environment jsdom` 自行切换
    // (environmentMatchGlobs 已废弃,docblock 是现在的推荐做法)。
  },
})
