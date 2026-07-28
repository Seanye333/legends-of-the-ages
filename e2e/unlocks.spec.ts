import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 模式渐进解锁的端到端闸门。
// 单测(src/content/unlocks.test.ts)管的是门槛算术,这里管的是**界面上真的锁住了**:
// 灰按钮点不动、条件写在脸上、够了之后真的能进。

test('新号:深度模式灰着,并写清怎么解锁', async ({ page }) => {
  await page.goto('/')
  const tower = page.getByRole('button', { name: /^登楼$|^Tower$/ })
  await expect(tower).toBeVisible()
  await expect(tower).toBeDisabled()
  // 条件必须写在按钮上 —— 一个灰着又不说为什么的按钮比藏起来还糟
  await expect(tower).toContainText(/通 2 关解锁|Clear 2/)
})

test('老号:同一个入口可以点进去', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  const tower = page.getByRole('button', { name: /^登楼$|^Tower$/ })
  await expect(tower).toBeEnabled()
  await tower.click()
  await expect(page.getByRole('heading', { name: /登楼|Tower/ })).toBeVisible()
})

test('主线入口对新号永远是开着的', async ({ page }) => {
  await page.goto('/')
  // 一个新玩家总得有地方开始。这三个就是那个地方,任何时候都不该被锁。
  for (const name of [/群雄逐鹿/, /名局重现/, /演武场/]) {
    await expect(page.getByRole('button', { name }).first()).toBeEnabled()
  }
})
