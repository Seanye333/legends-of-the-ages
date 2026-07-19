import { expect, test } from '@playwright/test'

// 冒烟:标题 → 开局 → 调度 → 出牌回合流转 → 认输结算 → 回标题 → 图鉴/构筑导航。
// 全链路走真实引擎与真实 UI,任何一环断了立刻红。

test('title screen renders the full pool and navigation', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
  await expect(page.getByText(/全卡池 \d+ 张/)).toBeVisible()
  await expect(page.getByRole('button', { name: '开始对战' })).toBeVisible()
  await expect(page.getByRole('button', { name: '桃園仁德' })).toBeVisible()
  await expect(page.getByRole('button', { name: '名将图鉴' })).toBeVisible()
})

test('full match loop: start → mulligan → play → concede → back to title', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()

  // 调度:全部保留
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()

  // 对战画面:结束回合可见,打两个回合
  const endTurn = page.getByRole('button', { name: '结束回合' })
  await expect(endTurn).toBeVisible()
  for (let i = 0; i < 2; i++) {
    await expect(endTurn).toBeEnabled()
    await endTurn.click()
  }

  // 认输 → 结算 → 回标题
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: '认输' }).click()
  await expect(page.getByText(/卷土重来|凯旋而归|平分秋色/)).toBeVisible()
  await page.getByRole('button', { name: '返回标题' }).click()
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
})

test('collection screen filters and shows cards', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '名将图鉴' }).click()
  await expect(page.getByRole('heading', { name: '名将图鉴' })).toBeVisible()
  await expect(page.getByText(/已收 \d+ \/ \d+/)).toBeVisible()
  // 搜索关羽 → 点卡打开详情(效果文本 + 关键词图例可见)
  await page.getByPlaceholder('搜索名将…').fill('關羽')
  await expect(page.getByText('關羽').first()).toBeVisible()
  await page.getByText('關羽').first().click()
  await expect(page.getByText(/№\d+/)).toBeVisible()
  await expect(page.getByText('攻高者先手')).toBeVisible() // 单挑规则图例
  await page.keyboard.press('Escape')
  await page.locator('[class*="overlay"]').first().click({ position: { x: 10, y: 10 } })
  await page.getByRole('button', { name: '← 返回' }).click()
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
})

test('deck builder: pick hero and see owned pool', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '组建卡组' }).click()
  await expect(page.getByText('择主而事')).toBeVisible()
  await page.getByRole('button', { name: /劉備/ }).click()
  await expect(page.getByText('0/30', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '← 换主公' }).click()
  await expect(page.getByText('择主而事')).toBeVisible()
})

test('pack opening reveals five cards', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /卡包 ×\d+/ }).click()
  // 新手礼两包:启封
  await page.getByRole('button', { name: /启封/ }).click()
  // 依次翻五张
  for (let i = 0; i < 5; i++) {
    const next = page.locator('[class*="next"]').first()
    await next.click()
  }
  await expect(page.getByRole('button', { name: '再开一包' })).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
})
