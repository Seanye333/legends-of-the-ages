import type { ExportOutcome } from './cardExport'

// 生涯檔案 —— 一张能发出去的「我玩到哪了」。
//
// 【它和戰報海報的分工】
// 战报海报是**一局**的结果,打完就发;生涯档案是**这些年**的结果,想起来才发。
// 前者的主角是胜负,后者的主角是军衔与那几条纪录。
//
// 【为什么是图不是一段文字】
// 一段文字发出去是「我在玩这个」,一张排好版的图发出去是「你看这个」。
// 而且这个游戏一个字节都不往外送(见 ARCHITECTURE 安全边界),
// 没有服务器就没有个人主页链接 —— 图是唯一能带走的载体。
//
// 【为什么复用 recapExport 的画法而不是抽公共层】
// 两张图的版式差得很远(一张是竖排的成绩单,一张是横幅胜负),
// 抽出来的公共层只会是「画个圆角矩形」这种没有意义的东西。
// 真正共享的是**出图路径**(移动端优先系统分享、否则下载),那一段抽了。
const W = 800
const H = 1040
const PAD = 52

export interface CareerLine {
  label: string
  value: string
}

export interface CareerProfile {
  rank: string // 军衔
  merit: number
  title: string // 一句话概括(「已经打过 300 局以上了」之类)
  sections: { heading: string; lines: CareerLine[] }[]
}

export function renderCareerPNG(profile: CareerProfile, zh: boolean): Promise<Blob | null> {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.resolve(null)

  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#221b11')
  bg.addColorStop(0.5, '#14100a')
  bg.addColorStop(1, '#0b0805')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // 上下两道包边 —— 卷轴的样子。没有它这张图就是一块深色背景上的文字列表。
  ctx.fillStyle = '#d4a84a'
  ctx.fillRect(0, 0, W, 6)
  ctx.fillRect(0, H - 6, W, 6)

  const serif = '"Songti SC", "STSong", "Noto Serif SC", serif'
  const sans = '"PingFang SC", "Hiragino Sans GB", sans-serif'

  // 军衔:整张图最该一眼看到的东西
  ctx.fillStyle = '#f7e1a8'
  ctx.font = `bold ${zh ? 84 : 60}px ${serif}`
  ctx.fillText(profile.rank, PAD, PAD + 84)

  ctx.fillStyle = '#c9bfa8'
  ctx.font = `24px ${sans}`
  ctx.fillText(
    zh ? `累計戰功 ${profile.merit}` : `${profile.merit} war merit`,
    PAD,
    PAD + 126,
  )

  if (profile.title) {
    ctx.fillStyle = '#9a8a6a'
    ctx.font = `19px ${sans}`
    ctx.fillText(profile.title, PAD, PAD + 162)
  }

  let y = PAD + 216
  for (const section of profile.sections) {
    // 版面见底就停:宁可少画一段,也不能让文字压到页脚上去。
    // 画布是固定高的,而各段的行数随玩家进度变化 —— 这一条必须有。
    if (y > H - 140) break

    ctx.fillStyle = '#d4a84a'
    ctx.font = `bold 26px ${serif}`
    ctx.fillText(section.heading, PAD, y)
    ctx.fillStyle = 'rgba(212, 168, 74, 0.35)'
    ctx.fillRect(PAD, y + 12, W - PAD * 2, 1)
    y += 46

    for (const line of section.lines) {
      if (y > H - 120) break
      ctx.fillStyle = '#c9bfa8'
      ctx.font = `20px ${sans}`
      ctx.fillText(line.label, PAD, y)
      // 数值右对齐:一列参差不齐的数字读起来要一个个找,右对齐一眼扫完
      ctx.fillStyle = '#e8dfc8'
      ctx.font = `bold 20px ${sans}`
      ctx.textAlign = 'right'
      ctx.fillText(line.value, W - PAD, y)
      ctx.textAlign = 'left'
      y += 34
    }
    y += 22
  }

  ctx.fillStyle = '#6a5f48'
  ctx.font = `14px ${sans}`
  ctx.fillText(zh ? '千古名将 · Legends of the Ages' : 'Legends of the Ages', PAD, H - 28)

  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/** 与卡面/卡组/战报同一条出图路径:移动端优先系统分享,否则下载 */
export async function exportCareerImage(
  profile: CareerProfile,
  zh: boolean,
): Promise<ExportOutcome> {
  const blob = await renderCareerPNG(profile, zh)
  if (!blob) return 'failed'
  const file = new File([blob], 'career.png', { type: 'image/png' })
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
  a.download = 'career.png'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
  return 'saved'
}
