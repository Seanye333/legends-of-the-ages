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
async function intoPuzzle(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /斩杀谜题|Lethal Puzzles/ }).first().click()
  await page.getByRole('button', { name: /挑战/ }).first().click()
  await page.waitForTimeout(1200)
}

async function overlaps(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const banner = document.querySelector('[class*=turnBanner], [class*=bannerFoe]') as HTMLElement | null
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

for (const [w, h] of [
  [844, 390],
  [926, 428],
] as const) {
  test(`手机横屏 ${w}x${h}:回合横幅不压在任何令牌上`, async ({ page }) => {
    await seedUnlockedProfile(page)
    await page.setViewportSize({ width: w, height: h })
    await intoPuzzle(page)
    const r = await overlaps(page)
    expect(r.banner, '横幅没渲染出来 —— 这条就没在验什么了').toBe(true)
    expect(r.hits, `横幅压着这些令牌:${r.hits.join(' ')}`).toEqual([])
  })
}

test('平板横屏 1024x768:两排令牌都完整落在战场里', async ({ page }) => {
  await seedUnlockedProfile(page)
  await page.setViewportSize({ width: 1024, height: 768 })
  await intoPuzzle(page)
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
