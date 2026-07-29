// 繁简盘点 —— 那张转换表到底覆盖了卡池的多少。
// 运行:npm run audit-zh
//
// 转换表是**精选的不是穷尽的**(见 src/ui/zhVariant.ts 的说明),
// 所以「覆盖率」必须能被量出来,否则没人知道打开繁简开关会看到什么。
//
// 量法:卡池里出现的每一个汉字,分成三类 ——
//   已转:在表里,会被转成简体
//   同形:不在表里,而且它也出现在**手写的界面文案**里(那些是简体),
//        所以它大概率本来就是繁简同形
//   存疑:不在表里,也没在界面文案里出现过 —— 可能是漏掉的异形字
// 存疑那一列是这个脚本唯一的产出:它是下一批要往表里加的候选。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import { toSimplified, variantKeys } from '../src/ui/zhVariant'

const HAN = /[一-鿿]/
const keys = new Set(variantKeys().filter((k) => k.length === 1))

// 卡池里的字
const pool = new Set<string>()
for (const c of COLLECTIBLE_CARDS) {
  for (const ch of c.name.zh + (c.text?.zh ?? '')) if (HAN.test(ch)) pool.add(ch)
}

// 手写界面文案里的字(简体,作为「同形」的参照)
function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p) && !/\/content\/generated\//.test(p)) out.push(p)
  }
  return out
}
const ui = new Set<string>()
for (const f of walk('src')) {
  for (const m of readFileSync(f, 'utf8').matchAll(/'([^'\\]*)'/g)) {
    for (const ch of m[1]) if (HAN.test(ch)) ui.add(ch)
  }
}

const mapped = [...pool].filter((c) => keys.has(c))
const sameShape = [...pool].filter((c) => !keys.has(c) && ui.has(c))
const unknown = [...pool].filter((c) => !keys.has(c) && !ui.has(c))

console.log(`繁简盘点:卡池 ${pool.size} 个不同汉字`)
console.log(`  已转  ${mapped.length}  (表里有,会被转成简体)`)
console.log(`  同形  ${sameShape.length}  (界面手写文案里也出现过 → 大概率繁简同形)`)
console.log(`  存疑  ${unknown.length}  (${((unknown.length / pool.size) * 100).toFixed(1)}%,下一批候选)`)
console.log(`\n转换表 ${variantKeys().length} 条(含 ${variantKeys().filter((k) => k.length > 1).length} 条词条)`)

console.log('\n存疑字样本(前 60 个 —— 多数是人名地名用字,本来就繁简同形):')
console.log('  ' + unknown.slice(0, 60).join(' '))

console.log('\n转换样例:')
for (const c of COLLECTIBLE_CARDS.filter((x) => x.text?.zh).slice(0, 4)) {
  console.log(`  ${c.name.zh} → ${toSimplified(c.name.zh)}`)
  console.log(`    ${c.text!.zh}`)
  console.log(`    ${toSimplified(c.text!.zh)}`)
}
