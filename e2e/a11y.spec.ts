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

// 讲堂的规则说明里有 16 处 `**着重**`,此前星号原样露在界面上 ——
// 写文案的人在源码里读它,那里星号是对的,所以谁都没发现。
test('兵法讲堂不会把 markdown 星号原样显示出来', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '兵法讲堂' }).click()
  await expect(page.getByRole('heading', { name: /兵法讲堂|Codex/ })).toBeVisible()
  expect(await page.getByText('**').count()).toBe(0)
  // 着重号确实渲染出来了(而不是被删掉)
  await expect(page.locator('strong').first()).toBeVisible()
})
