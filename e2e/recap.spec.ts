import { expect, test } from '@playwright/test'

// 战报海报:分享的是**结果**不是重放 —— 一份战报是每一帧的完整 GameState
// (上限 2.5MB),编成码长度以兆计,而没有服务器就没有短链接。
test('终局结算:能导出战报图', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  // 直接认输拿到终局面板
  await page.getByRole('button', { name: /^认输$|^Concede$/ }).click()
  await page.getByRole('button', { name: /确认|认输/ }).last().click()
  const btn = page.getByRole('button', { name: /保存戰報圖|Save recap/ })
  await expect(btn).toBeVisible({ timeout: 15000 })
  const dl = page.waitForEvent('download', { timeout: 15000 })
  await btn.click()
  expect((await dl).suggestedFilename()).toMatch(/\.png$/)
})
