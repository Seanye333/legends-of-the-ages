/**
 * 千古名将 · logo 光栅化管线
 *
 *   node scripts/make-logo.mjs
 *
 * 源图是 assets/logo.svg(纯 SVG,渐变 / 滤镜 / 系统字形)。这里用 Playwright
 * 的 Chromium 渲染成位图,字形在生成时就被光栅化固化,运行时(Tauri / iOS /
 * 浏览器)不再依赖任何字体。
 *
 * 产物:
 *   assets/logo-1024.png        —— iOS 图标源图(不透明、无圆角,iOS 自己切)
 *   public/apple-touch-icon.png —— 180×180
 *   public/favicon-192.png      —— 192×192
 *   public/favicon-32.png       —— 32×32
 */
import { chromium } from 'playwright'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const OUTPUTS = [
  { file: 'assets/logo-1024.png', size: 1024 },
  { file: 'public/favicon-192.png', size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-32.png', size: 32 },
]

const svg = await readFile(resolve(ROOT, 'assets/logo.svg'), 'utf8')

const browser = await chromium.launch()
try {
  for (const { file, size } of OUTPUTS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    })
    // 小尺寸先在 4× 画布上渲染再缩，避免细线走样(favicon 尤其明显)。
    const scale = size <= 256 ? 4 : 1
    await page.setContent(
      `<!doctype html><meta charset="utf-8">
       <style>
         html,body{margin:0;padding:0;background:#0a0805;overflow:hidden}
         svg{display:block;width:${size * scale}px;height:${size * scale}px;
             transform:scale(${1 / scale});transform-origin:0 0}
       </style>${svg}`,
      { waitUntil: 'load' },
    )
    await page.evaluate(() => document.fonts.ready)
    const png = await page.screenshot({ type: 'png', omitBackground: false })
    const out = resolve(ROOT, file)
    await mkdir(dirname(out), { recursive: true })
    await writeFile(out, png)
    await page.close()
    console.log(`  ✓ ${file}  ${size}×${size}  ${(png.length / 1024).toFixed(1)} KB`)
  }
} finally {
  await browser.close()
}

console.log('\n下一步:npx tauri icon assets/logo-1024.png')
