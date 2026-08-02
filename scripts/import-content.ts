// 内容导入管线:从姊妹仓库 ThreeKingdomMastersIOS(素材源头,只读)
// 读取全部武将 → 套公式生成全卡池 → 输出 cards.gen.ts + 复制签名卡立绘。
// 运行:npm run import-content(幂等,输出入 git,构建不依赖姊妹仓库)

// ⚠️ **这个脚本目前跑不得 —— 它会毁掉已提交的卡池。**
//
// 2026-07 实测(在当时的姊妹仓库状态下重跑一次):
//   卡池   2392 → 2207 张(少 185)
//   白板率 8.9% → 29.5%
//   立绘   62.5MB → 34.0MB(被换成更小的一批,清单也跟着缩水)
//   底图   把已经转成 WebP 的五张 JPG 又拷了回来
//
// 也就是说:**已提交的 generated/ 是用姊妹仓库的另一个状态生成的**,
// 现在的姊妹仓库复现不出它。产物入库(而不是构建期生成)本来是对的决定,
// 但它掩盖了这件事 —— CI 的 content job 只检查「没人手改过 generated/」,
// 不会重跑这个脚本,所以这个漂移可以无限期地不被发现。
//
// 要再动卡池,得先解决源头:要么把姊妹仓库固定到当时那个 commit,
// 要么承认现在的姊妹仓库就是新的真相、接受那 185 张卡与白板率的变化
// 并重跑全部平衡闸门(sim-balance / sim-campaign / sim-hero-mirror / deck-stats)。
// 在那之前,**改 seed-mechanics.ts 是没法验证的**(见那个文件里同样的警告)。

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  buildHistoricalOfficers,
  buildInitialOfficers,
} from '../../ThreeKingdomMastersIOS/src/game/data/officers'
import { DYNASTY_DEFS } from '../../ThreeKingdomMastersIOS/src/game/data/dynasties'
import { CARD_INDEX } from '../../ThreeKingdomMastersIOS/src/game/data/cardIndex'
import { deriveDoctrine } from '../../ThreeKingdomMastersIOS/src/game/data/officerAttributes'
// BIOGRAPHIES 直接用而不是 getBiography:后者查不到时会**按五维编一段**,
// 那种程序生成的「他统率很高,善于治军」正是我们要摆脱的东西 ——
// 列传要么是真的,要么就空着(空着至少诚实,而且能被盘点脚本数出来)。
import { BIOGRAPHIES } from '../../ThreeKingdomMastersIOS/src/game/data/biographies'
import { OFFICER_DUEL_LINES } from '../../ThreeKingdomMastersIOS/src/game/data/officerLines'
import { DEATH_POEMS } from '../../ThreeKingdomMastersIOS/src/game/data/deathPoems'
import { HISTORICAL_LIFESPANS } from '../../ThreeKingdomMastersIOS/src/game/data/historicalLifespans'
import { HISTORICAL_TRAITS } from '../../ThreeKingdomMastersIOS/src/game/data/historicalAttributes'
import { TRAIT_DEFS } from '../../ThreeKingdomMastersIOS/src/game/data/personality'
import { CITY_NAMES_BY_ID } from '../../ThreeKingdomMastersIOS/src/game/data/cities'
import type { CardDef, DynastyTag, Rarity } from '../src/engine/types'
import { SIGNATURE_OVERRIDES } from '../src/content/overrides/signature'
import { PRECON_DECKS } from '../src/content/decks'
import { HEROES } from '../src/content/overrides/heroes'
import {
  ERA_OF,
  KEYWORD_POINTS,
  hash01,
  seedKeyword,
  seedMechanics,
  type Seeded,
  type Stats,
} from './seed-mechanics'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..')
const SIBLING = join(ROOT, '..', 'ThreeKingdomMastersIOS')

