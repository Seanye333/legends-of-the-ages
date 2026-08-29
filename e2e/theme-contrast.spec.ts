import { expect, test } from '@playwright/test'
import { seedUnlockedProfile } from './unlocked'

// 亮色主题的验收 —— **不靠肉眼**。
//
// 【为什么必须有这一道】
// 亮色那组覆盖是按「明度翻转、色相不动」算出来的(见 index.css)。
// 规则保证了「底浅字深」,保证不了每一处的对比度:两个中等明度的色阶翻转之后
// 仍然是两个中等明度,叠在一起就是一块读不出字的地方 —— 而它不崩、不红,
// 只有人眼看得见。这一条把它变成可测的。
//
// 【判据是相对的,不是绝对的】
// 不断言「所有文字都达到 WCAG AA 4.5:1」—— 这是一屏做旧的暗金牌桌,描边、
// 外发光、纹理都在参与可读性,而 getComputedStyle 只看得见色值,拿绝对线去卡
// 会把一堆本来读得清的地方判红。断言的是**亮色不比暗色差**:同一批文字,
// 低于 4.5:1 的个数不许变多。它守的是「翻转有没有把某处翻坏」,
// 而那正是这一版唯一没被规则保证的东西。
const AA = 4.5

interface Probe {
  /** 真正算出比值的元素数 —— 用来证明这道闸门**量到了东西** */
  measured: number
  /** 低于 AA 的那些 */
  low: string[]
}

/** 页面内测量:每个直接含文字的可见元素,算它与**实际背景**的对比度。 */
async function probe(page: import('@playwright/test').Page): Promise<Probe> {
  return page.evaluate((AA) => {
    const lum = (c: string): number | null => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(/[,/]/).map((s) => parseFloat(s.trim()))
      if (p.length >= 4 && p[3] < 0.95) return null // 半透明:算不准,跳过
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(p[0]) + 0.7152 * f(p[1]) + 0.0722 * f(p[2])
    }

    /**
     * 往上找第一个能定色的背景。
     *
     * 【第一版这里是「碰到 background-image 就放弃」,而那让整道闸门变成空的】
     * 探针实测:标题页 1001 个文字元素,**一个都没量到** —— 全站底纹与渐变
     * 让每一条祖先链上都有 background-image,于是全被跳过,而测试照样绿。
     * 一道量不到东西的闸门比没有闸门更糟:它让人以为验过了。
     * 所以渐变不放弃:把色标取出来平均,当作那一片的底色 —— 近似,
     * 但比「不量」诚实得多。真正未知的只有 url() 位图,那个才返回 null。
     */
    const bgOf = (el: Element): number | null => {
      let n: Element | null = el
      while (n) {
        const cs = getComputedStyle(n)
        // 【顺序要紧:先看纯色,再看渐变,最后才为位图放弃】
        // 反过来写(撞见 url() 就 return null)会让整道闸门在**有底纹的屏**上全盲:
        // 设置页与图鉴实测只量到 1 个元素,而它们的底色其实就写在 background-color 上,
        // 只是被同一条 background 里的 url() 挡在了后面。
        const l = lum(cs.backgroundColor)
        if (l !== null) return l
        const bi = cs.backgroundImage
        if (bi !== 'none') {
          const stops = [...bi.matchAll(/rgba?\([^)]+\)/g)]
            .map((m) => lum(m[0]))
            .filter((v): v is number => v !== null)
          if (stops.length) return stops.reduce((a, b) => a + b, 0) / stops.length
          if (bi.includes('url(')) return null // 位图且没有可用色标:真算不出来
        }
        n = n.parentElement
      }
      return null
    }

    const low: string[] = []
    let measured = 0
    for (const el of document.querySelectorAll('body *')) {
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0,
      )
      if (!hasText) continue
      const r = el.getBoundingClientRect()
      if (r.width < 4 || r.height < 4) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.opacity === '0') continue
      const fg = lum(cs.color)
      const bg = bgOf(el)
      if (fg === null || bg === null) continue
      measured++
      const ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05)
      if (ratio < AA) {
        const cls = typeof el.className === 'string' ? el.className.slice(0, 28) : ''
        low.push(`${el.tagName.toLowerCase()}.${cls} ${ratio.toFixed(2)}`)
      }
    }
    return { measured, low }
  }, AA)
}

function seedTheme(page: import('@playwright/test').Page, theme: 'dark' | 'light') {
  return page.addInitScript((theme) => {
    let box: { state?: Record<string, unknown>; version?: number } = {}
    try {
      box = JSON.parse(localStorage.getItem('qiangu-settings') ?? '{}')
    } catch {
      box = {}
    }
    box.state = { ...(box.state ?? {}), theme, reducedMotion: true }
    box.version = box.version ?? 0
    localStorage.setItem('qiangu-settings', JSON.stringify(box))
  }, theme)
}

type Page = import('@playwright/test').Page

// 【为什么只有标题页在跑】
// 探针要能算出「文字底下是什么颜色」才有意义。标题页量得到 999 / 1000 个元素;
// 而设置页与图鉴上,文字一路往上找到的都是透明背景,最后落在一张 url() 底图上 ——
// 位图里那一块是什么颜色,getComputedStyle 是答不出来的,实测**只量到 1 个元素**。
// 那两屏留在这里但标成 fixme:不是「对比度不合格」,是**这道闸门在那儿是瞎的**。
// 假装绿比红更糟,所以不给它们一个恒真的断言。
// 要让它们也能测,得换一种取底色的办法 —— 截图之后按像素采样,
// 那是另一件事(见 ROADMAP 30)。
const SCREENS: [string, (p: Page) => Promise<void>, boolean][] = [
  ['标题页', async (p) => { await p.goto('/') }, true],
  ['设置页', async (p) => {
    await p.goto('/')
    await p.getByRole('button', { name: /设置|Settings/ }).first().click()
  }, false],
  ['图鉴', async (p) => {
    await p.goto('/')
    await p.getByRole('button', { name: /名将图鉴|Collection/ }).first().click()
  }, false],
]

for (const [name, go, measurable] of SCREENS) {
  const t = measurable ? test : test.fixme
  t(`${name}:亮色的低对比处不比暗色多`, async ({ page }) => {
    await seedUnlockedProfile(page)

    await seedTheme(page, 'dark')
    await go(page)
    await page.evaluate(() => document.fonts.ready)
    const dark = await probe(page)

    await seedTheme(page, 'light')
    await go(page)
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    const light = await probe(page)

    // 【先断言「量到了东西」,再断言「量出来的结果好」】
    // 第一版没有这两条,而它的 bgOf 碰到背景图就放弃 —— 于是一个元素都没量到,
    // 测试照样绿;后来把亮色整条色阶刷成同一个灰(文字与底同色,对比度 1.0),
    // 它**还是绿的**。一道量不到东西的闸门不会失败,因为它什么都不知道。
    // 所以这两条排在前面:它们守的是闸门自己还活着。
    expect(dark.measured, '暗色下几乎没量到元素 —— 闸门空了,先修它再谈结果').toBeGreaterThan(200)
    expect(light.measured, '亮色下几乎没量到元素 —— 闸门空了').toBeGreaterThan(200)

    const added = light.low.filter((x) => !dark.low.includes(x)).slice(0, 12)
    const msg = [
      `亮色低于 ${AA}:1 的有 ${light.low.length} 处,暗色 ${dark.low.length} 处`,
      `(各量了 ${light.measured} / ${dark.measured} 个元素)`,
      '亮色新增的:',
      ...added,
    ].join('\n  ')
    expect(light.low.length, msg).toBeLessThanOrEqual(dark.low.length)
  })
}
