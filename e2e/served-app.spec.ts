import { expect, test } from '@playwright/test'

// 「我们测的是不是自己这个 app」。
//
// 这条看起来毫无意义的用例,来自一次真实的浪费:
// e2e 端口从前是 5199,而姊妹仓库的 dev server 也用 5199;
// 配置里 `reuseExistingServer: true`,于是 Playwright 直接连上了**另一个游戏**,
// 整套用例一起超时,而报错是「找不到演武场按钮」—— 从错误信息完全看不出端口的事。
//
// 一行断言就能把这一整类问题挡在门外,而且它会**第一个**失败(文件名排序靠前),
// 后面几十条的报错噪音都省了。
test('服务的是本项目,不是别的 app', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/千古名将|Legends of the Ages/)
})
