import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // 端口纪律(和 ARCHITECTURE.md 那条对齐):5173 姊妹项目 / 5174 本项目 dev /
  // **5175 本项目 e2e**。
  //
  // 原来用的是 5199,而姊妹仓库 ThreeKingdomMastersIOS 的 dev server 也会占 5199 ——
  // 配合 `reuseExistingServer: true`,Playwright 会**高高兴兴地连上另一个游戏**跑完整套用例。
  // 实测踩到了:那次所有点模式入口的用例一起超时,报错却是「找不到演武场按钮」,
  // 完全看不出和端口有关系。守着这一条的是 e2e/served-app.spec.ts。
  webServer: {
    command: 'npx vite --port 5175 --strictPort',
    url: 'http://localhost:5175',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
