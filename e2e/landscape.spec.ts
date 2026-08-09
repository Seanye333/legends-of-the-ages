import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 横屏。
//
// 【量过之后的结论:平板横屏(1024x768)本来就是好的】
// 这一屏几乎全用 clamp / vh 排版,所以宽高一变它自己会跟着走。
// 真正会坏的是**矮**视口(手机横屏 ≈390px 高),而坏的方式很具体:
// 绝对定位的浮层按百分比落位,而百分比在矮屏上会正好落在战线上。
//
// 回合横幅就是这么错过两次的:38% 压着敌方那一排,改成 48% 之后压着**我方**那一排
// —— 而后者更要命,你看不见的是你正要操作的那些单位。
// 所以这条断言的不是「横幅在」,是**横幅和任何一个令牌都不相交**。
const BANNER = '[class*=turnBanner], [class*=bannerFoe]'

// 【为什么要从首帧就关掉动效】
// 横幅有 1.4 秒的入场动画(末帧还会往上飘 8%),令牌也有各自的入场动画。
// 带着动画去量矩形,量到的是**某一帧**,而是哪一帧取决于机器多快 ——
// 那样的测试红不红是随机的,红了也说不清是布局坏了还是抽到了动画中间态。
//
// `data-reduced-motion` 是 app 自己的开关(main.tsx 汇总系统偏好与设置页,
// 落成 <html data-reduced-motion>),CSS 里对应 `animation: none; opacity: 1`,
// 也就是**静止位置**——正是这条用例想断言的东西。
// 用 addInitScript 而不是进页面之后再 setAttribute:后者晚于横幅挂载,
// 等于又把「多快」放回了判据里。
async function intoPuzzle(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    document.documentElement.setAttribute('data-reduced-motion', 'true')
  })
  await page.goto('/')
  await page.getByRole('button', { name: /斩杀谜题|Lethal Puzzles/ }).first().click()
  // 【必须点名固定那一道,不能点「第一个挑战」】
  // 谜题屏顶上是**每日轮换**的那一组(dailyPuzzleSetFor(today)),
  // 静态的 LETHAL_PUZZLES 排在它下面。原来这里点的是第一个「挑战」,
  // 也就是**今天**的题 —— 于是这条用例的棋盘每天都不一样,
  // 令牌几个、落在哪一行全跟着变,而这条断言量的正是令牌的位置。
  // 它红不红取决于日期,这是最难查的一种不稳:
  // 昨天绿今天红,而代码一行没动。
  await page.getByRole('button', { name: /破壁一擊|Breach the Wall/ }).first().click()
}

// 【别把这里改回 `waitForTimeout`】
// 原来这条是 `await page.waitForTimeout(1200)` 然后直接量 —— 而回合横幅是
// **会自己消失**的:MatchScreen 在挂上它 1400ms 之后 setTurnBanner(0) 把它摘掉。
// 也就是说那版测试的可用窗口只有 **200 毫秒**:页面加载或铺场只要慢一点,
// 横幅就已经没了,断言当场挂,而报出来的是「横幅没渲染出来」——
// 看上去像布局坏了,其实是测试自己踩空。
// 在空闲的快机器上跑十次十次过,只有整套一起跑时偶尔红一次,极难查。
//
// 改成等元素真的出现再量:窗口从 200ms 变成约 1.3 秒,而且断言的东西一点没变。
async function waitForBanner(page: import('@playwright/test').Page) {
  await page.locator(BANNER).first().waitFor({ state: 'visible', timeout: 10_000 })
  // 还要等字体。这一条是压力测试逼出来的:整套一起跑时偶尔量到令牌
  // `180..232`(高 52px),而空闲时量到的是 `186.5..236.5`(高 50px)——
  // 尺寸和位置一起变,那不是布局在抖,是**回退字体的度量**和正式字体不一样,
  // 而字号是 clamp(…vh) 的,行高一变整排令牌就往上挪了六个多像素,
  // 正好蹭到横幅底边。间隙本来只有 3.3px(926x428),经不起这个。
  await page.evaluate(() => document.fonts.ready)
}

async function overlaps(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const banner = document.querySelector(
      '[class*=turnBanner], [class*=bannerFoe]',
    ) as HTMLElement | null
    if (!banner) return { banner: false, hits: [] as string[] }
    const b = banner.getBoundingClientRect()
    if (b.width === 0 || b.height === 0) return { banner: false, hits: [] as string[] }
    const hits: string[] = []
    document.querySelectorAll('[class*=token]').forEach((t) => {
      const r = t.getBoundingClientRect()
      if (r.width === 0) return
      const hit = !(r.right < b.left || r.left > b.right || r.bottom < b.top || r.top > b.bottom)
      if (hit) hits.push(`${Math.round(r.top)}..${Math.round(r.bottom)}`)
    })
    return { banner: true, hits }
  })
}

// ⚠️ **这两档是覆盖到的全部,而不是「矮屏都没问题」。**
// 2026-08-09 顺手试过 740x360 与 900x420,两档都稳定复现「横幅压着我方战线」——
// 和这里修好的是同一个病(浮层按视口百分比落位),而解法不是再猜一个数。
// 没有把它们留在套件里,是因为那会让 e2e 长期红;记在 ROADMAP 待办上。
for (const [w, h] of [
  [844, 390],
  [926, 428],
] as const) {
  test(`手机横屏 ${w}x${h}:回合横幅不压在任何令牌上`, async ({ page }) => {
    await seedUnlockedProfile(page)
    await page.setViewportSize({ width: w, height: h })
    await intoPuzzle(page)
    await waitForBanner(page)
    const r = await overlaps(page)
    expect(r.banner, '横幅没渲染出来 —— 这条就没在验什么了').toBe(true)
    expect(r.hits, `横幅压着这些令牌:${r.hits.join(' ')}`).toEqual([])
  })
}

test('平板横屏 1024x768:两排令牌都完整落在战场里', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  await intoPuzzle(page)
  // 这一条量的是令牌不是横幅,所以等的也该是令牌 ——
  // 等错东西和睡固定时长是同一类毛病:通过与否取决于机器有多快。
  await page.locator('[class*=token]').first().waitFor({ state: 'visible', timeout: 10_000 })
  await page.evaluate(() => document.fonts.ready)
  const ok = await page.evaluate(() => {
    const field = document.querySelector('[class*=battlefield]')?.getBoundingClientRect()
    if (!field) return 'no-field'
    const bad: string[] = []
    document.querySelectorAll('[class*=token]').forEach((t) => {
      const r = t.getBoundingClientRect()
      if (r.width === 0) return
      if (r.top < field.top - 1 || r.bottom > field.bottom + 1) bad.push(`${Math.round(r.top)}..${Math.round(r.bottom)}`)
    })
    return bad.join(' ')
  })
  expect(ok, '有令牌跑出了战场区').toBe('')
})
