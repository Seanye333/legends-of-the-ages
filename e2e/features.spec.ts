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
  // 进度条 + 后退一手:此前只能从头顺着播
  await expect(page.getByRole('slider', { name: '回放进度' })).toBeVisible()
  await expect(page.getByTitle('上一手')).toBeVisible()
  await page.getByRole('button', { name: '退出回放' }).click()
  await expect(page.getByRole('heading', { name: '战报回放' })).toBeVisible()
})

test('collection: pack-2 equipment card is in the pool with its keyword rule', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '名将图鉴' }).click()
  await page.getByPlaceholder('搜索名将…').fill('青釭劍')
  await page.getByText('青釭劍').first().click()
  // 只在卡牌详情面板里找 —— 图鉴的筛选下拉里也有「剧毒」这一项,
  // 用全页 getByText 会撞上 <option>(strict mode 直接报两个匹配)
  const inspect = page.locator('[class*="overlay"]').first()
  await expect(inspect.getByText('装备')).toBeVisible()
  await expect(inspect.getByText('剧毒')).toBeVisible()
  await expect(inspect.getByText('战斗中伤害到的武将立即死亡')).toBeVisible()
})

test('hero power: both heroes show a power button wired to the engine', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()

  // 双方主帅面板各挂一个主公技按钮,带技能名与说明
  const powers = page.locator('button[aria-label*="—"]')
  await expect(powers).toHaveCount(2)
  await expect(powers.first()).toHaveAttribute('title', /\(2\)/)

  // 牌库余量也在(以前完全看不到,牌库见底是突然死亡)
  await expect(page.getByTitle(/牌库剩余 \d+ 张/).first()).toBeVisible()

  // 可用/不可用取决于法力与是否有合法目标,那是规则问题 ——
  // 已由 src/engine/pack3.test.ts 的 27 个用例覆盖,这里只验接线。
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

  // 音量滑块(以前只有开/关);现在音效与音乐各一个
  await expect(page.getByRole('slider').first()).toBeVisible()

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

test('arena: entry gate, hero pick, drafting, and fighting', async ({ page }) => {
  await page.goto('/')
  // 先给足功勋(报名费 100)—— 新号只有 0 功勋,入口应该是锁着的
  await page.getByRole('button', { name: '校场点将' }).click()
  await expect(page.getByRole('heading', { name: '校场点将' })).toBeVisible()
  await expect(page.getByRole('button', { name: /还差 \d+ 功勋/ })).toBeVisible()

  // 注入功勋后重新进入
  await page.evaluate(() => {
    const raw = localStorage.getItem('qiangu-collection')
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    s.state = { ...s.state, merit: 500 }
    localStorage.setItem('qiangu-collection', JSON.stringify(s))
  })
  await page.reload()
  await page.getByRole('button', { name: '校场点将' }).click()
  await page.getByRole('button', { name: '报名参战' }).click()

  // 择主:三选一
  await expect(page.getByText('第一步 · 择主')).toBeVisible()
  await page.locator('button').filter({ hasText: /王道|霸道|礼教|名利|割据|隐逸/ }).first().click()

  // 抽满 30 张 —— 每次点第一张
  await expect(page.getByText(/第二步 · 点将 1 \/ 30/)).toBeVisible()
  for (let i = 0; i < 30; i++) {
    await page.locator('[role="button"][aria-label]').first().click()
  }

  // 抽完进备战页,可以出战
  await expect(page.getByRole('button', { name: '出战' })).toBeVisible()
  await page.getByRole('button', { name: '出战' }).click()
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})

test('achievements: permanent progress, gated claim, reward payout', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '功名簿' }).click()
  await expect(page.getByRole('dialog', { name: '功名簿' })).toBeVisible()

  // 未达成的成就领取按钮是锁着的
  await expect(page.getByRole('button', { name: '未达成' }).first()).toBeDisabled()

  // 注入一个已达成的统计,面板应立刻可领
  await page.getByRole('button', { name: '关闭' }).click()
  await page.evaluate(() => {
    const raw = localStorage.getItem('qiangu-achievements')
    const s = raw ? JSON.parse(raw) : { state: {}, version: 0 }
    s.state = { ...s.state, stats: { matchesWon: 10 }, claimed: [] }
    localStorage.setItem('qiangu-achievements', JSON.stringify(s))
  })
  await page.reload()

  // 标题页入口应带上可领标记
  await expect(page.getByRole('button', { name: /功名簿 ●\d+/ })).toBeVisible()
  await page.getByRole('button', { name: /功名簿 ●\d+/ }).click()
  const claim = page.getByRole('button', { name: '领取' }).first()
  await expect(claim).toBeEnabled()
  await claim.click()
  await expect(page.getByText(/功勋 \+\d+/)).toBeVisible()
  await expect(page.getByText('已领').first()).toBeVisible()
})

