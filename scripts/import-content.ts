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
import { getBiography } from '../../ThreeKingdomMastersIOS/src/game/data/biographies'
import { OFFICER_DUEL_LINES } from '../../ThreeKingdomMastersIOS/src/game/data/officerLines'
import type { CardDef, DynastyTag, Rarity } from '../src/engine/types'
import { SIGNATURE_OVERRIDES } from '../src/content/overrides/signature'
import { PRECON_DECKS } from '../src/content/decks'
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

// ---------- 机制播种 ----------
//
// 姊妹仓库只给五维属性,原来的生成器把 keywords 留成 [](注释写着「关键词播种 Phase 1」,
// 一直没做)。结果是 2211 张生成卡**全部**没有关键词、没有效果、没有文本,
// 而且只有 40 种不同的费/攻/血组合 —— 玩家开包开出来的名将,机制上跟已有的一模一样。
//
// 这里按属性画像播种关键词与战吼,三条原则:
// 1. **确定性**:一切随机走 id 的哈希,不用 Math.random。脚本必须幂等
//    (输出入 git,每次重跑必须逐字节一致)。
// 2. **要付账**:关键词与效果一律从身材里扣点数,不是白送。否则等于给全池加强度,
//    平衡直接崩。计价沿用第二/三卡包的基线:1 点攻 = 1 点,1 点血 = 0.8 点。
// 3. **留白板**:不是每张都要有花活。约三分之一带关键词、四分之一带战吼,
//    其余保持白板 —— 白板卡本身就是正当设计,而且是曲线的骨架。

// 姊妹仓库的 deriveDoctrine 是「canon」,稀有以上一律照它走。
// 但它对隐逸/割据极其吝啬(隐逸要 智≥85 且 政<60),导致这两个主义可构筑池薄到没法组牌。
// 只在把普通卡拉出中立池时改用这份**放宽版**判定,优先补最薄的两个主义 ——
// 稀有卡的主义归属仍然完全遵循源头数据,不会出现「同一个人在两边阵营不同」。
function widenedDoctrine(s: Stats, id: string): ReturnType<typeof deriveDoctrine> {
  const canon = deriveDoctrine(s, id)
  if (canon === 'reclusion' || canon === 'separatist') return canon
  // 隐逸:智谋高而不涉政 —— 门槛从 85/60 放到 78/68
  if (s.intelligence >= 78 && s.politics < 68) return 'reclusion'
  // 割据:统率见长的一方之主 —— 门槛从 80 放到 74
  if (s.leadership >= 74 && s.war < 82) return 'separatist'
  return canon
}

// 预组用到的全部卡 id(见 generateCard 里为什么要保护它们)
const PRECON_CARD_IDS = new Set(PRECON_DECKS.flatMap((d) => d.cardIds))

