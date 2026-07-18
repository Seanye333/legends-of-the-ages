// 内容导入管线:从姊妹仓库 ThreeKingdomMastersIOS(素材源头,只读)
// 读取全部武将 → 套公式生成全卡池 → 输出 cards.gen.ts + 复制签名卡立绘。
// 运行:npm run import-content(幂等,输出入 git,构建不依赖姊妹仓库)
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHistoricalOfficers,
  buildInitialOfficers,
} from '../../ThreeKingdomMastersIOS/src/game/data/officers'
import { DYNASTY_DEFS } from '../../ThreeKingdomMastersIOS/src/game/data/dynasties'
import { CARD_INDEX } from '../../ThreeKingdomMastersIOS/src/game/data/cardIndex'
import { deriveDoctrine } from '../../ThreeKingdomMastersIOS/src/game/data/officerAttributes'
import type { CardDef, DynastyTag, Rarity } from '../src/engine/types'
import { SIGNATURE_OVERRIDES } from '../src/content/overrides/signature'
import { HEROES } from '../src/content/overrides/heroes'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SIBLING = join(ROOT, '..', 'ThreeKingdomMastersIOS')
const OUT_GEN = join(ROOT, 'src', 'content', 'generated')
const OUT_PORTRAITS = join(ROOT, 'public', 'portraits')

// ---------- 生成公式(默认值;signature.ts 的手工覆盖优先) ----------

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, Math.round(v)))

interface Stats {
  leadership: number
  war: number
  intelligence: number
  politics: number
  charisma: number
}

function fame(s: Stats): number {
  const values = [s.leadership, s.war, s.intelligence, s.politics, s.charisma]
  const max = Math.max(...values)
  const avg = values.reduce((a, b) => a + b, 0) / values.length
  return 0.6 * max + 0.4 * avg
}

// 稀有度按全池名望百分位切分,保证正金字塔:
// 传奇 ~5%、史诗 ~10%、稀有 ~25%、普通 ~60%(固定阈值会因光荣数值整体偏高而倒挂)
function makeRarityOf(allFames: number[]): (f: number) => Rarity {
  const sorted = [...allFames].sort((a, b) => b - a)
  const at = (pct: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))]
  const legendaryMin = at(0.05)
  const epicMin = at(0.15)
  const rareMin = at(0.4)
  return (f) => {
    if (f >= legendaryMin) return 'legendary'
    if (f >= epicMin) return 'epic'
    if (f >= rareMin) return 'rare'
    return 'common'
  }
}

// 引擎 DynastyTag 的运行时校验集(跨仓库边界不做裸 cast)
const VALID_DYNASTIES: ReadonlySet<string> = new Set([
  'wei', 'shu', 'wu', 'qun', 'spring-autumn', 'warring-states', 'qin', 'chu-han',
  'western-han', 'jin', 'southern-northern', 'sui', 'tang', 'five-dynasties',
  'song', 'yuan', 'ming', 'qing',
] satisfies DynastyTag[])

function generateCard(
  officer: {
    id: string
    name: { zh: string; en: string }
    stats: Stats
    dynasty?: string
  },
  rarityOf: (f: number) => Rarity,
): CardDef {
  const s = officer.stats
  const archetype = s.intelligence > s.war + 10 ? 'strategist' : 'warrior'
  const attack =
    archetype === 'warrior'
      ? clamp(1, 12, (s.war - 30) / 9)
      : clamp(1, 8, (s.intelligence - 40) / 12)
  const health = clamp(1, 12, (0.5 * s.leadership + 0.3 * s.charisma + 0.2 * s.war - 25) / 9)
  const cost = clamp(0, 10, (attack + health) / 2 - 0.5)
  const f = fame(s)
  const rarity = rarityOf(f)
  const doctrine = rarity === 'common' ? 'neutral' : deriveDoctrine(s, officer.id)
  // 三国武将默认「群」,魏/蜀/吴归属在 signature.ts 手工覆盖(Phase 1 从剧本势力预填)
  if (officer.dynasty !== undefined && !VALID_DYNASTIES.has(officer.dynasty)) {
    throw new Error(`unknown dynasty "${officer.dynasty}" on officer ${officer.id} — 引擎 DynastyTag 需要同步`)
  }
  const dynasty = (officer.dynasty ?? 'qun') as DynastyTag
  return {
    id: officer.id,
    collectorNo: CARD_INDEX[officer.id] ?? 0,
    name: { zh: officer.name.zh, en: officer.name.en },
    type: 'general',
    doctrine,
    dynasty,
    rarity,
    archetype,
    cost,
    attack,
    health,
    keywords: [], // 关键词播种 Phase 1
  }
}

