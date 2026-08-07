// 内容 lint —— 扫全池,报告结构性问题。
// 运行:npm run lint-content(带 --strict 时有 error 就退出码 1)
//
// 【它和 content.test.ts 的分工】
// 测试是**闸门**:每一条都必须永远为真,红了就不许合。所以那里只放
// 「违反了就一定是 bug」的规则。
//
// lint 是**清单**:它报告的东西大多不是 bug,而是「你可能忘了」——
// 缺英文文案、效果指向了一张不存在的牌、锦囊写了身材、羁绊成员对不上……
// 这些逐条判断都需要人看一眼,做成红线只会逼着大家去糊弄它。
//
// 分三级:
//   error —— 一定是错的(引用了不存在的 id、锦囊带身材)。--strict 下会失败。
//   warn  —— 很可能是忘了(没有英文文案、传奇没有风味文本)。
//   info  —— 值得知道(某个机制全池只有一张卡在用)。
//
// 【判定层在 scripts/contentRules.ts】
// 这里只剩「扫哪一份卡池 + 怎么排版 + 退出码」。规则本身是纯函数,
// 配 contentRules.test.ts 逐条两个方向验(该报的必须报、不该报的必须不报)——
// 那 7 条 error 级规则决定 CI 红不红,而它们此前一行测试都没有(铁律 11)。
import { CARDS, CARDS_BY_ID, COLLECTIBLE_CARDS } from '../src/content/cards'
import { checkContent, type Issue, type Level } from './contentRules'

const STRICT = process.argv.includes('--strict')

const issues = checkContent({ all: CARDS, collectible: COLLECTIBLE_CARDS })

// ---- 输出 ----
const byLevel = (l: Level) => issues.filter((i) => i.level === l)
const ORDER: Level[] = ['error', 'warn', 'info']
const MARK: Record<Level, string> = { error: '✗', warn: '!', info: '·' }

for (const level of ORDER) {
  const list = byLevel(level)
  if (list.length === 0) continue
  console.log(`\n${MARK[level]} ${level.toUpperCase()} —— ${list.length} 条`)
  // 按规则分组:同一条规则触发几十次时,一条条列出来没人读得完
  const byRule = new Map<string, Issue[]>()
  for (const i of list) {
    const arr = byRule.get(i.rule) ?? []
    arr.push(i)
    byRule.set(i.rule, arr)
  }
  for (const [rule, arr] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  [${rule}] ${arr.length} 条`)
    for (const i of arr.slice(0, 8)) {
      const who = i.card ? `${i.card}(${CARDS_BY_ID[i.card]?.name.zh ?? '?'})` : '—'
      console.log(`    ${who}: ${i.msg}`)
    }
    if (arr.length > 8) console.log(`    …… 还有 ${arr.length - 8} 条`)
  }
}

const errors = byLevel('error').length
console.log(
  `\n扫了 ${CARDS.length} 张(可收集 ${COLLECTIBLE_CARDS.length} 张):` +
    ` ${errors} error / ${byLevel('warn').length} warn / ${byLevel('info').length} info`,
)
if (errors === 0) console.log('✓ 没有结构性错误。')
if (STRICT && errors > 0) process.exit(1)
