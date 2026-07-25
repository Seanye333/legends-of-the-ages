import { expect, test } from '@playwright/test'

// 历史名战「名局重现」:标题进模式 → 挑一场 → 看简报 → 真正开起一局(带开局态势)。
// 与 modes.spec 同风格,补新模式的入口 → 开战链路。对局内流程由 smoke.spec 覆盖。
test('history: title → pick battle → brief → into a match', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名局重现/ }).click()
  await expect(page.getByRole('heading', { name: '名局重现' })).toBeVisible()

  // 点第一场「長平之戰」打开简报
  await page.getByRole('button', { name: /長平之戰/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  // 出战 → 进入对局(与其它单人模式一致,调度/结束回合按钮可见)
  await page.getByRole('button', { name: '出战' }).click()
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})
