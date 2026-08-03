import type { HeroDef } from '../engine/types'
import { CLAN_QUORUM } from '../engine/types'

import { CARDS_BY_ID } from '../content/cards'
import { deckHealth } from '../content/deckHealth'
import { deckBonds, deckClans } from '../content/relations'
import { DOCTRINE_COLORS, DOCTRINE_GLYPH } from './doctrineColors'
import type { ExportOutcome } from './cardExport'

// 卡组分享图 —— 把一副牌画成一张可以直接发出去的图。
//
// 【为什么不是卡组码就够了】
// 卡组码是**给游戏读的**:一串 base64,人看不出里面是什么牌,更没法在社交媒体上
// 引起任何兴趣。而这个游戏的卡组自带叙事(羁绊、时代、主义)——
// 一张图能把「这是一副桃园结义的牌」一眼说清楚,卡组码不能。
//
// 【为什么不画立绘】
// 立绘要么随包(签名卡)要么走 CDN,一张图里塞三十张立绘既慢又可能触发跨域污染
// (cardExport 那边已经踩过:CDN 不给 CORS 头,toBlob 直接抛 SecurityError)。
// 所以这张图**纯文字排版** —— 卡名、费用、份数、体检、羁绊,外加卡组码本身。
// 它要传达的是「这副牌是什么」,不是「这副牌多好看」。
const W = 900
const PAD = 40
const ROW_H = 34

function line(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, 1)
}

