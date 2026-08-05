// 先手优势的判定逻辑。抽出来单放一个模块,理由同 campaignGate.ts:
// sim-firstplayer 是顶层就开跑的脚本,import 它等于跑几千局。
//
// 【判定思路】
// 完全对称的配置(同一套牌打自己)理论胜率是 50%。偏离多少算「设计上可以接受」?
// 卡牌游戏普遍存在先手优势,把它压到 50.0 既不现实也不必要 ——
// 真正要防的是**大到改变游戏性质**的偏置。所以band 定在 45–55%,
// 并且和这个仓库其他闸门一样只在**统计显著**越界时才判红。
//
// 【这道闸门为什么现有闸门替代不了】
// sim-balance 的座位与先后手是各自独立轮换的,先手优势在那张矩阵里被平均掉了 ——
// 也就是说这条偏置可以一直存在而不触发任何现有闸门。实测 2026-08-04:
// 六套预组自我对镜,先手胜率 71–76%,而当时没有任何一道闸门是红的。
//
// 【它还是所有对镜类模拟的仪器自检】
// 「两边放同一个东西,结果必须是 50%」这一步一旦跳过,尺子歪了也看不出来。
// sim-hero-mirror 就是这么把四个备选主公误判成「过弱」的(详见 simSeating.ts)。

export interface FirstPlayerVerdict {
  problems: string[]
  /** 给人看的解读,无论红绿都打印 */
  report: string[]
}

const LO = 45
const HI = 55
const Z = 2

/** 单个比例的标准误(Agresti–Coull),**收百分数、吐百分点**。 */
function seOfPct(pct: number, games: number): number {
  const p = pct / 100
  const pt = (p * games + 2) / (games + 4)
  return Math.sqrt((pt * (1 - pt)) / (games + 4)) * 100
}

/**
 * @param ratesPct 每套预组的**先手胜率百分数**(不是比例)
 * @param games    每套预组的局数
 */
export function judgeFirstPlayer(ratesPct: number[], games: number): FirstPlayerVerdict {
  const problems: string[] = []
  const report: string[] = []
  if (ratesPct.length === 0) return { problems, report }

  const overall = ratesPct.reduce((a, b) => a + b, 0) / ratesPct.length
  // 合计的标准误:k 套各 games 局,总样本 k*games
  const seAll = seOfPct(overall, ratesPct.length * games)

  const zHi = (overall - HI) / seAll
  const zLo = (LO - overall) / seAll
  if (zHi > Z) {
    problems.push(
      `先手方胜率 ${overall.toFixed(1)}%,显著高于 ${HI}% [z=${zHi.toFixed(1)}] —— ` +
        `后手补偿不足`,
    )
  } else if (zLo > Z) {
    problems.push(
      `后手方胜率 ${(100 - overall).toFixed(1)}%,显著高于 ${HI}% [z=${zLo.toFixed(1)}] —— ` +
        `后手补偿过头`,
    )
  }

  // 解读:把「先手优势」换算成更直观的说法
  const edge = overall - 50
  report.push('')
  if (Math.abs(edge) < 1) {
    report.push(`先手优势 ${edge >= 0 ? '+' : ''}${edge.toFixed(1)} 个百分点 —— 基本对称。`)
  } else {
    const odds = overall / Math.max(0.001, 100 - overall)
    report.push(
      `先手优势 ${edge >= 0 ? '+' : ''}${edge.toFixed(1)} 个百分点` +
        `(先手方赢的概率是后手方的 ${odds.toFixed(2)} 倍)。`,
    )
  }

  // 各套之间是否一致 —— 如果某一套明显更吃先手,那说明它和卡组构筑耦合,
  // 补偿方案要按「对谁都公平」来选,不能只看合计。
  const spread = Math.max(...ratesPct) - Math.min(...ratesPct)
  const seOne = seOfPct(overall, games)
  if (spread > 2 * Z * seOne) {
    report.push(
      `各套预组之间差 ${spread.toFixed(1)} 个百分点(单套标准误 ±${seOne.toFixed(1)})—— ` +
        `先手优势与卡组构筑耦合,补偿方案要照顾到最吃亏的那一套。`,
    )
  }

  return { problems, report }
}
