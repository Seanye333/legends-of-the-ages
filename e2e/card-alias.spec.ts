import { test, expect } from '@playwright/test'

// 卡面绰号。ROADMAP 在这一条上专门写着「卡面是小尺寸三行布局,**改之前要截图验证**」——
// 所以这条 e2e 钉的是两件事:短的**真的显示**,长的**真的不上卡面**
// (六个字的那两个会顶乱版面,它们仍在表里、图鉴详情看得到)。

test('卡面绰号:短的显示,长的不上卡面', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 })
  await page.goto('/')
  await page.getByRole('button', { name: /名将图鉴|Collection/ }).first().click()
  await page.getByPlaceholder(/搜索名将/).fill('呂布')
  await expect(page.getByText('三姓家奴')).toBeVisible({ timeout: 10000 })
  // 六个字的那两个不上卡面(FACE_MAX = 5),但图鉴详情里仍然看得到
  await page.getByPlaceholder(/搜索名将/).fill('黃霸')
  await page.waitForTimeout(400)
  await expect(page.getByText('天下第一賢吏')).toHaveCount(0)
})
