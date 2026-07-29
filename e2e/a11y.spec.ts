import { expect, test } from '@playwright/test'

// 无障碍三件套:色觉辅助、界面缩放、繁简。
// 三个都是**看不见的默认值** —— 不开的时候什么都不该变,这正是最容易回归的地方。
test('设置页给出色觉辅助、界面缩放与字形三个开关', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('色觉辅助')).toBeVisible()
  await expect(page.getByText(/界面缩放/)).toBeVisible()
  await expect(page.getByRole('button', { name: /繁體/ })).toBeVisible()
  await expect(page.getByRole('button', { name: '简体' })).toBeVisible()
})

test('色觉辅助落成 <html data-colorblind>,不开时是 false', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-colorblind', 'false')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByText('色觉辅助').click()
  await expect(page.locator('html')).toHaveAttribute('data-colorblind', 'true')
})

test('字形切到简体之后,卡池文案跟着变', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await page.getByRole('button', { name: '简体' }).click()
  await page.getByRole('button', { name: /← 返回|返回/ }).first().click()
  await page.getByRole('button', { name: '名将图鉴' }).click()
  // 「戰吼」是卡面文案里最常见的词,切简体之后应当一个都不剩
  await expect(page.getByText('戰吼').first()).toBeHidden({ timeout: 2000 }).catch(() => {})
  const trad = await page.getByText('戰吼').count()
  expect(trad).toBe(0)
})
