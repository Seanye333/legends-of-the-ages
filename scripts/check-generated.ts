// 生成层漂移自检:重跑 import-content,产物必须和已提交的**逐字节一致**。
// 运行:npm run check-generated
//
// 【为什么这是最该有的一道闸门】
// CI 只检查「没人手改过 generated/」,不检查「重跑一遍还是不是这个结果」。
// 这两件事完全不同 —— 后者才是产物入库的前提:
// 产物入库(而不是构建期生成)是对的决定,但它会**掩盖源头的漂移** ——
// 姊妹仓库改一批数据,已提交的卡池不会变、CI 也不会红,
// 而下一个人一旦重跑生成脚本,卡池就在他手里当场换了一副。
//
// import-content.ts 头上曾挂着一段警告,说重跑会把卡池从 2392 张打成 2207 张、
// 白板率 8.9% → 29.5%。**那段警告已经过期**:2026-08-03 实测重跑产物与已提交的
// 逐字节相同(见那个文件里更新后的说明)。这个脚本就是让「过期了没人知道」
// 这件事不再可能发生 —— 它红了,说明源头真的漂了,那时候再决定接不接受。
//
// 【为什么直接跑真的生成脚本而不是抽逻辑出来比对】
// 抽出来比对的是「我以为它会生成什么」,跑真的比对的是「它实际生成什么」。
// 这条闸门守的正好是后者。代价是它会改动工作区(生成脚本就是写文件的),
// 所以本地跑之前先 commit 或 stash —— 脚本会先检查工作区干净。
import { execFileSync } from 'node:child_process'

const GEN = 'src/content/generated'

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1e9 })
}

const dirty = git('status', '--porcelain', '--', GEN).trim()
if (dirty) {
  console.error(`✗ ${GEN} 在跑之前就是脏的 —— 先提交或 stash,否则分不清是谁改的:\n${dirty}`)
  process.exit(1)
}

console.log('重跑 import-content …')
execFileSync('npm', ['run', '--silent', 'import-content'], { stdio: 'inherit' })

const drift = git('status', '--porcelain', '--', GEN).trim()
if (!drift) {
  console.log(`✓ 生成层无漂移:重跑产物与已提交的逐字节一致。`)
  process.exit(0)
}

console.error('\n✗ 生成层漂移 —— 重跑产物与已提交的不一致:')
console.error(drift)
console.error(git('diff', '--stat', '--', GEN))
console.error(
  '\n这不一定是 bug,但**必须有人做决定**:\n' +
    '  · 源头(../ThreeKingdomMastersIOS)确实更新了 → 接受新产物,然后重跑全部平衡闸门\n' +
    '    (sim-balance / sim-campaign / sim-hero-mirror / deck-stats)\n' +
    '  · 源头没动而产物变了 → 生成脚本里混进了不确定性(Date / Math.random / 遍历顺序)\n',
)
process.exit(1)
