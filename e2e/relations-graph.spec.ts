import { expect, test } from '@playwright/test'

// 关系图谱:31 条羁绊 + 29 对宿敌本来就是一张网络图,
// 而在此之前玩家没有任何地方能通览它们 —— 只能在对局里一条条撞见。
test('名将列传:关系图谱列出羁绊与宿敌,点进去到人物', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名将列传|Chronicles/ }).click()
  await page.getByRole('button', { name: /關係圖譜|Relations/ }).click()

  await expect(page.getByText(/羈絆 · \d+ 條/)).toBeVisible()
  await expect(page.getByText('桃園結義')).toBeVisible()
  await expect(page.getByText(/宿敵 · \d+ 對/)).toBeVisible()
  await expect(page.getByText('五丈原').first()).toBeVisible()
  // 宿敌带史料 —— 这是「让人去查史料」的钩子
  await expect(page.getByText(/死諸葛走生仲達/)).toBeVisible()
})
