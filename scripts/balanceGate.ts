// 预组平衡的**判定逻辑**,从 sim-balance 里抽出来单放一个模块。
// 理由同 campaignGate.ts:sim-balance 是顶层就开跑的脚本,import 它等于跑几千局,
// 判定逻辑留在里面就没法单独验证 —— 而闸门的价值全在「该红时红、不该红时不红」。
//
// 【为什么这一道**不**改成显著性检验】
// 同一轮里 sim-campaign 的判定被改成了 z 检验,因为它的阈值配不上样本量
// (「章内落差 ≥8」在 60 局下即使真实落差为 0 也只有 z=1.8,根本红不了)。
// 这一道算一下就会发现**没有那个毛病**:
//
//   · 总胜率:500 局/套 → 标准误 2.2pp,而 band 是 50±10 → 4.5 个标准误
//   · 单个对位:100 局 → 标准误 5.0pp,而 band 是 50±20 → 4.0 个标准误
//
// 也就是说一套真正公平的卡组几乎不可能被误判,而真出了问题它也拦得住。
// 阈值本来就配得上样本量,不需要动。**写在这里是为了让下一个人不必再算一遍**,
// 更不要顺手把它也「统一」成 z 检验 —— 那只会让它更难红,而平衡闸门宁可敏感一点。
//
// 一句话:该不该上显著性检验,取决于阈值与标准误的比值,不取决于「别处也这么做了」。

export interface BalanceInput {
  names: string[]
  /** wins[i][j] = i 对 j 的胜场 */
  wins: number[][]
  /** games[i][j] = i 与 j 的总局数 */
  games: number[][]
}

export interface BalanceVerdict {
  problems: string[]
  /** 每套的总胜率百分数 */
  overall: number[]
  /** 最极端的那个对位,用来给调校方向 */
  worst?: { a: string; b: string; pct: number; n: number }
}

export const OVERALL_MIN = 40
export const OVERALL_MAX = 60
export const MATCHUP_MIN = 30
export const MATCHUP_MAX = 70

export function judgeBalance(input: BalanceInput): BalanceVerdict {
  const { names, wins, games } = input
  const n = names.length
  const problems: string[] = []

  // 总胜率
  const overall: number[] = []
  for (let i = 0; i < n; i++) {
    let w = 0
    let g = 0
    for (let j = 0; j < n; j++) {
      if (i === j) continue
      w += wins[i][j]
      g += games[i][j]
    }
    overall[i] = g ? (100 * w) / g : 0
  }
  const overallOut = overall
    .map((p, i) => ({ p, name: names[i] }))
    .filter((x) => x.p < OVERALL_MIN || x.p > OVERALL_MAX)
  for (const o of overallOut) {
    problems.push(`总胜率超出 ${OVERALL_MIN}-${OVERALL_MAX}%:${o.name} ${o.p.toFixed(1)}%`)
  }

  // 单个对位 —— 只看总胜率是不够的:六套互相克制、各自总分都在 50% 附近,
  // 照样能通过检查,但玩家体验是「选卡组即定胜负」的猜拳,不是对局博弈。
  const matchupOut: Array<{ a: string; b: string; pct: number; n: number }> = []
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!games[i][j]) continue
      const pct = (100 * wins[i][j]) / games[i][j]
      if (pct < MATCHUP_MIN || pct > MATCHUP_MAX) {
        matchupOut.push({ a: names[i], b: names[j], pct, n: games[i][j] })
      }
    }
  }
  matchupOut.sort((x, y) => Math.abs(y.pct - 50) - Math.abs(x.pct - 50))
  for (const m of matchupOut) {
    problems.push(
      `对位极化,超出 ${MATCHUP_MIN}-${MATCHUP_MAX}%:${m.a} vs ${m.b} ${m.pct.toFixed(0)}%(${m.n} 局)`,
    )
  }

  return { problems, overall, worst: matchupOut[0] }
}
