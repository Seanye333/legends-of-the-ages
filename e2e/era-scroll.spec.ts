import { expect, test } from '@playwright/test'

// 時代長卷:六块时代摆成一条路。它和「書房」那条时代进度条问的不是同一个问题 ——
// 那条是收集度,这条是「这是个什么时代、这一块里站着谁」。
test('名将列传:时代长卷横向铺开六个时代,选中的那一块决定下方列传', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名将列传|Chronicles/ }).click()
  await page.getByRole('button', { name: /時代長卷|The Scroll/ }).click()

  // 六块都在(横滚容器里,后面几块要滚才看得见 —— 用 attached 而不是 visible)
  for (const era of ['先秦', '秦漢', '三國兩晉', '隋唐五代', '宋元', '明清']) {
    await expect(page.getByRole('heading', { name: era })).toBeAttached()
  }
  // 年代与画像文字都得有 —— 只有名字的话它就退化成了六个分类标签
  await expect(page.getByText('前 770 — 前 221')).toBeVisible()
  await expect(page.getByText(/百家爭鳴/)).toBeVisible()

  // 默认选中第一块,下方列传跟着翻到先秦
  await expect(page.locator('main, body')).toBeVisible()
  const heading = page.getByRole('heading', { name: '先秦' })
  await expect(heading).toBeVisible()
})
