// 单卡强度模拟 —— 量「这张牌进卡组之后,胜率动了多少」。
//
// 【为什么需要它】
// sim-balance 测的是**六套预组之间是否公平**,sim-campaign 测的是**关卡曲线**。
// 两个都不回答一个很基本的问题:**某一张具体的牌是强是弱**。
// 卡池有 2,261 张,其中 80% 带效果、定价靠一套点数公式 ——
// 那套公式从来没有被实测校准过,只被「六套预组打起来还算公平」间接背书。
//
// 【方法:替换法】
// 拿一套基准预组,把其中 N 张最普通的牌换成待测卡,与其余预组对打,
// 和**未替换的同一套牌**比胜率。差值就是这张牌的边际价值。
//   · 双方都用 AI_NORMAL(与另外两个 sim 同一把尺);
//   · 轮流先后手;
//   · 被换掉的是**费用最接近**的那张 —— 否则量到的是曲线变化,不是这张牌。
//
// 【怎么读结果 —— 零点是量出来的,不是 ±4】
// 这里以前写着「合理区间大约是 ±4 个百分点」。那个 ±4 是**估的**,没有依据。
// 2026-08-07 真去量了对照组(五张白板武将,纯身材,各 600 局):
//
//   張布 +6.5 · 薛珝 +3.5 · 朱然 −1.0 · 陳餘 −1.2 · 辛毗 −4.8   中位 −1.0
//
// 也就是说正常卡的跨度是 **−4.8 ~ +6.5**,比 ±4 宽。
// 拿 ±4 当线会把一批正常卡判成超模,照着改就是在削平卡池。
// (后手补偿落地之后重量:−3.2 ~ +6.7,中位 −1.3 —— **零点几乎没动**。
//  补偿推动了单张卡,没有推动尺子本身。)
//
//   CONTROL=1 GAMES=600 npm run sim-cards    # 重新量一次零点
//
// **每次全局规则改动之后都要重量** —— 挪没挪只能量,不能推。
// 后手补偿把十一张已经调平的卡整体推了一遍(姜維 +7.8 → +13.5),
// 「零点跟着动」是完全合理的猜测,而实测**它没动**。这就是量一次的价值。
//
// 噪声:60 局的标准差约 ±6 个点(600 局 ±2.0,而 Δ 是两次测量之差,再 ×√2)。
// **单张卡的单次测量不能下结论** —— 要么加样本量,要么看一批卡的分布。
//
// 运行:
//   npm run sim-cards                       # 抽样 12 张
//   CARDS=guan-yu,zhang-fei npm run sim-cards
//   COST=5 SAMPLE=20 GAMES=80 npm run sim-cards
//   CONTROL=1 GAMES=600 npm run sim-cards   # 对照组:量这把尺子的零点
import { PRECON_DECKS } from '../src/content/decks'
import { CARDS_BY_ID, COLLECTIBLE_CARDS } from '../src/content/cards'
import { applyKit, swapInto } from './deckSwap'
import { HEROES_BY_ID } from '../src/content/overrides/heroes'
import { parallelMap, defaultConcurrency, progress } from './parallel'
import { fileURLToPath } from 'node:url'
import { writeFileSync } from 'node:fs'
import type { CardTask } from './workers/cards.worker'
import type { CardDef } from '../src/engine/types'
import { opsOf } from './pricing'
import { band, pickControls } from './controlGroup'

const GAMES = Number(process.env.GAMES ?? 60)
const SAMPLE = Number(process.env.SAMPLE ?? 12)
const COPIES = Number(process.env.COPIES ?? 2)
const COST_FILTER = process.env.COST ? Number(process.env.COST) : null
const ONLY = (process.env.CARDS ?? '').split(',').map((s) => s.trim()).filter(Boolean)

