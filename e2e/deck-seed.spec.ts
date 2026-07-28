import { expect, test } from '@playwright/test'

// 按羁绊组卡:构筑器此前只会指出「缺谁」,不会帮忙 ——
// 而从零搭一副合法的三十张牌是新玩家最陡的一道坎。
test('构筑器:选一条羁绊就自动配好一副牌', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /组建卡组|Deck Builder/ }).click()
  // 先选主公(桃园仁德的预组即可定主义)
  await page.getByRole('button', { name: /桃園仁德/ }).first().click()
  await page.getByText(/按羈絆組卡|Build around a bond/).click()
  // 列表里点第一条
  await page.locator('[class*="seedRow"]').first().click()
  await expect(page.getByText(/已按「|Built /)).toBeVisible()
  // 配完之后卡组是满的(或接近满),保存按钮显示张数
  // 「保存卡组图」也匹配 /保存卡组/,所以这里要钉住带张数的那个
  await expect(page.getByRole('button', { name: /保存卡组\(/ })).toBeVisible()
})
