import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 远征与乱斗此前没有端到端覆盖。这里只验「能从标题进模式、配置、真正开起一局对局」——
// 对局内的流程 smoke.spec 已覆盖,这里补的是两个模式各自的入口 → 开战链路。

test('brawl: title → pick ruleset → into a match', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: '群雄乱斗' }).click()
  await expect(page.getByRole('heading', { name: '乱斗 · 群雄混战' })).toBeVisible()
  // 选默认卡组,点第一个乱斗规则开战
  await page.getByRole('button', { name: /开战/ }).first().click()
  // 进入对局:调度阶段的保留按钮或结束回合按钮可见
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})

test('practice: title → pick both sides + tier → into a match', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '演武场' }).click()
  await expect(page.getByRole('heading', { name: '演武场 · 自由对练' })).toBeVisible()
  // 选名将档,开战
  await page.getByRole('button', { name: '名将' }).click()
  await page.getByRole('button', { name: /开战/ }).click()
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})

test('expedition: title → set out → fight → into a match', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: '远征逐鹿' }).click()
  await expect(page.getByRole('heading', { name: '远征 · 逐鹿中原' })).toBeVisible()
  await page.getByRole('button', { name: '出征' }).click()
  // 远征进行中:开战进入第一关
  await page.getByRole('button', { name: '开战' }).click()
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})
