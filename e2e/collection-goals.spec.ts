import { expect, test } from '@playwright/test'

// 收藏度:卡池两千三百张,而收藏系统此前只回答「这张你有没有」。
test('图鉴:收藏度面板列出六个时代块的进度', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名将图鉴|Collection/ }).click()
  await page.getByText(/收藏度|Collection progress/).click()
  for (const era of ['先秦', '秦漢', '三國兩晉', '隋唐五代', '宋元', '明清']) {
    await expect(page.getByText(era, { exact: true })).toBeVisible()
  }
})
