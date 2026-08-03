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

// 生平里有 17 条根本不是传,是**交叉引用**:「參見「hist-xu-da」(明初徐達)。」
// 徐達是冒险第二章的关底,他的列传上此前就写着这一行 —— 玩家看到的是一个坏指针。
//
// 能解开的解开(皇太極 → hist-huangtaiji、孟嘗君 → hist-mengchang-jun、
// 晉室那一串司馬 → 三国册的同一个人),12 条因此拿到了真的传;
// 剩下 5 条是指向自己或指向不存在的 id —— 那种**宁可空着**:
// 空的列传至少诚实,而且会被盘点脚本数出来,坏指针只会被当成正文读。
// 写法不止一种:「參見「hist-xu-da」」也有「參見前述「hist-zhang-xian」」——
// 中间那两个字是被闸门(dossier.test)抓出来的,凭眼睛扫源数据扫不到。
const BIO_REF = /^參見[^「『"]{0,4}[「『"]?([a-z0-9-]+)/
function bioOf(id: string): { zh: string; en: string; era?: { zh: string; en: string }; quote?: { zh: string; en: string } } | undefined {
  const b = BIOGRAPHIES[id]
  if (!b) return undefined
  const m = b.zh.trim().match(BIO_REF)
  if (!m || m[1] === id) return m ? undefined : b
  const t = BIOGRAPHIES[m[1]]
  // 只跟一跳:指针链在这份数据里不存在,而无限跟指针需要防环
  return t && !BIO_REF.test(t.zh.trim()) ? t : undefined
}
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
  deedsOf,
  seedKeyword,
  traitsOf,
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
  // 攻血配比。此前只看 武力−统率,于是低费段几乎只有两种劈法
  //(1 费预算 3 点 → 只能 1/2 或 2/1),28 名一费谋士长成同一张牌。
  //
  // 现在把**五维都拉进来**:文治(政+魅)高的人往血偏(他们靠活着做事),
  // 智力高的往血偏一点点(谋士不该站在前面挨刀)。总预算一个字不动 ——
  // 这条改动不碰任何平衡闸门,只是把同一份预算劈得更像那个人。
  const civil = (s.politics + s.charisma) / 2
  // **+0.056 是重新居中,不是调强度。**
  //
  // 新加的两项(武 vs 文治、智力)在全池上的均值不为零 —— 历史人物的政治与
  // 魅力普遍高于武力,智力均值也高于 60,于是整条公式系统性地往血偏:
  // 实测平均攻击 3.69 → 3.45(−6.5%),血 3.83 → 4.03。
  // 而**攻击才是贪心 AI 结束比赛的东西**,关底 Boss 的牌又是从全池切的 ——
  // 郑成功的玩家胜率因此从 18% 飙到 60%,tune-campaign 每一档都调不回来。
  //
  // 加回这 0.033 让**均值回到原位、分散度保留**:同一份预算劈得更像那个人
  // (麋竺政 85 该比劉禪政 45 厚),但全池的攻血总账一分不差。
  const aggression = clamp2(
    0.28,
    0.72,
    0.556 +
      (s.war - s.leadership) / 200 +
      (s.war - civil) / 320 -
      (s.intelligence - 60) / 700 +
      (archetype === 'warrior' ? 0.06 : -0.06),
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
  // 事迹标签:从**真实生平原文**抽出来的、这个人身上确实发生过的事。
  // 它会去抬对应机制的权重(见 seed-mechanics 的 DEED_AFFINITY)——
  // 播种因此从「加权随机」变成「有出处的确定性」。
  const deeds = deedsOf(bioOf(officer.id)?.zh, officer.name.zh)
  // 兵种:生平里写明了的,直接照抄,不交给 deriveTroop 去猜。
  //
  // 【为什么必须在这里定】
  // content/troops.ts 的 deriveTroop 是**按攻血与朝代的画像猜**的(约三分之一走
  // 哈希兜底),而生平里白纸黑字写着「善射」「水軍都督」「鎮守」的人有 540 名 ——
  // 实测其中 399 名的兵种与生平**不符**:养由基百步穿杨却被判成步兵。
  // 事迹标签本来就抽好了(播种在用),接到兵种上是同一份数据、零额外成本。
  // 生成层写进 CardDef.troop,合并层的 `withText.troop ?? deriveTroop(...)` 自然优先它。
  const troopFromDeeds: CardDef['troop'] | undefined = deeds.includes('archery')
    ? 'archer'
    : deeds.includes('navy')
      ? 'navy'
      : deeds.includes('cavalry')
        ? 'cavalry'
        : deeds.includes('defend')
          ? 'infantry'
          : undefined
  // 性格特质:源头的 HISTORICAL_TRAITS 只覆盖 17.8%,其余从生平原文抽。
  // 两条轴正交 —— 事迹说他做过什么,性格说他是什么人。
  const traits = HISTORICAL_TRAITS[officer.id]?.length
    ? HISTORICAL_TRAITS[officer.id].slice(0, 4)
    : traitsOf(bioOf(officer.id)?.zh, officer.name.zh)
  const kw = handAuthored
    ? null
    : seedKeyword(officer.id, s, archetype, rarity, era, dynasty, cost, deeds, traits)
  const empty: Seeded = { keywords: [], points: 0, textZh: [], textEn: [], shape: null }
  const seeded = handAuthored
    ? empty
    : seedMechanics(officer.id, s, archetype, rarity, kw, era, dynasty, cost, budget, deeds, traits)
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
  if (troopFromDeeds) card.troop = troopFromDeeds
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

// ---------- 家族(从生平原文抠出的宗族网)----------
//
// 羁绊只能覆盖「桃園結義」这种有名字的关系,三十来条就到头(4.3% 的武将)。
// 而「谁和谁是一家人」在史料里成百上千条,且写法极其规整:
// 「夏侯惇之從弟」「關羽長子」「馬良之弟」—— 照抄就是,不用推断。
//
// 【为什么必须同姓才算】
// 窗口里认到「之子」还不够:「曹操之子,封濟陽公。從袁紹征…」这种句子里
// 亲属词离得近的未必是同一个人。加一条「两人同姓」实测剔掉 102 次误判,
// 而真同族异姓的情况(过继、赐姓)在这份语料里少到可以整批放弃 ——
// 宁可漏,不可错:错一条就是卡面上写着家族、玩家查史料查不到。
const DOUBLE_SURNAMES = [
  '司馬', '諸葛', '夏侯', '歐陽', '上官', '皇甫', '公孫', '慕容', '宇文', '長孫',
  '尉遲', '獨孤', '拓跋', '赫連', '宗政', '濮陽', '淳于', '單于', '太叔', '申屠',
  '公羊', '東方', '司徒', '司空', '令狐', '鍾離', '閭丘', '南宮', '第五', '完顏', '耶律',
]
const surnameOf = (n: string) => (DOUBLE_SURNAMES.some((d) => n.startsWith(d)) ? n.slice(0, 2) : n.slice(0, 1))
// 亲属结构词。**只认带结构的写法**,不认单字 ——
// 「挾天子以令諸侯」里的「子」来自「天子」,单字规则会把曹操判成谁的儿子。
const KIN_RE = /(之(弟|兄|子|父|女|母|叔|姪|孫|妻)|兄弟|父子|從弟|從兄|族弟|族兄|長子|次子|少子)/

const clanNameToId = new Map<string, string>()
for (const o of unique) {
  // 同名的人不建亲族(重名连错了比不连更糟,和关系网同一条标准)
  if (clanNameToId.has(o.name.zh)) clanNameToId.set(o.name.zh, '')
  else clanNameToId.set(o.name.zh, o.id)
}
const kinParent = new Map<string, string>()
const kinFind = (x: string): string => {
  if (!kinParent.has(x)) kinParent.set(x, x)
  let r = kinParent.get(x)!
  while (r !== kinParent.get(r)!) r = kinParent.get(r)!
  kinParent.set(x, r)
  return r
}
let kinPairs = 0
for (const o of unique) {
  const bio = bioOf(o.id)?.zh
  if (!bio) continue
  const mySurname = surnameOf(o.name.zh)
  for (const sentence of bio.split(/[。;!?]/)) {
    for (const [name, otherId] of clanNameToId) {
      if (!otherId || otherId === o.id || name.length < 2) continue
      const at = sentence.indexOf(name)
      if (at < 0) continue
      // 在名字前后各 6 字的窗口里认亲属词(和关系网同一套窗口逻辑)
      if (!KIN_RE.test(sentence.slice(Math.max(0, at - 6), at + name.length + 6))) continue
      if (surnameOf(name) !== mySurname) continue
      kinPairs++
      kinParent.set(kinFind(o.id), kinFind(otherId))
    }
  }
}
// 连通分量 = 一个家族。族长取 collectorNo 最小的那位,只为让 id 稳定。
const clanMembers = new Map<string, string[]>()
for (const x of [...kinParent.keys()]) {
  const root = kinFind(x)
  const bucket = clanMembers.get(root)
  if (bucket) bucket.push(x)
  else clanMembers.set(root, [x])
}
const officerForClan = new Map(unique.map((o) => [o.id, o]))
const clanOf = new Map<string, CardDef['clan']>()
// 先按族长归好队,再统一起名 —— 因为「这个姓有几支」要等全部建完才知道。
const clanHeads = [...clanMembers.values()].map((members) =>
  [...members].sort((a, b) => (CARD_INDEX[a] ?? 0) - (CARD_INDEX[b] ?? 0) || a.localeCompare(b)),
)
// 同姓不同宗的有 27 个姓:程昱这一支和程普那一支都叫「程氏」,劉姓有八支。
// 光写姓氏,玩家在牌桌上分不出「我这两张程氏算不算一家」——
// 而这恰恰是这条机制唯一需要玩家判断的事。所以撞车的姓要缀上族长名。
//
// 本想按郡望起名(「汝南袁氏」才是史书的叫法),查了一遍放弃:
// 郡望得从籍贯来,而名册那份籍贯 80% 是错的(见上面 entry.home 那段),
// 传里抠出来的又只覆盖三分之一。宁可叫得笨,不可叫得错。
const surnameCount = new Map<string, number>()
for (const sorted of clanHeads) {
  const zh = surnameOf(officerForClan.get(sorted[0])!.name.zh)
  surnameCount.set(zh, (surnameCount.get(zh) ?? 0) + 1)
}
for (const sorted of clanHeads) {
  const head = officerForClan.get(sorted[0])!
  const zh = surnameOf(head.name.zh)
  const en = head.name.en.split(/[\s-]/)[0]
  const forked = (surnameCount.get(zh) ?? 1) > 1
  const def = {
    id: `clan-${sorted[0]}`,
    name: forked
      ? { zh: `${zh}氏 · ${head.name.zh}一支`, en: `House of ${en} (${head.name.en}'s line)` }
      : { zh: `${zh}氏`, en: `House of ${en}` },
    size: sorted.length,
  }
  for (const m of sorted) clanOf.set(m, def)
}
console.log(
  `家族:${clanMembers.size} 个,${clanOf.size} 名武将(${((clanOf.size / unique.length) * 100).toFixed(1)}%),` +
    `${kinPairs} 组亲族对 —— 最大 ${Math.max(...[...clanMembers.values()].map((m) => m.length))} 人`,
)

const rarityOf = makeRarityOf(unique.map((o) => fame(o.stats)))
const costOf = makeCostOf(unique.map((o) => might(o.stats)))
const cards = unique
  .map((o) => {
    const card = generateCard(o, rarityOf)
    const clan = clanOf.get(o.id)
    if (clan) card.clan = clan
    return card
  })
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

// 生平原文里「字X」「XX人」的写法极其规整(史书体例如此),
// 源头名册没给的那一半可以直接从传里抽 —— 这不是推断,是**照抄原文**。
// 实测 2,180 条生平里能抽出 860 个表字、789 个籍贯,和名册的覆盖正好互补。
const CZ_RE = /字([一-龥]{1,3})[,,。;;]/
// 籍贯:**在头一句里找**,不再死锚句首。
// 锚句首漏掉的是「名機,字仲景,南陽人」「字文舉,孔子二十世孫,魯國人」
// 这种前面多带了一节的写法 —— 实测多捞回九十来条,全是真籍贯。
//
// 但窗口一放宽就会捞到「而才識過人」「有若成人」「獻帝貴人」——
// 它们也以「人」收尾,却根本不是地名。所以「人」前面那个字要过一道排除:
// 这些词的倒数第二个字是**形容/身份**(過成貴美夫…),而地名收尾的是
// **行政区划或方位**(縣郡國州陽平城…)。排除表比白名单短得多,也更好维护。
const HOME_RE = /(?:^|[,,])([一-龥]{2,7}人)[,,。;;]/
// 「人」前面那个字是形容/身份(過成貴美…)或**数词**(「從食客中選二十人」
// 「殺諫者二十七人」)的,都不是籍贯。数词那一类是放宽窗口后才冒出来的。
const NOT_A_PLACE = /[過过成貴贵美夫愛爱殺杀活用知待後后時时他眾众奇異异常善罪僕仆一二三四五六七八九十百千萬万餘余數数\d]人$/
// 谥号/世称/尊号 —— 它们恰恰是最该显示的那种称呼。
// 只认「諡曰」「世稱」三四种写法时只有 15 条,而「尊為武聖」(關羽)这种
// 最该显示的反倒漏了;补齐常见写法后 24 条。
const POSTH_RE =
  /(?:諡曰|谥曰|追諡|追谥|諡號|谥号|世稱|世称|人稱|人称|號曰|号曰|時人謂之|时人谓之|後世尊為|后世尊为|追尊為|追尊为|尊為|尊为|封為|封为)([一-龥]{2,6})/

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
  const bio = bioOf(id)
  if (bio) {
    entry.bio = { zh: bio.zh, en: bio.en }
    tally.bio++
    if (bio.era) entry.era = bio.era
    else {
      // 尊号:传里写着「後世尊為武聖」「諡曰忠武」的那些
      const m = bio.zh.match(POSTH_RE)
      if (m) entry.era = { zh: m[1], en: m[1] }
    }
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
  const bioZh = bio?.zh
  const cn = (o as { courtesyName?: { zh: string; en: string } }).courtesyName
  if (cn?.zh) {
    entry.courtesy = cn
    tally.courtesy++
  } else {
    // 名册没给就从传里抽。英文那半只能留中文原字 ——
    // 表字没有通行的英译,音译反而更难认(源头给的英文也只是拼音)。
    const m = bioZh?.match(CZ_RE)
    if (m) {
      entry.courtesy = { zh: m[1], en: m[1] }
      tally.courtesy++
    }
  }
  // 籍贯**只认生平原文**。传里的「東海朐人」「潁川人」就是籍贯本身,照抄。
  //
  // 【为什么把名册的 hometownCityId 整个扔了】
  // 那个字段名叫 hometown,实际是姊妹仓库**战棋地图上的驻地**,不是籍贯。
  // 两者都有的 623 人里只有 20% 对得上,而且对不上的全是硬伤:
  //   關羽 河東解良 → 记成濮陽 · 劉備 涿郡涿縣 → 记成北平(那是他投公孫瓚的地方)
  //   荀彧 潁川潁陰 → 记成許昌(那是他后来任职的地方)· 呂布 五原九原 → 记成雁門
  // 覆盖率因此从 1,916 掉到 788,但那 1,916 里有一千多条是错的 ——
  // 而籍贯会进列传、进图鉴、还被稽古拿去出题(「谁是潁川人」),错的比没有更糟。
  // 只在头一句附近找(30 字):籍贯是传的第一句写的事,再往后就是别人的籍贯了
  const m = bioZh?.slice(0, 30).match(HOME_RE)
  if (m && !NOT_A_PLACE.test(m[1])) {
    entry.home = { zh: m[1], en: m[1] }
    tally.home++
  }
  const life = lifeOf(id, o)
  if (life) {
    entry.life = life
    tally.life++
  }
  // 性格特质:源头有就用源头的,没有就从生平原文抽(和播种用的是同一份,
  // 否则卡面上写着「嗜酒」而机制里按别的算,那就成了两套事实)
  const traits = HISTORICAL_TRAITS[id]?.length
    ? HISTORICAL_TRAITS[id].slice(0, 4)
    : traitsOf(bioOf(id)?.zh, o.name.zh)
  if (traits.length) {
    entry.traits = traits
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
// ---------- 史料关系网(从生平原文里互相点名抽出来)----------
//
// 【为什么值得单独做一层】
// 游戏里此前只有 31 条羁绊 + 29 对宿敌,覆盖 98 名武将(4.3%)——
// 而「谁和谁有关系」恰恰是这个题材唯一的护城河。
// 真实素材其实一直在眼前:**生平里点到名的那个人,就是一条有出处的关系**。
// 麋竺的传里写着糜芳、劉禪的传里写着諸葛亮、華歆的传里写着管寧。
// 实测能抽出 1,241 组、覆盖 657 名武将 —— 是现有羁绊的六倍多。
//
// 【为什么只做展示,不做羁绊光环】
// 羁绊是**带增益的机制**。几百条一次性上线,等于给六套预组白送强度,
// 会把刚调好的平衡再打一次(而且这一次是几百个来源,查都没法查)。
// 所以这一层只进图鉴与列传页:它回答「这个人和谁有关系」,不改任何数值。
// 将来要把其中一部分提成真羁绊,那是一次**人工挑选**,不是自动生成。
//
// 【关系类型怎么判】
// 看点到名字的那一句里有什么词 —— 这是有出处的判断,不是猜:
//   亲族(弟/兄/父/子/妻)· 君臣(從/事/佐/薦/舉)· 敵對(斬/敗/破/攻/拒/降)
//   交好(友/善/交/與…同)· 其余归「同时」(同一段历史里出现过)
interface RelEdge {
  a: string
  b: string
  kind: 'kin' | 'liege' | 'foe' | 'friend' | 'era'
  quote: string // 出处:点到名字的那一句原文
}

const REL_RULES: [RegExp, RelEdge['kind']][] = [
  // 亲族要求**明确的亲属结构**,不能只认单字:「起兵討董卓,挾天子以令諸侯」
  // 里的「子」来自「天子」,单字规则会把曹操和董卓判成亲族。
  // 异姓亲属单列一组:養子/女婿/外甥这些**写法本身就是明确的亲属结构**,
  // 不像单字「子」那样会认错人,所以不需要同姓这道保险
  //(霍去病是衛青外甥、劉封是劉備義子、李儒是董卓女婿、公冶長是孔子之婿)。
  // 从前它们一条都没进「亲族」,全被归成泛泛的「同时」。
  [/養子|义子|義子|之婿|女婿|外孫|外孙|外甥|繼子|继子|嗣子/, 'kin'],
  [/(之|族|從|親)(弟|兄|子|父|妻|女|母|叔|姪|孫)|兄弟|父子|夫人/, 'kin'],
  [/斬|敗|破|攻|拒|殺|降|叛|討|圍|擒/, 'foe'],
  [/從|事|佐|薦|舉|仕|歸|投|輔/, 'liege'],
  [/友|善|交|同坐|莫逆|結/, 'friend'],
]

const nameToId = new Map<string, string>()
for (const o of unique) {
  // 同名的人不建关系(2,400 张的池子里重名不少,连错了比不连更糟)
  if (nameToId.has(o.name.zh)) nameToId.set(o.name.zh, '')
  else nameToId.set(o.name.zh, o.id)
}
const edges: RelEdge[] = []
const seenEdge = new Set<string>()
for (const o of unique) {
  const bio = bioOf(o.id)?.zh
  if (!bio) continue
  // 按句号切句 —— 关系类型要看**点到名字的那一句**,整段扫会把无关的词算进来
  for (const sentence of bio.split(/[。;!?]/)) {
    for (const [name, otherId] of nameToId) {
      if (!otherId || otherId === o.id || name.length < 2) continue
      if (!sentence.includes(name)) continue
      const key = [o.id, otherId].sort().join('|')
      if (seenEdge.has(key)) continue
      seenEdge.add(key)
      // 在**名字附近**认词,而不是整句扫。
      // 「曹操之子,封濟陽公。從袁紹征…」整句里既有「子」又有「征」,
      // 整句扫会把关系判成亲族 —— 而那个「子」说的不是袁绍。
      // 取名字前后各 6 个字的窗口:关系词在中文里几乎总是紧挨着人名的
      //(「X 之弟」「從 X」「斬 X」「與 X 善」)。窗口里认不到就归「同时」。
      const at = sentence.indexOf(name)
      const win = sentence.slice(Math.max(0, at - 6), at + name.length + 6)
      let kind: RelEdge['kind'] = 'era'
      for (const [re, k] of REL_RULES) {
        if (re.test(win)) {
          kind = k
          break
        }
      }
      edges.push({ a: o.id, b: otherId, kind, quote: sentence.trim().slice(0, 40) })
    }
  }
}
const relPeople = new Set(edges.flatMap((e) => [e.a, e.b]))
const relKinds = edges.reduce<Record<string, number>>((m, e) => ({ ...m, [e.kind]: (m[e.kind] ?? 0) + 1 }), {})

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
    '// 史料关系网:生平原文里互相点名的那些人(只做展示,不给增益)',
    'export interface RelEdge {',
    '  a: string',
    '  b: string',
    "  kind: 'kin' | 'liege' | 'foe' | 'friend' | 'era'",
    '  quote: string',
    '}',
    `const relJson = ${JSON.stringify(JSON.stringify(edges))}`,
    'export const RELATION_EDGES = JSON.parse(relJson) as RelEdge[]',
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
console.log(
  `  史料关系网:${edges.length} 组,涉及 ${relPeople.size} 名武将 —— ` +
    Object.entries(relKinds)
      .map(([k, n]) => `${k} ${n}`)
      .join(' · '),
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
