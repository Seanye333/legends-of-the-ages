import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 自订乱斗:唯一一处把 RunModifiers 这套词汇直接交给玩家的地方
//(远征宝物 / 关卡态势 / 兵书都由系统发)。规则双方同吃,所以天然公平。
test('乱斗:自己拼一条规则再开战', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: /群雄乱斗|Brawl/ }).click()
  await page.getByText(/自訂亂鬥|Custom brawl/).click()

  // 一个旋钮都没开时不给开战
  const go = page.getByRole('button', { name: /自訂局不計每周首勝|custom: no weekly bonus/ })
  await expect(go).toBeDisabled()

  await page.getByRole('button', { name: /起手多抽三張|Draw 3 extra/ }).click()
  await expect(go).toBeEnabled()
  await go.click()
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
})
