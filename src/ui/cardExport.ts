import type { CardDef } from '../engine/types'
import {
  DOCTRINE_COLORS,
  DOCTRINE_NAME,
  DYNASTY_NAME,
  KEYWORD_NAME,
  RARITY_NAME,
} from './doctrineColors'
import { isCrossOrigin, portraitCandidates } from './portraitSource'
import type { Language } from './i18n'

// 卡面分享导出 —— 参考姊妹项目 officerCardExport 的思路:不截 DOM,
// 用 Canvas 2D 重绘一张干净的 750×1050 静态卡面(2x 渲染保证清晰),
// 立绘 + 主义色描金边框 + 费用/攻血宝石 + 稀有度徽记 + 卡文 + 落款印章。

const W = 750
const H = 1050
const FRAME = 10 // 外框色带宽
const ART_H = 600 // 立绘区高度(含框内)
const R = 26 // 外圆角

const RARITY_META: Record<CardDef['rarity'], { color: string; gem: [string, string] }> = {
  common: { color: '#b0b0b0', gem: ['#b8b8b8', '#6a6a6a'] },
  rare: { color: '#6aa8e8', gem: ['#8ac0f0', '#2a68b8'] },
  epic: { color: '#c084e8', gem: ['#d09af0', '#7a34b0'] },
  legendary: { color: '#f0a850', gem: ['#ffe9a8', '#c8862a'] },
}

const DISPLAY_FONT = '"Songti SC", "STSong", "Kaiti SC", "Noto Serif SC", "PingFang SC", serif'

// ---------- 小工具 ----------

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    // 走 CDN 的立绘是跨源的:不带 crossOrigin 画上 canvas 会污染画布,
    // toBlob 直接抛 SecurityError。CDN 需回 Access-Control-Allow-Origin。
    if (isCrossOrigin(src)) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** hex 颜色插值(canvas 没有 color-mix) */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16)
  const pb = parseInt(b.slice(1), 16)
  const ch = (sh: number) => {
    const va = (pa >> sh) & 0xff
    const vb = (pb >> sh) & 0xff
    return Math.round(va + (vb - va) * t)
  }
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`
}

/** 中英混排断行:CJK 逐字、拉丁按词 */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const tokens = text.match(/[\u3000-\u303f\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]|\S+|\s+/gu) ?? []
  const lines: string[] = []
  let line = ''
  for (const tk of tokens) {
    const probe = line + tk
    if (line && ctx.measureText(probe).width > maxWidth) {
      lines.push(line.trimEnd())
      line = tk.trimStart()
    } else {
      line = probe
    }
  }
  if (line.trim()) lines.push(line.trimEnd())
  return lines
}

/** 立绘探测:随包全身图 → CDN 全身图 → 随包头像 → CDN 头像;全无 → null(不导出卡面) */
export async function probeCardArt(id: string): Promise<HTMLImageElement | null> {
  for (const url of portraitCandidates(id, true)) {
    const img = await loadImage(url)
    if (img) return img
  }
  return null
}

function gem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  inner: string,
  outer: string,
  border: string,
  value: string,
  fontPx: number,
) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 14
  ctx.shadowOffsetY = 4
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r)
  g.addColorStop(0, inner)
  g.addColorStop(0.55, outer)
  g.addColorStop(1, mix(outer, '#000000', 0.45))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  // 高光 + 描边
  const hl = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.45, 0, cx - r * 0.35, cy - r * 0.45, r * 0.7)
  hl.addColorStop(0, 'rgba(255,255,255,0.75)')
  hl.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = hl
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.font = `800 ${fontPx}px ${DISPLAY_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.85)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 2
  ctx.fillText(value, cx, cy + 2)
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  ctx.textBaseline = 'alphabetic'
}

// ---------- 主渲染 ----------

