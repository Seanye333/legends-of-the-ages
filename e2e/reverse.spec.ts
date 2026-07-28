import { expect, test } from '@playwright/test'

// 逆位挑战:正位通关后才解锁 —— 先把这一仗按史实打赢一次,再来问「反过来呢」。
test('名局:通关后出现逆位,写明你这次是谁', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'qiangu-history',
      JSON.stringify({ state: { cleared: ['hb-guandu'], reversed: [], active: null, activeReverse: false }, version: 0 }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: /名局重现|Great Battles/ }).click()
  await page.getByRole('button', { name: /官渡之戰/ }).click()
  await expect(page.getByText(/官渡 · 逆位/)).toBeVisible()
  await expect(page.getByText(/这一次你是袁绍/)).toBeVisible()
  await expect(page.getByRole('button', { name: /逆位而战|Fight Reversed/ })).toBeVisible()
})

test('未通关时没有逆位入口', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名局重现|Great Battles/ }).click()
  await page.getByRole('button', { name: /官渡之戰/ }).click()
  await expect(page.getByRole('button', { name: /逆位而战/ })).toHaveCount(0)
})
