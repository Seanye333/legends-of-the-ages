import type { HeroDef, Winner } from '../engine/types'
import type { MatchStats } from '../app/matchStats'
import { DOCTRINE_COLORS, DOCTRINE_GLYPH } from './doctrineColors'
import type { ExportOutcome } from './cardExport'

// 戰報海報 —— 一局打完之后能发出去的那张图。
//
// 【为什么不是「战报分享码」】
// 一份战报是**每一帧的完整 GameState**(replayStore 的上限是 2.5MB/局)。
// 把它编成一串码,长度以兆计 —— 没有服务器就没有短链接,而这个游戏到现在
// 一个字节都没往外送过(ARCHITECTURE 安全边界一节)。
// 所以能分享出去的不是「重放」,是**结果**:谁打了谁、赢没赢、这一局什么样。
//
// 【图上放什么】
// 只放 GameState 事后**恢复不出来**的那几个数(与结算面板同源的 MatchStats):
// 总伤害、打脸伤害、斩将数、最大场面、回合数。
// 血量与场面在终局帧里就有,不必占版面。
const W = 800
const H = 460
const PAD = 44

export function renderRecapPNG(
  mine: HeroDef | undefined,
  foeName: string,
  winner: Winner | undefined,
  stats: MatchStats,
  zh: boolean,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#1d1710')
  bg.addColorStop(1, '#0b0805')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const accent = mine ? DOCTRINE_COLORS[mine.doctrine] : '#d4a84a'
  ctx.fillStyle = accent
  ctx.fillRect(0, 0, W, 5)

  // 胜负 —— 海报最该一眼看到的东西
  const verdict = winner === 0 ? (zh ? '勝' : 'VICTORY') : winner === 1 ? (zh ? '負' : 'DEFEAT') : (zh ? '和' : 'DRAW')
  ctx.fillStyle = winner === 0 ? '#e8c878' : winner === 1 ? '#c86a5a' : '#9a8c6e'
  ctx.font = `bold ${zh ? 76 : 56}px "PingFang SC", "Noto Serif SC", serif`
  ctx.fillText(verdict, PAD, PAD + 72)

  ctx.fillStyle = '#e8d9b5'
  ctx.font = '24px "PingFang SC", "Noto Serif SC", serif'
  const who = `${mine ? (zh ? mine.name.zh : mine.name.en) : '?'}  vs  ${foeName}`
  ctx.fillText(who, PAD, PAD + 118)

  if (mine) {
    ctx.fillStyle = accent
    ctx.font = '18px "PingFang SC", sans-serif'
    ctx.fillText(DOCTRINE_GLYPH[mine.doctrine], PAD, PAD + 150)
  }

  // 数据:两列,只放事后恢复不出来的那几个
  const rows: [string, string][] = zh
    ? [
        ['總傷害', String(stats.damageDealt)],
        ['打臉傷害', String(stats.damageToFace)],
        ['斬將', String(stats.enemyGeneralsSlain)],
        ['承受傷害', String(stats.damageTaken)],
        ['最大場面', String(stats.peakBoard)],
        ['回合', String(stats.turns)],
      ]
    : [
        ['Damage', String(stats.damageDealt)],
        ['To face', String(stats.damageToFace)],
        ['Slain', String(stats.enemyGeneralsSlain)],
        ['Taken', String(stats.damageTaken)],
        ['Peak board', String(stats.peakBoard)],
        ['Turns', String(stats.turns)],
      ]

  rows.forEach(([label, value], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = PAD + col * ((W - PAD * 2) / 2)
    const y = PAD + 200 + row * 58
    ctx.fillStyle = '#9a8c6e'
    ctx.font = '15px "PingFang SC", sans-serif'
    ctx.fillText(label, x, y)
    ctx.fillStyle = '#e8d9b5'
    ctx.font = 'bold 30px "PingFang SC", sans-serif'
    ctx.fillText(value, x, y + 32)
  })

  ctx.fillStyle = '#5e523c'
  ctx.font = '13px "PingFang SC", sans-serif'
  ctx.fillText(zh ? '千古名将 · Legends of the Ages' : 'Legends of the Ages', PAD, H - 24)

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 与卡面/卡组同一条出图路径:移动端优先系统分享,否则下载 */
export async function exportRecapImage(
  mine: HeroDef | undefined,
  foeName: string,
  winner: Winner | undefined,
  stats: MatchStats,
  zh: boolean,
): Promise<ExportOutcome> {
  const blob = await renderRecapPNG(mine, foeName, winner, stats, zh)
  if (!blob) return 'failed'
  const file = new File([blob], 'recap.png', { type: 'image/png' })
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'canceled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'recap.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