// 【基准卡组按主义选,而不是永远用桃園仁德】
//
// 从前基准写死 `PRECON_DECKS[0]`(桃園仁德,王道),而待测卡的主义必须与基准兼容,
// 否则换进去是非法卡组 —— 于是这个脚本**只测得了王道与中立**,
// 霸道/礼教/名利/割据/隐逸的专属卡一张都没量过,那是六分之五的卡池。
//
// 现在按卡的主义挑对应主义的预组当基准,每套预组各算一份自己的基准胜率,
// Δ 相对**它自己那套**的基准算。
//
// **中立卡仍然固定用桃園仁德**:一是保持与历史数字可比(姜維 +29.2、簡雍 +17.0、
// 蘇飛 +14.0 都是在这套里量的),二是中立卡进哪套都合法,不固定的话
// 同一张卡换个心情就换个数,没法跨版本对比。
const DECK_OF_DOCTRINE = new Map<string, number>()
PRECON_DECKS.forEach((d, i) => {
  const doc = HEROES_BY_ID[d.heroId]?.doctrine
  if (doc && !DECK_OF_DOCTRINE.has(doc)) DECK_OF_DOCTRINE.set(doc, i)
})
const baseIdxFor = (card: CardDef): number =>
  card.doctrine === 'neutral' ? 0 : (DECK_OF_DOCTRINE.get(card.doctrine) ?? -1)

