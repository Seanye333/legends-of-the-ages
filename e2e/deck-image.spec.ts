import { expect, test } from '@playwright/test'

// 卡组分享图:卡组码是给游戏读的,人看不出里面是什么牌。
// 这条闸门只验「按钮在、点了不炸、真的产出一个 PNG」—— 图长什么样靠人眼。
test('构筑器:能导出卡组图', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /组建卡组|Deck Builder/ }).click()
  await page.getByRole('button', { name: /桃園仁德/ }).first().click()
  const btn = page.getByRole('button', { name: /保存卡组图|Save deck image/ })
  await expect(btn).toBeEnabled()
  const download = page.waitForEvent('download', { timeout: 15000 })
  await btn.click()
  const file = await download
  expect(file.suggestedFilename()).toMatch(/\.png$/)
})
