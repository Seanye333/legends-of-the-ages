import { expect, test } from '@playwright/test'

// 羁绊/宿敌与卡组体检的 UI 闸门。
// 这三块此前是「机制在结算里生效,但界面上一个字都没有」——
// e2e 是唯一能证明它们真的露出来了的层。

test('构筑器:体检面板与羁绊提示', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /组建卡组|Deck Builder/ }).click()
  // 以预组为模板起手,卡组立刻是满的
  await page.getByRole('button', { name: /桃園仁德/ }).first().click()

  await expect(page.getByText(/守護/).first()).toBeVisible()
  await expect(page.getByText(/解場/).first()).toBeVisible()
  // 桃园仁德带着刘备与张飞,缺 7 费的关羽(那套牌曲线封顶 6 费)。
  // 面板的价值就在这一行:**当场告诉你还差谁**,而不是等你自己去数。
  // 顺带记一笔实测发现:六套预组一条羁绊都凑不齐,羁绊是留给自组卡组的奖励。
  // 「按羁绊组卡」的面板也列同一条羁绊,所以这里要指明是**羁绊面板**里的那个
  await expect(page.getByText('桃園結義').last()).toBeVisible()
  await expect(page.getByText(/缺 關羽/)).toBeVisible()
})

test('图鉴详情:关羽看得到自己属于桃园结义', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /名将图鉴|Collection/ }).click()
  await page.getByPlaceholder(/搜索名将|Search/).fill('關羽')
  await page.locator('[class*="cardBtn"], [class*="card"]').first().click()
  await expect(page.getByText(/羈絆 · 桃園結義/)).toBeVisible()
})

test('演武场:军师能回答「这回合有没有斩杀」', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /演武场|Training/ }).click()
  await page.getByRole('button', { name: /开战|Fight/ }).click()
  // 调度之后才进主阶段
  await expect(page.getByRole('heading', { name: '调度' })).toBeVisible()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  const advisor = page.getByRole('button', { name: /^军师$|^Advisor$/ })
  await advisor.click()
  await expect(page.getByText(/斩杀线|lethal/i).first()).toBeVisible()
})
