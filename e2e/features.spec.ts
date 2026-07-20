import { expect, test } from '@playwright/test'

// 新增系统的冒烟:教程引导、每日军令、战报回放、装备/新关键词入池。

test('tutorial: invite on first run → coach advances through mulligan', async ({ page }) => {
  await page.goto('/')
  // 零战绩新账号才会收到邀请
  await expect(page.getByText('初次执掌兵符?先走一遍教学对局。')).toBeVisible()
  await page.getByRole('button', { name: '开始教学' }).click()

  // 第一步:欢迎(需手动确认)
  await expect(page.getByText('欢迎入局')).toBeVisible()
  await page.getByRole('button', { name: '明白了' }).click()

  // 第二步:调度(条件推进 —— 完成调度即自动进入下一步)
  await expect(page.getByText('第一步:调度')).toBeVisible()
  await expect(page.getByText('照做即可继续 ▾')).toBeVisible()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByText('第一步:调度')).toBeHidden()
  await expect(page.getByText(/法力与费用|打出武将/)).toBeVisible()

  // 跳过 → 回标题
  await page.getByRole('button', { name: '跳过教程' }).click()
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
  // 跳过后不再邀请
  await expect(page.getByText('初次执掌兵符?先走一遍教学对局。')).toBeHidden()
})

test('daily quests: three orders with progress bars', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /每日军令|军令 ●\d+/ }).click()
  await expect(page.getByRole('heading', { name: '每日军令' })).toBeVisible()
  // 三条任务,各带 x / y 进度
  const bars = page.locator('[class*="barLabel"]')
  await expect(bars).toHaveCount(3)
  await expect(bars.first()).toHaveText(/\d+ \/ \d+/)
  await expect(page.getByText(/卡包 ×\d+/).first()).toBeVisible()
  await page.getByRole('button', { name: '关闭' }).click()
  await expect(page.getByRole('heading', { name: '千古名将' })).toBeVisible()
})

test('replays: empty state, then a finished match is recorded and playable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '战报回放' }).click()
  await expect(page.getByRole('heading', { name: '战报回放' })).toBeVisible()
  await expect(page.getByText(/还没有战报/)).toBeVisible()
  await page.getByRole('button', { name: '返回标题' }).click()

  // 打一局并认输 → 留档
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()
  page.once('dialog', (d) => void d.accept())
  await page.getByRole('button', { name: '认输' }).click()
  await expect(page.getByText(/卷土重来|凯旋而归|平分秋色/)).toBeVisible()
  await page.getByRole('button', { name: '返回标题' }).click()

  // 回放列表里有它,能进播放器
  await page.getByRole('button', { name: '战报回放' }).click()
  await expect(page.getByRole('button', { name: '观看' }).first()).toBeVisible()
  await page.getByRole('button', { name: '观看' }).first().click()
  await expect(page.getByText('回放', { exact: true })).toBeVisible()
  await expect(page.getByText(/第 \d+ 回合 · \d+ \/ \d+/)).toBeVisible()
  await page.getByRole('button', { name: '退出回放' }).click()
  await expect(page.getByRole('heading', { name: '战报回放' })).toBeVisible()
})

test('collection: pack-2 equipment card is in the pool with its keyword rule', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '名将图鉴' }).click()
  await page.getByPlaceholder('搜索名将…').fill('青釭劍')
  await page.getByText('青釭劍').first().click()
  await expect(page.getByText('装备')).toBeVisible()
  await expect(page.getByText('剧毒')).toBeVisible()
  await expect(page.getByText('战斗中伤害到的武将立即死亡')).toBeVisible()
})
