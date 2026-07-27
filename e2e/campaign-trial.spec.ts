import { expect, test } from '@playwright/test'

// 冒险的两块新东西:关底试炼(首通后解锁的第二种打法)与 Boss 台词。
// 试炼要先通关才看得到,所以这里直接把进度塞进 localStorage —— 打赢十六关不是 e2e 的活。

test('关底试炼:通关后出现,写明换了什么赢法', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'qiangu-campaign',
      JSON.stringify({ state: { cleared: ['boss-zhang-jiao'], trialsCleared: [] }, version: 0 }),
    )
  })
  await page.goto('/')
  await page.getByRole('button', { name: /群雄逐鹿|Contenders/ }).click()
  await page.getByRole('button', { name: /張角/ }).click()

  await expect(page.getByText(/試煉 · 蒼天已死/)).toBeVisible()
  await expect(page.getByText(/撑过 12 回合/)).toBeVisible()
  await expect(page.getByRole('button', { name: /挑战试炼|Take the Trial/ })).toBeVisible()
})

test('Boss 台词:开局就说话', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /群雄逐鹿|Contenders/ }).click()
  await page.getByRole('button', { name: /張角/ }).click()
  await page.getByRole('button', { name: /^出战$|^Fight$/ }).click()
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByText('蒼天已死,黃天當立。')).toBeVisible()
})

// 关底 Boss 的主帅面板必须显示人名,不是 id。
// 这条闸门的由来:Boss 用的是武将卡 id(zhang-jiao),而 HEROES_BY_ID 里只有
// 12 位可选主公 —— 少一层回落,面板上写的就是原始 id,截图里一眼看见。
test('关底对手显示人名,不是 id', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /群雄逐鹿|Contenders/ }).click()
  await page.getByRole('button', { name: /張角/ }).click()
  await page.getByRole('button', { name: /^出战$|^Fight$/ }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByText('zhang-jiao')).toHaveCount(0)
  await expect(page.locator('[class*="name"]').filter({ hasText: '張角' }).first()).toBeVisible()
})
