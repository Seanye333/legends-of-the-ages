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
// 所以这条断言的不是「横幅在」,是**横幅和任何一个令牌之间留得出余量**。
//
// 落点现在由 src/ui/useBannerPlacement.ts 按两排令牌之间的净空算出来
// (判据本身是纯函数 planBanner,在 src/ui/bannerPlacement.test.ts 里双向验过)。
// ⚠️ 高屏(> 430px)**故意不接管**:1024x768 下横幅仍然压着两排各 5.6 / 17.2px,
// 那是定过的桌面观感 —— 大屏上一块 1.4 秒的居中提示压一点没人抱怨,
// 而按几何让位会把它推到左侧空档去。要改的话是设计决定,不是修 bug。
const BANNER = '[class*=turnBanner], [class*=bannerFoe]'

// 【为什么要从首帧就关掉动效】
// 横幅有 1.4 秒的入场动画(末帧还会往上飘 8%),令牌也有各自的入场动画。
// 带着动画去量矩形,量到的是**某一帧**,而是哪一帧取决于机器多快 ——
// 那样的测试红不红是随机的,红了也说不清是布局坏了还是抽到了动画中间态。
//
// 【关动效要关在设置里,只钉 <html data-reduced-motion> 是不够的】
// 那个属性**只喂 CSS**。JS 这一侧还有 useFlip(战线合拢的 FLIP 动画),
// 它读的是 useSettings.reducedMotion —— 而那个值默认 false,并且**不跟随系统偏好**
// (main.tsx 只在写 <html> 属性时才把系统偏好并进去)。
// 于是钉属性关掉了 CSS 动画,令牌却仍然在被 JS 变换着。
// 6 并发 × 6 轮压力测试下实测:量到的令牌是 36x36 且位置偏上,而静止态是 49x52 ——
// 那是 FLIP 的中间帧。横幅落点算得再准,量的那一刻东西还在动也是白搭。
//
// 所以改成播种设置项:走的是玩家在设置页打开「减少动效」时那条真实路径,
// 一次把 CSS 与 JS 两侧都关掉。写法照抄 unlocked.ts 的合并写入 ——
// addInitScript 每次导航都重跑,直接 setItem 会冲掉别处注入的前置条件。
async function intoPuzzle(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    let box: { state?: Record<string, unknown>; version?: number } = {}
    try {
      box = JSON.parse(localStorage.getItem('qiangu-settings') ?? '{}')
    } catch {
      box = {}
    }
    box.state = { ...(box.state ?? {}), reducedMotion: true }
    box.version = box.version ?? 0
    localStorage.setItem('qiangu-settings', JSON.stringify(box))
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

// 断言的不是「不相交」,是**留得出余量**。
// 上一版只验相交,于是 844x390 曾经以 4.4px 的间隙「通过」——
// 而字体从回退切到正式时整排令牌会挪六个多像素,那种通过第二天就会变成红。
// 现在量的是横幅与最近一个令牌在**某一条轴上**分开多少(分开一条轴就够了),
// 负数即压上。落点改成按几何量之后实测:640/740 走横向让开是 92.8 / 117.8px,
// 844 / 900 / 926 坐进带子正中是 6.9 / 7.1 / 8.3px。3px 的门槛离两者都远。
const MIN_GAP = 3

interface GapProbe {
  gap: number
  worst: string
}

declare global {
  interface Window {
    __bannerGap?: GapProbe
  }
}

// 【在页面里逐帧盯,不要在外面等完再进去量】
// 回合横幅**会自己消失**:MatchScreen 挂上它 1400ms 之后就把它摘掉。
// 于是「等它可见 → 等字体 → evaluate 量一次」这条路有一个会被负载吃掉的窗口 ——
// 6 并发压力测试下实测翻红过,报的是「横幅没渲染出来」,看着像布局坏了,
// 其实是测试自己踩空。历史上同一处还踩过更糙的一版:waitForTimeout(1200) 之后直接量,
// 可用窗口只有 200ms。
//
// 改成把探针装在页面里,从首帧起逐帧记录,取横幅**一生中的最小间隙**。
// 这样做有两个好处:测试再也不依赖「外面跑得多快」,
// 而且断言从「某一瞬间不压」变成了**横幅存在期间一直不压** —— 是更强的那条。
// 起测条件挂在 fonts.status 上:回退字体与正式字体度量不同,而字号是 clamp(…vh),
// 行高一变整排令牌能挪六个多像素,那一帧不该算数(落点自己也会在 fonts.ready 时重算)。
async function installGapProbe(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const tick = () => {
      requestAnimationFrame(tick)
      if (document.fonts.status !== 'loaded') return
      const banner = document.querySelector(
        '[class*=turnBanner], [class*=bannerFoe]',
      ) as HTMLElement | null
      if (!banner) return
      const b = banner.getBoundingClientRect()
      if (b.width === 0 || b.height === 0) return
      document.querySelectorAll('[class*=token]').forEach((t) => {
        const r = t.getBoundingClientRect()
        if (r.width === 0) return
        const dx = Math.max(r.left - b.right, b.left - r.right)
        const dy = Math.max(r.top - b.bottom, b.top - r.bottom)
        const d = Math.max(dx, dy)
        if (window.__bannerGap && window.__bannerGap.gap <= d) return
        window.__bannerGap = {
          gap: Math.round(d * 10) / 10,
          // 类名一起记下来。查过一次:压力测试下最近的那个「令牌」是个 36x36 的方块,
          // 和战场上 49x52 的单位对不上 —— 光有坐标看不出量到的是不是中间态。
          worst: `${t.className} ${Math.round(r.left)},${Math.round(r.top)}..${Math.round(r.right)},${Math.round(r.bottom)}`,
        }
      })
    }
    requestAnimationFrame(tick)
  })
}

// 【这份档位表是这条不变量的全部证据,加档比调数值重要】
// 曾经这里只有 844x390 与 926x428 两档,而 740x360 / 900x420 是稳定压着战线的 ——
// 也就是说「矮屏修好了」这句话当时只对两个被挑出来的数成立。
// 落点改成按几何量(src/ui/useBannerPlacement.ts)之后才敢把档位铺开:
//   640x360 / 740x360 —— 安卓横屏最常见的一档,净空只有 16.6px,走的是「横着让开」那条分支
//   844x390 / 900x420 / 926x428 —— iPhone 各代,净空 35~39px,横幅坐进带子正中
// 两条分支都在表里,改了几何判据而只顾一边的话,另一边当场红。
for (const [w, h] of [
  [640, 360],
  [740, 360],
  [844, 390],
  [900, 420],
  [926, 428],
] as const) {
  test(`手机横屏 ${w}x${h}:回合横幅与战线之间留得出余量`, async ({ page }) => {
    await seedUnlockedProfile(page)
    await installGapProbe(page)
    await page.setViewportSize({ width: w, height: h })
    await intoPuzzle(page)
    // 横幅可见只是**开始采样**的信号,不是采样本身 —— 数据在探针里。
    await page.locator(BANNER).first().waitFor({ state: 'visible', timeout: 10_000 })
    await page.waitForFunction(() => window.__bannerGap !== undefined, undefined, {
      timeout: 10_000,
    })
    const r = (await page.evaluate(() => window.__bannerGap)) as GapProbe
    expect(
      r.gap,
      `横幅与最近的令牌一度只隔 ${r.gap}px(要求全程 ≥${MIN_GAP}):${r.worst}`,
    ).toBeGreaterThanOrEqual(MIN_GAP)
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
