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
// 低于 4.5:1 的个数不许变多。它守的是「翻转有没有把某处翻坏」。
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
    type RGBA = [number, number, number, number]

    const parse = (c: string): RGBA | null => {
      const m = c.match(/rgba?\(([^)]+)\)/)
      if (!m) return null
      const p = m[1].split(/[,/]/).map((s) => parseFloat(s.trim()))
      if (p.length < 3 || p.some((v) => Number.isNaN(v))) return null
      return [p[0], p[1], p[2], p.length >= 4 ? p[3] : 1]
    }

    /** 上层按 alpha 合成到下层。**这是这道闸门能工作的关键一步** —— 见 bgOf。 */
    const over = (top: RGBA, under: RGBA): RGBA => {
      const a = top[3]
      return [
        top[0] * a + under[0] * (1 - a),
        top[1] * a + under[1] * (1 - a),
        top[2] * a + under[2] * (1 - a),
        1,
      ]
    }

    const relLum = (c: RGBA): number => {
      const f = (v: number) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }

    /** 一个元素自己这一层的底色(渐变取色标平均)。没有就返回 null。 */
    const layerOf = (n: Element): RGBA | null => {
      const cs = getComputedStyle(n)
      const bi = cs.backgroundImage
      if (bi !== 'none') {
        const stops = [...bi.matchAll(/rgba?\([^)]+\)/g)]
          .map((m) => parse(m[0]))
          .filter((v): v is RGBA => v !== null)
          // 完全透明的色标是渐变的「淡出端」,不代表这一片的颜色
          .filter((v) => v[3] > 0.02)
        if (stops.length) {
          const n0 = stops.length
          return [
            stops.reduce((s, v) => s + v[0], 0) / n0,
            stops.reduce((s, v) => s + v[1], 0) / n0,
            stops.reduce((s, v) => s + v[2], 0) / n0,
            stops.reduce((s, v) => s + v[3], 0) / n0,
          ]
        }
        if (bi.includes('url(')) return null // 位图且没有可用色标:真算不出来
      }
      const bg = parse(cs.backgroundColor)
      return bg && bg[3] > 0.02 ? bg : null
    }

    /**
     * 文字底下**实际**是什么颜色。
     *
     * 【两版都错过,记在这儿】
     * 一、第一版「碰到 background-image 就放弃」—— 全站底纹让每条祖先链上都有
     *     背景图,于是 1001 个文字元素**一个都没量到**,而测试照样绿。
     * 二、第二版把 alpha < 0.95 的层直接丢掉 —— 而这个界面的面板底几乎全是
     *     `linear-gradient(rgba(...,0.8), ...)`,于是设置页只量到 **1** 个元素。
     * 两次都是「算不准就不算」,而结果是整道闸门在半个 app 上是瞎的。
     * 现在按 alpha **合成到下层**:半透明层不再是障碍,它就是它本来的样子。
     * 真正未知的只剩位图,那个才返回 null。
     */
    const bgOf = (el: Element): RGBA | null => {
      let n: Element | null = el
      const stack: RGBA[] = []
      while (n) {
        const layer = layerOf(n)
        if (layer) {
          if (layer[3] >= 0.999) {
            let acc = layer
            for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc)
            return acc
          }
          stack.push(layer)
        }
        n = n.parentElement
      }
      return null // 一路到顶都没有不透明的底 —— 说不清,不硬算
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
      const fgRaw = parse(cs.color)
      const bg = bgOf(el)
      if (!fgRaw || !bg) continue
      const fg = fgRaw[3] >= 0.999 ? fgRaw : over(fgRaw, bg)
      measured++
      const a = relLum(fg)
      const b = relLum(bg)
      const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
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

// ⚠️ **点完必须等那一屏真的渲染出来**。
// 设置页与图鉴都是懒加载的(React.lazy),点击之后有一段 Suspense 空窗;
// 这里原来点完就开测,量到的是还没挂上的空壳 —— 实测**只有 1 个文字元素**,
// 于是「量到了东西」那条断言把整个测试判红,而看上去像是主题不合格。
// 同一段测量逻辑单独跑能量到 1076 个,差别只在有没有等。
// 这和 ROADMAP 49 那一栏是同一类错:等错东西 / 不等,通过与否取决于机器多快。
const SCREENS: [string, (p: Page) => Promise<void>][] = [
  ['标题页', async (p) => {
    await p.goto('/')
    await p.getByRole('button', { name: /开始|Play|对战/ }).first().waitFor({ timeout: 10_000 })
  }],
  ['设置页', async (p) => {
    await p.goto('/')
    await p.getByRole('button', { name: /设置|Settings/ }).first().click()
    await p.getByText(/减少动效|Reduce motion/).first().waitFor({ timeout: 10_000 })
  }],
  ['图鉴', async (p) => {
    await p.goto('/')
    await p.getByRole('button', { name: /名将图鉴|Collection/ }).first().click()
    await p.locator('[class*=card]').first().waitFor({ timeout: 10_000 })
  }],
]

for (const [name, go] of SCREENS) {
  test(`${name}:亮色的低对比处不比暗色多`, async ({ page }) => {
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
    // 一道量不到东西的闸门不会失败,因为它什么都不知道 —— 这道闸门的前两版
    // 就是这么「通过」的(详见 bgOf 的注释)。所以这两条排在前面。
    expect(dark.measured, '暗色下几乎没量到元素 —— 闸门空了,先修它再谈结果').toBeGreaterThan(30)
    expect(light.measured, '亮色下几乎没量到元素 —— 闸门空了').toBeGreaterThan(30)

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
