import { test, expect } from '@playwright/test'

// 战役难度档。**列表上写的血量必须是真的会打的那个数** ——
// 这条 e2e 是补 bug 补出来的:第一版只把难度接进了开打那一行,
// 列表和简报仍然显示卡面基础血,于是选了「史實」屏幕上还写着 30 HP,
// 而真打是 39。那不是显示问题,是卡面在说谎。

test('战役难度三档', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /群雄逐鹿|Campaign/ }).first().click()
  await expect(page.getByRole('button', { name: '標準' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/調校過的那一档/)).toBeVisible()
  await page.getByRole('button', { name: '史實' }).click()
  await expect(page.getByText(/一點三倍/)).toBeVisible()
  // 列表上写的必须是真的会打的那个数:30 x 1.3 = 39
  await expect(page.getByText('39 HP')).toBeVisible()
  await page.getByRole('button', { name: '簡易' }).click()
  await expect(page.getByText('23 HP')).toBeVisible()
  await page.getByRole('button', { name: '標準' }).click()
  await expect(page.getByText('30 HP')).toBeVisible()
})
