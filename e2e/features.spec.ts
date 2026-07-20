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
  // 认输改用自绘确认框(原来是 window.confirm),先点触发再在弹窗里确认
  await page.getByRole('button', { name: '认输' }).click()
  await page.getByRole('dialog').getByRole('button', { name: '认输' }).click()
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

test('hero power: visible, costs mana, once per turn', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()

  // 主公技按钮存在(默认预组是刘备「仁德」)
  const power = page.getByRole('button', { name: /仁德/ })
  await expect(power).toBeVisible()

  // 第 1 回合只有 1 费,2 费的主公技必然不可用
  await expect(power).toBeDisabled()
})

test('deck builder: search, type filter and precon templates', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '组建卡组' }).click()
  // 选主公页要能看到主公技说明
  await expect(page.getByText('唯才是舉')).toBeVisible()
  await expect(page.getByText('以预组为模板')).toBeVisible()

  // 从预组模板进构筑,卡池搜索与类型筛选都在
  await page.getByRole('button', { name: '桃園仁德' }).click()
  await expect(page.getByPlaceholder('搜索卡池…')).toBeVisible()
  await expect(page.getByRole('button', { name: '锦囊', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '保存卡组(30/30)' })).toBeVisible()
})

test('collection: merit badge and craft/disenchant controls', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '名将图鉴' }).click()
  await expect(page.getByText(/✦ \d+/)).toBeVisible()
  // 稀有度/费用筛选条
  await page.getByRole('button', { name: '传说', exact: true }).click()
  await page.getByPlaceholder('搜索名将…').fill('關羽')
  await page.getByText('關羽').first().click()
  await expect(page.getByRole('button', { name: /合成 · \d+/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /分解 · \+\d+/ })).toBeVisible()
})

test('settings screen: record, volume, sync and reset are all reachable', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()

  // 战绩一直在记录与同步,但以前界面上从来不显示
  await expect(page.getByText('胜率')).toBeVisible()
  await expect(page.getByText('功勋')).toBeVisible()

  // 音量滑块(以前只有开/关)
  await expect(page.getByRole('slider')).toBeVisible()

  // syncNow() 早就写好了,这里是它第一个调用方
  await expect(page.getByRole('button', { name: '立即同步' })).toBeVisible()
  await expect(page.getByText('设备 ID', { exact: true })).toBeVisible()

  // 清空进度走自绘确认框,默认焦点在取消上
  await page.getByRole('button', { name: '清空本地进度' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('deck codes: copy from a precon and import it back', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/')
  await page.getByRole('button', { name: '组建卡组' }).click()
  await page.getByRole('button', { name: '桃園仁德' }).click()

  // 满 30 张才允许导出
  const copyBtn = page.getByRole('button', { name: '复制卡组码' })
  await expect(copyBtn).toBeEnabled()
  await copyBtn.click()
  await expect(page.getByRole('button', { name: '已复制卡组码' })).toBeVisible()

  const code = await page.evaluate(() => navigator.clipboard.readText())
  expect(code.startsWith('QG1.')).toBe(true)

  // 导入同一串码 → 仍是满编卡组
  await page.getByPlaceholder('粘贴卡组码…').fill(code)
  await page.getByRole('button', { name: '导入' }).click()
  await expect(page.getByRole('button', { name: '保存卡组(30/30)' })).toBeVisible()

  // 垃圾码要给人话,而不是内部错误码
  await page.getByPlaceholder('粘贴卡组码…').fill('QG1.garbage')
  await page.getByRole('button', { name: '导入' }).click()
  await expect(page.getByText('卡组码无法识别')).toBeVisible()
})