// FNV-1a:同一个 (id, salt) 永远得到同一个 [0,1)
function hash01(id: string, salt: string): number {
  let h = 0x811c9dc5
  const s = `${id}#${salt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h / 0x100000000
}

// 关键词/效果的身材点数报价
const KEYWORD_POINTS: Record<string, number> = {
  charge: 2,
  rush: 1,
  guard: 1.5,
  windfury: 2,
  lifesteal: 1.5,
  stealth: 1,
  duel: 2,
}

// 从身材里扣点数:优先扣血(单点价值低),攻血都不低于 1
function payFor(attack: number, health: number, points: number): [number, number] {
  let atk = attack
  let hp = health
  let owed = points
  while (owed > 0.4 && (hp > 1 || atk > 1)) {
    if (hp > 1 && (hp >= atk || atk <= 1)) {
      hp -= 1
      owed -= 0.8
    } else if (atk > 1) {
      atk -= 1
      owed -= 1
    } else break
  }
  return [atk, hp]
}

interface Seeded {
  keywords: string[]
  battlecry?: { ops: unknown[] }
  deathrattle?: { ops: unknown[] }
  spellDamage?: number
  points: number
  textZh: string[]
  textEn: string[]
}

// 属性画像 → 至多一个关键词。候选按「属性信号强度」排序,逐个过哈希闸门,
// 命中即停 —— 这样强信号的武将更可能拿到关键词,而不是全池平摊。
function seedKeyword(id: string, s: Stats, archetype: string, rarity: Rarity): string | null {
  const gate = (p: number, salt: string) => hash01(id, salt) < p
  const candidates: [string, boolean, number][] = [
    // [关键词, 属性条件, 命中概率]
    ['duel', rarity !== 'common' && s.war >= 92 && archetype === 'warrior', 0.5],
    // 连击放在冲锋之前:纯武力型(高武低智)是它唯一的画像,
    // 排在冲锋后面会被高武条件先吃光,实测会一张都发不出去。
    ['windfury', s.war >= 86 && s.intelligence < 66, 0.35],
    ['charge', s.war >= 88 && archetype === 'warrior', 0.5],
    ['guard', s.leadership >= 85, 0.45],
    ['stealth', archetype === 'strategist' && s.intelligence >= 80 && s.politics < 70, 0.4],
    ['lifesteal', s.charisma >= 88, 0.35],
    ['rush', s.war >= 78 && archetype === 'warrior', 0.35],
    ['guard', s.leadership >= 76, 0.25],
  ]
  for (let i = 0; i < candidates.length; i++) {
    const [kw, cond, p] = candidates[i]
    if (cond && gate(p, `kw${i}`)) return kw
  }
  return null
}

function seedMechanics(
  id: string,
  s: Stats,
  archetype: string,
  rarity: Rarity,
  hasKeyword: string | null,
): Seeded {
  const out: Seeded = { keywords: [], points: 0, textZh: [], textEn: [] }
  if (hasKeyword) {
    out.keywords.push(hasKeyword)
    out.points += KEYWORD_POINTS[hasKeyword] ?? 1
    out.textZh.push(KEYWORD_TEXT[hasKeyword].zh)
    out.textEn.push(KEYWORD_TEXT[hasKeyword].en)
  }

  // 战吼:带了关键词的卡再给战吼容易变成「什么都会」,概率减半。
  const bcGate = hasKeyword ? 0.5 : 1
  const roll = hash01(id, 'bc')
  const mag = hash01(id, 'mag') // 同一种效果的量级抖动,避免整池只有一个数字

  const add = (
    kind: 'battlecry' | 'deathrattle',
    ops: unknown[],
    points: number,
    zh: string,
    en: string,
  ) => {
    if (kind === 'battlecry') out.battlecry = { ops }
    else out.deathrattle = { ops }
    out.points += points
    out.textZh.push(zh)
    out.textEn.push(en)
  }

  // 谋士线:点杀 / 抽牌 / 法伤 / 冻结 / 弃牌 / 回复 / 蓄力
  if (archetype === 'strategist') {
    if (s.intelligence >= 88 && roll < 0.22 * bcGate) {
      const dmg = mag < 0.25 ? 3 : 2
      add(
        'battlecry',
        [{ op: 'damage', amount: dmg, target: 'chosenEnemyGeneral' }],
        dmg * 1.5,
        `戰吼:對一名敵方武將造成 ${dmg} 點傷害。`,
        `Battlecry: Deal ${dmg} damage to an enemy general.`,
      )
    } else if (s.intelligence >= 86 && roll < 0.3 * bcGate) {
      add(
        'battlecry',
        [{ op: 'freeze', target: 'chosenEnemyGeneral' }],
        1.5,
        '戰吼:凍結一名敵方武將。',
        'Battlecry: Freeze an enemy general.',
      )
    } else if (s.intelligence >= 82 && rarity !== 'common' && roll < 0.4 * bcGate) {
      out.spellDamage = 1
      out.points += 1.5
      out.textZh.push('法術傷害+1。')
      out.textEn.push('Spell Damage +1.')
    } else if (s.intelligence >= 78 && roll < 0.58 * bcGate) {
      const n = s.intelligence >= 92 && mag < 0.2 ? 2 : 1
      add(
        'battlecry',
        [{ op: 'draw', count: n }],
        n * 2,
        `戰吼:抽 ${n} 張牌。`,
        `Battlecry: Draw ${n === 1 ? 'a card' : `${n} cards`}.`,
      )
    } else if (s.politics >= 84 && roll < 0.68 * bcGate) {
      add(
        'battlecry',
        [{ op: 'gainMana', amount: 1, temporary: true }],
        1.5,
        '戰吼:本回合獲得 1 點法力。',
        'Battlecry: Gain 1 Mana this turn only.',
      )
    } else if (s.politics >= 78 && roll < 0.8 * bcGate) {
      const n = mag < 0.4 ? 4 : 3
      add(
        'battlecry',
        [{ op: 'heal', amount: n, target: 'friendlyHero' }],
        1,
        `戰吼:你的主公恢復 ${n} 點生命。`,
        `Battlecry: Restore ${n} Health to your hero.`,
      )
    } else if (s.intelligence >= 74 && roll < 0.76 * bcGate) {
      add(
        'battlecry',
        [{ op: 'discardRandom', count: 1 }],
        1.5,
        '戰吼:對手隨機棄一張牌。',
        'Battlecry: Your opponent discards a random card.',
      )
    }
  } else {
    // 武将线:上场点杀 / 号令 / 护甲 / 自我加成 / 招募
    if (s.war >= 85 && roll < 0.22 * bcGate) {
      const dmg = mag < 0.3 ? 3 : 2
      add(
        'battlecry',
        [{ op: 'damage', amount: dmg, target: 'randomEnemyGeneral' }],
        dmg,
        `戰吼:對隨機一名敵方武將造成 ${dmg} 點傷害。`,
        `Battlecry: Deal ${dmg} damage to a random enemy general.`,
      )
    } else if (s.charisma >= 82 && roll < 0.4 * bcGate) {
      add(
        'battlecry',
        [{ op: 'buffStats', attack: 1, health: 1, target: 'allFriendlyOthers' }],
        2,
        '戰吼:其他友方武將+1/+1。',
        'Battlecry: Give your other generals +1/+1.',
      )
    } else if (s.leadership >= 84 && roll < 0.55 * bcGate) {
      add(
        'battlecry',
        [{ op: 'summon', defId: 'token-si-shi', count: 1 }],
        1.5,
        '戰吼:召喚一個 1/1 的死士。',
        'Battlecry: Summon a 1/1 Retainer.',
      )
    } else if (s.leadership >= 78 && roll < 0.7 * bcGate) {
      const n = mag < 0.35 ? 4 : 3
      add(
        'battlecry',
        [{ op: 'gainArmor', amount: n }],
        n * 0.5,
        `戰吼:你的主公獲得 ${n} 點護甲。`,
        `Battlecry: Your hero gains ${n} Armor.`,
      )
    } else if (s.war >= 76 && roll < 0.72 * bcGate) {
      add(
        'battlecry',
        [{ op: 'buffStats', attack: 2, health: 0, target: 'self', duration: 'endOfTurn' }],
        1,
        '戰吼:本回合此武將+2/+0。',
        'Battlecry: This general has +2/+0 this turn.',
      )
    }
  }

  // 亡语:只给稀有以上,且比例克制 —— 亡语铺满全池会让战场噪声过大、结算变慢
  if (!out.battlecry && rarity !== 'common' && hash01(id, 'dr') < 0.35) {
    if (s.war >= 78) {
      add(
        'deathrattle',
        [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }],
        1.5,
        '亡語:對隨機一名敵方武將造成 2 點傷害。',
        'Deathrattle: Deal 2 damage to a random enemy general.',
      )
    } else if (s.leadership >= 76) {
      add(
        'deathrattle',
        [{ op: 'summon', defId: 'token-si-shi', count: 1 }],
        1,
        '亡語:召喚一個 1/1 的死士。',
        'Deathrattle: Summon a 1/1 Retainer.',
      )
    } else if (s.intelligence >= 76) {
      add('deathrattle', [{ op: 'draw', count: 1 }], 1.5, '亡語:抽一張牌。', 'Deathrattle: Draw a card.')
    }
  }

  return out
}

const KEYWORD_TEXT: Record<string, { zh: string; en: string }> = {
  charge: { zh: '衝鋒。', en: 'Charge.' },
  rush: { zh: '突襲。', en: 'Rush.' },
  guard: { zh: '守護。', en: 'Guard.' },
  windfury: { zh: '連擊。', en: 'Windfury.' },
  lifesteal: { zh: '吸血。', en: 'Lifesteal.' },
  stealth: { zh: '潛行。', en: 'Stealth.' },
  duel: { zh: '單挑。', en: 'Duel.' },
}

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
  const baseAttack =
    archetype === 'warrior'
      ? clamp(1, 12, (s.war - 30) / 9)
      : clamp(1, 8, (s.intelligence - 40) / 12)
  const baseHealth = clamp(1, 12, (0.5 * s.leadership + 0.3 * s.charisma + 0.2 * s.war - 25) / 9)
  // 费用按**未扣点数前**的身材算,这样带效果的卡就是「同费更弱的身材 + 一个效果」,
  // 而不是「同费同身材还白送一个效果」。
  const cost = clamp(0, 10, (baseAttack + baseHealth) / 2 - 0.5)
  const f = fame(s)
  const rarity = rarityOf(f)
  // 原来所有普通卡一律中立(1320 张),这是隐逸只有 17 张可构筑卡的直接原因 ——
  // 六个「职业」里最深的 383 张、最浅的 17 张,差 20 倍。
  // 现在放三分之一的普通卡回自己的主义,中立占比从 60% 降到约 42%(仍高于炉石)。
  // 六套预组共用一批中立骨架卡(藤甲、王平、程普…)。把它们拉进某个主义,
  // 立刻会有四套预组构筑违规 —— 预组是平衡基准,不能被内容播种顺手打坏。
  const commonKeepsNeutral = PRECON_CARD_IDS.has(officer.id) || hash01(officer.id, 'doct') >= 0.34
  const doctrine =
    rarity === 'common'
      ? commonKeepsNeutral
        ? 'neutral'
        : widenedDoctrine(s, officer.id)
      : deriveDoctrine(s, officer.id)

  // 预组用到的卡**完全不参与播种**。
  // 这批卡是六套预组共用的骨架,身材与曲线是跨很多轮 sim-balance 手调出来的
  // (decks.ts 里那三条经验就是这么来的)。给它们随机播种关键词并扣身材,
  // 实测直接把矩阵打成 70% / 33%,而这些卡本来就已经是策划过的 —— 没有任何收益。
  // 代价:约 100 张卡保持白板。但预组骨架本来就是刻意压平的白板骨架。
  const inPrecon = PRECON_CARD_IDS.has(officer.id)
  const kw = inPrecon ? null : seedKeyword(officer.id, s, archetype, rarity)
  const seeded = inPrecon
    ? { keywords: [], points: 0, textZh: [], textEn: [] }
    : seedMechanics(officer.id, s, archetype, rarity, kw)
  const [attack, health] = payFor(baseAttack, baseHealth, seeded.points)
  // 三国武将默认「群」,魏/蜀/吴归属在 signature.ts 手工覆盖(Phase 1 从剧本势力预填)
  if (officer.dynasty !== undefined && !VALID_DYNASTIES.has(officer.dynasty)) {
    throw new Error(`unknown dynasty "${officer.dynasty}" on officer ${officer.id} — 引擎 DynastyTag 需要同步`)
  }
  const dynasty = (officer.dynasty ?? 'qun') as DynastyTag
  const card: CardDef = {
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
    keywords: seeded.keywords as CardDef['keywords'],
  }
  if (seeded.battlecry) card.battlecry = seeded.battlecry as CardDef['battlecry']
  if (seeded.deathrattle) card.deathrattle = seeded.deathrattle as CardDef['deathrattle']
  if (seeded.spellDamage) card.spellDamage = seeded.spellDamage
  if (seeded.textZh.length > 0) {
    card.text = { zh: seeded.textZh.join(''), en: seeded.textEn.join(' ') }
  }
  return card
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

// ---------- 界面美术复制(标题/战场/结算背景;可按需增补) ----------
// [姊妹仓库 public/ 下相对路径, 本项目 public/art/ 下文件名]
const ART_FILES: [string, string][] = [
  ['title-hero.jpg', 'title-hero.jpg'],
  ['map-bg.jpg', 'battlefield-bg.jpg'],
  ['battle/field-victory.jpg', 'result-victory.jpg'],
  ['battle/field-defeat.jpg', 'result-defeat.jpg'],
  ['popups/grand-muster.jpg', 'mulligan-bg.jpg'],
]
const OUT_ART = join(ROOT, 'public', 'art')
mkdirSync(OUT_ART, { recursive: true })
let artBytes = 0
for (const [srcRel, destName] of ART_FILES) {
  const src = join(SIBLING, 'public', srcRel)
  if (!existsSync(src)) {
    console.warn(`⚠ missing art: ${srcRel}`)
    continue
  }
  const dest = join(OUT_ART, destName)
  copyFileSync(src, dest)
  artBytes += statSync(dest).size
}
console.log(`art: ${ART_FILES.length} files, ${(artBytes / 1024 / 1024).toFixed(1)} MB`)

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

// ---------- 列传/台词(签名集专属,图鉴长按详情用) ----------

interface CardLore {
  bio: { zh: string; en: string }
  era?: { zh: string; en: string }
  quote?: { zh: string; en: string }
  line?: { zh: string; en: string } // 单挑台词(有配音文案的名将)
}

const officerById = new Map(unique.map((o) => [o.id, o]))
const lore: Record<string, CardLore> = {}
let handWrittenBios = 0
for (const id of signatureIds) {
  const o = officerById.get(id)
  if (!o) continue
  const bio = getBiography(id, o.name.en, o.name.zh, o.stats)
  const lines = OFFICER_DUEL_LINES[id]
  const entry: CardLore = { bio: { zh: bio.zh, en: bio.en } }
  if (bio.era) entry.era = bio.era
  if (bio.quote) {
    entry.quote = bio.quote
    handWrittenBios++
  }
  if (lines?.ult?.[0]) entry.line = lines.ult[0]
  else if (lines?.taunt?.[0]) entry.line = lines.taunt[0]
  lore[id] = entry
}
writeFileSync(
  join(OUT_GEN, 'lore.gen.ts'),
  [
    '// GENERATED by scripts/import-content.ts — DO NOT EDIT.',
    '// 签名卡列传/称号/名言/单挑台词(源:姊妹仓库 biographies.ts / officerLines.ts)',
    'export interface CardLore {',
    '  bio: { zh: string; en: string }',
    '  era?: { zh: string; en: string }',
    '  quote?: { zh: string; en: string }',
    '  line?: { zh: string; en: string }',
    '}',
    '',
    `const rawJson = ${JSON.stringify(JSON.stringify(lore))}`,
    '',
    'export const LORE = JSON.parse(rawJson) as Record<string, CardLore>',
    '',
  ].join('\n'),
)
console.log(`lore.gen.ts: ${Object.keys(lore).length} entries (${handWrittenBios} with hand-written quotes)`)

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
