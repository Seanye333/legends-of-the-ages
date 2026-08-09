import { expect, test } from '@playwright/test'

// 按羁绊组卡:构筑器此前只会指出「缺谁」,不会帮忙 ——
// 而从零搭一副合法的三十张牌是新玩家最陡的一道坎。
test('构筑器:选一条羁绊就自动配好一副牌', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /组建卡组|Deck Builder/ }).click()
  // 先选主公(桃园仁德的预组即可定主义)
  await page.getByRole('button', { name: /桃園仁德/ }).first().click()
  // 钉类名而不是钉文案。原来这里写的是 `getByText(/按羈絆組卡|…/)`,
  // 而「按兵種 / 降將组卡」上线时这行标题正当地变成了
  // 「按羈絆 · 家族 · 兵種組卡」—— 功能没坏,测试红了,而且**红得毫无信息量**。
  // 下一行本来就在用 `[class*="seedRow"]`,摘要行照同一个写法钉就是了:
  // 类名跟着结构走,文案跟着产品走,e2e 该锚在前者上。
  await page.locator('[class*="seedSummary"]').click()
  // 列表里点第一条
  await page.locator('[class*="seedRow"]').first().click()
  await expect(page.getByText(/已按「|Built /)).toBeVisible()
  // 配完之后卡组是满的(或接近满),保存按钮显示张数
  // 「保存卡组图」也匹配 /保存卡组/,所以这里要钉住带张数的那个
  await expect(page.getByRole('button', { name: /保存卡组\(/ })).toBeVisible()
})
