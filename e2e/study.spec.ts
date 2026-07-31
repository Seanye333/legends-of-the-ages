import { expect, test } from '@playwright/test'

// 书房:进度散落在八个 store 里,每个只在自己那一屏露出 ——
// 在此之前没有任何一屏能回答「我玩了多少」。
test('书房:一屏列出军衔、征战进度、收藏度、战绩', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /書房|The Study/ }).click()

  // **断言要限定在書房这一屏里。**
  // 换屏是交叉淡化的:旧屏(标题页)会在 DOM 里多留 0.44 秒做淡出,
  // 而标题页上也有「群雄逐鹿」——三个灰按钮的解锁提示里还各有一次。
  // 不限定的话 getByText(/群雄逐鹿/) 会同时命中 5 个元素,
  // Playwright 的 strict 模式直接判失败,而且**只在淡出没结束时**才失败:
  // 那是一条按机器快慢随机红的用例。
  const study = page.locator('[class*="screen-enter"]')
  await expect(study.getByText('白身')).toBeVisible()
  await expect(study.getByRole('heading', { name: /征戰|Campaigns/ })).toBeVisible()
  await expect(study.getByText('群雄逐鹿', { exact: true })).toBeVisible()
  await expect(study.getByRole('heading', { name: /典藏|Collection/ })).toBeVisible()
  await expect(study.getByRole('heading', { name: /戰績|Record/ })).toBeVisible()
})
