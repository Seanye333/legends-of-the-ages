// 首屏体积闸门的**判定逻辑**,从 perf-budget 里抽出来单放一个模块。
// 与另外几个判定层同样的理由:抽出来才验得了「该红时红、不该红时不红」——
// 而这一道原本连「它还在不在守东西」都没人验过(见下)。
//
// 【这道闸门原本有一个静默失效】
// 按 chunk 钉的基线是靠正则去 dist 里找文件的:
//
//   [/\/assets\/content-.*\.js$/, 150, '内容层']
//
// 找不到时原来的代码是 `console.warn(...)` 然后 `continue` —— 注释里明明白白写着
// 「打包分块规则可能改了,**基线失效**」,却只警告不报错。
// 也就是说 vite.config 的 manualChunks 一改名(或者某个 chunk 被合并掉),
// 那条上限就**不再守任何东西**,而 CI 照样绿、日志里那行 warn 没人会看。
//
// 这正是本仓库列为最贵的一类 bug:不崩不红,只是「有东西不见了」。
// 现在改成硬失败:基线找不到目标就是红,逼人当场决定「改基线还是改打包」。
// 少一条能默默停止工作的闸门。
//
// 【2026-08-09 补上镜像的那一半:没人管的 chunk】
// 上面那条验的是「每条基线都找得到文件」,而反过来**没人验**:
// 首屏出现了一个不在基线表上的 chunk,三条正则一条都不匹配,于是它不受任何约束。
// 这不是假想:查第 51 条时随手在 manualChunks 里加了一行,
// 主包从 189.8 KB 掉到 75.7 KB —— 而新出来的那块 116.6 KB **首屏照样下载**,
// 玩家一个字节都没少等。总预算那条拦住了它(合计几乎没变),
// 但「首屏主包 / 190」这条基线当场变绿,报表上看起来像是瘦了一半。
//
// 也就是说:**改一行分块规则就能让每条 chunk 基线好看**,而基线的本意
// 恰恰是回答「谁胖了」。所以现在要求每个首屏文件都被某条基线覆盖到 ——
// 新增一块就得先给它写一条基线,把「它该多大」当场说清楚。

export interface ChunkCeiling {
  /** 匹配 dist 下的文件路径 */
  re: RegExp
  /** gzip 后的上限,KB */
  ceilKB: number
  label: string
}

export interface BudgetInput {
  /** 首屏必须下载的文件:路径 → gzip 字节数 */
  files: Array<{ file: string; gz: number }>
  /** 总预算,KB */
  budgetKB: number
  ceilings: ChunkCeiling[]
}

/**
 * 每条问题**带类型**,不是一串字符串。
 *
 * 【为什么不能是字符串】2026-08-09 实测踩到:判定层报了「有 chunk 没人管」,
 * 而 perf-budget 那边是 `problems.filter(p => p.startsWith('chunk'))` ——
 * 新消息不以 chunk 开头,于是**判对了却被打印层丢掉**,闸门照样绿。
 * 按前缀猜字符串的分类迟早会这样坏,而且坏得没有任何提示。
 * 带上 kind 之后,调用方按「排除已单独处理的那一类」写,新增的类别默认会被报出来。
 */
export type ProblemKind =
  /** 首屏总量超预算 */
  | 'total'
  /** 某条 chunk 基线超上限 */
  | 'ceiling'
  /** 某条基线找不到目标文件 —— 它已经不守任何东西了 */
  | 'missing'
  /** 首屏里有文件不在任何一条基线里 —— 没人管的那一块 */
  | 'uncovered'

export interface BudgetProblem {
  kind: ProblemKind
  msg: string
}

export interface BudgetVerdict {
  problems: BudgetProblem[]
  totalKB: number
  /** 每条 chunk 基线的结果;missing=true 表示正则没匹配到任何文件 */
  chunks: Array<{ label: string; kb: number | null; ceilKB: number; missing: boolean }>
}

export function judgeBudget(input: BudgetInput): BudgetVerdict {
  const { files, budgetKB, ceilings } = input
  const problems: BudgetProblem[] = []

  const totalKB = files.reduce((n, e) => n + e.gz, 0) / 1024
  if (totalKB > budgetKB) {
    problems.push({ kind: 'total', msg: `首屏超预算 ${(totalKB - budgetKB).toFixed(1)} KB(${totalKB.toFixed(1)} / ${budgetKB})` })
  }

  const chunks: BudgetVerdict['chunks'] = []
  const covered = new Set<string>()
  for (const c of ceilings) {
    // **匹配到的全算进来**,不是只取第一个:分块规则一改就可能出现两个
    // `index-*.js`,只量第一个的话第二个就是白送的。
    const hits = files.filter((e) => c.re.test(e.file))
    for (const h of hits) covered.add(h.file)
    if (hits.length === 0) {
      // **不是警告,是红。** 见文件头:找不到 = 这条基线已经不守任何东西了。
      chunks.push({ label: c.label, kb: null, ceilKB: c.ceilKB, missing: true })
      problems.push({
        kind: 'missing',
        msg:
          `chunk 基线「${c.label}」找不到目标文件 —— 打包分块规则改了?` +
          `这条基线现在不守任何东西,要么改正则要么删掉它,别让它默默失效`,
      })
      continue
    }
    const kb = hits.reduce((n, h) => n + h.gz, 0) / 1024
    chunks.push({ label: c.label, kb, ceilKB: c.ceilKB, missing: false })
    if (kb > c.ceilKB) {
      problems.push({ kind: 'ceiling', msg: `chunk「${c.label}」${kb.toFixed(1)} KB 超出基线 ${c.ceilKB} KB` })
    }
  }

  // 镜像的那一半:首屏里出现了没人管的文件(见文件头)。
  for (const f of files) {
    if (covered.has(f.file)) continue
    problems.push({
      kind: 'uncovered',
      msg:
        `首屏文件「${f.file}」${(f.gz / 1024).toFixed(1)} KB **不在任何一条 chunk 基线里** —— ` +
        `新分出来的块要先写一条基线,否则改一行分块规则就能让报表变好看,而玩家下载的字节一个没少`,
    })
  }

  return { problems, totalKB, chunks }
}