// ---- 三国势力回填(魏 / 蜀 / 吴 / 群)----
//
// 姊妹仓库的 officer 记录**没有势力字段**,但整份 officers.ts 是**按势力分段注释**的
// (`// Cao Wei circle` / `// Liu Bei circle (Shu)` / `// Sun Wu circle` / `// Yuan Shao force` …),
// 那是源作者按三国志/演义整理的归属。此前只有 41 张签名卡手工标了魏蜀吴,
// 其余 771 张一律落到「群」—— 于是「组一副纯蜀汉牌」根本不成立。
//
// 这里把段注释解析出来当势力真相来源:确定性、可复现、权威性来自源头而不是我们的记忆。
// 两条判断原则:
//   · 跨阵营者按**归宿**定(段注释本身已体现:姜維 在 Liu Bei circle → 蜀);
//   · **真·群雄不硬塞**(黄巾/十常侍/南蛮/鲜卑/袁绍/董卓/刘表刘璋…)一律留「群」,
//     那是正确归属,不是漏标。
const OFFICER_SRC = join(SIBLING, 'src', 'game', 'data', 'officers.ts')

function sectionByOfficerId(): Map<string, string> {
  const out = new Map<string, string>()
  let sec = ''
  for (const ln of readFileSync(OFFICER_SRC, 'utf8').split('\n')) {
    const m = ln.match(/^\s*\/\/\s*(.+?)\s*$/)
    if (m && !/^@|eslint|prettier|TODO/.test(m[1])) {
      sec = m[1]
      continue
    }
    for (const x of ln.matchAll(/\bid:\s*.([a-z0-9-]+)./g)) out.set(x[1], sec)
  }
  return out
}

// 段名 → 势力。先排除明确不属魏蜀吴的势力,再认魏/蜀/吴关键词(顺序要紧:
// 「Liu Biao / Liu Zhang region」含 Liu 但不是刘备,必须落「群」)。
function factionFromSection(sec: string): DynastyTag {
  const s = sec.toLowerCase()
  const isWei = () => /\bwei\b|cao wei|cao clan|cao cao|cao shuang/.test(s)
  const isShu = () => /\bshu\b|liu bei|shu han|zhuge/.test(s)
  const isWu = () => /\bwu\b|sun wu|sun force|sun clan|sun heirs|sun extras|sun /.test(s)
  if (
    /yellow turban|ten attendants|eunuch|nanman|meng huo|xianbei|qiang|wuhuan|court|he jin|yuan shao|yuan shu|dong zhuo|lu bu|liu biao|liu zhang|gongsun|ma teng|han sui|zhang lu|warlord|outsider|scholar|misc|rounding out|phase/.test(
      s,
    )
  ) {
    if (isWei()) return 'wei'
    if (isShu()) return 'shu'
    if (isWu()) return 'wu'
    return 'qun'
  }
  if (isWei()) return 'wei'
  if (isShu()) return 'shu'
  if (isWu()) return 'wu'
  return 'qun'
}

const OFFICER_SECTION = sectionByOfficerId()

const OUT_GEN = join(ROOT, 'src', 'content', 'generated')
const OUT_PORTRAITS = join(ROOT, 'public', 'portraits')

// ---------- 生成公式(默认值;signature.ts 的手工覆盖优先) ----------

const clamp = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, Math.round(v)))
// 同上但不取整(比例用)
const clamp2 = (lo: number, hi: number, v: number) => Math.max(lo, Math.min(hi, v))

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

// ── 费用曲线 ────────────────────────────────────────────────────────────────
//
// 从前费用是**直接从光荣数值线性算出来**的:cost ≈ (攻+血)/2 - 0.5,
// 而攻血又各自是武力/统率的线性映射。历史人物的能力值是钟形分布,
// 线性映射不会把钟形拉平 —— 实测 2211 张武将里 **72.4% 挤在 3-5 费**,
// 0 费、9 费、10 费一张都没有,攻击力上限卡在 8(尽管 clamp 写的是 12)。
//
// 后果不是「不好看」,是**卡池在设计上没有边缘**:
// 竞技场三选一常常三张都是 4 费白板,冒险模式的 Boss 卡组抽不出压场的大哥,
// 玩家也永远没有「这张 9 费值不值得留」的决策。曲线的两端才是构筑的乐趣所在。
//
// 现在改成**按名次分配**:先给每个武将算一个战力分,排序后按百分位落进
// 一条设计好的曲线。这样曲线形状是我们说了算的,不再由数值分布决定;
// 而「谁更强 → 谁更贵」的相对关系完全保留(名次是单调的)。
//
// 曲线偏低费(1-4 费占 55%),因为一副 30 张的卡组本来就需要更多早期牌;
// 高费段刻意留薄(9-10 费共 4%)—— 它们是「一局最多出一张」的牌。
// 不生成 0 费武将:0 费随从是 combo 的启动器,不是能随手播种的东西。
const COST_CURVE: readonly [cost: number, share: number][] = [
  [1, 0.09],
  [2, 0.15],
  [3, 0.17],
  [4, 0.16],
  [5, 0.14],
  [6, 0.11],
  [7, 0.08],
  [8, 0.06],
  [9, 0.025],
  [10, 0.015],
]

