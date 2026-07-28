import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 残局分享:UGC 最难的一环从来不是编辑器,是**审核** ——
// 而这里有完备求解器,导入时当场跑一遍,无解的直接拒收。
test('斩杀谜题:坏码被拒,并说清原因', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: /斩杀谜题|Lethal Puzzles/ }).click()
  await page.getByPlaceholder(/粘贴残局码|Paste a puzzle code/).fill('随便一串东西')
  await page.getByRole('button', { name: /^导入残局$|^Import$/ }).click()
  await expect(page.getByText(/这不像一个残局码|could not be read/)).toBeVisible()
})

test('斩杀谜题:能复制今日残局码', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: /斩杀谜题|Lethal Puzzles/ }).click()
  await page.getByRole('button', { name: /复制今日残局码|Copy daily code/ }).click()
  await expect(page.getByText(/每日残局码已复制|code copied/)).toBeVisible()
})
