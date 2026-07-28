import { expect, test } from '@playwright/test'

// 军衔:标题页有二十几个入口、每个都发自己的进度,而在此之前
// 没有任何一样东西回答「我在这个游戏里走到哪儿了」。
test('标题页显示军衔与到下一衔的差距', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('白身')).toBeVisible()
  await expect(page.getByText(/距.+还差/)).toBeVisible()
})

test('打过的东西越多,衔越高', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'qiangu-collection',
      JSON.stringify({ state: { owned: {}, packs: 0, merit: 0, wins: 120, losses: 0, customDecks: [], collectionClaimed: [] }, version: 0 }),
    )
  })
  await page.goto('/')
  await expect(page.getByText('白身')).toHaveCount(0)
})
