// 环境自检 —— 一条命令看清「这台机器上什么能跑、什么不能跑、为什么」。
// 运行:npm run doctor
//
// 【为什么需要它】
// ROADMAP 第 0 节要求新机器上跑四条命令确认环境是好的,但那四条里有两条要几分钟,
// 而且**失败时的报错离根因很远**:没有姊妹仓库时 import-content 报的是模块找不到,
// Windows 上 npm test 报的是 `ENOENT ... C:\C:\...`。
// 这个脚本把「环境层面的前提」一次性摊开,几秒钟跑完,不打一局牌。
//
// 它**不替代闸门**:闸门验的是内容和平衡对不对,这里验的是「你有没有资格开始」。
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { COLLECTIBLE_CARDS, CARDS_BY_ID } from '../src/content/cards'
import { PRECON_DECKS } from '../src/content/decks'
import { ALL_HEROES } from '../src/content/overrides/heroes'
import { BOSSES } from '../src/content/campaign'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type Level = 'ok' | 'warn' | 'bad'
const lines: Array<[Level, string, string?]> = []
const add = (level: Level, what: string, detail?: string) => lines.push([level, what, detail])

// ---- 运行时 ----
const major = Number(process.versions.node.split('.')[0])
add(
  major >= 22 ? 'ok' : 'bad',
  `Node ${process.versions.node}`,
  major >= 22 ? undefined : 'CI 用的是 22,低于它可能跑不起来',
)
add('ok', `平台 ${process.platform} ${process.arch}`)

// ---- 依赖 ----
add(
  existsSync(join(ROOT, 'node_modules')) ? 'ok' : 'bad',
  'node_modules',
  existsSync(join(ROOT, 'node_modules')) ? undefined : '先跑 npm ci',
)

// ---- 素材源头(可选)----
// 缺它是**正常的**,只是三条命令用不了。这是最容易被误当成「环境坏了」的一项。
const SIBLING = resolve(ROOT, '..', 'ThreeKingdomMastersIOS')
if (existsSync(SIBLING)) {
  add('ok', '素材源 ../ThreeKingdomMastersIOS', '可以跑 import-content / check-generated / export-portraits')
} else {
  add(
    'warn',
    '素材源 ../ThreeKingdomMastersIOS 不在',
    '**这是正常的**。只影响 import-content / check-generated / export-portraits;' +
      '其余一切照常(src/ 一行都不 import 它,生成产物已入库)。' +
      '注意:没有它就不要改 scripts/import-content.ts 与 scripts/seed-mechanics.ts —— 改了没法验证。',
  )
}

// ---- 生成层是否在库 ----
const genDir = join(ROOT, 'src', 'content', 'generated')
const genFiles = existsSync(genDir) ? readdirSync(genDir).filter((f) => f.endsWith('.ts')) : []
add(
  genFiles.length > 0 ? 'ok' : 'bad',
  `生成层 ${genFiles.length} 个文件`,
  genFiles.length > 0 ? genFiles.join(' · ') : '生成产物应当入库,缺了构建会红',
)

// ---- 内容自洽(不打牌,只查引用)----
add('ok', `卡池 ${CARDS_BY_ID ? Object.keys(CARDS_BY_ID).length : 0} 张(可收集 ${COLLECTIBLE_CARDS.length})`)

const badDeck = PRECON_DECKS.filter((d) => d.cardIds.some((id) => !CARDS_BY_ID[id]))
add(
  badDeck.length === 0 ? 'ok' : 'bad',
  `预组 ${PRECON_DECKS.length} 套`,
  badDeck.length === 0 ? undefined : `有卡查不到:${badDeck.map((d) => d.name.zh).join(', ')}`,
)

const badHero = ALL_HEROES.filter((h) => !CARDS_BY_ID[h.id])
add(
  badHero.length === 0 ? 'ok' : 'warn',
  `主公 ${ALL_HEROES.length} 位`,
  badHero.length === 0 ? undefined : `立绘会退化:${badHero.map((h) => h.name.zh).join(', ')}`,
)

const badBoss = BOSSES.filter((b) => !CARDS_BY_ID[b.heroId])
add(
  badBoss.length === 0 ? 'ok' : 'warn',
  `关底 ${BOSSES.length} 关`,
  badBoss.length === 0 ? undefined : `立绘会退化:${badBoss.map((b) => b.name.zh).join(', ')}`,
)

// ---- 输出 ----
const ICON: Record<Level, string> = { ok: '✓', warn: '·', bad: '✗' }
console.log('环境自检\n')
for (const [level, what, detail] of lines) {
  console.log(`  ${ICON[level]} ${what}`)
  if (detail) for (const d of detail.split('\n')) console.log(`      ${d}`)
}

const bad = lines.filter(([l]) => l === 'bad').length
console.log('')
if (bad > 0) {
  console.log(`✗ ${bad} 项需要处理,先解决再谈别的。`)
} else {
  console.log('✓ 环境可用。')
}

// ---- 闸门清单:跑之前先知道要等多久 ----
// 这些数字是 2026-08-04 在一台 12 核 Windows 上量的,只用来估量级。
console.log(`
闸门(有明确 exit code):
  npm run build            类型检查 + 构建            ~40s
  npm test                 单测(含 server/)          ~45s
  npm run lint-content     卡池结构性自检              ~5s
  npm run perf-budget      首屏体积                    ~10s
  npm run replay-diff      引擎确定性对拍              ~10s
  npm run check-offline    PWA 断网可玩                ~10s

平衡(慢,先泡杯茶):
  npm run sim-balance      六套预组互搏      GAMES=100  ~5min
  npm run sim-campaign     冒险 24 关曲线    GAMES=240  ~12min
  npm run sim-hero-mirror  备选主公技对镜    GAMES=400  ~10min
  npm run sim-firstplayer  先手优势/仪器自检 GAMES=400  ~5min

**下结论一律用默认局数或更高。** 调小 GAMES 只配试探 —— 这个仓库
已经两次把噪声当成结论(详见 ROADMAP「闸门的现状」)。`)

process.exit(bad > 0 ? 1 : 0)
