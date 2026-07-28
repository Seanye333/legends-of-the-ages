import { expect, test } from '@playwright/test'

// 卡背:奖励此前只有功勋与卡包,两者最终都落回卡池 ——
// 「我通关了第三章」在牌桌上是不可见的。卡背是唯一一样对手也看得见的东西。
test('设置:卡背可选,未解锁的显示为 ???', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /^设置$|^Settings$/ }).click()
  await expect(page.getByRole('heading', { name: /^卡背$|^Card Back$/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /素麻/ })).toBeEnabled()
  // 零进度时其余全是锁着的
  await expect(page.getByRole('button', { name: '???' }).first()).toBeDisabled()
})
