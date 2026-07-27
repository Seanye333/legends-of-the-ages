import { expect, test } from '@playwright/test'

// 讲堂实练:兵法讲堂此前是一本只能读的手册,没有任何一处能上手。
// 这条闸门钉住「读到那条词条 → 点一下 → 真的进了一局残局」。
test('讲堂:阵型词条能开一局实练', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /兵法讲堂|Codex/ }).click()
  await page.getByRole('button', { name: /陣型 Formation/ }).click()
  await page.getByRole('button', { name: /上手试一试|Try it/ }).click()
  // 残局直接从「你的回合」开始,没有调度
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()
  await expect(page.getByRole('button', { name: /^提示$|^Hint$/ })).toBeVisible()
})
