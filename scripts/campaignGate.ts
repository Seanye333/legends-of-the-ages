// 冒险难度曲线的**判定逻辑**,从 sim-campaign 里抽出来单放一个模块。
//
// 【为什么要单独一个文件】sim-campaign.ts 是顶层就开跑的脚本 —— import 它等于跑一遍
// 24 关模拟(十分钟起步)。判定逻辑留在里面就没法单独验证,而这恰恰是最该验证的一层:
// 闸门的价值全在「该红时红、不该红时不红」,那是纯函数,不需要真打牌。
// 见 ROADMAP「闸门自检推广」。
//
// 【判定为什么走显著性,不拿点估计直接比阈值】
// 从前是 `if (chRates[0] < openFloor)` 这样的裸比较,和样本量完全无关:
//   · 60 局/关时单关标准误 6.5pp —— 一个真正 40% 的开章关有相当概率被判成「劝退」
//   · 「章内前后半落差 ≥8」那一条的差值标准误是 4.5pp,
//     也就是说**哪怕真实落差是 0,z 也只有 1.8,这道闸门永远红不了**
// 一道既会误报又抓不到真问题的闸门比没有更糟。2026-08 它就误报过一次
// (「第 2 章曲线太平:前半 48% vs 后半 46%」,2 个点的差,半宽 ±13),
// 而 ROADMAP 把那次误报当成真问题写进了待办第一条,差点据此去重调关卡。
//
// 现在每一条都要求「越界幅度大于 Z 倍标准误」才算数,并把 z 一起吐出来让人自己判。
// 同一类毛病的另外两道闸门早就修过:sim-ai-tiers 换成真 z 检验、
// sim-hero-mirror 从 100 局提到 400 局。

export interface GateOpts {
  games: number
  openFloor: number // 开章胜率下限(第一章 55,后续章 35)
  z?: number // 显著性阈值,默认 2,与 sim-ai-tiers 同一条线
  drop?: number // 章内前后半要求的最小落差(个百分点)
  finaleCap?: number // 末关胜率上限
}

export interface ChapterVerdict {
  problems: string[]
  /** 样本不足以支撑落差判定时的提示(此时这一跑对那一条等于没测) */
  note?: string
}

/**
 * 单关胜率的标准误,**收比例(0–1)、吐百分点**。
 *
 * 用 Agresti–Coull(加 2 成功 2 失败)而不是朴素 √(p(1−p)/n):
 * 朴素式在 p=0 或 1 时是 0,z 会变成无穷 —— 于謙那种 12% 的关卡一旦某次跑出 0%,
 * 就会被无条件判红。加 2/2 之后边界不再退化。
 */
export function seOf(p: number, games: number): number {
  const pt = (p * games + 2) / (games + 4)
  return Math.sqrt((pt * (1 - pt)) / (games + 4)) * 100
}

const meanPct = (ps: number[]) => (ps.reduce((a, b) => a + b, 0) / ps.length) * 100

/** 均值的标准误:Var(mean) = (1/k²)·ΣVar(pᵢ)。同样收比例、吐百分点。 */
const seOfMean = (ps: number[], games: number) =>
  Math.sqrt(ps.reduce((s, p) => s + seOf(p, games) ** 2, 0)) / ps.length

/**
 * 校验一章的难度曲线。`props` 是这一章各关玩家胜率(比例 0–1,按关序)。
 *
 * 三条:开章要够友好 · 收官要够难 · 章内整体递减。
 * 递减用「前半均 − 后半均」而不是逐关严格递减 —— 后者会被单关噪声打断。
 */
export function judgeChapter(ch: number, props: number[], opts: GateOpts): ChapterVerdict {
  const { games, openFloor } = opts
  const Z = opts.z ?? 2
  const DROP = opts.drop ?? 8
  const CAP = opts.finaleCap ?? 45
  const problems: string[] = []
  if (props.length < 2) return { problems }

  const pct = (p: number) => Math.round(p * 100)

  const zOpen = (openFloor - props[0] * 100) / seOf(props[0], games)
  if (zOpen > Z) {
    problems.push(
      `第 ${ch} 章开章胜率仅 ${pct(props[0])}%(应 ≥${openFloor}%),劝退 [z=${zOpen.toFixed(1)}]`,
    )
  }

  const last = props[props.length - 1]
  const zLast = (last * 100 - CAP) / seOf(last, games)
  if (zLast > Z) {
    problems.push(`第 ${ch} 章末关胜率 ${pct(last)}%,关底不够关底 [z=${zLast.toFixed(1)}]`)
  }

  const half = Math.floor(props.length / 2)
  const frontPs = props.slice(0, half)
  const backPs = props.slice(half)
  const front = meanPct(frontPs)
  const back = meanPct(backPs)
  const seDiff = Math.sqrt(seOfMean(frontPs, games) ** 2 + seOfMean(backPs, games) ** 2)
  const zDrop = (DROP - (front - back)) / seDiff
  if (zDrop > Z) {
    problems.push(
      `第 ${ch} 章曲线太平:前半均 ${Math.round(front)}% vs 后半均 ${Math.round(back)}% ` +
        `(落差 ${(front - back).toFixed(1)} ±${seDiff.toFixed(1)},应 ≥${DROP})[z=${zDrop.toFixed(1)}]`,
    )
  }

  // 这一跑的样本撑不撑得起落差判定:落差要小到多少才红得起来。
  // 小于 0 说明**再平的曲线也红不了**,那这一跑对这一条等于没测 —— 必须说出来,
  // 否则一个「测不动」的绿会被读成「没问题」。
  const note =
    DROP - Z * seDiff < 0
      ? `第 ${ch} 章:落差判定在 ${games} 局下没有分辨力(差值标准误 ±${seDiff.toFixed(1)},` +
        `即使落差为 0 也只有 z=${(DROP / seDiff).toFixed(1)})—— 加大 GAMES 才测得动这一条`
      : undefined

  return { problems, note }
}
