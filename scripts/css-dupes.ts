// 「同一个东西在各屏长得不一样」的清单 —— `npm run css-dupes`。
//
// 判定层在 scripts/cssDupes.ts,配 cssDupes.test.ts 两个方向逐条验过。
// 这里只负责扫文件和排版。
//
// **这是清单不是闸门**(同 dead-css / price-cards):差异里混着正当的那一部分,
// 做成红线只会逼人去糊弄它。
//
// 读法:
//   · 「逐字节相同」那一段是**零风险的去重机会** —— 收进 uiKit 版式不会变。
//   · 「取值分布」那一段要人判断。看两样东西:
//       某个属性写法种数越多 → 越没人管过;
//       某个属性「没写」的那一档越大 → 越可能是集体漏了同一件事
//       (tap-highlight 就是这么查出来的:九处胶囊一处都没写,
//        也就是手机上点每一下都会闪系统蓝框)。
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { importIdentFor } from './deadCss'
import { buttonClasses, driftReport, exactDupes, isSurface, rulesIn, type Rule } from './cssDupes'

const ROOT = process.cwd()
const SRC = join(ROOT, 'src')

function walk(dir: string, hit: (p: string) => void): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, hit)
    else hit(p)
  }
}

const cssFiles: string[] = []
const srcFiles: string[] = []
walk(SRC, (p) => {
  if (p.endsWith('.module.css')) cssFiles.push(p)
  else if (p.endsWith('.tsx')) srcFiles.push(p)
})

const sources = srcFiles.map((p) => ({ p, text: readFileSync(p, 'utf8') }))

/** 某份 CSS Modules 里,哪些类真的挂在了 `<button>` 上 */
function buttonsOf(cssPath: string): Set<string> {
  const base = cssPath.split(/[\\/]/).pop() ?? cssPath
  const out = new Set<string>()
  for (const { text } of sources) {
    if (!text.includes(base)) continue
    const ident = importIdentFor(text, base)
    if (!ident) continue
    for (const c of buttonClasses(text, ident)) out.add(c)
  }
  return out
}

const all: Rule[] = []
const buttons: Rule[] = []
/** 有 cursor:pointer 但挂在别的标签上的 —— 卡片、格子、行。不是按钮,不参与比对。 */
let notButtons = 0
let composed = 0
const KIT = 'ui/uiKit'

for (const p of cssFiles) {
  const short = relative(SRC, p).replace(/\\/g, '/').replace(/\.module\.css$/, '')
  const rules = rulesIn(readFileSync(p, 'utf8'), short)
  all.push(...rules)
  composed += rules.filter((r) => r.composed).length
  if (short === KIT) continue // 基件是标尺,不是待办
  const onButtons = buttonsOf(p)
  for (const r of rules) {
    if (!isSurface(r) || r.composed) continue
    const names = r.selector.split(',').map((s) => s.trim().slice(1))
    if (names.some((n) => onButtons.has(n))) buttons.push(r)
    else notButtons++
  }
}

console.log(
  `扫了 ${cssFiles.length} 份 CSS Modules(${all.length} 条裸类规则),` +
    `已 composes 基件的 ${composed} 条。\n` +
    `还没接基件、且真的挂在 <button> 上的「面」:${buttons.length} 条` +
    `(另有 ${notButtons} 条可点的面挂在别的标签上 —— 卡片、格子、行,不是按钮,不比)。\n`,
)

// ---- 一、逐字节相同 ----
const dupes = exactDupes(buttons)
if (dupes.length === 0) {
  console.log('· 没有跨文件逐字节相同的按钮规则。')
} else {
  const total = dupes.reduce((n, g) => n + g.where.length, 0)
  console.log(`· 逐字节相同、跨文件重复的按钮规则:${dupes.length} 组 / ${total} 处`)
  console.log('  —— 这一段是零风险的去重机会,收进 uiKit 版式不会变。')
  for (const g of dupes) {
    console.log(`\n  ${g.where.length} 处 · ${g.decls.length} 条声明`)
    for (const w of g.where) console.log(`    ${w.file}  ${w.selector}`)
    for (const [p, v] of g.decls) console.log(`      ${p}: ${v}`)
  }
}

// ---- 二、胶囊档:逐条列 ----
//
// 胶囊是个**真的族**:七处都在干同一件事(筛选 / 切换 / 分段),
// 所以「谁写了什么」逐条列出来是有意义的,能直接照着收。
const pill = driftReport(buttons, 'pill')
if (pill.members.length >= 3) {
  console.log(`\n· 胶囊(筛选 / 切换 / 分段) —— ${pill.members.length} 处,长相属性的取值分布`)
  for (const w of pill.members) console.log(`    ${w.file}  ${w.selector}`)
  for (const s of pill.spread) {
    if (s.values.length === 1 && s.missing.length === 0) continue
    const tail = s.missing.length > 0 ? `,另有 ${s.missing.length} 处没写` : ''
    console.log(`\n  ${s.prop} —— ${s.values.length} 种写法${tail}`)
    for (const v of s.values.slice(0, 6)) {
      console.log(`    ${String(v.who.length).padStart(2)}×  ${v.value}`)
      console.log(`         ${v.who.map((w) => w.selector.split(',')[0]).join(' ')}`)
    }
    if (s.values.length > 6) console.log(`    …… 还有 ${s.values.length - 6} 种`)
    if (s.missing.length > 0) {
      console.log(`     没写:${s.missing.map((w) => w.selector.split(',')[0]).join(' ')}`)
    }
  }
}

// ---- 三、方角档:只给概览 ----
//
// 【为什么这一档不逐条列】
// 方角那七十多处**不是一个族**。为了能用键盘操作,这个仓库里的卡片、格子、
// 条目也都是 `<button>`(`.heroCard` / `.bookCard` / `.relicCard` / `.entry`),
// 它们和「结束回合」「保存卡组」根本不是同一样东西。
// 把它们的 padding 分布列出来,只会得到一张七十行的噪声表 ——
// 而一份读两次就没人读的清单,比没有清单更危险(deadCss 的教训)。
//
// 所以这一档只报**种数**:它是个体检指标(uiKit 立项时数出的「16 种圆角」就是它),
// 不是待办。真要统一,得先按用途拆族,而拆族是设计判断。
const boxy = driftReport(buttons, 'boxy')
if (boxy.members.length >= 3) {
  console.log(`\n· 方角 —— ${boxy.members.length} 处。**这一档不是一个族**,只报种数当体检指标:`)
  console.log('  (卡片 / 格子 / 条目为了能键盘操作也是 <button>,和常规按钮混在一起)')
  for (const s of boxy.spread) {
    if (s.values.length === 1 && s.missing.length === 0) continue
    const top = s.values
      .slice(0, 3)
      .map((v) => `${v.who.length}× ${v.value}`)
      .join('  ')
    const miss = s.missing.length > 0 ? `  ·  ${s.missing.length} 处没写` : ''
    console.log(`    ${s.prop.padEnd(28)} ${String(s.values.length).padStart(2)} 种${miss}`)
    console.log(`      最常见:${top}`)
  }
}

console.log(
  '\n注:这是清单不是闸门。差异里有正当的那一部分(拇指要点的分区页签本来就该更高),' +
    '\n收之前先想清楚哪些是设计、哪些只是没人管过。',
)
