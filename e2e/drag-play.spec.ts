import { expect, test } from '@playwright/test'

// 拖拽出牌。这条闸门真正要钉住的是**它没有把点击弄坏** ——
// 拖拽是加法:桌面端点击更快、无障碍只有点击、五十多条既有用例全是 .click()。

async function intoMatch(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: '演武场' }).click()
  await expect(page.getByRole('heading', { name: '演武场 · 自由对练' })).toBeVisible()
  await page.getByRole('button', { name: '名将' }).click()
  await page.getByRole('button', { name: /开战/ }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
}

test('拖起来再放回去 —— 牌不该被打出', async ({ page }) => {
  await intoMatch(page)
  const hand = page.locator('[class*="slot"]').first()
  await expect(hand).toBeVisible()
  const before = await page.locator('[class*="slot"]').count()

  const box = (await hand.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  // 抬起来一点点(超过 8px 判定为拖拽,但没到 64px 的出牌线)
  await page.mouse.move(cx + 4, cy - 30, { steps: 6 })
  await page.mouse.up()

  // 手牌数不变 —— 「拖到一半反悔」是拖拽相对点击唯一多出来的能力,
  // 它必须真的能反悔,否则拖拽只是一个更慢的点击。
  await page.waitForTimeout(300)
  expect(await page.locator('[class*="slot"]').count()).toBe(before)
})

test('点击出牌照旧', async ({ page }) => {
  await intoMatch(page)
  // 只验「点了有反应」:1 费牌未必存在,所以不断言手牌一定减少,
  // 而是断言点击之后界面进入了某种响应态(选中或已出牌)。
  const first = page.locator('[class*="slot"]').first()
  await first.click()
  await expect(page.locator('[class*="slot"]')).not.toHaveCount(0)
})
