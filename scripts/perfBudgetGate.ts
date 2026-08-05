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

export interface BudgetVerdict {
  problems: string[]
  totalKB: number
  /** 每条 chunk 基线的结果;missing=true 表示正则没匹配到任何文件 */
  chunks: Array<{ label: string; kb: number | null; ceilKB: number; missing: boolean }>
}

export function judgeBudget(input: BudgetInput): BudgetVerdict {
  const { files, budgetKB, ceilings } = input
  const problems: string[] = []

  const totalKB = files.reduce((n, e) => n + e.gz, 0) / 1024
  if (totalKB > budgetKB) {
    problems.push(`首屏超预算 ${(totalKB - budgetKB).toFixed(1)} KB(${totalKB.toFixed(1)} / ${budgetKB})`)
  }

  const chunks: BudgetVerdict['chunks'] = []
  for (const c of ceilings) {
    const hit = files.find((e) => c.re.test(e.file))
    if (!hit) {
      // **不是警告,是红。** 见文件头:找不到 = 这条基线已经不守任何东西了。
      chunks.push({ label: c.label, kb: null, ceilKB: c.ceilKB, missing: true })
      problems.push(
        `chunk 基线「${c.label}」找不到目标文件 —— 打包分块规则改了?` +
          `这条基线现在不守任何东西,要么改正则要么删掉它,别让它默默失效`,
      )
      continue
    }
    const kb = hit.gz / 1024
    chunks.push({ label: c.label, kb, ceilKB: c.ceilKB, missing: false })
    if (kb > c.ceilKB) {
      problems.push(`chunk「${c.label}」${kb.toFixed(1)} KB 超出基线 ${c.ceilKB} KB`)
    }
  }

  return { problems, totalKB, chunks }
}
