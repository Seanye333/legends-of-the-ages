import { expect, test } from '@playwright/test'

// 天时:零状态机制(由回合数推出)。它的全部价值在于**可以被预判**,
// 所以界面上必须同时写出「现在」和「下一段」—— 只写现在的话,
// 想排「等到夜半再劫营」还是得自己背回合数。
test('对局画面显示天时,且写出下一段', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()

  const sky = page.getByText(/拂曉|正午|黃昏|夜半/).first()
  await expect(sky).toBeVisible()
  // 「→ 下一段」的箭头
  await expect(page.getByText(/→\s*(拂曉|正午|黃昏|夜半)/)).toBeVisible()
})
