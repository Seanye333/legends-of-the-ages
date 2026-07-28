import { expect, test } from '@playwright/test'

// 书房:进度散落在八个 store 里,每个只在自己那一屏露出 ——
// 在此之前没有任何一屏能回答「我玩了多少」。
test('书房:一屏列出军衔、征战进度、收藏度、战绩', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /書房|The Study/ }).click()
  await expect(page.getByText('白身')).toBeVisible()
  await expect(page.getByRole('heading', { name: /征戰|Campaigns/ })).toBeVisible()
  await expect(page.getByText(/群雄逐鹿/)).toBeVisible()
  await expect(page.getByRole('heading', { name: /典藏|Collection/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /戰績|Record/ })).toBeVisible()
})
