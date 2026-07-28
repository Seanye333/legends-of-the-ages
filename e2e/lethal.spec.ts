import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 斩杀谜题:标题入口 → 选题 → 残局直接进「你的回合」(跳过调度)→ 结束回合判负 →
// 专用结算面板(提示 + 重试/返回)→ 重试回到残局 → 返回选题。
// 胜利路径的引擎逻辑已由求解器回放测试覆盖,这里专测谜题特有的 UI 管线。
test('lethal puzzle: enter → fail on end turn → retry → back to list', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.goto('/')
  await page.getByRole('button', { name: '斩杀谜题' }).click()

  await expect(page.getByRole('heading', { name: /斩杀谜题/ })).toBeVisible()
  await expect(page.getByText(/已解 \d+ \/ \d+/)).toBeVisible()

  // 进入第一道题「風助火勢」
  await page.getByRole('button').filter({ hasText: '風助火勢' }).click()

  // 谜题从「你的回合」开始:没有调度步骤,结束回合按钮直接可见
  const endTurn = page.getByRole('button', { name: '结束回合' })
  await expect(endTurn).toBeVisible()
  await expect(page.getByRole('heading', { name: '调度' })).toHaveCount(0)

  // 结束回合而未斩杀 → 判负,弹专用面板(带提示)
  await endTurn.click()
  await expect(page.getByText('未能斩杀')).toBeVisible()
  await expect(page.getByText('提示')).toBeVisible()

  // 重试:回到同一残局
  await page.getByRole('button', { name: '重试' }).click()
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()

  // 再失败一次 → 返回选题 → 回到谜题列表
  await page.getByRole('button', { name: '结束回合' }).click()
  await expect(page.getByText('未能斩杀')).toBeVisible()
  await page.getByRole('button', { name: '返回选题' }).click()
  await expect(page.getByRole('heading', { name: /斩杀谜题/ })).toBeVisible()
})