// ---------- 主流程 ----------

const tkOfficers = buildInitialOfficers({}, [])
const historicalDynasties = DYNASTY_DEFS.map((d) => d.id).filter((d) => d !== 'three-kingdoms')
const histOfficers = buildHistoricalOfficers(historicalDynasties)
const all = [...tkOfficers, ...histOfficers]

console.log(`officers: three-kingdoms=${tkOfficers.length} historical=${histOfficers.length}`)

// 源数据存在重复 id(如 nan-lou 在 officers.ts 出现两次)—— 保留首个,警告跳过
const seen = new Set<string>()
const unique = all.filter((o) => {
  if (seen.has(o.id)) {
    console.warn(`⚠ duplicate officer id in source data, skipping: ${o.id} (${o.name.zh})`)
    return false
  }
  seen.add(o.id)
  return true
})

const rarityOf = makeRarityOf(unique.map((o) => fame(o.stats)))
const cards = unique
  .map((o) => generateCard(o, rarityOf))
  .sort((a, b) => a.collectorNo - b.collectorNo || a.id.localeCompare(b.id))

const rarityCount: Record<string, number> = {}
const doctrineCount: Record<string, number> = {}
for (const c of cards) {
  rarityCount[c.rarity] = (rarityCount[c.rarity] ?? 0) + 1
  doctrineCount[c.doctrine] = (doctrineCount[c.doctrine] ?? 0) + 1
}
console.log('rarity:', JSON.stringify(rarityCount))
console.log('doctrine:', JSON.stringify(doctrineCount))

mkdirSync(OUT_GEN, { recursive: true })
// 以 JSON 字符串形式内嵌:2,211 个对象字面量会让 tsc 类型推导爆炸 (TS2590),
// JSON.parse + 断言则零类型检查成本。
writeFileSync(
  join(OUT_GEN, 'cards.gen.ts'),
  [
    '// GENERATED by scripts/import-content.ts — DO NOT EDIT.',
    '// Regenerate: npm run import-content (source of truth: ../ThreeKingdomMastersIOS)',
    "import type { CardDef } from '../../engine/types'",
    '',
    `const rawJson = ${JSON.stringify(JSON.stringify(cards))}`,
    '',
    'export const GENERATED_CARDS = JSON.parse(rawJson) as CardDef[]',
    '',
  ].join('\n'),
)
console.log(`cards.gen.ts: ${cards.length} cards`)

// ---------- 签名卡立绘复制(签名集 = overrides + 主公,立绘自动跟随) ----------

const allIds = new Set(unique.map((o) => o.id))
const signatureIds = [
  ...new Set([...Object.keys(SIGNATURE_OVERRIDES), ...HEROES.map((h) => h.id)]),
].filter((id) => {
  if (!allIds.has(id)) {
    console.warn(`⚠ signature override id not in roster (stratagem or typo?): ${id}`)
    return false
  }
  return true
})
console.log(`signature ids: ${signatureIds.length}`)

mkdirSync(OUT_PORTRAITS, { recursive: true })
let totalBytes = 0
const manifest: Record<string, { files: string[]; bytes: number }> = {}
for (const id of signatureIds) {
  const files: string[] = []
  let bytes = 0
  for (const suffix of ['.webp', '-full.webp']) {
    const src = join(SIBLING, 'public', 'portraits', `${id}${suffix}`)
    if (!existsSync(src)) {
      console.warn(`⚠ missing portrait: ${id}${suffix}`)
      continue
    }
    const dest = join(OUT_PORTRAITS, `${id}${suffix}`)
    copyFileSync(src, dest)
    files.push(`${id}${suffix}`)
    bytes += statSync(dest).size
  }
  manifest[id] = { files, bytes }
  totalBytes += bytes
}
writeFileSync(
  join(OUT_GEN, 'manifest.json'),
  JSON.stringify({ signatureIds, portraits: manifest, totalBytes }, null, 2) + '\n',
)
console.log(
  `portraits: ${Object.values(manifest).reduce((n, m) => n + m.files.length, 0)} files, ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB (红线 150MB)`,
)
