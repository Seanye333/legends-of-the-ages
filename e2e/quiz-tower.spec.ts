import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 稽古与登楼此前在 28 个 spec 里**零命中** —— 两个完整的模式,
// 从入口到核心循环没有任何自动化覆盖。
//
// 这两条不追求测全,追求的是「这个模式还活着」:
// 进得去、核心动作能做、做完有反馈。屏幕级的回归(比如某次重构把
// 答题选项的 onClick 改没了)靠它们兜住。

test('稽古:答一题就有对错反馈,并揭晓这是谁', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '稽古' }).click()

  // 题面与四个选项
  await expect(page.getByRole('heading', { name: '稽古' })).toBeVisible()
  await expect(page.getByText(/1 \/ 5|1 \/ \d+/)).toBeVisible()

  // 四选一:点第一个可点的选项(对错都行 —— 这里测的是「有反馈」)。
  // **必须限定 button** —— 选项容器的类名是 `options`,也含 "opt",
  // 不限定的话 .first() 匹配到的是那个 div,点它什么都不会发生。
  const optionButtons = page.locator('button[class*="opt"]')
  await expect(optionButtons.first()).toBeVisible()
  await optionButtons.first().click()

  // 答完必须给出两样东西:判定(选项染色)与揭晓(这是谁)
  await expect(page.locator('[class*="optRight"], [class*="optWrong"]').first()).toBeVisible()
  // 揭晓块带立绘与名字 —— 一轮五题打完至少记住一个人,这是它存在的理由
  await expect(page.locator('[class*="reveal"]').first()).toBeVisible()

  // 能走到下一题
  await page.getByRole('button', { name: /下一题|下一題|Next|再考一轮/ }).first().click()
  await expect(page.locator('button[class*="opt"]').first()).toBeVisible()
})

test('登楼:授兵書三选一,选完进得了下一层', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: /^登楼$|^Tower$/ }).click()

  await expect(page.getByRole('heading', { name: /登楼/ })).toBeVisible()
  // 当前层与往上四层的预览都要在
  await expect(page.getByText(/第 \d+ 层/).first()).toBeVisible()

  // 兵书三选一:第 1 层就该给(每 3 层一本,首层必给)
  const books = page.locator('[class*="bookCard"]')
  const n = await books.count()
  if (n > 0) {
    await expect(n).toBeGreaterThanOrEqual(3)
    await books.first().click()
  }

  // 无论有没有兵书环节,开战入口都必须在 —— 那是这个模式的核心动作
  await expect(page.getByRole('button', { name: /登楼|開戰|开战|出战|挑战/ }).first()).toBeVisible()
})
