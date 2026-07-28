import { expect, test } from '@playwright/test'

// 热座双人同机:同一台设备轮流出牌。
// 这条闸门钉住整个模式成立的那一点 —— **换人时必须先把上一个人的手牌盖住**。
test('演武场:热座换人时落帘', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /演武场|Training/ }).click()
  await page.getByRole('button', { name: /热座双人|Hot seat/ }).click()
  await page.getByRole('button', { name: /对坐开战|Hot seat ›/ }).click()

  // 先手直接进调度(开局视角就是先手,不落帘)
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()

  // 轮到后手调度 —— 视角一换,帘子必须落下来
  await expect(page.getByText(/請交予|Pass to player/)).toBeVisible()
  await page.getByRole('button', { name: /我已接手|I have it/ }).click()
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
})

test('非热座对局完全不受影响 —— 没有帘子', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByText(/請交予|Pass to player/)).toHaveCount(0)
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()
})
