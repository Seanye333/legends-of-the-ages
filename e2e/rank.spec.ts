import { expect, test } from '@playwright/test'

// 军衔:标题页有二十几个入口、每个都发自己的进度,而在此之前
// 没有任何一样东西回答「我在这个游戏里走到哪儿了」。
// 新档那一档是 2026-08-07 走新玩家流程之后分出来的:
// 一局都没打过的人看到的是「白身 · 距什长还差 20」—— 两个他没见过的词加一个没解释的数。
// 现在零战功时先说清楚这是什么,有了战功再显示差距。两档各验一遍。
test('新档:显示军衔并说清它是什么', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('白身')).toBeVisible()
  await expect(page.getByText(/军衔 · 打赢对局积战功/)).toBeVisible()
  await expect(page.getByText(/距.+还差/)).toHaveCount(0)
})

test('有战功之后:显示到下一衔还差多少', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'qiangu-collection',
      JSON.stringify({
        state: { owned: {}, packs: 0, merit: 0, wins: 1, losses: 0, customDecks: [], collectionClaimed: [] },
        version: 0,
      }),
    )
  })
  await page.goto('/')
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
