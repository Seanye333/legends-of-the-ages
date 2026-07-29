// 英文盘点 —— 把界面切到 English 之后,还有多少地方是中文。
// 运行:npm run audit-en(FULL=1 列出全部,默认每类只列前 12 条)
//
// 【为什么人工看不出来】
// 这个游戏的英文不是一份独立的语言文件,而是**贴着代码写的**:
// `t('结束回合', 'End Turn')` 一处一对。好处是不会有对不上号的 key,
// 坏处是漏掉一处**不会有任何提示** —— 它只是在英文界面上显示中文,
// 而写代码的人自己一直开着中文。
//
// 三类问题,严重程度递减:
//   1. **en 里含汉字** —— 直接就是没翻,英文玩家看到的就是中文。
//   2. **en 与 zh 逐字相同** —— 多半是复制粘贴时忘了改(纯数字/符号除外)。
//   3. **en 是空的** —— 会渲染成空白。
//
// 顺带报一个覆盖率:内容层(卡名/卡面文案/列传)有多少条带了英文。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { COLLECTIBLE_CARDS } from '../src/content/cards'

const FULL = process.env.FULL === '1'
const ROOT = 'src'
const HAN = /[一-鿿㐀-䶿]/

interface Hit {
  file: string
  line: number
  zh: string
  en: string
  kind: 'han-in-en' | 'same' | 'empty' | 'measure-word'
}
const hits: Hit[] = []

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

// 两种写法都要扫:
//   t('中文', 'English')            —— 界面文案的主力
//   { zh: '中文', en: 'English' }   —— LocalizedText 字面量
// 引号里允许转义(\' 与 \\),否则带撇号的英文(Foe's)会把匹配截断。
const STR = String.raw`'((?:[^'\\]|\\.)*)'`
const T_CALL = new RegExp(String.raw`\bt\(\s*${STR}\s*,\s*${STR}\s*[,)]`, 'g')
const LOC_LIT = new RegExp(String.raw`\bzh:\s*${STR}\s*,\s*en:\s*${STR}`, 'g')

// 生成文件不算:它们是从姊妹仓库导入的,要修得回源头去修
const SKIP = /\/content\/generated\//

for (const file of walk(ROOT)) {
  if (SKIP.test(file)) continue
  const src = readFileSync(file, 'utf8')
  const lineOf = (idx: number) => src.slice(0, idx).split('\n').length

  for (const re of [T_CALL, LOC_LIT]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const zh = m[1]
      const en = m[2]
      const rel = relative('.', file)
      if (en.trim() === '') {
        // zh 也空的话那是个占位对,不算漏翻
        if (zh.trim() === '') continue
        // **量词位**:中文「3 員」需要量词,英文 "3" 不需要 —— 英文留空是对的,
        // 不是漏翻。第一版把这四处一起报成「会渲染成空白」,那是喊狼来了:
        // 一个总在报假阳性的盘点工具,下次真漏了也不会有人看。
        // 判据:中文短(≤3 字)且英文空 —— 真正的漏翻不会只有两三个字还配空英文。
        const kind = zh.trim().length <= 3 ? 'measure-word' : 'empty'
        hits.push({ file: rel, line: lineOf(m.index), zh, en, kind })
      } else if (HAN.test(en)) {
        hits.push({ file: rel, line: lineOf(m.index), zh, en, kind: 'han-in-en' })
      } else if (zh === en && HAN.test(zh)) {
        hits.push({ file: rel, line: lineOf(m.index), zh, en, kind: 'same' })
      }
    }
  }
}

const KIND_TITLE: Record<Hit['kind'], string> = {
  'han-in-en': '英文里还有汉字 —— 英文玩家看到的就是中文',
  same: '中英逐字相同 —— 多半是复制时忘了改',
  empty: '英文是空的 —— 会渲染成空白',
  'measure-word': '量词位(中文有量词、英文留空)—— 通常是对的,列出来只是让人扫一眼',
}

// 量词位不计进「有问题」的总数 —— 它是正常写法,只是值得看一眼
const PROBLEM_KINDS = ['han-in-en', 'empty', 'same'] as const

let problems = 0
for (const kind of ['han-in-en', 'empty', 'same', 'measure-word'] as const) {
  const list = hits.filter((h) => h.kind === kind)
  if (list.length === 0) continue
  if ((PROBLEM_KINDS as readonly string[]).includes(kind)) problems += list.length
  const mark = (PROBLEM_KINDS as readonly string[]).includes(kind) ? '✗' : '·'
  console.log(`\n${mark} ${KIND_TITLE[kind]}(${list.length} 处)`)
  for (const h of FULL ? list : list.slice(0, 12)) {
    console.log(`  ${h.file}:${h.line}`)
    console.log(`    zh: ${h.zh}`)
    console.log(`    en: ${h.en || '(空)'}`)
  }
  if (!FULL && list.length > 12) console.log(`  …… 还有 ${list.length - 12} 处(FULL=1 全列)`)
}

// ---- 内容层覆盖率 ----
const noName = COLLECTIBLE_CARDS.filter((c) => !c.name.en?.trim() || HAN.test(c.name.en))
const withText = COLLECTIBLE_CARDS.filter((c) => c.text?.zh?.trim())
const noText = withText.filter((c) => !c.text?.en?.trim() || HAN.test(c.text.en))

console.log('\n内容层覆盖率:')
console.log(
  `  卡名   ${COLLECTIBLE_CARDS.length - noName.length} / ${COLLECTIBLE_CARDS.length}` +
    ` (${(((COLLECTIBLE_CARDS.length - noName.length) / COLLECTIBLE_CARDS.length) * 100).toFixed(1)}%)`,
)
console.log(
  `  卡面文案 ${withText.length - noText.length} / ${withText.length}` +
    ` (${withText.length ? (((withText.length - noText.length) / withText.length) * 100).toFixed(1) : '—'}%)`,
)
for (const c of noName.slice(0, 6)) console.log(`    缺英文名:${c.id}(${c.name.zh})`)
for (const c of noText.slice(0, 6)) console.log(`    缺英文文案:${c.id}(${c.name.zh})`)

console.log(
  `\n扫了 ${walk(ROOT).filter((f) => !SKIP.test(f)).length} 个源文件,` +
    `界面文案 ${problems} 处有问题。`,
)
if (problems === 0) console.log('✓ 界面文案全部有英文,且没有一处把中文抄进 en。')
