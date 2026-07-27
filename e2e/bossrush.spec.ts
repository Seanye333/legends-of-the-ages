import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

// 群雄连斩:冒险全通之后才露出来。
// 这条闸门同时钉住「没通关时不该看见」和「通关后能开阵」。
const ALL_BOSSES = (readFileSync('src/content/campaign.ts', 'utf8').match(/^    id: 'boss-/gm) ?? [])
  .length

test('未通关时标题页没有连斩入口', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /群雄连斩|Gauntlet/ })).toHaveCount(0)
})

test('全通之后可以开阵,血量继承写在界面上', async ({ page }) => {
  const cleared = Array.from({ length: ALL_BOSSES }, (_, i) => `b${i}`)
  await page.addInitScript((ids: string[]) => {
    localStorage.setItem(
      'qiangu-campaign',
      JSON.stringify({ state: { cleared: ids, trialsCleared: [] }, version: 0 }),
    )
  }, cleared)
  await page.goto('/')
  // cleared 的长度够就解锁(内容 id 是否对得上由单测管)
  await page.getByRole('button', { name: /群雄连斩|Gauntlet/ }).click()
  await expect(page.getByText(/第 1 陣/)).toBeVisible()
  await expect(page.getByRole('button', { name: /^开阵$|^Begin$/ })).toBeVisible()
})