// 把 COPIES 张**费用最接近**的普通牌换成待测卡。
// 换费用最接近的那张很重要 —— 否则量到的是曲线变化,不是这张牌本身。
//
// 【但要记住 Δ 是个**差值**:被换掉的那张同样决定结果】
// 2026-08-07 逐套量对照组时撞到:同一张白板 4/7(陳餘)在 坐斷東南 里是 **−15.8**,
// 在 桃園仁德 里只有 −1.2。差别不在陳餘,在**它换掉了谁** ——
// 坐斷東南 的 5 费档正好是 王世充 和 陸抗,而 陸抗 单独量是 +21.5。
// 所以那个 −15.8 量的是陆抗的价值,不是陈馀的。
//
// 实践上:**深负的 Δ 要先看它换掉了什么再下结论**;
// 判一张卡强不强,看对照组的**中位**那条线(六套一致),别看跨度(逐套差三倍)。
// 【KIT:给「需要牌库配合」的条件用的第二把量法】
// 有一整类条件此前**结构性量不了**:`ifChain`(本回合结算过几张锦囊)、
// `ifSupply`(屯粮)、`ifHandCount`(手牌数)、`ifKeywordCount`(带某关键词的友方数)。
// 它们的前置条件不会自己发生,得**牌库里配着别的卡**;而这个脚本是单张换入,
// 于是量到的是「前置条件没出现」,不是「这张卡强不强」。第三十三卡包为此停过一次手。
//
// `KIT=<id,id>` 把配合卡**同时换进基准和待测两副牌**:
//   基准 = 预组 ⊕ KIT        待测 = 预组 ⊕ KIT ⊕ 待测卡
// 于是 Δ 隔离出来的是「**在有配合的前提下**这张卡值多少」—— 那才是这四个条件
// 唯一有意义的问法。KIT 里的卡进去之后**受保护**,待测卡不许把它们挤掉。
//
// ⚠️ KIT 下的 Δ **不能**和无 KIT 的历史数字直接比:基准换了一副牌。
// 换牌逻辑本身在 scripts/deckSwap.ts,那边有 12 条测试(它决定整把尺子量的是什么)。
const KIT = (process.env.KIT ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const unknownKit = KIT.filter((id) => !CARDS_BY_ID[id])
if (unknownKit.length) {
  console.error(`KIT 里有不认识的卡:${unknownKit.join(' · ')}`)
  process.exit(1)
}
const costOf = (id: string) => CARDS_BY_ID[id]?.cost ?? 99

/** 预组 ⊕ KIT。KIT 为空时就是预组本身。 */
function baseDeckOf(baseIdx: number): { deck: string[]; protect: Set<string> } | null {
  const raw = PRECON_DECKS[baseIdx].cardIds as string[]
  if (KIT.length === 0) return { deck: [...raw], protect: new Set() }
  return applyKit(raw, KIT, { copies: COPIES, costOf })
}

function swapIn(card: CardDef, baseIdx: number): string[] | null {
  const base = baseDeckOf(baseIdx)
  if (!base) return null
  return swapInto(base.deck, card.id, { copies: COPIES, costOf, protect: base.protect })
}

// 全池都能测了 —— 只要它的主义有对应的预组(六个主义各有一套,所以实际是全部)
const pool = COLLECTIBLE_CARDS.filter((c) => !c.token && baseIdxFor(c) >= 0)

// 【CONTROL=1:量对照组,也就是量这把尺子的零点】
//
// 这个脚本的注释长期写着「一张牌的合理区间大约是 ±4 个百分点」——
// 那个 ±4 是**估的**,从来没有东西支撑它。它错了会导致两类相反的错误:
// 估窄了 → 一堆正常卡被判成超模,照着改就是把卡池削平;估宽了 → 真超模的混过去。
//
// 零点只能量:拿一批**白板武将**(纯身材,见 controlGroup.isVanilla)
// 换进同一套预组,它们的 Δ 分布就是「正常卡长什么样」。
// 2026-08-07 实测是 `−4.8 ~ +6.5,中位 −1.0`,不是 ±4。
//
// **每次全局规则改动之后都要重量一次** —— 同一天落地的后手补偿把十一张
// 已经调平的卡整体推了一遍(姜維 +7.8 → +13.5),零点当然也跟着动了。
// 做成一条命令就是为了让「重量一次」便宜到没有理由跳过。
const CONTROL = process.env.CONTROL === '1'
const CONTROL_COSTS = [2, 3, 4, 5, 6]

// 【BASE=<0..5>:把基准钉在指定那套预组上】
//
// Δ 是**相对所在卡组**量的 —— 同一张卡换进不同的预组,数字可以差很远。
// 2026-08-07 撞到一个例子:陸抗(5 费 3/6 守护)换进 坐斷東南 是 **+21.5**,
// 而它在费用曲线上还偏低。那不是「这张卡超模」,是那套牌缺守护缺到这个地步。
//
// 于是有个问题必须回答:**每套预组的零点是不是同一个?**
// 如果 坐斷東南(六套里最弱的一套)随便换张能打的进去都 +10,
// 那么「在 坐斷東南 里量到 +21.5」和「在 桃園仁德 里量到 +21.5」根本不是一件事。
//
// 中立白板卡在**每套预组里都合法**,所以拿同一批控制卡逐套量一遍就能答 ——
// 那正是 BASE 存在的理由。只在 CONTROL 模式下生效(别的卡有主义限制)。
const BASE = process.env.BASE ? Number(process.env.BASE) : null

let targets: CardDef[]
if (CONTROL) {
  targets = pickControls(pool, CONTROL_COSTS)
} else if (ONLY.length > 0) {
  targets = ONLY.map((id) => CARDS_BY_ID[id]).filter(Boolean)
} else {
  const filtered = COST_FILTER === null ? pool : pool.filter((c) => c.cost === COST_FILTER)
  // 确定性抽样:按 collectorNo 等距取,而不是 Math.random —— 两次跑要能对比
  const stride = Math.max(1, Math.floor(filtered.length / SAMPLE))
  targets = filtered.filter((_, i) => i % stride === 0).slice(0, SAMPLE)
}

console.log(
  `sim-cards: 每张换入 ${COPIES} 份,${GAMES} 局/张,共 ${targets.length} 张` +
    `(基准按主义选,中立卡固定用「${PRECON_DECKS[0].name.zh}」)\n`,
)
if (KIT.length) console.log(`  ⚠ KIT=${KIT.join(' · ')} —— 基准与待测**都**带这套配合卡,Δ 不可与无 KIT 的历史数字直接比
`)
const t0 = performance.now()

// 对局本体在 workers/cards.worker.ts。任务粒度就是「一副牌」——
// 每张待测卡跑的局数、对手轮转、种子序列完全相同,所以任务天然等长,
// 不必像 sim-campaign / sim-firstplayer 那样再往下切段。
//
// 基准也当成一个普通任务丢进去(排在第 0 位),这样它和待测卡走的是同一条路径,
// 不会出现「基准用串行、待测用并行」这种最难查的不对称。
const WORKER = fileURLToPath(new URL('./workers/cards.worker.ts', import.meta.url))
const buildable: { card: CardDef; deck: string[]; baseIdx: number }[] = []
for (const card of targets) {
  // CONTROL+BASE:把基准钉死在指定预组(中立白板卡进哪套都合法)
  const baseIdx = CONTROL && BASE !== null ? BASE : baseIdxFor(card)
  const deck = swapIn(card, baseIdx)
  if (!deck) {
    console.log(`  ${card.name.zh} —— 换不进去(基准里没有足够的可换牌)`)
    continue
  }
  buildable.push({ card, deck, baseIdx })
}

// 用到哪几套基准就只算哪几套的基准胜率 —— 只测王道卡时不必把六套都跑一遍
const usedBases = [...new Set(buildable.map((b) => b.baseIdx))].sort((a, b) => a - b)
const jobs: CardTask[] = [
  // 基准也吃同一份 KIT —— 否则 Δ 量的是「配合卡本身值多少」,不是待测卡。
  ...usedBases.map((i) => ({ deck: baseDeckOf(i)!.deck, baseIdx: i, games: GAMES })),
  ...buildable.map((b) => ({ deck: b.deck, baseIdx: b.baseIdx, games: GAMES })),
]
const out = await parallelMap<CardTask, { wins: number; played: number }>(
  WORKER,
  jobs,
  progress(`${jobs.length} 副牌`),
  process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
)
const pct = (r: { wins: number; played: number }) => (100 * r.wins) / Math.max(1, r.played)

const baselineOf = new Map<number, number>()
usedBases.forEach((i, k) => baselineOf.set(i, pct(out[k])))
for (const i of usedBases) {
  console.log(`基准胜率 ${PRECON_DECKS[i].name.zh}: ${baselineOf.get(i)!.toFixed(1)}%`)
}
console.log('')

const rows: { card: CardDef; rate: number; delta: number; baseIdx: number }[] = buildable.map(
  (b, i) => {
    const rate = pct(out[usedBases.length + i])
    // Δ 相对**这张卡自己那套基准** —— 跨主义比较的是 Δ,不是绝对胜率
    return { card: b.card, rate, delta: rate - baselineOf.get(b.baseIdx)!, baseIdx: b.baseIdx }
  },
)

rows.sort((a, b) => b.delta - a.delta)
console.log('卡名            费用  胜率    Δ      基准')
for (const r of rows) {
  const sign = r.delta >= 0 ? '+' : ''
  console.log(
    `${r.card.name.zh.padEnd(12, '　')} ${String(r.card.cost).padStart(3)}  ` +
      `${r.rate.toFixed(1)}%  ${(sign + r.delta.toFixed(1)).padStart(5)}  ` +
      `${PRECON_DECKS[r.baseIdx].name.zh}`,
  )
}

console.log(`\n(${((performance.now() - t0) / 1000).toFixed(1)}s)`)

// 对照组模式:把跨度打出来 —— 那就是「正常卡长什么样」
if (CONTROL) {
  const b = band(rows.map((r) => r.delta))
  console.log(
    `\n对照组(白板武将,纯身材)@${PRECON_DECKS[usedBases[0]].name.zh}:${b.n} 张,` +
      `Δ 跨度 ${b.lo.toFixed(1)} ~ ${b.hi.toFixed(1)},中位 ${b.median.toFixed(1)}`,
  )
  console.log(
    '  **这就是这把尺子的零点。** 判一张卡超不超模,拿它和这个跨度比,' +
      '\n  而不是和一个拍出来的 ±4 比。全局规则一改就重量一次:' +
      '\n  CONTROL=1 GAMES=600 npm run sim-cards',
  )
}

// 【DUMP=<路径>:把每张卡的实测 Δ 落盘】
// 这份数据是 price-cards **唯一可能的外部真值**。那张定价表现在是从卡池反推卡池的
// (注释自己承认「数值取自同类卡的实际定价」),所以卡池里一整类效果定价偏低时,
// 它会忠实地把这个偏差学过来,再拿去给新卡定价 —— 一个闭环。
// 这里的 Δ 来自对局结果,不在那个环里。scripts/fit-price.ts 拿它当拟合目标。
if (process.env.DUMP) {
  const path = process.env.DUMP
  writeFileSync(
    path,
    JSON.stringify(
      {
        games: GAMES,
        copies: COPIES,
        cards: rows.map((r) => ({
          id: r.card.id,
          name: r.card.name.zh,
          cost: r.card.cost,
          rate: r.rate,
          delta: r.delta,
          base: PRECON_DECKS[r.baseIdx].name.zh,
        })),
      },
      null,
      1,
    ),
  )
  console.log(`已写出 ${rows.length} 张的实测 Δ → ${path}`)
}

// ---------- 怎么读这份清单 ----------
//
// 【原来这里是 `Math.abs(delta) > 4`,一个和样本量、和比较次数都无关的阈值】
// 2026-08-04 用 SAMPLE=400 扫了一遍,它报「偏离超过 ±4 的 235 张」。
// 算一下就知道那是什么:60 局时**差值**的标准误约 9 个点(两次测量各 ±6.5,相加开方),
// 纯噪声下 |Δ|>4 的概率就有五成多 —— 400 张里报 235 张,和随机数几乎无法区分。
// 一份「六成的卡都上榜」的异常清单,读的人只会从头到尾挑自己本来就想改的那几张。
//
// 还有第二层,比噪声更容易被忽略:**这是 400 次比较**。
// 哪怕每张卡都严格按 z>2 判定,400 次里也会有约 18 张纯属偶然上榜。
// 所以这里按族错误率(Bonferroni)给一条更高的线:z > ~3.5 时,
// 400 次比较里出现一个假阳性的概率才降到 5% 左右。
//
// 结论是这个脚本**只配当筛子,不配当判决**:它的用途是从两千多张里
// 挑出几张值得用大样本复测的,而不是产出一份「该改这些卡」的清单。
// 所以下面分两档报,并且把该跑的复测命令直接打出来。
const seDelta = Math.sqrt(2 * (0.25 / GAMES)) * 100 // 两次独立测量之差的标准误
const zOf = (d: number) => Math.abs(d) / seDelta
const bonferroniZ = rows.length > 1 ? Math.sqrt(2) * erfInv(1 - 0.05 / rows.length) : 2

console.log(
  `\n噪声:每次测量 ±${(50 / Math.sqrt(GAMES)).toFixed(1)} 个点,` +
    `而榜上的 Δ 是**两次测量之差**,标准误 ±${seDelta.toFixed(1)}。\n` +
    `本次比较了 ${rows.length} 张 —— 按族错误率校正后,` +
    `要 |Δ| > ${(bonferroniZ * seDelta).toFixed(1)} 才算真的越界(z > ${bonferroniZ.toFixed(1)})。`,
)

const strong = rows.filter((r) => zOf(r.delta) > bonferroniZ)
const weak = rows.filter((r) => zOf(r.delta) <= bonferroniZ && Math.abs(r.delta) > 4)

if (strong.length > 0) {
  console.log(`\n✗ 越过校正线的 ${strong.length} 张(**这几张单独拎出来也站得住**):`)
  for (const r of strong) {
    console.log(
      `  ${r.card.name.zh} (${r.card.id}) ${r.delta > 0 ? '+' : ''}${r.delta.toFixed(1)}` +
        `  z=${zOf(r.delta).toFixed(1)}`,
    )
  }
}
if (weak.length > 0) {
  console.log(
    `\n另有 ${weak.length} 张 |Δ|>4 但没越过校正线 —— ` +
      `纯随机下就会有约 ${Math.round(rows.length * 0.54)} 张落在这里,**别照着这一档改卡**。`,
  )
}

// 【但「没越过校正线」不等于「里面没东西」】
//
// 校正线回答的是「这一张单独拎出来能不能宣布异常」,而**排序本身仍然有信号**。
// 2026-08-04 实测:400 张 / 60 局那一跑一张都没越过线(线在 |Δ|>35),
// 可把榜首六张拿去 600 局复测,正的三张全是真的:
//   姜維 +28.3 → +29.2 · 簡雍 +16.7 → +17.0 · 蘇飛 +20.0 → +14.0
// 负的三张则整齐地塌回去(-16.7 → -5.7 / -16.7 → -5.8 / -18.3 → -7.7)——
// 典型的均值回归:它们是**因为极端才被选中**的,噪声把它们吹大了。
//
// 所以这个脚本的正确用法是**两段式**:小样本扫全池排个序,再把榜首拿去大样本复测。
// 无论有没有越线,都把复测命令打出来 —— 让「宣布不了」不至于被读成「没东西」。
const CANDIDATES = Number(process.env.CANDIDATES ?? 6)
const top = [...rows]
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  .slice(0, CANDIDATES)

// `VERIFY=<局数>` 直接把第二段接上跑,不用人手复制命令。
//
// 【为什么值得固化成一条命令】
// 这个两段式协议我手工走过两遍,两次的教训都一样:**第一段的结论不能信**。
//   · 王道那一跑榜首六张,复测后三张塌回去(-16.7 → -5.7 这种)
//   · 全池那一跑榜首六张,复测后一张没塌
// 两次都得复测才知道是哪种。靠人记得去跑第二段,迟早会有一次忘了 ——
// 而忘了的那次,读到的就是一份掺着均值回归的「异常清单」。
const VERIFY = process.env.VERIFY ? Number(process.env.VERIFY) : 0
if (top.length > 0 && !VERIFY) {
  console.log(
    `\n下一步:榜单**排序有信号,单张判决没有**。把榜首 ${top.length} 张拿去大样本复测 ——\n` +
      `  VERIFY=600 npm run sim-cards        # 接着这一跑自动复测\n` +
      `  CARDS=${top.map((r) => r.card.id).join(',')} GAMES=600 npm run sim-cards   # 或手动\n` +
      `复测后仍然大的才当真;塌回去的那些是均值回归,本来就不存在。`,
  )
} else if (top.length > 0) {
  console.log(`\n---- 第二段:榜首 ${top.length} 张按 ${VERIFY} 局复测 ----`)
  const vJobs: CardTask[] = [
    ...usedBases.map((i) => ({
      deck: [...PRECON_DECKS[i].cardIds] as string[],
      baseIdx: i,
      games: VERIFY,
    })),
    ...top.map((r) => {
      const b = buildable.find((x) => x.card.id === r.card.id)!
      return { deck: b.deck, baseIdx: b.baseIdx, games: VERIFY }
    }),
  ]
  const vOut = await parallelMap<CardTask, { wins: number; played: number }>(
    WORKER,
    vJobs,
    progress(`${vJobs.length} 副牌`),
    process.env.JOBS ? Number(process.env.JOBS) : defaultConcurrency(),
  )
  const vBase = new Map<number, number>()
  usedBases.forEach((i, k) => vBase.set(i, pct(vOut[k])))
  const vSe = Math.sqrt(2 * (0.25 / VERIFY)) * 100

  console.log(`\n卡名            筛选 Δ   复测 Δ    z     判定`)
  for (let k = 0; k < top.length; k++) {
    const r = top[k]
    const b = buildable.find((x) => x.card.id === r.card.id)!
    const vDelta = pct(vOut[usedBases.length + k]) - vBase.get(b.baseIdx)!
    const z = Math.abs(vDelta) / vSe
    // 复测样本大得多,这里不必再做多重比较校正:候选是**上一段选出来的**,
    // 不是从两千张里现挑的,比较次数就是这几张。
    const verdict =
      z > 2
        ? Math.sign(vDelta) === Math.sign(r.delta)
          ? '✓ 站得住'
          : '⚠ 方向反了'
        : '× 塌回噪声里(均值回归)'
    console.log(
      `${r.card.name.zh.padEnd(12, '　')} ` +
        `${((r.delta >= 0 ? '+' : '') + r.delta.toFixed(1)).padStart(6)}  ` +
        `${((vDelta >= 0 ? '+' : '') + vDelta.toFixed(1)).padStart(6)}  ` +
        `${z.toFixed(1).padStart(5)}   ${verdict}`,
    )
  }
  console.log(
    `\n复测标准误 ±${vSe.toFixed(1)}(筛选那一段是 ±${seDelta.toFixed(1)})。\n` +
      `**只有「站得住」那几张值得动**;塌回去的是均值回归 —— 它们是因为极端才被选中的。`,
  )
}

// ---------- 按效果归组:把这个脚本变成 price-cards 的校准器 ----------
//
// 【为什么要这一段】
// 单张卡的 Δ 噪声太大(60 局时标准误 ±9.1),所以上面那份榜单只能当筛子。
// 但**把同一种效果的卡放在一起平均**,噪声就按 √n 缩小:20 张卡的均值标准误
// 只有 2.0pp —— 足够看出「这个 op 被系统性低估了几个点」。
//
// 这正是 price-cards 一直缺的东西。它的 `opValue` 是一张**拍出来的点数表**
// (注释里写着「数值取自同类卡的实际定价」,也就是从现状反推现状),
// 从来没有被实测校准过。而 2026-08-05 的证据表明它至少在一类效果上是错的:
//   弹回一名敌将  簡雍 +17.0 · 鄭厲公 +15.5
//   全体敌将 2 点  蘇飛 +14.0 · 項伯  +16.7
// 两组独立的同形状效果各自落在同一区间,而定价表把其中大部分评为「正好在曲线上」。
//
// 【怎么读】
// 这里的均值**不是「这个 op 值多少分」**,而是「带这个 op 的卡整体偏强/偏弱多少」。
// 一个 op 的均值显著为正,意味着定价表给它的分数偏低(卡因此定价偏便宜)。
// 样本少的不列 —— 三五张卡的均值还是噪声。
// opsOf 在 scripts/pricing.ts —— fit-price 的归组版要用**同一份**定义。
// 两边各写一遍的话,有一天一边加了新触发时机、另一边没加,
// 两份报表对同一张卡的归属就悄悄分叉了,而且谁都不会红。

const MIN_N = 5
const byOp = new Map<string, number[]>()
for (const r of rows) {
  for (const op of opsOf(r.card)) {
    const arr = byOp.get(op) ?? []
    arr.push(r.delta)
    byOp.set(op, arr)
  }
}

// 【和「全池均值」比,不是和 0 比】
// 基准胜率**只测了一次**,是所有 Δ 共用的一个常数项。跟 0 比就把基准那一次测量的
// 误差也算进了每个 op 头上;跟全池均值比,这个共同项直接抵消。
// 实测(1200 张):全池均值 +0.58,接近 0 —— 也就是说「有效果的卡整体强于白板」
// 这个可能的混淆**不存在**,但代码不能依赖它恰好为零。
const poolMean = rows.reduce((a, r) => a + r.delta, 0) / Math.max(1, rows.length)

// 【用实测的卡间标准差,不是理论噪声】
// seDelta(=√2·√(0.25/GAMES))是把两次测量都当 p=0.5、且互相独立算出来的上界。
// 实测 1200 张的标准差只有 7.6(理论 9.1)—— 因为基准是共用的、不贡献离散度。
// 用实测值更准;样本太少时退回理论值,免得被几张卡的偶然一致骗成"极显著"。
const spread = (() => {
  if (rows.length < 30) return seDelta
  const v = rows.reduce((a, r) => a + (r.delta - poolMean) ** 2, 0) / rows.length
  return Math.sqrt(v)
})()

const opStats = [...byOp.entries()]
  .filter(([, ds]) => ds.length >= MIN_N)
  .map(([op, ds]) => {
    const mean = ds.reduce((a, b) => a + b, 0) / ds.length
    return { op, n: ds.length, mean, se: spread / Math.sqrt(ds.length) }
  })
  .sort((a, b) => b.mean - a.mean)

if (opStats.length > 0) {
  console.log(
    `\n---- 按效果归组(≥${MIN_N} 张才列)----\n` +
      `单张卡的 Δ 噪声太大,但同一种效果的卡放在一起平均,噪声按 √n 缩小。\n` +
      `**均值显著高于全池 = 定价表给这个 op 的分数偏低**,带它的卡因此偏便宜。\n` +
      `全池均值 ${poolMean >= 0 ? '+' : ''}${poolMean.toFixed(1)}(${rows.length} 张),` +
      `卡间标准差 ±${spread.toFixed(1)} —— z 是相对全池均值算的。\n`,
  )
  console.log('效果               张数   平均 Δ    z')
  for (const s of opStats) {
    const z = (s.mean - poolMean) / s.se
    const flag = Math.abs(z) > 2 ? (z > 0 ? '  ← 偏低' : '  ← 偏高') : ''
    console.log(
      `${s.op.padEnd(18)} ${String(s.n).padStart(4)}  ` +
        `${(s.mean >= 0 ? '+' : '') + s.mean.toFixed(1)}`.padStart(7) +
        `  ${z.toFixed(1).padStart(5)}${flag}`,
    )
  }
  console.log(
    `\n拿它去校准 scripts/price-cards.ts 的 opValue —— 那张表至今是拍出来的\n` +
      `(它的注释说「数值取自同类卡的实际定价」,也就是从现状反推现状,从没被实测校准过)。\n` +
      `⚠️ 但**别直接把这一列当成新分值**:这里量的是「带这个 op 的卡整体偏强多少」,\n` +
      `   不是「这个 op 本身值多少分」。一张卡常常带好几个 op,归组时它在每一组里都算一次。\n` +
      `   正确用法是拿它定**方向与量级**,改完再跑一遍看排序有没有更贴近实测。`,
  )
}

// 逆误差函数:只为算 Bonferroni 的 z 阈值。Acklam 有理逼近,精度远超这里的需要。
function erfInv(x: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const p = (x + 1) / 2
  const pLow = 0.02425
  let q: number
  let r: number
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) / Math.SQRT2
  }
  if (p <= 1 - pLow) {
    q = p - 0.5
    r = q * q
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1) / Math.SQRT2
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1) / Math.SQRT2
}