// 战力分:决定名次(进而决定费用)。和 fame()(决定稀有度)刻意用不同的公式 ——
// 名将不等于大牌,关羽该是贵的猛将,而荀彧该是便宜的谋士。
function might(s: Stats): number {
  return Math.max(s.war, s.intelligence) * 0.55 + s.leadership * 0.3 + s.charisma * 0.15
}

// 名次 → 费用。返回的函数吃战力分,吐 1..10。
function makeCostOf(allMights: number[]): (m: number) => number {
  const sorted = [...allMights].sort((a, b) => a - b)
  // 累积份额的切点:第 i 档的上界百分位
  const cuts: [number, number][] = []
  let acc = 0
  for (const [cost, share] of COST_CURVE) {
    acc += share
    cuts.push([cost, sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * acc))]])
  }
  return (m) => {
    for (const [cost, upper] of cuts) if (m <= upper) return cost
    return 10
  }
}

// 费用 → 身材总点数。炉石的白板基准线是 攻+血 ≈ 2×费+1
// (1 费 2/1、3 费 3/4、5 费 5/6…)。高费段按同一条线会过强
// —— 8 费给 17 点身材意味着 8/9,而对手到 8 费时手里往往还有解场牌 ——
// 所以 7 费以上每费只加 1.5 点。
function statBudget(cost: number): number {
  return cost <= 6 ? 2 * cost + 1 : Math.round(13 + (cost - 6) * 1.5)
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

// 播种形状统计:跑完打一张分布表。这不是装饰 —— 从前那 268 张「戰吼:抽一張牌」
// 就是因为没人看得见分布才躺了那么久。任何一种形状占比过高,这张表会当场暴露。
const SHAPE_TALLY = new Map<string, number>()

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
  // 预组骨架卡沿用**旧的线性公式**,不走新曲线。
  //
  // 不是偷懒 —— 是新曲线整体把费用推高了(设计上如此:旧公式没有高费段),
  // 而六套预组的每个插槽都是照旧身材调出来的。直接套上去,六套预组的
  // 平均费用从 ~3.3 跳到 4.0~4.8,曲线全线后置,开局三四回合无牌可出。
  // 那不是平衡问题,是「六副卡组一起变难玩」。
  //
  // 代价:约 100 张骨架卡的定价和新池子不是同一套语言。可以接受 ——
  // 它们本来就是刻意压平的白板,而且已经在预组里各就各位。
  // 真要统一,得连着 decks.ts 的插槽一起重调,那是另一件事。
  const legacy = PRECON_CARD_IDS.has(officer.id)
  const legacyAttack =
    archetype === 'warrior'
      ? clamp(1, 12, (s.war - 30) / 9)
      : clamp(1, 8, (s.intelligence - 40) / 12)
  const legacyHealth = clamp(1, 12, (0.5 * s.leadership + 0.3 * s.charisma + 0.2 * s.war - 25) / 9)

  // 新卡的因果方向和旧公式相反:先由名次定**费用**,再由费用给出身材预算,
  // 最后按武将自己的攻守倾向把预算劈成攻和血。理由见 COST_CURVE 上方。
  const cost = legacy
    ? clamp(0, 10, (legacyAttack + legacyHealth) / 2 - 0.5)
    : costOf(might(s))
  const budget = statBudget(cost)
  // 攻血配比 0.3~0.7:谋士偏血(靠效果吃饭,身板要活得下来),猛将偏攻。
  // 用连续比例而不是分档,免得同费卡的身材只有两三种。
  const aggression = clamp2(
    0.3,
    0.7,
    0.5 + (s.war - s.leadership) / 200 + (archetype === 'warrior' ? 0.06 : -0.06),
  )
  const baseAttack = legacy
    ? legacyAttack
    : Math.max(1, Math.min(budget - 1, Math.round(budget * aggression)))
  const baseHealth = legacy ? legacyHealth : budget - baseAttack
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

  // 势力:源数据显式给了就用显式的;三国武将否则按 officers.ts 的**势力分段注释**回填
  //(见 factionFromSection)。签名卡在 signature.ts 里的手工覆盖仍然优先级更高 ——
  // 那一层在 cards.ts 合并时才叠上去,不会被这里冲掉。
  //
  // 必须算在播种**之前** —— 播种要按时代分风味(先秦多谋略、宋元多城防…),
  // 势力/朝代就是时代的唯一来源。
  if (officer.dynasty !== undefined && !VALID_DYNASTIES.has(officer.dynasty)) {
    throw new Error(`unknown dynasty "${officer.dynasty}" on officer ${officer.id} — 引擎 DynastyTag 需要同步`)
  }
  const sec = OFFICER_SECTION.get(officer.id)
  const dynasty = (officer.dynasty ??
    (sec !== undefined ? factionFromSection(sec) : 'qun')) as DynastyTag

  // 不播种的两类卡:
  //
  // 1. **预组骨架**:身材与曲线是跨很多轮 sim-balance 手调出来的,随机播种实测
  //    直接把胜率矩阵打成 70%/33%。
  // 2. **签名卡**:效果与文本全是手写的。233 张里有 **102 张刻意不带效果**
  //    (關羽、張飛、孫武、衛青、李靖、戚繼光…),而覆盖是浅合并 ——
  //    播下去的战吼/光环会从手写文本底下漏上来,变成**卡面没写却真的会触发**的技能。
  //    高順就这么背了一道看不见的光环、廖化背了一条看不见的「交换攻血」。
  //    手写的就该完全手写,这是铁律 3 的直接推论。
  const handAuthored = PRECON_CARD_IDS.has(officer.id) || SIGNATURE_OVERRIDES[officer.id] !== undefined
  const era = ERA_OF[dynasty]
  const kw = handAuthored ? null : seedKeyword(officer.id, s, archetype, rarity, era, dynasty, cost)
  const empty: Seeded = { keywords: [], points: 0, textZh: [], textEn: [], shape: null }
  const seeded = handAuthored
    ? empty
    : seedMechanics(officer.id, s, archetype, rarity, kw, era, dynasty, cost, budget)
  // 签名卡不播种,但**覆盖里声明的关键词照样要付账** —— 否则它白拿一个关键词还留着满额身材。
  // (233 张里有 16 张没在覆盖里钉死攻血,吃的是这里算出来的身材;
  //  廖化就是其中之一,不收这笔钱它会从 3/3 变成 4/3,凭空强一档。)
  //
  // **预组骨架除外**:那 75 张是跨很多轮 sim-balance 手调出来的,一点都不能动。
  // 收过一次:颜真卿从 4/6 削成 4/4,礼家预组当场掉到 38.4%、割据涨到 61.2% ——
  // 一张守护骨架掉 2 血就能把矩阵打出闸门,可见这批卡有多敏感。
  const sigKeywords = PRECON_CARD_IDS.has(officer.id) ? undefined : SIGNATURE_OVERRIDES[officer.id]?.keywords
  if (sigKeywords) for (const k of sigKeywords) seeded.points += KEYWORD_POINTS[k] ?? 1
  SHAPE_TALLY.set(seeded.shape ?? '—', (SHAPE_TALLY.get(seeded.shape ?? '—') ?? 0) + 1)
  const [attack, health] = payFor(baseAttack, baseHealth, seeded.points)
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
  if (seeded.endOfTurn) card.endOfTurn = seeded.endOfTurn as CardDef['endOfTurn']
  if (seeded.startOfTurn) card.startOfTurn = seeded.startOfTurn as CardDef['startOfTurn']
  if (seeded.onAttack) card.onAttack = seeded.onAttack as CardDef['onAttack']
  if (seeded.onDamaged) card.onDamaged = seeded.onDamaged as CardDef['onDamaged']
  if (seeded.onSpellCast) card.onSpellCast = seeded.onSpellCast as CardDef['onSpellCast']
  if (seeded.combo) card.combo = seeded.combo as CardDef['combo']
  if (seeded.choose) card.choose = seeded.choose as CardDef['choose']
  if (seeded.aura) card.aura = seeded.aura
  if (seeded.enrage) card.enrage = seeded.enrage
  if (seeded.overload) card.overload = seeded.overload
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

// 同一个人在两份花名册里各占一条(id 拼法不同,人是同一个)。
//
// 只列**玩家完全分不出来的**那几对 —— 同名、同朝代、同费用、同身材。
// 卡池里还有 36 组重名不在这里:有的是真同名异人(蜀漢馬忠 / 東吳馬忠、
// 東漢賈逵 / 曹魏賈逵、蜀漢李密 / 隋末李密,上游 id 用 -wu / -wei 后缀
// 明确区分过);有的是同一个人在三国册记「群」、在两晋册记「晋」
// (杜預、嵇康、阮籍…)—— 那批要合并得逐条过史料,而且合并不可逆,
// 不在这里替人决定。界面上它们会带朝代标注,玩家分得清(见 CardFace 的 dynastyTag)。
//
// 去留标准:保留信息更多的那条(有主义 > 中立、稀有度更高),同分取 collectorNo 更小的。
const DUPLICATE_OFFICER_IDS: ReadonlySet<string> = new Set([
  'mulu-da', // 木鹿大王 —— 保留 mu-lu(collectorNo 更小)
  'daolaidong', // 帶來洞主 —— 保留 dailai-dongzhu(有主义:名利)
  'cui-zhou-ping', // 崔州平 —— 保留 cui-zhouping(稀有 + 隐逸,信息更全)
  'fu-qi', // 傅僉 —— 保留 fu-qian(collectorNo 更小)
])

// 源数据存在重复 id(如 nan-lou 在 officers.ts 出现两次)—— 保留首个,警告跳过
const seen = new Set<string>()
const unique = all.filter((o) => {
  if (DUPLICATE_OFFICER_IDS.has(o.id)) return false
  if (seen.has(o.id)) {
    console.warn(`⚠ duplicate officer id in source data, skipping: ${o.id} (${o.name.zh})`)
    return false
  }
  seen.add(o.id)
  return true
})

const rarityOf = makeRarityOf(unique.map((o) => fame(o.stats)))
const costOf = makeCostOf(unique.map((o) => might(o.stats)))
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

// 播种分布:占比最高的十种形状 + 白板率。任何一种超过 8% 就该去调权重了。
{
  const total = cards.length
  const rows = [...SHAPE_TALLY.entries()].sort((a, b) => b[1] - a[1])
  const blank = SHAPE_TALLY.get('—') ?? 0
  console.log(
    `seeding: ${rows.length - 1} 种效果形状,白板 ${blank}(${((blank / total) * 100).toFixed(1)}%)`,
  )
  console.log(
    '  top:',
    rows
      .filter(([k]) => k !== '—')
      .slice(0, 10)
      .map(([k, n]) => `${k} ${((n / total) * 100).toFixed(1)}%`)
      .join('  '),
  )
}

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

// 【为什么这一段从「只发签名卡」改成「全员」】
// 此前这个循环是 `for (const id of signatureIds)` —— 2,258 名武将里只有 233 名
// 有档案,其余 2,025 名在图鉴里就是一张脸加一句程序生成的卡面文案。
// 而姊妹仓库里躺着 833 条**注明取自三国志/演义**的生平、345 条生卒、
// 442 份性格特质、1,747 个籍贯、1,139 个表字 —— 一条都没导过。
//
// 分两类导,标准不同:
//   · **故事**(生平/名言/绝命诗/台词)—— 只导源头真有的,查不到就空着。
//     绝不用 getBiography 的程序兜底(那会按五维编一段「他统率很高,善于治军」,
//     正是我们要摆脱的东西)。空着至少诚实,而且能被盘点脚本数出来。
//   · **身份**(字/籍贯/生卒/五维/性格)—— 有多少导多少,这些是事实不是叙述。
interface CardLore {
  bio?: { zh: string; en: string }
  era?: { zh: string; en: string }
  quote?: { zh: string; en: string }
  line?: { zh: string; en: string } // 单挑台词(有配音文案的名将)
  // ---- 2026-08 扩:武将档案 ----
  courtesy?: { zh: string; en: string } // 表字
  home?: { zh: string; en: string } // 籍贯
  life?: { zh: string; en: string } // 生卒年
  poem?: { zh: string; en: string } // 绝命诗
  taunt?: { zh: string; en: string } // 挑衅
  traits?: string[] // 性格特质 id(译名表在内容层)
  stats?: { ld: number; war: number; int: number; pol: number; cha: number } // 五维
}

const officerById = new Map(unique.map((o) => [o.id, o]))
const lore: Record<string, CardLore> = {}
const tally = { bio: 0, quote: 0, poem: 0, line: 0, courtesy: 0, home: 0, life: 0, traits: 0, stats: 0 }
// 生卒年:源头的 HISTORICAL_LIFESPANS 只覆盖歷代名將;三国那批用名册上的
// birthYear/deathYear 现拼(两者格式不同,所以不能混成一个来源)
const lifeOf = (id: string, o: (typeof unique)[number]): { zh: string; en: string } | undefined => {
  const hist = HISTORICAL_LIFESPANS[id]
  if (hist) return hist
  const b = (o as { birthYear?: number }).birthYear
  const d = (o as { deathYear?: number }).deathYear
  if (!d) return undefined
  return { zh: `${b ?? '?'}–${d}`, en: `${b ?? '?'}–${d}` }
}
for (const o of unique) {
  const id = o.id
  const entry: CardLore = {}
  const bio = BIOGRAPHIES[id]
  if (bio) {
    entry.bio = { zh: bio.zh, en: bio.en }
    tally.bio++
    if (bio.era) entry.era = bio.era
    if (bio.quote) {
      entry.quote = bio.quote
      tally.quote++
    }
  }
  const lines = OFFICER_DUEL_LINES[id]
  if (lines?.ult?.[0]) {
    entry.line = lines.ult[0]
    tally.line++
  }
  if (lines?.taunt?.[0]) entry.taunt = lines.taunt[0]
  const poem = DEATH_POEMS[id]
  if (poem) {
    entry.poem = poem
    tally.poem++
  }
  const cn = (o as { courtesyName?: { zh: string; en: string } }).courtesyName
  if (cn?.zh) {
    entry.courtesy = cn
    tally.courtesy++
  }
  const city = (o as { hometownCityId?: string }).hometownCityId
  const cityName = city ? CITY_NAMES_BY_ID[city] : undefined
  if (cityName) {
    entry.home = cityName
    tally.home++
  }
  const life = lifeOf(id, o)
  if (life) {
    entry.life = life
    tally.life++
  }
  const traits = HISTORICAL_TRAITS[id]
  if (traits?.length) {
    entry.traits = traits.slice()
    tally.traits++
  }
  if (o.stats) {
    entry.stats = {
      ld: o.stats.leadership,
      war: o.stats.war,
      int: o.stats.intelligence,
      pol: o.stats.politics,
      cha: o.stats.charisma,
    }
    tally.stats++
  }
  // 一条信息都没有的不写进去(省体积,也让盘点脚本的数字诚实)
  if (Object.keys(entry).length > 0) lore[id] = entry
}
const handWrittenBios = tally.quote
writeFileSync(
  join(OUT_GEN, 'lore.gen.ts'),
  [
    '// GENERATED by scripts/import-content.ts — DO NOT EDIT.',
    '// 签名卡列传/称号/名言/单挑台词(源:姊妹仓库 biographies.ts / officerLines.ts)',
    'export interface CardLore {',
    '  bio?: { zh: string; en: string }',
    '  era?: { zh: string; en: string }',
    '  quote?: { zh: string; en: string }',
    '  line?: { zh: string; en: string }',
    '  courtesy?: { zh: string; en: string }',
    '  home?: { zh: string; en: string }',
    '  life?: { zh: string; en: string }',
    '  poem?: { zh: string; en: string }',
    '  taunt?: { zh: string; en: string }',
    '  traits?: string[]',
    '  stats?: { ld: number; war: number; int: number; pol: number; cha: number }',
    '}',
    '',
    `const rawJson = ${JSON.stringify(JSON.stringify(lore))}`,
    '',
    'export const LORE = JSON.parse(rawJson) as Record<string, CardLore>',
    '',
    '// 性格特质译名 —— 和 traits 一起生成,免得两处漂移',
    `export const TRAIT_NAMES: Record<string, { zh: string; en: string }> = ${JSON.stringify(
      Object.fromEntries(TRAIT_DEFS.map((t) => [t.id, { zh: t.name.zh, en: t.name.en }])),
      null,
      2,
    )}`,
    '',
  ].join('\n'),
)
console.log(
  `lore.gen.ts: ${Object.keys(lore).length} 条档案 —— ` +
    `生平 ${tally.bio} · 名言 ${tally.quote} · 绝命诗 ${tally.poem} · 台词 ${tally.line} · ` +
    `表字 ${tally.courtesy} · 籍贯 ${tally.home} · 生卒 ${tally.life} · 性格 ${tally.traits} · 五维 ${tally.stats}`,
)
void handWrittenBios

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
// ---- 缩略图层:让**每一位**武将都有脸 ----
//
// 签名卡随包的是全尺寸立绘(约 50MB / 233 张),其余两千余张此前只能靠 CDN;
// 没配 VITE_PORTRAIT_CDN 时它们全部退化成首字兜底 —— 十张卡九张没脸,砸招牌。
//
// 现在给所有非签名武将再生成一层**缩略图**(宽 200、webp q70,单张约 6KB):
// 全池约 12MB,包体从 50MB → 62MB,离 150MB 红线仍很远,却让列表/图鉴/牌桌上
// 每张牌都是一张真脸。全尺寸立绘仍只随签名卡(详情大图才需要那个分辨率)。
const THUMB_WIDTH = 200
const THUMB_QUALITY = 70
let thumbCount = 0
let thumbBytes = 0
const sigSet = new Set(signatureIds)
for (const def of cards) {
  if (def.type !== 'general' || sigSet.has(def.id)) continue
  const src = join(SIBLING, 'public', 'portraits', `${def.id}.webp`)
  if (!existsSync(src)) continue
  const dest = join(OUT_PORTRAITS, `${def.id}.webp`)
  const buf = await sharp(src).resize({ width: THUMB_WIDTH }).webp({ quality: THUMB_QUALITY }).toBuffer()
  writeFileSync(dest, buf)
  manifest[def.id] = { files: [`${def.id}.webp`], bytes: buf.length }
  thumbCount++
  thumbBytes += buf.length
}
totalBytes += thumbBytes

writeFileSync(
  join(OUT_GEN, 'manifest.json'),
  JSON.stringify({ signatureIds, portraits: manifest, totalBytes }, null, 2) + '\n',
)
console.log(
  `portraits: ${Object.values(manifest).reduce((n, m) => n + m.files.length, 0)} files, ` +
    `${(totalBytes / 1024 / 1024).toFixed(1)} MB (红线 150MB)`,
)
console.log(
  `  其中缩略图 ${thumbCount} 张 / ${(thumbBytes / 1024 / 1024).toFixed(1)} MB ` +
    `(非签名武将,宽 ${THUMB_WIDTH} q${THUMB_QUALITY})`,
)