/** 把一张卡渲染成 750×1050(2x)PNG;无立绘 → null */
export async function renderCardPNG(def: CardDef, lang: Language): Promise<Blob | null> {
  const art = await probeCardArt(def.id)
  if (!art) return null

  const zh = lang !== 'en'
  const rar = RARITY_META[def.rarity]
  const doc = DOCTRINE_COLORS[def.doctrine]
  const dyn = DYNASTY_NAME[def.dynasty] ?? { zh: def.dynasty, en: def.dynasty }
  const rarName = RARITY_NAME[def.rarity]

  const canvas = document.createElement('canvas')
  const dpr = 2
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(dpr, dpr)

  // —— 外框:主义色 × 描金 渐变色带 ——
  const frame = ctx.createLinearGradient(0, 0, W, H)
  const stops =
    def.rarity === 'legendary'
      ? [mix(doc, '#ffe9a8', 0.55), mix(doc, '#7a5a1e', 0.3), '#f2d694', mix(doc, '#8a6a2a', 0.4)]
      : [mix(doc, '#ffffff', 0.28), doc, mix(doc, '#000000', 0.38), mix(doc, '#e8c878', 0.35)]
  stops.forEach((c, i) => frame.addColorStop(i / (stops.length - 1), c))
  ctx.fillStyle = frame
  rr(ctx, 0, 0, W, H, R)
  ctx.fill()
  // 内底
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#241d12')
  bg.addColorStop(0.7, '#171208')
  bg.addColorStop(1, '#120d06')
  ctx.fillStyle = bg
  rr(ctx, FRAME, FRAME, W - FRAME * 2, H - FRAME * 2, R - 8)
  ctx.fill()

  // —— 立绘区:cover 顶对齐 + 晕影 + 底部渐隐 ——
  const artX = FRAME
  const artW = W - FRAME * 2
  ctx.save()
  rr(ctx, artX, FRAME, artW, ART_H, R - 8)
  ctx.clip()
  const vig = ctx.createRadialGradient(W / 2, ART_H * 0.36, 60, W / 2, ART_H * 0.36, ART_H * 0.95)
  vig.addColorStop(0, '#2c2517')
  vig.addColorStop(1, '#120d06')
  ctx.fillStyle = vig
  ctx.fillRect(artX, FRAME, artW, ART_H)
  const scale = Math.max(artW / art.width, ART_H / art.height)
  const dw = art.width * scale
  const dh = art.height * scale
  ctx.drawImage(art, artX + (artW - dw) / 2, FRAME, dw, dh)
  // 高稀有:一层斜向虹彩,呼应 UI 闪卡
  if (def.rarity === 'legendary' || def.rarity === 'epic') {
    const foil = ctx.createLinearGradient(0, 0, W, ART_H)
    if (def.rarity === 'legendary') {
      foil.addColorStop(0, 'rgba(255,120,120,0.10)')
      foil.addColorStop(0.25, 'rgba(255,214,110,0.09)')
      foil.addColorStop(0.5, 'rgba(120,235,160,0.07)')
      foil.addColorStop(0.75, 'rgba(110,190,255,0.09)')
      foil.addColorStop(1, 'rgba(205,130,255,0.10)')
    } else {
      foil.addColorStop(0, 'rgba(168,124,255,0.09)')
      foil.addColorStop(0.5, 'rgba(120,170,245,0.05)')
      foil.addColorStop(1, 'rgba(205,132,250,0.09)')
    }
    ctx.fillStyle = foil
    ctx.fillRect(artX, FRAME, artW, ART_H)
  }
  // 底部渐隐入牌身
  const fade = ctx.createLinearGradient(0, FRAME + ART_H - 150, 0, FRAME + ART_H)
  fade.addColorStop(0, 'rgba(23,18,8,0)')
  fade.addColorStop(0.72, 'rgba(23,18,8,0.88)')
  fade.addColorStop(1, 'rgba(23,18,8,1)')
  ctx.fillStyle = fade
  ctx.fillRect(artX, FRAME + ART_H - 150, artW, 150)
  ctx.restore()

  // 内圈描金细线
  ctx.strokeStyle = 'rgba(224,190,118,0.5)'
  ctx.lineWidth = 2
  rr(ctx, FRAME + 7, FRAME + 7, W - (FRAME + 7) * 2, H - (FRAME + 7) * 2, R - 12)
  ctx.stroke()

  // —— 费用宝石(左上) ——
  gem(ctx, 82, 82, 48, '#5a9aee', '#2a55a8', '#9cc0f2', String(def.cost), 52)

  // —— 稀有度徽记(右上小玉印 + 名称) ——
  {
    const label = zh ? rarName.zh : rarName.en
    ctx.font = `700 26px ${DISPLAY_FONT}`
    const tw = ctx.measureText(label).width
    const bw = tw + 66
    const bx = W - FRAME - 24 - bw
    ctx.fillStyle = 'rgba(12,9,4,0.78)'
    rr(ctx, bx, 34, bw, 48, 12)
    ctx.fill()
    ctx.strokeStyle = mix(rar.color, '#000000', 0.15)
    ctx.lineWidth = 2
    rr(ctx, bx, 34, bw, 48, 12)
    ctx.stroke()
    // 玉印(旋转小方)
    ctx.save()
    ctx.translate(bx + 28, 58)
    ctx.rotate(Math.PI / 4)
    const gg = ctx.createLinearGradient(-9, -9, 9, 9)
    gg.addColorStop(0, rar.gem[0])
    gg.addColorStop(1, rar.gem[1])
    ctx.fillStyle = gg
    ctx.shadowColor = rar.color
    ctx.shadowBlur = 10
    ctx.fillRect(-9, -9, 18, 18)
    ctx.restore()
    ctx.fillStyle = rar.color
    ctx.textAlign = 'left'
    ctx.fillText(label, bx + 48, 67)
  }

  // —— 攻/血宝石 或 锦囊标 ——
  const artBottom = FRAME + ART_H
  if (def.type === 'general') {
    gem(ctx, 82, artBottom - 40, 44, '#f0c250', '#b8862a', '#f5d78a', String(def.attack ?? 0), 46)
    gem(ctx, W - 82, artBottom - 40, 44, '#e05a48', '#a82e20', '#e88a7a', String(def.health ?? 0), 46)
  } else {
    const label = zh ? '锦 囊' : 'STRATAGEM'
    ctx.font = `700 26px ${DISPLAY_FONT}`
    const tw = ctx.measureText(label).width
    const bw = tw + 56
    ctx.save()
    ctx.translate(W / 2, artBottom - 44)
    ctx.fillStyle = '#5e1c10'
    ctx.strokeStyle = 'rgba(224,170,100,0.85)'
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(-bw / 2, 0)
    ctx.lineTo(-bw / 2 + 14, -24)
    ctx.lineTo(bw / 2 - 14, -24)
    ctx.lineTo(bw / 2, 0)
    ctx.lineTo(bw / 2 - 14, 24)
    ctx.lineTo(-bw / 2 + 14, 24)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#f0d8a0'
    ctx.textAlign = 'center'
    ctx.fillText(label, 0, 9)
    ctx.restore()
  }

  // —— 名号 ——
  let y = artBottom + 66
  ctx.textAlign = 'center'
  ctx.fillStyle = '#f7e1a8'
  ctx.shadowColor = 'rgba(0,0,0,0.8)'
  ctx.shadowBlur = 10
  ctx.shadowOffsetY = 3
  {
    const name = zh ? def.name.zh : def.name.en
    let px = 58
    ctx.font = `700 ${px}px ${DISPLAY_FONT}`
    while (px > 30 && ctx.measureText(name).width > W - 120) {
      px -= 4
      ctx.font = `700 ${px}px ${DISPLAY_FONT}`
    }
    ctx.fillText(name, W / 2, y)
  }
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0
  if (lang !== 'en') {
    y += 36
    ctx.font = `24px ${DISPLAY_FONT}`
    ctx.fillStyle = '#9a8a6a'
    ctx.fillText(def.name.en, W / 2, y)
  }

  // —— 出身行:稀有度 · 主义 · 朝代 · 类型 ——
  y += 44
  {
    ctx.font = `600 25px ${DISPLAY_FONT}`
    const kind =
      def.type === 'stratagem' ? (zh ? '锦囊' : 'Stratagem')
      : def.archetype === 'strategist' ? (zh ? '谋士' : 'Strategist')
      : zh ? '武将' : 'General'
    const parts: Array<[string, string]> = [
      [zh ? rarName.zh : rarName.en, rar.color],
      [zh ? DOCTRINE_NAME[def.doctrine].zh : DOCTRINE_NAME[def.doctrine].en, mix(doc, '#ffffff', 0.2)],
      [zh ? `${dyn.zh}` : dyn.en, '#c9bfa8'],
      [kind, '#c9bfa8'],
    ]
    const sep = '  ·  '
    const sepW = ctx.measureText(sep).width
    const total = parts.reduce((n, [s]) => n + ctx.measureText(s).width, 0) + sepW * (parts.length - 1)
    let x = W / 2 - total / 2
    ctx.textAlign = 'left'
    for (let i = 0; i < parts.length; i++) {
      const [txt, color] = parts[i]
      ctx.fillStyle = color
      ctx.fillText(txt, x, y)
      x += ctx.measureText(txt).width
      if (i < parts.length - 1) {
        ctx.fillStyle = '#7a6a4a'
        ctx.fillText(sep, x, y)
        x += sepW
      }
    }
    ctx.textAlign = 'center'
  }

  // 分隔描金线
  y += 30
  const rule = ctx.createLinearGradient(W * 0.16, 0, W * 0.84, 0)
  rule.addColorStop(0, 'rgba(224,190,118,0)')
  rule.addColorStop(0.5, 'rgba(224,190,118,0.55)')
  rule.addColorStop(1, 'rgba(224,190,118,0)')
  ctx.fillStyle = rule
  ctx.fillRect(W * 0.16, y, W * 0.68, 2)

  // —— 卡牌文本 ——
  if (def.text) {
    y += 52
    ctx.font = `30px ${DISPLAY_FONT}`
    ctx.fillStyle = '#e8dfc8'
    const lines = wrapText(ctx, zh ? def.text.zh : def.text.en, W - 150).slice(0, 4)
    for (const line of lines) {
      ctx.fillText(line, W / 2, y)
      y += 44
    }
    y -= 14
  }

  // —— 关键词印 ——
  if (def.keywords.length > 0) {
    y += 52
    ctx.font = `700 26px ${DISPLAY_FONT}`
    const chips = def.keywords.map((k) => (zh ? KEYWORD_NAME[k].zh : KEYWORD_NAME[k].en))
    const pad = 26
    const gap = 18
    const widths = chips.map((c) => ctx.measureText(c).width + pad * 2)
    let x = W / 2 - (widths.reduce((a, b) => a + b, 0) + gap * (chips.length - 1)) / 2
    for (let i = 0; i < chips.length; i++) {
      ctx.fillStyle = 'rgba(58,44,20,0.85)'
      rr(ctx, x, y - 32, widths[i], 46, 23)
      ctx.fill()
      ctx.strokeStyle = 'rgba(224,190,118,0.6)'
      ctx.lineWidth = 2
      rr(ctx, x, y - 32, widths[i], 46, 23)
      ctx.stroke()
      ctx.fillStyle = '#e8c878'
      ctx.textAlign = 'center'
      ctx.fillText(chips[i], x + widths[i] / 2, y)
      x += widths[i] + gap
    }
  }

  // —— 落款:编号 + 出处 + 朱印 ——
  ctx.textAlign = 'center'
  ctx.fillStyle = '#7a6a4a'
  ctx.font = `20px ${DISPLAY_FONT}`
  ctx.fillText(
    zh ? `№ ${def.collectorNo} · 千古名将 · Legends of the Ages` : `№ ${def.collectorNo} · Legends of the Ages`,
    W / 2,
    H - 34,
  )
  // 朱砂印章(右下)
  {
    const sx = W - 96
    const sy = H - 118
    ctx.save()
    ctx.translate(sx + 28, sy + 28)
    ctx.rotate(0.05)
    ctx.fillStyle = '#9c2517'
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 8
    rr(ctx, -28, -28, 56, 56, 8)
    ctx.fill()
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = 'rgba(255,235,215,0.8)'
    ctx.lineWidth = 2
    rr(ctx, -23, -23, 46, 46, 5)
    ctx.stroke()
    ctx.fillStyle = '#ffefe2'
    ctx.font = `700 21px ${DISPLAY_FONT}`
    ctx.fillText('千', 0, -3)
    ctx.fillText('古', 0, 18)
    ctx.restore()
  }

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

// ---------- 保存 / 分享 ----------

export type ExportOutcome = 'shared' | 'saved' | 'canceled' | 'failed'

/** 优先走系统分享(移动端),否则触发下载 */
export async function exportCardImage(def: CardDef, lang: Language): Promise<ExportOutcome> {
  const blob = await renderCardPNG(def, lang)
  if (!blob) return 'failed'
  const file = new File([blob], `${def.id}-card.png`, { type: 'image/png' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: def.name.zh })
      return 'shared'
    } catch (err) {
      // 用户取消分享:不再强塞下载
      if ((err as DOMException)?.name === 'AbortError') return 'canceled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${def.id}-card.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