export function renderDeckPNG(
  hero: HeroDef,
  counts: Record<string, number>,
  deckName: string,
  code: string,
  lang: 'zh' | 'en' | 'both',
): Promise<Blob | null> {
  const zh = lang !== 'en'
  const entries = Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort(
      ([a], [b]) =>
        (CARDS_BY_ID[a]?.cost ?? 0) - (CARDS_BY_ID[b]?.cost ?? 0) || a.localeCompare(b),
    )
  const cardIds = entries.flatMap(([id, n]) => Array<string>(n).fill(id))
  const health = deckHealth(cardIds)
  const bonds = deckBonds(entries.map(([id]) => id)).filter((b) => b.missing.length === 0)
  // 家族同理只报**成得了的**那些(两个不同的族人)。分享图是给人看的,
  // 「差一个人的家族」是构筑器该说的话,不是海报该说的话。
  const clans = deckClans(entries.map(([id]) => id)).filter((c) => c.have.length >= CLAN_QUORUM)

  // 两栏排版:三十张牌一栏放不下,一栏又太长
  const rows = Math.ceil(entries.length / 2)
  // 高度是算出来的,不是拍的:头部 150 + 卡表 + 页脚 66(码 + 一行说明)+ 羁绊行。
  // 第一版尾部留了 90,实测底下空出一大条 —— 图要发出去,留白就是浪费像素。
  const H = PAD + 150 + rows * ROW_H + 66 + (bonds.length > 0 ? 34 : 0) + (clans.length > 0 ? 34 : 0)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  // 背景
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1d1710')
  bg.addColorStop(1, '#0b0805')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const accent = DOCTRINE_COLORS[hero.doctrine]
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, 5)

  // 标题
  ctx.fillStyle = '#e8d9b5'
  ctx.font = 'bold 34px "PingFang SC", "Noto Serif SC", serif'
  ctx.fillText(deckName || (zh ? '自组卡组' : 'Custom Deck'), PAD, PAD + 34)

  ctx.fillStyle = accent
  ctx.font = '18px "PingFang SC", sans-serif'
  ctx.fillText(
    `${DOCTRINE_GLYPH[hero.doctrine]} ${zh ? hero.name.zh : hero.name.en} · ${cardIds.length} ${zh ? '张' : 'cards'}`,
    PAD,
    PAD + 64,
  )

  // 体检行
  ctx.fillStyle = '#9a8c6e'
  ctx.font = '15px "PingFang SC", sans-serif'
  const stats = zh
    ? `均费 ${health.avgCost.toFixed(1)} · 身材 ${health.body} · 守护 ${health.guards} · 解场 ${health.removal} · 抽牌 ${health.draw}`
    : `avg ${health.avgCost.toFixed(1)} · body ${health.body} · guard ${health.guards} · removal ${health.removal} · draw ${health.draw}`
  ctx.fillText(stats, PAD, PAD + 92)

  line(ctx, PAD, PAD + 110, W - PAD * 2, 'rgba(212,168,74,0.3)')

  // 卡表(两栏)
  const colW = (W - PAD * 2) / 2
  entries.forEach(([id, n], i) => {
    const card = CARDS_BY_ID[id]
    const col = Math.floor(i / rows)
    const row = i % rows
    const x = PAD + col * colW
    const y = PAD + 140 + row * ROW_H

    ctx.fillStyle = '#2359a8'
    ctx.beginPath()
    ctx.arc(x + 12, y - 6, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 14px "PingFang SC", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(card?.cost ?? '?'), x + 12, y - 1)
    ctx.textAlign = 'left'

    ctx.fillStyle = '#e8d9b5'
    ctx.font = '17px "PingFang SC", "Noto Serif SC", serif'
    ctx.fillText(zh ? (card?.name.zh ?? id) : (card?.name.en ?? id), x + 32, y)

    if (n > 1) {
      ctx.fillStyle = '#d4a84a'
      ctx.font = 'bold 15px "PingFang SC", sans-serif'
      ctx.fillText(`×${n}`, x + colW - 46, y)
    }
  })

  let cursor = PAD + 140 + rows * ROW_H + 16

  // 羁绊:这副牌的叙事 —— 卡组码永远说不出这一行
  if (bonds.length > 0) {
    ctx.fillStyle = '#d4a84a'
    ctx.font = '16px "PingFang SC", sans-serif'
    ctx.fillText(
      `${zh ? '羈絆' : 'Bonds'}  ${bonds.map((b) => (zh ? b.ref.bond.name.zh : b.ref.bond.name.en)).join(' · ')}`,
      PAD,
      cursor,
    )
    cursor += 34
  }

  // 家族:和羁绊同一行高、同一种口吻 —— 它也是「这副牌的理由」
  if (clans.length > 0) {
    ctx.fillStyle = '#d4a84a'
    ctx.font = '16px "PingFang SC", sans-serif'
    ctx.fillText(
      `${zh ? '家族' : 'Clans'}  ${clans.map((c) => `${zh ? c.name.zh : c.name.en}·${c.have.length}`).join('  ')}`,
      PAD,
      cursor,
    )
    cursor += 34
  }

  // 卡组码 —— 图是给人看的,码是给游戏读的,两者都要在
  line(ctx, PAD, cursor - 8, W - PAD * 2, 'rgba(212,168,74,0.25)')
  ctx.fillStyle = '#7a6c50'
  ctx.font = '13px ui-monospace, monospace'
  ctx.fillText(code.length > 96 ? `${code.slice(0, 96)}…` : code, PAD, cursor + 18)
  ctx.fillStyle = '#5e523c'
  ctx.font = '13px "PingFang SC", sans-serif'
  ctx.fillText(zh ? '千古名将 · 卡组码可直接导入' : 'Legends of the Ages — import with this code', PAD, cursor + 42)

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 优先走系统分享(移动端),否则触发下载 —— 与 exportCardImage 同一条路径 */
export async function exportDeckImage(
  hero: HeroDef,
  counts: Record<string, number>,
  deckName: string,
  code: string,
  lang: 'zh' | 'en' | 'both',
): Promise<ExportOutcome> {
  const blob = await renderDeckPNG(hero, counts, deckName, code, lang)
  if (!blob) return 'failed'
  const file = new File([blob], 'deck.png', { type: 'image/png' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: deckName })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'canceled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${deckName || 'deck'}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