test('campaign: stages unlock in order, brief shows the asymmetry, fight starts', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /群雄逐鹿/ }).click()
  await expect(page.getByRole('heading', { name: '群雄逐鹿' })).toBeVisible()

  // 第 1 关开着,后面的锁着
  await expect(page.getByText('未解锁').first()).toBeVisible()
  const stages = page.locator('ol li button')
  await expect(stages.first()).toBeEnabled()
  await expect(stages.nth(1)).toBeDisabled()

  // 战前简报要说清「凭什么它是 Boss」:血量 + 主公技
  await stages.first().click()
  const brief = page.getByRole('dialog')
  await expect(brief).toBeVisible()
  await expect(brief.getByText('太平要術')).toBeVisible()
  await expect(brief.getByText(/首通战利/)).toBeVisible()

  await brief.getByRole('button', { name: '出战' }).click()
  await expect(page.getByRole('button', { name: /全部保留|确认/ })).toBeVisible()
})

test('match extras: your-turn banner, graveyard viewer, music toggle', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '开始对战' }).click()
  await page.getByRole('button', { name: /全部保留|确认/ }).click()
  await expect(page.getByRole('button', { name: '结束回合' })).toBeVisible()

  // 墓地面板:此前完全看不到已打出/阵亡的牌
  await page.getByRole('button', { name: '墓地' }).click()
  const grave = page.getByRole('dialog', { name: '墓地' })
  await expect(grave).toBeVisible()
  await expect(grave.getByText('我方墓地')).toBeVisible()
  await expect(grave.getByText('对方墓地')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(grave).toHaveCount(0)

  // 结束回合后轮回我方 → 横幅
  await page.getByRole('button', { name: '结束回合' }).click()
  await expect(page.getByText('轮到你了')).toBeVisible({ timeout: 8000 })
})

test('settings: music can be turned off independently of sfx', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '设置', exact: true }).click()
  await expect(page.getByText('背景音乐')).toBeVisible()
  await expect(page.getByText(/音乐音量/)).toBeVisible()
  await expect(page.getByText(/音效音量/)).toBeVisible()
  // 音乐与音效是两个独立开关
  await expect(page.getByRole('slider')).toHaveCount(2)
})

test('collection: dynasty / mechanic filters, sorting, and infinite scroll', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: '名将图鉴' }).click()
  await expect(page.getByRole('heading', { name: '名将图鉴' })).toBeVisible()

  // 机制筛选:伏兵是第四卡包引入的,数量固定
  await page.getByLabel('按机制筛选').selectOption('secret')
  await expect(page.locator('[class*="resultCount"]')).toHaveText(/6 张/)

  // 换筛选要回到第一页 —— 从前每加一个筛选器就得记着补 setLimit,漏一个就停在旧页
  await page.getByLabel('按机制筛选').selectOption('all')
  await page.getByLabel('按朝代筛选').selectOption('tang')
  const tangCount = await page.locator('[class*="resultCount"]').innerText()
  expect(Number(tangCount.replace(/\D/g, ''))).toBeGreaterThan(0)

  // 排序切换不该把结果筛没
  await page.getByLabel('排序方式').selectOption('cost')
  await expect(page.locator('[class*="resultCount"]')).toHaveText(tangCount)

  // 无限滚动:滚到底自动加载下一页,不用点按钮
  await page.getByLabel('按朝代筛选').selectOption('all')
  await page.waitForTimeout(200)
  // 不假设起始页数:筛选结果短的时候哨兵一开始就在视口里,会立刻自动多载一页 ——
  // 那是对的行为,断言写死 48 反而会红。只验证「滚动确实让它继续长」。
  const sentinel = page.locator('[class*="sentinel"]')
  const shownNow = async () => Number((await sentinel.innerText()).match(/(\d+)\//)![1])
  const before = await shownNow()
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.waitForTimeout(400)
  }
  expect(await shownNow()).toBeGreaterThan(before)
})
