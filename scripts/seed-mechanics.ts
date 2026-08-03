// 机制播种 —— 从五维属性画像生成关键词与效果。
//
// 【为什么单独成一个模块】
// 原来这套逻辑是 import-content.ts 里的一串 if-else 阶梯:谋士线 8 个分支、武将线 5 个。
// 阶梯的结构性毛病是**靠前的宽条件分支会把后面的人全吃光** —— 实测下来:
//   · 2233 张武将里 **268 张都是「戰吼:抽一張牌」**(就是 `int>=78 && roll<0.58` 那条);
//   · 1238 张有效果的卡只用出了 **121 种效果形状**;
//   · 724 张(32%)什么都没有;
//   · 而引擎支持的触发器有十来种,其中 endOfTurn / startOfTurn / onAttack / onDamaged /
//     onSpellCast / enrage / aura / combo / choose / overload **一个都没被播种过**。
//
// 现在改成**加权候选池**:每个候选自带「属性条件 + 权重 + 定价 + 生成器」,
// 命中条件的候选一起参与一次加权抽签。三个好处:
//   1. 没有分支能吃光别人 —— 份额由权重显式决定,想调哪个调哪个;
//   2. 加一种玩法只是往数组里加一条,不必重排整条阶梯;
//   3. 可以按**时代**给候选加权 —— 于是先秦多谋略、宋元多城防、明清多火器。
//      **时代特性因此落在播种层,一行引擎代码都不用动。**
//
// 三条老原则原样保留(它们是对的):
//   · **确定性**:一切随机走 id 的 FNV-1a 哈希,不用 Math.random。脚本必须幂等。
//   · **要付账**:关键词与效果一律从身材预算里扣点数(1 攻 = 1 点、1 血 = 0.8 点),
//     不是白送 —— 否则等于给全池加强度,平衡直接崩。
//   · **留白板**:约一成保持纯白板、另有一成只带关键词。简单牌是曲线的骨架,不是缺陷。

// ⚠️ **改这个文件目前无法验证。**
// 它的产物要靠 `npm run import-content` 落地,而那个脚本现在会毁掉已提交的
// 卡池(少 185 张、白板率 8.9%→29.5%、立绘缩水)—— 详见 import-content.ts 头部。
//
// 下面两处改动(2026-07)因此是**已写好但未生效**的:
//   1. 放宽 duel / windfury 的准入 —— 实测全池只有 14 / 9 张,而同为 2 点定价的
//      剧毒有 39 张;差别不在定价,在 when 卡得极窄(單挑限三国、連擊限隋唐)。
//   2. 新增「高费守护」候选 —— 六套预组各有 33-47% 的格子被同样七张牌占着,
//      而那几张身材只在同费池第 31-51 百分位,共同点只有 guard:
//      带守护的高费随从池太薄,六套只能抢同样这几张。
// 等源头问题解决后重跑 import-content + 全部平衡闸门,这两条才会真的生效。

import type { DynastyTag, Rarity } from '../src/engine/types'
import { toSimplified } from '../src/ui/zhVariant'

export interface Stats {
  leadership: number
  war: number
  intelligence: number
  politics: number
  charisma: number
}

// FNV-1a:同一个 (id, salt) 永远得到同一个 [0,1)
export function hash01(id: string, salt: string): number {
  let h = 0x811c9dc5
  const s = `${id}#${salt}`
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h / 0x100000000
}

// ---------- 时代块 ----------
// 定义搬到了 src/content/eras.ts —— 战前檄文也要用它,而 src 不能 import scripts。
// 方向:内容层是真相,这个构建期脚本是消费者。
export { ERA_OF } from '../src/content/eras'
export type { Era } from '../src/content/eras'

// ---------- 定价表 ----------

export const KEYWORD_POINTS: Record<string, number> = {
  charge: 2,
  rush: 1,
  guard: 1.5,
  windfury: 2,
  lifesteal: 1.5,
  stealth: 1,
  duel: 2,
  // 新开的三个:此前引擎支持但播种器从没发过
  poison: 2, // 剧毒:任何伤害必杀 —— 低攻身上尤其强
  divineShield: 1.5, // 铁壁:抵消下一次伤害
  trample: 1, // 碾压:溢出伤害穿透主公
}

export const KEYWORD_TEXT: Record<string, { zh: string; en: string }> = {
  charge: { zh: '衝鋒。', en: 'Charge.' },
  rush: { zh: '突襲。', en: 'Rush.' },
  guard: { zh: '守護。', en: 'Guard.' },
  windfury: { zh: '連擊。', en: 'Windfury.' },
  lifesteal: { zh: '吸血。', en: 'Lifesteal.' },
  stealth: { zh: '潛行。', en: 'Stealth.' },
  duel: { zh: '單挑。', en: 'Duel.' },
  poison: { zh: '劇毒。', en: 'Poisonous.' },
  divineShield: { zh: '鐵壁。', en: 'Divine Shield.' },
  trample: { zh: '碾壓。', en: 'Trample.' },
}

// ---------- 播种结果 ----------

type Ops = { ops: unknown[] }

export interface Seeded {
  keywords: string[]
  battlecry?: Ops
  deathrattle?: Ops
  endOfTurn?: Ops
  startOfTurn?: Ops
  onAttack?: Ops
  onDamaged?: Ops
  onSpellCast?: Ops
  combo?: Ops
  aura?: { scope: 'friendlyOthers' | 'friendlyAll'; attack: number; health: number }
  choose?: { modes: { label: { zh: string; en: string }; script: Ops }[] }
  enrage?: number
  overload?: number
  spellDamage?: number
  points: number
  textZh: string[]
  textEn: string[]
  /** 命中的候选 key —— 只给统计用,不进卡面 */
  shape: string | null
}

const RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 }

interface Ctx {
  id: string
  s: Stats
  archetype: 'warrior' | 'strategist'
  rarity: Rarity
  era: Era
  dynasty: DynastyTag
  cost: number
  budget: number
  mag: number
  kw: string | null
  // 事迹标签(见 DEED_WORDS)。下面有一整批**只由事迹开门**的候选 ——
  // 它们不看五维,因为那批人五维本来就低,看五维他们永远够不着任何候选。
  deeds: string[]
  // 性格特质(见 TRAIT_WORDS)。第二条轴,加成比事迹低一档。
  traits: string[]
}

interface Cand {
  key: string
  points: number
  /** 相对份额,缺省 1。命中条件的候选一起抽签,权重决定谁多谁少 */
  weight?: number
  /** 最低稀有度 —— 强效果不该在普通卡上批量出现 */
  minRank?: number
  when: (c: Ctx) => boolean
  /** 属于这些时代时权重放大(时代风味) */
  eras?: Era[]
  /** 只在这些时代出现(独占风味,用得克制) */
  only?: Era[]
  emit: (o: Seeded, c: Ctx) => void
}

// 时代命中时的权重倍率。2.4 是试出来的:再高会让同一时代的卡雷同,
// 再低则玩家感觉不到时代差别。
const ERA_BOOST = 2.4

// 势力精锐兵:同一段「召唤一个精锐」的文本,按势力换成各自的招牌部队。
// 这是白捡的风味 —— 曹魏出虎豹骑、蜀汉出白毦兵、东吴出丹阳兵。
function eliteToken(d: DynastyTag): { defId: string; zh: string; en: string; pts: number } {
  switch (d) {
    case 'wei':
      return { defId: 'token-hubao-qi', zh: '2/1 的虎豹騎(衝鋒)', en: 'a 2/1 Tiger-Leopard Rider with Charge', pts: 2.5 }
    case 'shu':
      return { defId: 'token-baimao-bing', zh: '2/2 的白毦兵', en: 'a 2/2 White-Plume Guard', pts: 2 }
    case 'wu':
      return { defId: 'token-danyang-bing', zh: '1/3 的丹陽兵(守護)', en: 'a 1/3 Danyang Levy with Guard', pts: 2.2 }
    default:
      return { defId: 'token-tie-qi', zh: '2/2 的鐵騎', en: 'a 2/2 Ironclad Rider', pts: 2 }
  }
}

const t = (o: Seeded, zh: string, en: string) => {
  o.textZh.push(zh)
  o.textEn.push(en)
}

// ---------- 关键词候选池 ----------
//
// 和效果一样改成加权池。此前是「命中即停」的有序阶梯,后面的关键词几乎发不出去
// (剧毒/铁壁/碾压压根不在池子里)。

type KwCtx = Pick<Ctx, 'id' | 's' | 'archetype' | 'rarity' | 'era' | 'dynasty' | 'cost'>

interface KwCand {
  kw: string
  weight: number
  when: (c: KwCtx) => boolean
  eras?: Era[]
}

const KEYWORD_POOL: KwCand[] = [
  // —— 通用画像 ——
  // 【2026-07 放宽了 duel / windfury 的准入】
  // 实测全池:連擊只有 9 张、單挑 14 张,而同为 2 点定价的剧毒有 39 张。
  // 差别不在定价,在这两条的 when 卡得极窄 —— 單挑要「war≥90 且武将且稀有以上
  // 且**仅三国**」,連擊要「war≥86 且 int<66 且**仅隋唐**」(隋唐全池才 342 张)。
  // 而讲堂给它们各写了一条词条,玩家读得到规则却几乎抽不到卡。
  // 放宽的方向是**开时代**而不是降门槛:单挑本来就该是三国之外也有的事
  // (先秦的致师、秦汉的斗将),連擊给到高武的猛将而不限朝代。
  { kw: 'duel', weight: 5, when: (c) => RANK[c.rarity] >= 1 && c.s.war >= 88 && c.archetype === 'warrior', eras: ['three-kingdoms', 'pre-qin', 'qin-han'] },
  { kw: 'windfury', weight: 4, when: (c) => c.s.war >= 84 && c.s.intelligence < 70, eras: ['sui-tang', 'three-kingdoms', 'song-yuan'] },
  { kw: 'charge', weight: 5, when: (c) => c.s.war >= 86 && c.archetype === 'warrior', eras: ['qin-han', 'sui-tang', 'song-yuan'] },
  { kw: 'rush', weight: 6, when: (c) => c.s.war >= 70 && c.archetype === 'warrior' },
  { kw: 'guard', weight: 5, when: (c) => c.s.leadership >= 74, eras: ['song-yuan', 'ming-qing'] },
  // 兜底:上面全够不着的普通人物(偏将、文吏)也该有一件小本事,
  // 否则 1-3 费段整段没有关键词 —— 而那一段占全池四成。
  { kw: 'rush', weight: 2, when: (c) => c.s.war >= 60 },
  { kw: 'guard', weight: 2, when: (c) => c.s.leadership >= 62 },
  // 【高费守护】六套预组各有 33-47% 的格子被同样七张牌占着,其中四张
  // (藤甲/明光鎧/王平/程普那一类)六套全带满两份。而它们**并不超模** ——
  // 身材落在同费池第 31-51 百分位。共同点只有一个:guard。
  // 根因是**带守护的高费随从池太薄**(5 费以上同费池里只有 15-20% 带守护),
  // 六套只能抢同样这几张。这一条专门补那一段。
  { kw: 'guard', weight: 6, when: (c) => c.cost >= 5 && c.s.leadership >= 66 },
  { kw: 'stealth', weight: 4, when: (c) => c.s.intelligence >= 78 && c.s.politics < 72, eras: ['pre-qin'] },
  { kw: 'lifesteal', weight: 2, when: (c) => c.s.charisma >= 84 },
  // —— 新开的三个 ——
  // 剧毒:刺客与用毒者的画像 —— 高智低政、或武力平平却致命。先秦刺客最典型。
  { kw: 'poison', weight: 3, when: (c) => c.s.intelligence >= 68 && c.s.war < 82 && c.s.politics < 70, eras: ['pre-qin'] },
  // 铁壁:重甲与名城守将 —— 统率高、稀有以上。宋元的城防、明清的边军。
  { kw: 'divineShield', weight: 4, when: (c) => RANK[c.rarity] >= 1 && c.s.leadership >= 80, eras: ['song-yuan', 'ming-qing'] },
  // 碾压:大兵团正面推平 —— 高武高统的方面军统帅。秦汉远征、蒙古西征。
  { kw: 'trample', weight: 4, when: (c) => c.s.war >= 82 && c.s.leadership >= 78, eras: ['qin-han', 'song-yuan'] },
]

export function seedKeyword(id: string, s: Stats, archetype: string, rarity: Rarity, era: Era, dynasty: DynastyTag, cost = 4, deeds: string[] = [], traits: string[] = []): string | null {
  // 约 44% 的卡带关键词(此前约三分之一)。
  //
  // 【这道闸门刻意**不因事迹放宽**】试过放宽到 0.62,冒险模式当场塌了:
  // 带关键词/效果的卡多了 5 个百分点,平均身材从 7.53 掉到 7.29,
  // 而**关底 Boss 的牌是从全池切的、由贪心 AI 驾驶** —— 对它来说身材远重于效果
  // (实测:「6/6 白板」换成「4/6 守护+光环」,预组总胜率反而从 38% 掉到 36%)。
  // 于是郑成功从 18% 变成 67%,连 tune-campaign 都调不回来(每档都 80%+)。
  //
  // 结论:事迹只改**选哪一个**,不改**有多少个**。构成不变,难度曲线才不动。
  if (hash01(id, 'kwgate') >= 0.44) return null
  const ctx: KwCtx = { id, s, archetype: archetype as Ctx['archetype'], rarity, era, dynasty, cost }
  const live = KEYWORD_POOL.filter((k) => k.when(ctx))
  if (live.length === 0) return null
  const want = deedWants(deeds, traits)
  const w = live.map(
    (k) => k.weight * (k.eras?.includes(era) ? ERA_BOOST : 1) * (want.kw.get(k.kw) ?? 1),
  )
  const total = w.reduce((a, b) => a + b, 0)
  let r = hash01(id, 'kwpick') * total
  for (let i = 0; i < live.length; i++) {
    r -= w[i]
    if (r <= 0) return live[i].kw
  }
  return live[live.length - 1].kw
}

// ---------- 事迹标签(第一次让播种「有出处」) ----------
//
// 【为什么要有它】
// 播种此前完全由五维 + 哈希决定:同一个费用档、同一类属性画像 → 同一套效果。
// 实测 2,258 名武将里 55.6% 有「机制双胞胎」(除名字与立绘外完全一样),
// 最大的一组 28 张全是 1 费 1/2 白板谋士 —— 麋竺、劉禪、華歆在牌桌上是同一张牌。
// 而这三个人的生平天差地别:一个散尽家财、一个乐不思蜀、一个割席分坐。
//
// 【做法】
// 从**真实生平原文**里认词,认到的词是这个人身上真的发生过的事;
// 事迹标签再去抬对应机制的权重。于是播种从「加权随机」变成
// **「有出处的确定性」** —— 同样是 1 费谋士,散财的和降敌的不再是同一张牌。
//
// 【为什么是抬权重而不是直接指定】
// 直接指定会让一个标签下的几百人**又变成同一张牌**(把重复从属性搬到标签上)。
// 抬权重保留了哈希的分散性:同为「守城」的人仍会拿到不同的守御类效果。
// 抬多少是个平衡问题 —— DEED_BOOST 取 6,实测足够把命中率从「随缘」拉到「大概率」,
// 又不至于让同标签的人塌成一张牌。
export const DEED_BOOST = 6

// 词 → 性格特质。和事迹标签是**两条正交的轴**:
// 事迹说「他做过什么」(射、守城、降敌),性格说「他是个什么人」(嗜酒、多疑、刚愎)。
// 两条乘起来才拉得开 —— 同样是「守城」,谨慎的人和刚愎的人不该长成一张牌。
//
// 源头的 HISTORICAL_TRAITS 只覆盖 401 名(17.8%),而生平原文里到处是这些词。
// trait id 取自姊妹仓库的 TRAIT_DEFS(译名一起生成,见 import-content)。
const TRAIT_WORDS: [RegExp, string][] = [
  // ── 一句话就能认出这个人的那种 ──────────────────────────────
  // 放在最前面是因为 traitsOf 只留前四条:張飛的「聲若巨雷」、關羽的「面如重棗」、
  // 曹植的「七步成詩」都写在传的头一句里,它们比「忠」「勇」更能把人认出来。
  // 姊妹仓库的 TRAIT_DEFS 有 202 条,此前只用到 46 条 —— 剩下那 156 条不是没用,
  // 是没人去把它们和原文里的话接上。
  // 臥龍 / 鳳雛 试过又撤了:史书写的是**合称**「號臥龍鳳雛」,
  // 于是龐統的传里两个绰号都在,匹配出来他既是臥龍又是鳳雛。
  // 合称这种东西没法靠字面切开,要么手写要么不做。
  [/七步成詩|七步/, 'quick-verse'],
  [/獨眼|拔矢啖睛|眇一目/, 'one-eyed'],
  [/聲若巨雷|聲如雷|聲震/, 'thunder-voice'],
  [/面如重棗|赤面/, 'red-faced'],
  [/觀星|夜觀天象|仰觀/, 'star-reader'],
  [/採藥|本草|青囊/, 'herbalist'],
  [/一騎當千|萬夫不當/, 'matchless'],
  [/笑裡藏刀|口蜜腹劍/, 'smiling-blade'],
  [/木牛流馬|巧思|機巧|作器/, 'inventive'],
  [/料事|先知|前知|神算/, 'precognitive'],
  [/姿顏雄偉|風神|儀表/, 'handsome-noble'],
  [/目光如電|銳目|虎目/, 'piercing-eyes'],
  [/日行|倍道|急行/, 'tireless-march'],
  // ── 原有的一批 ─────────────────────────────────────────────
  [/嗜酒|醉|好酒|酗/, 'drunkard'],
  [/多疑|猜忌|忌之/, 'suspicious'],
  [/仁厚|仁德|寬厚|寬仁|愛民|恤民|愛人/, 'benevolent'],
  [/剛愎|固執|不聽|自用/, 'stubborn'],
  [/懼|怯|遁走|棄軍/, 'cowardly'],
  [/野心|圖之|篡|自立/, 'ambitious'],
  [/忠|守節|不降|死節/, 'loyal'],
  [/貪|賄|受金/, 'greedy'],
  [/輕敵|躁|恃勇|輕進/, 'reckless'],
  [/謹慎|持重|不輕/, 'cautious'],
  [/傲|矜|自負/, 'arrogant'],
  [/詐|譎|反間|離間/, 'cunning'],
  [/暴怒|性怒|忿|鞭撻|怒斬/, 'wrathful'],
  [/大義|義氣|俠義|義薄雲天|重然諾|輕財重義/, 'chivalrous'],
  [/驍勇|萬人敵|勇冠|力戰/, 'martial-valor'],
  [/沉毅|鎮定|不動|從容/, 'composed'],
  [/寡言|木訥|訥/, 'taciturn'],
  [/宗室|封王|封侯|公子|太子/, 'noble'],
  [/多病|疾篤|羸|疾卒|素有疾/, 'sickly'],
  [/年八十|壽|高齡|年九十/, 'long-lived'],
  [/殘|暴虐|坑殺|屠/, 'cruel'],
  [/儉|樸素|不治產/, 'frugal'],
  [/廉|不受/, 'incorruptible'],
  [/孝/, 'filial'],
  [/善射|百步穿楊|射藝|弓馬|箭無虛發/, 'sharpshooter'],
  [/矛|槍/, 'spear-master'],
  [/騎射|善騎|輕騎/, 'cavalryman'],
  [/水軍|舟師|樓船/, 'navy-master'],
  [/攻城|器械|礮/, 'siege-expert'],
  [/鎮守|守城|拒守/, 'fortress-keeper'],
  [/宿將|老將|歷仕|老當益壯|老而彌堅|白首/, 'veteran'],
  [/伏兵|設伏|夜襲/, 'ambush-master'],
  [/弩/, 'crossbow-adept'],
  [/先登|先鋒|陷陣/, 'vanguard'],
  [/單挑|鬥將|挑戰/, 'duelist'],
  [/火攻|縱火|焚其/, 'fire-tactician'],
  [/博覽|經學|通經|好學/, 'classics-scholar'],
  [/文章|詩|賦|善書/, 'poetic-genius'],
  [/醫|方術|針/, 'physician'],
  [/多謀|奇計|善謀/, 'strategist'],
  [/辯|說之|遊說/, 'persuasive'],
  [/直言|抗表|犯顏|切諫/, 'honest-to-fault'],
  [/隱居|不仕|辭疾/, 'ascetic'],
  [/美姿|姿容|貌美|色美|美如玉|昳麗/, 'beautiful'],
  [/身長|長八尺|長九尺/, 'tall'],
  [/力能|扛鼎|絕人|力大|膂力過人|拔山/, 'mighty-strength'],
  // ── 补的一批(2026-08-02):原文里到处是这些词,只是从前没人接 ──
  // 1,417 名有生平的武将一条性格都抽不出来,而性格是**列传上直接显示的东西**。
  // 这一批只做风味不进 TRAIT_AFFINITY(除非注明)—— 它们改的是「这个人是谁」,
  // 不是「这张卡怎么打」。
  [/慷慨|好施|散財/, 'generous'],
  [/寬厚|寬仁|寬和/, 'lenient'],
  [/嚴峻|嚴刻|峻法/, 'stern'],
  [/嚴明|賞罰必信/, 'strict-fair'],
  [/雄辯|口辯|善辯|辯給/, 'eloquent'],
  [/博學|博覽|群書|通經史/, 'erudite'],
  [/多智|智謀過人|智計/, 'wise'],
  [/遠見|先見|深慮/, 'visionary'],
  [/刑名|法家|申韓|明法/, 'legalist'],
  [/勤|夙夜|不倦|孜孜/, 'diligent'],
  [/謙|遜|不伐/, 'humble'],
  [/然諾|守信|不欺/, 'keeps-word'],
  [/舉賢|薦士|任賢|好士/, 'meritocratic'],
  [/報恩|知遇|感恩/, 'grateful'],
  [/念舊|故舊/, 'nostalgic'],
  [/嫉惡|疾惡/, 'hates-evil'],
  [/仗義|急人之難/, 'stand-for-justice'],
  [/重義|義烈/, 'honor-bound'],
  [/豪放|豪邁|任俠|不羈/, 'unrestrained'],
  [/詼諧|滑稽|善謔/, 'humorous'],
  [/嚴肅|莊重/, 'solemn'],
  [/機警|機智|敏捷應對/, 'quick-witted'],
  [/機變|權變|應變/, 'adaptable'],
  [/務實|不尚虛/, 'pragmatic'],
  [/高傲|倨傲/, 'haughty'],
  [/寡情|薄情|少恩/, 'cold'],
  [/質直|直率|訥直/, 'frank'],
  [/圓滑|周旋/, 'smooth'],
  [/心狠|忍人|殘忍/, 'ruthless'],
  [/嗜殺|好殺|不眨眼/, 'bloodthirsty'],
  [/報仇|復仇|雪恥|報怨/, 'vengeful'],
  [/嫉|妒/, 'jealous'],
  [/怠|惰|不事事/, 'lazy'],
  [/急躁|性急|褊急/, 'impatient'],
  [/暴烈|性烈|剛烈/, 'explosive'],
  [/沉勇|沉毅有勇|臨危不亂/, 'stoic-brave'],
  [/文武雙全|文武兼/, 'versatile'],
  [/好色|淫/, 'lustful'],
  [/慈|哀矜|恤民|憐/, 'compassionate'],
  [/膂力|強健|壯健/, 'robust'],
  [/貌醜|形陋|醜/, 'ugly'],
  [/文弱|體弱|羸/, 'frail'],
  [/敏捷|矯健|輕捷/, 'nimble'],
  [/戟/, 'pikeman'],
  [/盾|楯/, 'shield-bearer'],
  [/夜襲|夜擊|乘夜/, 'night-raider'],
  [/殿後|斷後|殿軍/, 'rear-guard'],
  [/死戰|力戰不退|奮擊/, 'berserker'],
  [/水淹|決水|灌城|決河/, 'water-tactician'],
  [/軍法|治軍嚴|不擾民|秋毫無犯/, 'iron-discipline'],
  [/野戰|野合/, 'field-tactician'],
  [/奔襲|急襲|輕騎襲/, 'raid-style'],
  [/山戰|據險/, 'hill-fighter'],
  [/邊|塞|禦胡|防秋/, 'desert-rider'],
  [/河防|守河|漕/, 'river-warden'],
  [/旗|麾下嚴整|部伍/, 'banner-master'],
  [/守節|不事二/, 'principled'],
  [/愛國|憂國/, 'patriotic'],
  [/寬容|能容|不校/, 'tolerant'],
  [/自律|克己/, 'self-disciplined'],
  [/虔|奉道|事佛|齋/, 'pious'],
  [/開朗|樂易|坦率/, 'cheerful'],
  [/風流|放達/, 'refined'],
  [/風雅|雅好/, 'graceful'],
]

// 性格 → 它想要的关键词/形状。比事迹那张表克制得多 ——
// 性格调的是**气质**,不该抢走事迹对机制的决定权,所以只点少数几个。
const TRAIT_AFFINITY: Record<string, { kw?: string[]; shapes?: string[] }> = {
  drunkard: { shapes: ['overload-raid', 'deed-wine', 'bc-self-temp'] },
  cautious: { kw: ['guard'], shapes: ['lo-palisade', 'od-brace', 'bc-armor'] },
  reckless: { kw: ['charge'], shapes: ['bc-face', 'lo-overrun'] },
  cruel: { kw: ['poison'], shapes: ['bc-behead', 'dr-strike'] },
  loyal: { shapes: ['dr-legacy', 'dr-avenge', 'bc-grant-guard'] },
  cunning: { kw: ['stealth'], shapes: ['lo-ruse', 'bc-steal', 'combo-ambush'] },
  benevolent: { kw: ['lifesteal'], shapes: ['bc-heal-general', 'sot-heal', 'od-rally'] },
  arrogant: { kw: ['duel'], shapes: ['bc-behead', 'oa-momentum'] },
  'martial-valor': { kw: ['trample', 'charge'], shapes: ['bc-warcry-big', 'enrage'] },
  'sharpshooter': { kw: ['rush'], shapes: ['lo-arrow', 'bc-snipe'] },
  'fortress-keeper': { kw: ['guard'], shapes: ['bc-wall', 'lo-palisade'] },
  'ambush-master': { kw: ['stealth'], shapes: ['lo-veil', 'combo-ambush'] },
  'navy-master': { shapes: ['bc-freeze', 'bc-freeze-all'] },
  'siege-expert': { kw: ['siege'], shapes: ['bc-scorch', 'bc-volley'] },
  vanguard: { kw: ['charge', 'rush'], shapes: ['oa-press'] },
  duelist: { kw: ['duel'], shapes: ['bc-behead'] },
  'fire-tactician': { shapes: ['bc-scorch', 'dr-blast'] },
  'classics-scholar': { shapes: ['bc-draw', 'lo-scribe', 'os-scholar'] },
  strategist: { shapes: ['bc-discover-strat', 'spell-damage', 'deed-scheme'] },
  physician: { shapes: ['lo-mend', 'bc-heal-hero', 'deed-heal'] },
  'mighty-strength': { kw: ['trample'], shapes: ['bc-warcry-big', 'lo-overrun'] },
  sickly: { shapes: ['dr-draw', 'deed-mote-doomed'] },
  noble: { shapes: ['aura-both', 'aura-hp', 'bc-kin'] },
}

// 从生平原文抽性格。同 deedsOf:纯函数,产物逐字节可复现。
// 【为什么要先把本人的名字抠掉】
// 单字规则碰上人名就翻车:黃忠的传里必然有「忠」、曹仁的传里必然有「仁」、
// 關羽的传里必然有「羽」—— 于是**每个人都从自己的名字里领到一条性格**。
// 这类错在列传上直接可见,而且看着还挺像回事,不查原文根本发现不了。
// 顺手也把「字X」那三个字抠掉(表字同样常用仁/忠/義)。
function withoutSelf(bioZh: string, selfName?: string): string {
  let out = bioZh
  if (selfName) out = out.split(selfName).join('　')
  return out.replace(/^字[一-龥]{1,3}/, '')
}

export function traitsOf(bioZh: string | undefined, selfName?: string): string[] {
  if (!bioZh) return []
  const hay = toSimplified(withoutSelf(bioZh, selfName))
  const out: string[] = []
  for (const [re, tag] of TRAIT_RE) if (re.test(hay)) out.push(tag)
  // 一个人身上挂七八条性格等于没有性格 —— 只留前四条(表的顺序就是优先级:
  // 越靠前的越是「一句话能概括这个人」的那种特质)
  return out.slice(0, 4)
}

// 词 → 标签。词都取自生平原文里真实出现的说法(繁体,源头就是繁体)。
// 刻意用**具体的事**而不是抽象品格:「射」「焚」「渡江」是能落到机制上的,
// 「忠勇」「賢明」落不到 —— 后者是评价,不是事迹。
const DEED_WORDS: [RegExp, string][] = [
  [/射|箭|弓|百步穿楊/, 'archery'],
  [/水戰|舟|船|渡江|水軍|樓船/, 'navy'],
  [/守|鎮|固守|拒|城不下|堅壁/, 'defend'],
  [/騎|馬|突騎|輕騎|奔襲/, 'cavalry'],
  [/火|焚|燒/, 'fire'],
  [/毒|鴆/, 'poison'],
  [/降|叛|歸|反|倒戈/, 'defect'],
  [/家財|散財|巨富|資之|賑/, 'wealth'],
  [/醫|療|救|活人/, 'heal'],
  [/計|謀|策|智|離間|反間/, 'scheme'],
  [/諫|直言|抗表|犯顏/, 'remonstrate'],
  [/酒|醉/, 'wine'],
  [/斬|首級|殺之|梟/, 'slay'],
  [/萬人敵|萬夫不當|勇冠|力能|扛鼎|虎|膽烈|絕倫/, 'might'],
  [/書|經|學|文章|著/, 'letters'],
  [/使|說|辯|遊說/, 'envoy'],
  [/屯田|糧|倉|轉運/, 'supply'],
  [/早卒|病卒|遇害|死於|自殺|伏誅/, 'doomed'],
  [/托孤|輔政|顧命/, 'regent'],
  [/隱|不仕|辭/, 'recluse'],
  // ── 补的一批(2026-08-02)──────────────────────────────────
  // 2,165 条生平里有 **818 条一个事迹都抽不出来**,而且抽不出来的恰恰是最有名的那批:
  // 曹操(「少時機警,有權數」)、劉備(「桃園結義」)、樂進(「每戰必先登」)、
  // 典韋(「萬夫不當之勇」)、諸葛恪(「平山越,伐魏」)。
  // 词表只有二十条,漏的不是生僻词,是**史书最常用的那几种写法**。
  //
  // 【为什么这一批全是新标签,而不是往老标签里加词】
  // 老标签下面挂着**只有它才开得了的候选**(deed-mid-defend 之类)。
  // 给老标签加词 = 给几百个人开了新候选 = 卡池身材整体缩水 = 平衡闸门要重跑
  //(这一课在放宽播种闸门时交过学费:身材 7.53→7.29,冒险关底当场崩)。
  // 新标签只进 DEED_AFFINITY(抬权重、不开新候选),改的是**挑哪一个**,
  // 不是**能不能挑** —— 那是实测过的、成分中性的那条路。
  [/先登|先鋒|陷陣|首入|冒矢石|每戰必先/, 'vanguard'],
  [/結義|義兄弟|歃血|同生共死|刎頸|莫逆/, 'oath'],
  [/篡|廢帝|自立|專權|挾天子|矯詔/, 'usurp'],
  [/死節|不降|自刎|伏劍|殉|夷三族|夷滅/, 'martyr'],
  [/少有|幼有|早慧|神童|少而|年十/, 'prodigy'],
  [/安撫|招撫|懷柔|綏|平定|山越/, 'pacify'],
  [/匈奴|鮮卑|烏桓|羌|氐|南蠻|禦邊|塞外/, 'frontier'],
  [/廷尉|治獄|明斷|決獄|刑獄|執法/, 'judge'],
  [/築|治水|渠|營建|修城|堰/, 'builder'],
  [/名重|海內|望重|時人稱|名士|四世三公|評之/, 'renown'],
]

// 标签 → 它想要的关键词与效果形状。一个标签可以点名多个,权重一起抬。
const DEED_AFFINITY: Record<string, { kw?: string[]; shapes?: string[] }> = {
  archery: { kw: ['rush'], shapes: ['lo-arrow', 'bc-snipe', 'bc-volley', 'bc-strike'] },
  navy: { shapes: ['bc-freeze', 'bc-freeze-all', 'lo-skirmish', 'bc-return'] },
  defend: { kw: ['guard'], shapes: ['lo-palisade', 'bc-wall', 'bc-armor', 'bc-grant-guard', 'od-brace'] },
  cavalry: { kw: ['charge', 'rush'], shapes: ['bc-face', 'oa-press', 'bc-grant-charge'] },
  fire: { shapes: ['bc-scorch', 'bc-volley', 'dr-blast', 'lo-arrow'] },
  poison: { kw: ['poison'], shapes: ['bc-snipe'] },
  defect: { shapes: ['bc-seize', 'bc-steal', 'bc-silence', 'bc-return'] },
  wealth: { shapes: ['bc-discard', 'bc-draw2', 'bc-warcry', 'lo-hearten', 'bc-heal-general'] },
  heal: { kw: ['lifesteal'], shapes: ['bc-heal-general', 'bc-heal-hero', 'sot-heal', 'lo-mend', 'od-rally'] },
  scheme: { shapes: ['bc-discover-strat', 'bc-tutor-strat', 'os-scholar', 'spell-damage', 'combo-ambush'] },
  remonstrate: { shapes: ['bc-silence', 'lo-ruse', 'choose-scholar'] },
  wine: { shapes: ['overload-raid', 'bc-self-temp', 'lo-overrun'] },
  slay: { kw: ['duel', 'trample'], shapes: ['bc-behead', 'bc-strike', 'oa-momentum'] },
  might: { kw: ['trample', 'charge'], shapes: ['bc-warcry-big', 'enrage', 'lo-overrun', 'bc-self-temp'] },
  letters: { shapes: ['bc-draw', 'bc-draw2', 'lo-scribe', 'os-scholar', 'spell-damage'] },
  envoy: { shapes: ['bc-steal', 'bc-discover-general', 'bc-tutor-general', 'lo-requisition'] },
  supply: { shapes: ['lo-levy', 'bc-recruit', 'lo-requisition', 'eot-armor', 'bc-summon-pair'] },
  doomed: { shapes: ['dr-strike', 'dr-summon', 'dr-draw', 'dr-legacy', 'dr-avenge', 'dr-armor'] },
  regent: { kw: ['guard'], shapes: ['aura-both', 'aura-hp', 'lo-hearten', 'bc-kin'] },
  recluse: { kw: ['stealth'], shapes: ['lo-veil', 'bc-discover-costly', 'choose-scholar'] },
  // 新标签只抬权重,下面没有任何「只有它才开得了」的候选(见 DEED_WORDS 那段说明)
  vanguard: { kw: ['charge', 'rush'], shapes: ['bc-face', 'oa-press', 'oa-momentum'] },
  oath: { shapes: ['aura-both', 'lo-hearten', 'bc-kin', 'bc-summon-pair'] },
  usurp: { shapes: ['bc-seize', 'bc-steal', 'bc-silence', 'lo-ruse'] },
  martyr: { shapes: ['dr-strike', 'dr-avenge', 'dr-legacy', 'dr-summon'] },
  prodigy: { shapes: ['bc-draw', 'lo-scribe', 'bc-discover-strat'] },
  pacify: { shapes: ['lo-mend', 'bc-heal-general', 'aura-hp', 'od-rally'] },
  frontier: { kw: ['rush'], shapes: ['bc-summon-pair', 'lo-skirmish', 'bc-recruit'] },
  judge: { shapes: ['bc-silence', 'lo-ruse', 'choose-scholar'] },
  builder: { shapes: ['eot-armor', 'bc-armor', 'lo-palisade', 'bc-wall'] },
  renown: { shapes: ['lo-hearten', 'bc-warcry', 'bc-discover-general'] },
}

// 从生平原文抽标签。**纯函数**(同一段文字永远给同一批标签),
// 所以产物依旧逐字节可复现 —— 这是生成层的铁律。
// 【为什么要先折成简体再匹配】
// 2,180 条生平里有 **523 条(24%)混着简体字** —— 而且是句内混:
// 曹操传写「漢相曹參之后」、關羽传写「義薄云天」、諸葛亮传写「躬耕于南陽」。
// 上面两张表全是繁體正则,碰上简体那半个字就整条不命中,
// 于是**最有名的那批人反而抽不出事迹**:曹操、劉備、孫堅、樂進、典韋一个都没有。
//
// 折的方向只能是繁→简:繁→简是多对一(纯查表,永不出错),
// 简→繁是一对多(「发」是發还是髮要看词)—— 见 src/ui/zhVariant.ts 的长注释。
// 所以把**两边**都折到简体这个公共空间里再比:表照旧用繁體写(与卡池文案一致),
// 载入时用同一张表把正则源码也折一遍,不用手工维护两套写法。
const foldRe = (re: RegExp): RegExp => new RegExp(toSimplified(re.source))
const DEED_RE: [RegExp, string][] = DEED_WORDS.map(([re, tag]) => [foldRe(re), tag])
const TRAIT_RE: [RegExp, string][] = TRAIT_WORDS.map(([re, tag]) => [foldRe(re), tag])

export function deedsOf(bioZh: string | undefined, selfName?: string): string[] {
  if (!bioZh) return []
  const hay = toSimplified(withoutSelf(bioZh, selfName))
  const out: string[] = []
  for (const [re, tag] of DEED_RE) if (re.test(hay)) out.push(tag)
  return out
}

// 这批标签(事迹 + 性格)想要的关键词/形状集合。
// 两条轴共用一个出口,但**权重不同**:事迹是他做过的事,性格是他的气质 ——
// 前者更该决定机制,所以性格只给一半的加成(见下面的 boostOf)。
function deedWants(deeds: string[], traits: string[] = []): {
  kw: Map<string, number>
  shapes: Map<string, number>
} {
  const kw = new Map<string, number>()
  const shapes = new Map<string, number>()
  const add = (m: Map<string, number>, k: string, mult: number) =>
    m.set(k, Math.max(m.get(k) ?? 1, mult))
  for (const d of deeds) {
    const a = DEED_AFFINITY[d]
    if (!a) continue
    for (const k of a.kw ?? []) add(kw, k, DEED_BOOST)
    for (const sp of a.shapes ?? []) add(shapes, sp, DEED_BOOST)
  }
  for (const tr of traits) {
    const a = TRAIT_AFFINITY[tr]
    if (!a) continue
    for (const k of a.kw ?? []) add(kw, k, TRAIT_BOOST)
    for (const sp of a.shapes ?? []) add(shapes, sp, TRAIT_BOOST)
  }
  return { kw, shapes }
}

// 性格的加成比事迹低一档:事迹是「他做过这件事」,性格是「他是这种人」。
export const TRAIT_BOOST = 3

// ---------- 效果候选池 ----------
//
// 权重是相对的,不是概率。同一张卡通常有 10-25 个候选命中条件,
// 权重决定它们之间的份额。定价(points)必须诚实 —— 它会从身材里扣。

const POOL: Cand[] = [
  // ══════ 事迹中效果(1.8–2.6 点,3-6 费段)══════
  //
  // 低费段的重复是**定价的必然**(1 费只有 3 点身材预算,买不起第二样东西),
  // 但 3-4 费段有 7-9 点预算却同样重复(实测 60.3% 有双胞胎)—— 那是候选不够,
  // 不是钱不够。这一批把事迹铺到中费段:同样是「守城」的四费将,
  // 有的筑墙、有的死守、有的以命换城。
  {
    key: 'deed-mid-defend',
    weight: 1.3,
    points: 2.2,
    when: (c) => c.deeds.includes('defend') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'allFriendlyOthers' }] }
      o.points += 2.2
      t(o, '戰吼:其餘友方武將獲得【守護】。', 'Battlecry: Your other generals gain [Guard].')
    },
  },
  {
    key: 'deed-mid-slay',
    weight: 1.3,
    points: 2.4,
    when: (c) => c.deeds.includes('slay') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 4, target: 'strongestEnemyGeneral' }] }
      o.points += 2.4
      t(o, '戰吼:對敵方攻擊最高的武將造成 4 點傷害。', 'Battlecry: Deal 4 damage to the enemy general with the highest attack.')
    },
  },
  {
    key: 'deed-mid-fire',
    weight: 1.3,
    points: 2.5,
    when: (c) => c.deeds.includes('fire') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.battlecry = {
        ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'aoeDamage', amount: 3 }] } }],
      }
      o.points += 2.5
      t(o, '戰吼:伏筆 —— 1 個我方回合後,對敵方全場造成 3 點傷害。', 'Battlecry: Fuse — in 1 of your turns, deal 3 damage to all enemy generals.')
    },
  },
  {
    key: 'deed-mid-navy',
    weight: 1.3,
    points: 2.2,
    when: (c) => c.deeds.includes('navy') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] }
      o.points += 2.2
      t(o, '戰吼:凍結敵方全場。', 'Battlecry: Freeze all enemy generals.')
    },
  },
  {
    key: 'deed-mid-regent',
    weight: 1.2,
    points: 2.3,
    when: (c) => c.deeds.includes('regent') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.aura = { scope: 'friendlyOthers', attack: 1, health: 1 }
      o.points += 2.3
      t(o, '光環:其餘友方武將 +1/+1。', 'Aura: Your other generals have +1/+1.')
    },
  },
  {
    key: 'deed-mid-scheme',
    weight: 1.2,
    points: 2.0,
    when: (c) => c.deeds.includes('scheme') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'stealCard', count: 1 }, { op: 'draw', count: 1 }] }
      o.points += 2.0
      t(o, '戰吼:從對手手牌取 1 張,再抽 1 張牌。', "Battlecry: Take a card from your opponent's hand, then draw a card.")
    },
  },
  {
    key: 'deed-mid-doomed',
    weight: 1.2,
    points: 1.9,
    when: (c) => c.deeds.includes('doomed') && c.cost >= 3 && c.cost <= 7,
    emit: (o, c) => {
      o.deathrattle = { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 2 }] }
      o.points += 1.9
      void c
      t(o, '亡語:召喚兩個 1/1 鄉勇。', 'Deathrattle: Summon two 1/1 Village Levies.')
    },
  },
  {
    key: 'deed-mid-supply',
    weight: 1.2,
    points: 2.1,
    when: (c) => c.deeds.includes('supply') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'gainSupply', amount: 1 }, { op: 'gainArmor', amount: 1 }] }
      o.points += 2.1
      t(o, '我方回合結束時:屯糧 +1,主公獲得 1 點護甲。', 'At the end of your turn: gain 1 Supply and 1 Armor.')
    },
  },
  {
    key: 'deed-mid-might',
    weight: 1.3,
    points: 2.3,
    when: (c) => c.deeds.includes('might') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.onAttack = { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] }
      o.points += 2.3
      t(o, '攻擊後:此牌 +1/+1。', 'After attacking: this gains +1/+1.')
    },
  },
  {
    key: 'deed-mid-archery',
    weight: 1.3,
    points: 2.2,
    when: (c) => c.deeds.includes('archery') && c.cost >= 3 && c.cost <= 7,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'damage', amount: 2, target: 'weakestEnemyGeneral' }] }
      o.points += 2.2
      t(o, '我方回合結束時:對現存生命最低的敵將造成 2 點傷害。', 'At the end of your turn: deal 2 damage to the enemy general with the lowest health.')
    },
  },
  // ══════ 中费变体(2.0–2.6 点)══════
  //
  // 3-4 费段实测 60.3% 有双胞胎,而这一段的身材预算是 7-9 点 ——
  // **不是钱不够,是候选不够**:同一个画像下能命中的形状就那么几个,
  // 于是几百个人挤在同一张牌上。这一批不开新闸门、不改命中率,
  // 只是往同一个价位塞更多**互不相同的**选择(纯变体)。
  //
  // 定价刻意贴着既有中费候选(2.0–2.6),所以卡池的构成一分不动 ——
  // 冒险模式那三次塌陷的教训:动构成就要重调整条难度曲线。
  {
    key: 'var-shield-wall',
    weight: 0.9,
    points: 2.2,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.leadership >= 62,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 0, health: 2, target: 'allFriendlyOthers' }] }
      o.points += 2.2
      t(o, '戰吼:其餘友方武將 +0/+2。', 'Battlecry: Give your other generals +0/+2.')
    },
  },
  {
    key: 'var-skirmish-line',
    weight: 0.9,
    points: 2.4,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.war >= 66,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 2, target: 'allEnemyGenerals' }] }
      o.points += 2.4
      t(o, '戰吼:對敵方全場造成 2 點傷害。', 'Battlecry: Deal 2 damage to all enemy generals.')
    },
  },
  {
    key: 'var-forced-march',
    weight: 0.85,
    points: 2.0,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.war >= 58,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'rush', target: 'allFriendlyOthers', duration: 'endOfTurn' }] }
      o.points += 2.0
      t(o, '戰吼:本回合其餘友方武將獲得【突襲】。', 'Battlecry: Your other generals gain [Rush] this turn.')
    },
  },
  {
    key: 'var-quartermaster',
    weight: 0.85,
    points: 2.1,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.politics >= 60,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainSupply', amount: 3 }, { op: 'gainArmor', amount: 3 }] }
      o.points += 2.1
      t(o, '戰吼:屯糧 +3,主公獲得 3 點護甲。', 'Battlecry: Gain 3 Supply and 3 Armor.')
    },
  },
  {
    key: 'var-counsel',
    weight: 0.85,
    points: 2.3,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.intelligence >= 64,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'tutor', kind: 'general', count: 1 }, { op: 'reduceCost', amount: 1, filter: 'generals' }] }
      o.points += 2.3
      t(o, '戰吼:檢索 1 名武將,並使手牌中的武將 -1 費。', 'Battlecry: Draw a general from your deck; generals in your hand cost 1 less.')
    },
  },
  {
    key: 'var-executioner',
    weight: 0.85,
    points: 2.5,
    when: (c) => c.cost >= 4 && c.cost <= 7 && c.s.war >= 70,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 3, target: 'weakestEnemyGeneral' }, { op: 'damage', amount: 3, target: 'weakestEnemyGeneral' }] }
      o.points += 2.5
      t(o, '戰吼:對現存生命最低的敵將造成 3 點傷害,兩次。', 'Battlecry: Deal 3 damage to the lowest-health enemy general, twice.')
    },
  },
  {
    key: 'var-vigil',
    weight: 0.8,
    points: 2.2,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.charisma >= 62,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'heal', amount: 2, target: 'allFriendlyGenerals' }] }
      o.points += 2.2
      t(o, '我方回合結束時:友方全場恢復 2 點生命。', 'At the end of your turn: restore 2 Health to all your generals.')
    },
  },
  {
    key: 'var-turncoat',
    weight: 0.8,
    points: 2.6,
    when: (c) => c.cost >= 4 && c.cost <= 7 && c.s.intelligence >= 60,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'borrow', target: 'weakestEnemyGeneral' }] }
      o.points += 2.6
      t(o, '戰吼:借將 —— 奪取敵方生命最低的武將,回合結束歸還。', 'Battlecry: Borrow the lowest-health enemy general; it returns at end of turn.')
    },
  },
  {
    key: 'var-signal-fire',
    weight: 0.8,
    points: 2.3,
    when: (c) => c.cost >= 3 && c.cost <= 6 && c.s.intelligence >= 55,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'recruit', count: 1 }] } }] }
      o.points += 2.3
      t(o, '亡語:伏筆 —— 1 個我方回合後,從牌庫召喚 1 名武將。', 'Deathrattle: Fuse — in 1 of your turns, summon a general from your deck.')
    },
  },
  {
    key: 'var-stone-wall',
    weight: 0.8,
    points: 2.4,
    when: (c) => c.cost >= 4 && c.cost <= 7 && c.s.leadership >= 68,
    emit: (o) => {
      o.aura = { scope: 'adjacent', attack: 1, health: 2 }
      o.points += 2.4
      t(o, '光環:左右相鄰的友軍 +1/+2。', 'Aura: Adjacent friendly generals have +1/+2.')
    },
  },
  // ══════ 无名微效果(0.3 点,**不扣身材**)══════
  //
  // 【它补的是哪一批人】
  // 全池最大的同质组是「1 費 1/2」共 25 张,他们的共同点不是弱,是**史书没写**:
  // 生平只有一句「蜀漢將。隨諸葛亮北伐」——既抽不出事迹也抽不出性格,
  // 于是上面那两批候选一个都够不着,一路掉回白板,长成同一张牌。
  //
  // 【为什么定价 0.3】
  // payFor 的扣款门槛是 0.4:低于它一分身材都不扣。这不是钻空子,是刻意的 ——
  // **冒险模式那次塌陷的根因是身材缩水,不是效果变多**(平均身材 7.53→7.29,
  // 而关底 Boss 的牌由贪心 AI 驾驶,对它身材远重于效果)。
  // 定在 0.3 就能在**身材一分不动**的前提下让这批人各有各的小动作。
  //
  // 【效果要小到什么程度】
  // 小到「有它没它都不影响这张牌该不该进卡组」。它们要回答的不是强度,
  // 是「这张牌和旁边那张不是同一张」。
  // 分流靠 when 的画像条件(兵种/朝代/五维)——同为无名之辈,
  // 江东的和西凉的、文的和武的,拿到的那一件小事也不一样。
  {
    key: 'anon-levy',
    weight: 0.8,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.leadership >= c.s.war,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainArmor', amount: 1 }] }
      o.points += 0.3
      t(o, '戰吼:你的主公獲得 1 點護甲。', 'Battlecry: Your hero gains 1 Armor.')
    },
  },
  {
    key: 'anon-scout',
    weight: 0.8,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.intelligence >= 55,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainSupply', amount: 1 }] }
      o.points += 0.3
      t(o, '戰吼:屯糧 +1。', 'Battlecry: Gain 1 Supply.')
    },
  },
  {
    key: 'anon-vanguard',
    weight: 0.8,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.war > c.s.leadership,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainMorale', amount: 1 }] }
      o.points += 0.3
      t(o, '戰吼:我方士氣 +1。', 'Battlecry: Gain 1 Morale.')
    },
  },
  {
    key: 'anon-mourn',
    weight: 0.8,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.charisma >= 55,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'gainMorale', amount: 1 }] }
      o.points += 0.3
      t(o, '亡語:我方士氣 +1。', 'Deathrattle: Gain 1 Morale.')
    },
  },
  {
    key: 'anon-forage',
    weight: 0.7,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.politics >= 55,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'gainSupply', amount: 1 }] }
      o.points += 0.3
      t(o, '我方回合結束時:屯糧 +1。', 'At the end of your turn: gain 1 Supply.')
    },
  },
  {
    key: 'anon-picket',
    weight: 0.7,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.s.leadership >= 55,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'gainArmor', amount: 2 }] }
      o.points += 0.3
      t(o, '亡語:你的主公獲得 2 點護甲。', 'Deathrattle: Your hero gains 2 Armor.')
    },
  },
  {
    key: 'anon-runner',
    weight: 0.7,
    points: 0.3,
    when: (c) => c.cost <= 3 && c.s.war >= 45,
    emit: (o) => {
      o.onAttack = { ops: [{ op: 'gainMorale', amount: 1 }] }
      o.points += 0.3
      t(o, '攻擊後:我方士氣 +1。', 'After attacking: gain 1 Morale.')
    },
  },
  {
    key: 'anon-clerk',
    weight: 0.7,
    points: 0.3,
    when: (c) => c.cost <= 4 && c.archetype === 'strategist',
    emit: (o) => {
      o.startOfTurn = { ops: [{ op: 'gainSupply', amount: 1 }] }
      o.points += 0.3
      t(o, '我方回合開始時:屯糧 +1。', 'At the start of your turn: gain 1 Supply.')
    },
  },
  // ══════ 事迹微效果(0.5 点)══════
  //
  // 【为什么需要一档比「便宜」还便宜的】
  // 1 费卡的身材预算只有 3 点,而 1/1 已经吃掉 2 点 —— 再买一个关键词
  // (突襲 1 点)就一点不剩。于是**全池最大的同质组是「1 費 1/1 突襲」共 30 张**:
  // 不是播种器偷懒,是定价上他们真的买不起第二样东西。
  //
  // 这一档定价 0.5,专门塞进那道缝里:带了关键词的低费卡仍然掏得起一件小事。
  // 效果都刻意做得**小而具体** —— 它们要回答的不是「这张卡强不强」,
  // 而是「这个人是谁」:献马的、水军的、被诱斩的,各有各的一句话。
  {
    key: 'deed-mote-navy',
    weight: 1.4,
    points: 0.5,
    when: (c) => c.deeds.includes('navy') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'freeze', target: 'randomEnemyGeneral' }] }
      o.points += 0.5
      t(o, '戰吼:凍結一名隨機敵將。', 'Battlecry: Freeze a random enemy general.')
    },
  },
  {
    key: 'deed-mote-defend',
    weight: 1.4,
    points: 0.5,
    when: (c) => c.deeds.includes('defend') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainArmor', amount: 2 }] }
      o.points += 0.5
      t(o, '戰吼:你的主公獲得 2 點護甲。', 'Battlecry: Your hero gains 2 Armor.')
    },
  },
  {
    key: 'deed-mote-slay',
    weight: 1.4,
    points: 0.5,
    when: (c) => c.deeds.includes('slay') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 1, target: 'weakestEnemyGeneral' }] }
      o.points += 0.5
      t(o, '戰吼:對現存生命最低的敵將造成 1 點傷害。', 'Battlecry: Deal 1 damage to the enemy general with the lowest health.')
    },
  },
  {
    key: 'deed-mote-cavalry',
    weight: 1.3,
    points: 0.5,
    when: (c) => c.deeds.includes('cavalry') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'adjacentFriendly' }] }
      o.points += 0.5
      t(o, '戰吼:左右相鄰的友軍各 +1 攻擊。', 'Battlecry: Adjacent friendly generals gain +1 Attack.')
    },
  },
  {
    key: 'deed-mote-doomed',
    weight: 1.4,
    points: 0.5,
    when: (c) => c.deeds.includes('doomed') && c.cost <= 4,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'gainMorale', amount: 1 }] }
      o.points += 0.5
      t(o, '亡語:我方士氣 +1。', 'Deathrattle: Gain 1 Morale.')
    },
  },
  {
    key: 'deed-mote-defect',
    weight: 1.3,
    points: 0.5,
    when: (c) => c.deeds.includes('defect') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'mill', count: 1 }] }
      o.points += 0.5
      t(o, '戰吼:敵方牌庫頂 1 張入墓。', "Battlecry: Mill the top card of the enemy's deck.")
    },
  },
  {
    key: 'deed-mote-scheme',
    weight: 1.3,
    points: 0.5,
    when: (c) => c.deeds.includes('scheme') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainSupply', amount: 1 }, { op: 'draw', count: 0 }] }
      o.points += 0.5
      t(o, '戰吼:屯糧 +1。', 'Battlecry: Gain 1 Supply.')
    },
  },
  {
    key: 'deed-mote-letters',
    weight: 1.2,
    points: 0.5,
    when: (c) => c.deeds.includes('letters') && c.cost <= 4,
    emit: (o, c) => {
      o.aura = { scope: 'adjacent', attack: 0, health: 1 }
      o.points += 0.5
      void c
      t(o, '光環:左右相鄰的友軍 +0/+1。', 'Aura: Adjacent friendly generals have +0/+1.')
    },
  },
  {
    key: 'deed-mote-heal',
    weight: 1.2,
    points: 0.5,
    when: (c) => c.deeds.includes('heal') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'heal', amount: 2, target: 'weakestFriendlyGeneral' }] }
      o.points += 0.5
      t(o, '戰吼:為現存生命最低的友方武將恢復 2 點。', 'Battlecry: Restore 2 Health to your lowest-health general.')
    },
  },
  {
    key: 'deed-mote-might',
    weight: 1.2,
    points: 0.5,
    when: (c) => c.deeds.includes('might') && c.cost <= 4,
    emit: (o) => {
      o.enrage = 1
      o.points += 0.5
      t(o, '激怒:受傷時 +1 攻擊。', 'Enrage: +1 Attack while damaged.')
    },
  },
  {
    key: 'deed-mote-envoy',
    weight: 1.2,
    points: 0.5,
    when: (c) => c.deeds.includes('envoy') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'draw', count: 1 }, { op: 'discardRandom', count: 1 }] }
      o.points += 0.5
      t(o, '戰吼:抽 1 張牌,對手隨機棄 1 張。', 'Battlecry: Draw a card; your opponent discards one at random.')
    },
  },
  {
    key: 'deed-mote-wealth',
    weight: 1.2,
    points: 0.5,
    when: (c) => c.deeds.includes('wealth') && c.cost <= 4,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 0, health: 2, target: 'randomFriendlyGeneral' }] }
      o.points += 0.5
      t(o, '戰吼:使一名友方武將 +0/+2。', 'Battlecry: Give a friendly general +0/+2.')
    },
  },
  // ══════ 事迹候选(只由生平开门,不看五维)══════
  //
  // 【为什么必须有这一层】
  // 全池最重复的那批卡是**低费文官**:麋竺 武25/統30、劉禪 武25/統30、
  // 華歆 武30/統50 —— 他们够不着关键词池的任何一条兜底(要 war≥60 或 ld≥62),
  // 也够不着效果池里那些看属性的门槛,于是一路掉回白板,长成同一张牌。
  //
  // 而他们的生平天差地别。这一批候选把门开在**事迹**上而不是数值上:
  // 散尽家财的、乐不思蜀的、割席分坐的,从此在牌桌上不是同一张牌。
  // 定价一律 ≤1.5 点,1 费的身材预算(3 点)掏得起。
  //
  // 顺序放在最前面只是可读性 —— 命中靠权重,和位置无关。
  {
    key: 'deed-wealth',
    weight: 1.2,
    points: 1.2,
    when: (c) => c.deeds.includes('wealth') && c.cost <= 5,
    emit: (o) => {
      // 散尽家财:把手里的东西给出去,换别人变强
      o.battlecry = {
        ops: [
          { op: 'discardRandom', count: 0 },
          { op: 'buffStats', attack: 1, health: 1, target: 'randomFriendlyGeneral' },
        ],
      }
      o.points += 1.2
      t(o, '戰吼:使一名友方武將 +1/+1。', 'Battlecry: Give a friendly general +1/+1.')
    },
  },
  {
    key: 'deed-regent',
    weight: 1.2,
    points: 1.4,
    when: (c) => c.deeds.includes('regent') && c.cost <= 6,
    emit: (o) => {
      // 辅政/托孤:主公在,他就在做事
      o.battlecry = { ops: [{ op: 'heal', amount: 3, target: 'friendlyHero' }, { op: 'draw', count: 1 }] }
      o.points += 1.4
      t(o, '戰吼:你的主公恢復 3 點生命,抽 1 張牌。', 'Battlecry: Restore 3 Health to your hero and draw a card.')
    },
  },
  {
    key: 'deed-doomed',
    weight: 1.3,
    points: 1.1,
    when: (c) => c.deeds.includes('doomed') && c.cost <= 5,
    emit: (o) => {
      // 死于非命的人,死后还有一句话
      o.deathrattle = { ops: [{ op: 'draw', count: 1 }] }
      o.points += 1.1
      t(o, '亡語:抽 1 張牌。', 'Deathrattle: Draw a card.')
    },
  },
  {
    key: 'deed-remonstrate',
    weight: 1.1,
    points: 1.4,
    when: (c) => c.deeds.includes('remonstrate') && c.cost <= 6,
    emit: (o) => {
      // 直言犯颜:把话说到对面脸上,削掉他一层增益
      o.battlecry = { ops: [{ op: 'dispel', target: 'strongestEnemyGeneral' }] }
      o.points += 1.4
      t(o, '戰吼:驅散敵方攻擊最高的武將身上的附魔。', "Battlecry: Dispel the enemy general with the highest attack.")
    },
  },
  {
    key: 'deed-envoy',
    weight: 1.1,
    points: 1.5,
    when: (c) => c.deeds.includes('envoy') && c.cost <= 6,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'stealCard', count: 1 }] }
      o.points += 1.5
      t(o, '戰吼:從對手手牌隨機取 1 張。', "Battlecry: Take a random card from your opponent's hand.")
    },
  },
  {
    key: 'deed-letters',
    weight: 1.0,
    points: 1.2,
    when: (c) => c.deeds.includes('letters') && c.cost <= 5,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'tutor', kind: 'stratagem', count: 1 }] }
      o.points += 1.2
      t(o, '戰吼:從牌庫中檢索 1 張錦囊。', 'Battlecry: Draw a stratagem from your deck.')
    },
  },
  {
    key: 'deed-heal',
    weight: 1.1,
    points: 1.1,
    when: (c) => c.deeds.includes('heal') && c.cost <= 5,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'heal', amount: 3, target: 'weakestFriendlyGeneral' }] }
      o.points += 1.1
      t(o, '戰吼:為現存生命最低的友方武將恢復 3 點。', 'Battlecry: Restore 3 Health to your lowest-health general.')
    },
  },
  {
    key: 'deed-supply',
    weight: 1.0,
    points: 1.0,
    when: (c) => c.deeds.includes('supply') && c.cost <= 6,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainSupply', amount: 2 }] }
      o.points += 1.0
      t(o, '戰吼:屯糧 +2。', 'Battlecry: Gain 2 Supply.')
    },
  },
  {
    key: 'deed-defect',
    weight: 1.0,
    points: 1.5,
    when: (c) => c.deeds.includes('defect') && c.cost <= 6,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'mill', count: 2 }] }
      o.points += 1.5
      t(o, '戰吼:敵方牌庫頂 2 張入墓。', "Battlecry: Mill the top 2 cards of the enemy's deck.")
    },
  },
  {
    key: 'deed-wine',
    weight: 0.9,
    points: 1.0,
    when: (c) => c.deeds.includes('wine') && c.cost <= 6,
    emit: (o) => {
      // 醉后逞强:这一回合猛,下回合还债
      o.battlecry = { ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self', duration: 'endOfTurn' }] }
      o.overload = 1
      o.points += 1.0
      t(o, '戰吼:本回合此牌 +2 攻擊。過載 1。', 'Battlecry: This gains +2 Attack this turn. Overload 1.')
    },
  },
  {
    key: 'deed-recluse',
    weight: 1.0,
    points: 1.2,
    when: (c) => c.deeds.includes('recluse') && c.cost <= 6,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'discover', pool: 'myGeneral', count: 3 }] }
      o.points += 1.2
      t(o, '戰吼:發現一名武將。', 'Battlecry: Discover a general.')
    },
  },
  {
    key: 'deed-scheme',
    weight: 1.0,
    points: 1.3,
    when: (c) => c.deeds.includes('scheme') && c.cost <= 5,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'delay', turns: 1, script: { ops: [{ op: 'damage', amount: 3, target: 'strongestEnemyGeneral' }] } }] }
      o.points += 1.3
      t(o, '戰吼:伏筆 —— 1 個我方回合後,對敵方攻擊最高的武將造成 3 點傷害。', 'Battlecry: Fuse — in 1 of your turns, deal 3 damage to the enemy general with the highest attack.')
    },
  },
  // ══════ 低门槛小效果 ══════
  //
  // 低费卡之所以低费,是因为 might 低 —— 也就是五维普遍在 70 以下,
  // 于是它们**过不了下面任何一条属性门槛**,只能一路掉回白板。
  // 实测:不补这一层,1-3 费段(占全池 41%)几乎全是白板。
  //
  // 这批的定价一律 ≤1.5 点,身材预算掏得起;强度也配得上一个末流人物 ——
  // 偏将不该有惊天动地的本事,但可以有一件小事做。
  {
    key: 'lo-skirmish',
    weight: 0.7,
    points: 1,
    when: (c) =>
      c.cost <= 4 && c.s.war >= 58,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] }
      o.points += 1
      t(o, '戰吼:對隨機一名敵方武將造成 1 點傷害。', 'Battlecry: Deal 1 damage to a random enemy general.')
    },
  },
  {
    key: 'lo-arrow',
    weight: 0.7,
    points: 1.5,
    when: (c) =>
      c.cost <= 4 && c.s.intelligence >= 60,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 1, target: 'chosenEnemyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:對一名敵方武將造成 1 點傷害。', 'Battlecry: Deal 1 damage to an enemy general.')
    },
  },
  {
    key: 'lo-mend',
    weight: 0.4,
    points: 0.8,
    when: (c) =>
      c.cost <= 4 && c.s.politics >= 56,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'heal', amount: 2, target: 'friendlyHero' }] }
      o.points += 0.8
      t(o, '戰吼:你的主公恢復 2 點生命。', 'Battlecry: Restore 2 Health to your hero.')
    },
  },
  {
    key: 'lo-palisade',
    weight: 0.6,
    points: 1,
    when: (c) =>
      c.cost <= 4 && c.s.leadership >= 58,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainArmor', amount: 2 }] }
      o.points += 1
      t(o, '戰吼:你的主公獲得 2 點護甲。', 'Battlecry: Your hero gains 2 Armor.')
    },
  },
  {
    key: 'lo-levy',
    weight: 0.6,
    points: 1.5,
    when: (c) =>
      c.cost <= 4 && c.s.leadership >= 60 || c.s.charisma >= 64,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 1 }] }
      o.points += 1.5
      t(o, '戰吼:召喚一個 1/1 的鄉勇。', 'Battlecry: Summon a 1/1 Militia.')
    },
  },
  {
    key: 'lo-hearten',
    weight: 0.6,
    points: 1.2,
    when: (c) =>
      c.cost <= 4 && c.s.charisma >= 64,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'allFriendlyOthers' }] }
      o.points += 1.2
      t(o, '戰吼:其他友方武將+1/+0。', 'Battlecry: Give your other generals +1/+0.')
    },
  },
  {
    key: 'lo-urge',
    weight: 0.8,
    points: 1,
    when: (c) =>
      c.cost <= 4 && c.s.war >= 64 && c.s.leadership >= 58,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'rush', target: 'chosenFriendlyGeneral' }] }
      o.points += 1
      t(o, '戰吼:使一名友方武將獲得突襲。', 'Battlecry: Give a friendly general Rush.')
    },
  },
  {
    key: 'lo-dr-spark',
    weight: 0.5,
    points: 0.8,
    when: (c) =>
      c.cost <= 4 && c.s.war >= 56,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] }
      o.points += 0.8
      t(o, '亡語:對隨機一名敵方武將造成 1 點傷害。', 'Deathrattle: Deal 1 damage to a random enemy general.')
    },
  },
  {
    key: 'lo-dr-succor',
    weight: 0.4,
    points: 0.8,
    when: (c) =>
      c.cost <= 4 && c.s.politics >= 60,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'heal', amount: 3, target: 'friendlyHero' }] }
      o.points += 0.8
      t(o, '亡語:你的主公恢復 3 點生命。', 'Deathrattle: Restore 3 Health to your hero.')
    },
  },
  {
    key: 'lo-dr-levy',
    weight: 0.5,
    points: 0.8,
    when: (c) =>
      c.cost <= 4 && c.s.leadership >= 60,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'summon', defId: 'token-xiangyong', count: 1 }] }
      o.points += 0.8
      t(o, '亡語:召喚一個 1/1 的鄉勇。', 'Deathrattle: Summon a 1/1 Militia.')
    },
  },
  {
    key: 'lo-od-tend',
    weight: 0.6,
    points: 1,
    when: (c) =>
      c.cost <= 4 && c.s.politics >= 62 && c.s.charisma >= 58,
    emit: (o) => {
      o.onDamaged = { ops: [{ op: 'heal', amount: 1, target: 'friendlyHero' }] }
      o.points += 1
      t(o, '此武將受傷後,你的主公恢復 1 點生命。', 'After this general takes damage, restore 1 Health to your hero.')
    },
  },

  {
    key: 'lo-enrage',
    weight: 0.9,
    points: 0.6,
    when: (c) => c.cost <= 4 && c.s.war >= 60,
    emit: (o) => {
      o.enrage = 1
      o.points += 0.6
      t(o, '激怒:受傷時+1/+0。', 'Enrage: +1/+0 while damaged.')
    },
  },
  {
    key: 'lo-veil',
    weight: 0.9,
    points: 1,
    when: (c) => c.cost <= 4 && c.s.intelligence >= 62,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'stealth', target: 'chosenFriendlyGeneral' }] }
      o.points += 1
      t(o, '戰吼:使一名友方武將獲得潛行。', 'Battlecry: Give a friendly general Stealth.')
    },
  },
  {
    key: 'lo-overrun',
    weight: 0.9,
    points: 1,
    when: (c) => c.cost <= 4 && c.s.war >= 64 && c.s.leadership >= 60,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'trample', target: 'chosenFriendlyGeneral' }] }
      o.points += 1
      t(o, '戰吼:使一名友方武將獲得碾壓。', 'Battlecry: Give a friendly general Trample.')
    },
  },
  {
    key: 'lo-ruse',
    weight: 0.9,
    points: 1.5,
    when: (c) => c.cost <= 4 && c.s.intelligence >= 62 && c.s.politics < 74,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:交換一名敵方武將的攻擊力與最大生命。', "Battlecry: Swap an enemy general's Attack and max Health.")
    },
  },
  {
    key: 'lo-scribe',
    weight: 0.9,
    points: 1.5,
    when: (c) => c.cost <= 4 && c.s.intelligence >= 66 && c.archetype === 'strategist',
    emit: (o) => {
      o.spellDamage = 1
      o.points += 1.5
      t(o, '法術傷害+1。', 'Spell Damage +1.')
    },
  },
  {
    key: 'lo-requisition',
    weight: 0.9,
    points: 1.5,
    when: (c) => c.cost <= 4 && c.s.politics >= 66,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainMana', amount: 1, temporary: true }] }
      o.points += 1.5
      t(o, '戰吼:本回合獲得 1 點法力。', 'Battlecry: Gain 1 Mana this turn only.')
    },
  },

  // ══════ 战吼 · 点杀与清场 ══════
  {
    key: 'bc-snipe',
    weight: 0.9,
    points: 3,
    when: (c) => c.s.intelligence >= 82,
    emit: (o, c) => {
      const n = c.mag < 0.3 ? 3 : 2
      o.battlecry = { ops: [{ op: 'damage', amount: n, target: 'chosenEnemyGeneral' }] }
      o.points += n === 3 ? 4 : 3
      t(o, `戰吼:對一名敵方武將造成 ${n} 點傷害。`, `Battlecry: Deal ${n} damage to an enemy general.`)
    },
  },
  {
    key: 'bc-strike',
    weight: 0.9,
    points: 2,
    when: (c) => c.s.war >= 82,
    emit: (o, c) => {
      const n = c.mag < 0.3 ? 3 : 2
      o.battlecry = { ops: [{ op: 'damage', amount: n, target: 'randomEnemyGeneral' }] }
      o.points += n
      t(o, `戰吼:對隨機一名敵方武將造成 ${n} 點傷害。`, `Battlecry: Deal ${n} damage to a random enemy general.`)
    },
  },
  {
    key: 'bc-volley',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 78 || c.s.war >= 84,
    eras: ['ming-qing'], // 火器齐射
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 1, target: 'allEnemyGenerals' }] }
      o.points += 2.5
      t(o, '戰吼:對所有敵方武將造成 1 點傷害。', 'Battlecry: Deal 1 damage to all enemy generals.')
    },
  },
  {
    key: 'bc-scorch',
    points: 3.5,
    minRank: 2,
    when: (c) => c.s.intelligence >= 84,
    eras: ['ming-qing'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'aoeDamage', amount: 2 }] }
      o.points += 3.5
      t(o, '戰吼:對所有敵方武將造成 2 點傷害。', 'Battlecry: Deal 2 damage to all enemy generals.')
    },
  },
  {
    key: 'bc-face',
    points: 2,
    when: (c) => c.s.war >= 80 && c.s.politics < 74,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 2, target: 'enemyHero' }] }
      o.points += 2
      t(o, '戰吼:對敵方主公造成 2 點傷害。', 'Battlecry: Deal 2 damage to the enemy hero.')
    },
  },
  {
    key: 'bc-behead',
    points: 5,
    minRank: 3,
    when: (c) => c.s.war >= 92 || c.s.intelligence >= 92,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'destroy', target: 'chosenEnemyGeneral' }] }
      o.points += 5
      t(o, '戰吼:消滅一名敵方武將。', 'Battlecry: Destroy an enemy general.')
    },
  },
  {
    key: 'bc-swarm-face',
    points: 2,
    minRank: 1,
    when: (c) => c.s.leadership >= 80,
    emit: (o) => {
      o.battlecry = {
        ops: [{ op: 'damagePer', per: { kind: 'friendlyGenerals' }, amount: 1, target: 'enemyHero' }],
      }
      o.points += 2
      t(o, '戰吼:對敵方主公造成傷害,數量等於你的武將數。', "Battlecry: Deal damage to the enemy hero equal to your general count.")
    },
  },

  // ══════ 战吼 · 牌与资源 ══════
  {
    key: 'bc-draw',
    weight: 0.5,
    points: 2,
    // 权重刻意压到很低 —— 这条就是从前那 268 张的来源。
    when: (c) => c.s.intelligence >= 76,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'draw', count: 1 }] }
      o.points += 2
      t(o, '戰吼:抽一張牌。', 'Battlecry: Draw a card.')
    },
  },
  {
    key: 'bc-draw2',
    points: 4,
    minRank: 1,
    when: (c) => c.s.intelligence >= 88,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'draw', count: 2 }] }
      o.points += 4
      t(o, '戰吼:抽兩張牌。', 'Battlecry: Draw two cards.')
    },
  },
  {
    key: 'bc-tutor-general',
    points: 2,
    when: (c) => c.s.leadership >= 78,
    eras: ['three-kingdoms'], // 求贤令
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'tutor', kind: 'general', count: 1 }] }
      o.points += 2
      t(o, '戰吼:從牌庫抽一張武將牌。', 'Battlecry: Draw a general from your deck.')
    },
  },
  {
    key: 'bc-tutor-strat',
    points: 2,
    when: (c) => c.s.intelligence >= 80,
    eras: ['pre-qin'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'tutor', kind: 'stratagem', count: 1 }] }
      o.points += 2
      t(o, '戰吼:從牌庫抽一張錦囊。', 'Battlecry: Draw a stratagem from your deck.')
    },
  },
  {
    key: 'bc-discover-strat',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 82,
    eras: ['pre-qin'], // 百家争鸣:选一家之言
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'discover', pool: 'myStratagem' }] }
      o.points += 2.5
      t(o, '戰吼:發現一張錦囊。', 'Battlecry: Discover a stratagem.')
    },
  },
  {
    key: 'bc-discover-general',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.charisma >= 80,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'discover', pool: 'myGeneral' }] }
      o.points += 2.5
      t(o, '戰吼:發現一名武將。', 'Battlecry: Discover a general.')
    },
  },
  {
    key: 'bc-discover-costly',
    points: 3,
    minRank: 2,
    when: (c) => c.s.leadership >= 84 && c.s.politics >= 74,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'discover', pool: 'costlyGeneral' }] }
      o.points += 3
      t(o, '戰吼:發現一名 6 費及以上的武將。', 'Battlecry: Discover a general costing 6 or more.')
    },
  },
  {
    key: 'bc-steal',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 84 && c.s.politics >= 70,
    eras: ['three-kingdoms'], // 反间
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'stealCard', count: 1 }] }
      o.points += 2.5
      t(o, '戰吼:從對手手牌隨機取走一張。', "Battlecry: Take a random card from your opponent's hand.")
    },
  },
  {
    key: 'bc-discard',
    weight: 0.7,
    points: 1.5,
    when: (c) => c.s.intelligence >= 74 && c.s.charisma < 80,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'discardRandom', count: 1 }] }
      o.points += 1.5
      t(o, '戰吼:對手隨機棄一張牌。', 'Battlecry: Your opponent discards a random card.')
    },
  },
  {
    key: 'bc-mana',
    points: 1.5,
    when: (c) => c.s.politics >= 82,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'gainMana', amount: 1, temporary: true }] }
      o.points += 1.5
      t(o, '戰吼:本回合獲得 1 點法力。', 'Battlecry: Gain 1 Mana this turn only.')
    },
  },
  {
    key: 'bc-reduce-dynasty',
    points: 2,
    minRank: 2,
    when: (c) => c.s.politics >= 84,
    eras: ['three-kingdoms'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'reduceCost', amount: 1, filter: 'dynasty' }] }
      o.points += 2
      t(o, '戰吼:你手牌中所有同勢力的牌費用-1。', 'Battlecry: Cards of the same faction in your hand cost (1) less.')
    },
  },

  // ══════ 战吼 · 铺场 ══════
  {
    key: 'bc-summon-sishi',
    weight: 0.8,
    points: 1.5,
    when: (c) => c.s.leadership >= 74,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] }
      o.points += 1.5
      t(o, '戰吼:召喚一個 1/1 的死士。', 'Battlecry: Summon a 1/1 Retainer.')
    },
  },
  {
    key: 'bc-summon-pair',
    points: 3,
    minRank: 1,
    when: (c) => c.s.leadership >= 82,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'summon', defId: 'token-si-shi', count: 2 }] }
      o.points += 3
      t(o, '戰吼:召喚兩個 1/1 的死士。', 'Battlecry: Summon two 1/1 Retainers.')
    },
  },
  {
    key: 'bc-summon-elite',
    points: 2.2,
    minRank: 1,
    when: (c) => c.s.leadership >= 78 && c.s.war >= 74,
    emit: (o, c) => {
      const e = eliteToken(c.dynasty)
      o.battlecry = { ops: [{ op: 'summon', defId: e.defId, count: 1 }] }
      o.points += e.pts
      t(o, `戰吼:召喚一個${e.zh}。`, `Battlecry: Summon ${e.en}.`)
    },
  },
  {
    key: 'bc-summon-jinjun',
    points: 3,
    minRank: 2,
    when: (c) => c.s.leadership >= 86,
    eras: ['song-yuan'], // 禁军
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'summon', defId: 'token-jin-jun', count: 1 }] }
      o.points += 3
      t(o, '戰吼:召喚一個 3/3 的禁軍。', 'Battlecry: Summon a 3/3 Imperial Guard.')
    },
  },
  {
    key: 'bc-wall',
    points: 2.2,
    when: (c) => c.s.leadership >= 80 && c.s.war < 84,
    eras: ['song-yuan'], // 城防
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'summon', defId: 'token-shui-zhai', count: 1 }] }
      o.points += 2.2
      t(o, '戰吼:召喚一個 0/4 的水寨(守護)。', 'Battlecry: Summon a 0/4 Stockade with Guard.')
    },
  },
  {
    key: 'bc-recruit',
    points: 3,
    minRank: 2,
    when: (c) => c.s.leadership >= 86,
    eras: ['qin-han'], // 军功爵:征发
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'recruit', count: 1 }] }
      o.points += 3
      t(o, '戰吼:從牌庫隨機召喚一名武將。', 'Battlecry: Summon a random general from your deck.')
    },
  },
  {
    key: 'bc-resurrect',
    points: 2.5,
    minRank: 2,
    when: (c) => c.s.charisma >= 84 || c.s.politics >= 86,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'resurrect', count: 1 }] }
      o.points += 2.5
      t(o, '戰吼:復活一名友方陣亡武將。', 'Battlecry: Resurrect a friendly general that died this game.')
    },
  },
  {
    key: 'bc-copy',
    points: 3,
    minRank: 2,
    when: (c) => c.s.intelligence >= 86,
    eras: ['three-kingdoms'], // 疑兵
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'copyGeneral', target: 'randomFriendlyGeneral' }] }
      o.points += 3
      t(o, '戰吼:複製一名隨機友方武將。', 'Battlecry: Summon a copy of a random friendly general.')
    },
  },

  // ══════ 战吼 · 号令与增益 ══════
  {
    key: 'bc-warcry',
    points: 2,
    when: (c) => c.s.charisma >= 78,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'allFriendlyOthers' }] }
      o.points += 2
      t(o, '戰吼:其他友方武將+1/+1。', 'Battlecry: Give your other generals +1/+1.')
    },
  },
  {
    key: 'bc-warcry-big',
    points: 3.5,
    minRank: 2,
    when: (c) => c.s.charisma >= 88,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'buffStats', attack: 2, health: 2, target: 'allFriendlyOthers' }] }
      o.points += 3.5
      t(o, '戰吼:其他友方武將+2/+2。', 'Battlecry: Give your other generals +2/+2.')
    },
  },
  {
    key: 'bc-kin',
    points: 2,
    minRank: 1,
    when: (c) => c.s.leadership >= 74 && c.s.charisma >= 70,
    eras: ['three-kingdoms'],
    only: ['three-kingdoms'], // 同势力协同 —— 这一块独有的题眼
    emit: (o) => {
      o.battlecry = {
        ops: [{ op: 'buffPer', per: { kind: 'friendlyDynasty' }, attack: 1, health: 1, target: 'self' }],
      }
      o.points += 2
      t(o, '戰吼:每有一名同勢力友方武將,此武將+1/+1。', 'Battlecry: Gain +1/+1 for each friendly general of the same faction.')
    },
  },
  {
    key: 'bc-self-temp',
    weight: 0.7,
    points: 1,
    when: (c) => c.s.war >= 76,
    emit: (o) => {
      o.battlecry = {
        ops: [{ op: 'buffStats', attack: 2, health: 0, target: 'self', duration: 'endOfTurn' }],
      }
      o.points += 1
      t(o, '戰吼:本回合此武將+2/+0。', 'Battlecry: This general has +2/+0 this turn.')
    },
  },
  {
    key: 'bc-grant-guard',
    points: 1,
    when: (c) => c.s.leadership >= 80,
    eras: ['song-yuan'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'guard', target: 'chosenFriendlyGeneral' }] }
      o.points += 1
      t(o, '戰吼:使一名友方武將獲得守護。', 'Battlecry: Give a friendly general Guard.')
    },
  },
  {
    key: 'bc-grant-charge',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.war >= 84,
    eras: ['sui-tang'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'charge', target: 'chosenFriendlyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:使一名友方武將獲得衝鋒。', 'Battlecry: Give a friendly general Charge.')
    },
  },
  {
    key: 'bc-grant-shield',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.leadership >= 78 && c.s.politics >= 70,
    eras: ['ming-qing'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'grantKeyword', keyword: 'divineShield', target: 'chosenFriendlyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:使一名友方武將獲得鐵壁。', 'Battlecry: Give a friendly general Divine Shield.')
    },
  },
  {
    key: 'bc-armor',
    weight: 0.7,
    points: 1.5,
    when: (c) => c.s.leadership >= 76,
    eras: ['qin-han'],
    emit: (o, c) => {
      const n = c.mag < 0.35 ? 4 : 3
      o.battlecry = { ops: [{ op: 'gainArmor', amount: n }] }
      o.points += n * 0.5
      t(o, `戰吼:你的主公獲得 ${n} 點護甲。`, `Battlecry: Your hero gains ${n} Armor.`)
    },
  },
  {
    key: 'bc-heal-hero',
    weight: 0.6,
    points: 1,
    when: (c) => c.s.politics >= 76,
    emit: (o, c) => {
      const n = c.mag < 0.4 ? 4 : 3
      o.battlecry = { ops: [{ op: 'heal', amount: n, target: 'friendlyHero' }] }
      o.points += 1
      t(o, `戰吼:你的主公恢復 ${n} 點生命。`, `Battlecry: Restore ${n} Health to your hero.`)
    },
  },
  {
    key: 'bc-heal-general',
    points: 1,
    when: (c) => c.s.charisma >= 76 && c.s.politics >= 68,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'heal', amount: 3, target: 'chosenFriendlyGeneral' }] }
      o.points += 1
      t(o, '戰吼:使一名友方武將恢復 3 點生命。', 'Battlecry: Restore 3 Health to a friendly general.')
    },
  },

  // ══════ 战吼 · 控制与干扰 ══════
  {
    key: 'bc-freeze',
    points: 1.5,
    when: (c) => c.s.intelligence >= 80,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'freeze', target: 'chosenEnemyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:凍結一名敵方武將。', 'Battlecry: Freeze an enemy general.')
    },
  },
  {
    key: 'bc-freeze-all',
    points: 3.5,
    minRank: 2,
    when: (c) => c.s.intelligence >= 88,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'freeze', target: 'allEnemyGenerals' }] }
      o.points += 3.5
      t(o, '戰吼:凍結所有敵方武將。', 'Battlecry: Freeze all enemy generals.')
    },
  },
  {
    key: 'bc-silence',
    points: 1.5,
    when: (c) => c.s.intelligence >= 80 && c.s.politics >= 72,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'silence', target: 'chosenEnemyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:沉默一名敵方武將。', 'Battlecry: Silence an enemy general.')
    },
  },
  {
    key: 'bc-return',
    points: 2,
    when: (c) => c.s.intelligence >= 78,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'returnToHand', target: 'chosenEnemyGeneral' }] }
      o.points += 2
      t(o, '戰吼:將一名敵方武將移回其手牌。', "Battlecry: Return an enemy general to its owner's hand.")
    },
  },
  {
    key: 'bc-swap',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 82,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'swapStats', target: 'chosenEnemyGeneral' }] }
      o.points += 1.5
      t(o, '戰吼:交換一名敵方武將的攻擊力與最大生命。', "Battlecry: Swap an enemy general's Attack and max Health.")
    },
  },
  {
    key: 'bc-seize',
    points: 4.5,
    minRank: 3,
    when: (c) => c.s.charisma >= 88 || c.s.politics >= 90,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'seize', target: 'randomEnemyGeneral' }] }
      o.points += 4.5
      t(o, '戰吼:策反一名隨機敵方武將。', 'Battlecry: Take control of a random enemy general.')
    },
  },
  {
    key: 'bc-banish',
    points: 5,
    minRank: 3,
    when: (c) => c.s.war >= 88 && c.s.charisma < 76,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'banish', target: 'chosenEnemyGeneral' }] }
      o.points += 5
      t(o, '戰吼:放逐一名敵方武將(不觸發亡語)。', 'Battlecry: Banish an enemy general. It does not trigger Deathrattles.')
    },
  },

  // ══════ 亡语 ══════
  {
    key: 'dr-strike',
    points: 1.5,
    when: (c) => c.s.war >= 76,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'damage', amount: 2, target: 'randomEnemyGeneral' }] }
      o.points += 1.5
      t(o, '亡語:對隨機一名敵方武將造成 2 點傷害。', 'Deathrattle: Deal 2 damage to a random enemy general.')
    },
  },
  {
    key: 'dr-summon',
    weight: 0.7,
    points: 1,
    when: (c) => c.s.leadership >= 74,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] }
      o.points += 1
      t(o, '亡語:召喚一個 1/1 的死士。', 'Deathrattle: Summon a 1/1 Retainer.')
    },
  },
  {
    key: 'dr-draw',
    weight: 0.6,
    points: 1.5,
    when: (c) => c.s.intelligence >= 74,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'draw', count: 1 }] }
      o.points += 1.5
      t(o, '亡語:抽一張牌。', 'Deathrattle: Draw a card.')
    },
  },
  {
    key: 'dr-blast',
    points: 2.5,
    minRank: 2,
    when: (c) => c.s.war >= 84,
    eras: ['ming-qing'], // 火药
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'aoeDamage', amount: 2 }] }
      o.points += 2.5
      t(o, '亡語:對所有敵方武將造成 2 點傷害。', 'Deathrattle: Deal 2 damage to all enemy generals.')
    },
  },
  {
    key: 'dr-armor',
    points: 1.5,
    when: (c) => c.s.leadership >= 78 && c.s.politics >= 70,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'gainArmor', amount: 3 }] }
      o.points += 1.5
      t(o, '亡語:你的主公獲得 3 點護甲。', 'Deathrattle: Your hero gains 3 Armor.')
    },
  },
  {
    key: 'dr-legacy',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.charisma >= 80,
    emit: (o) => {
      o.deathrattle = { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'allFriendlyOthers' }] }
      o.points += 1.5
      t(o, '亡語:其他友方武將+1/+1。', 'Deathrattle: Give your other generals +1/+1.')
    },
  },
  {
    key: 'dr-avenge',
    points: 2,
    minRank: 1,
    when: (c) => c.s.war >= 80 && c.s.charisma >= 74,
    emit: (o, c) => {
      const e = eliteToken(c.dynasty)
      o.deathrattle = { ops: [{ op: 'summon', defId: e.defId, count: 1 }] }
      o.points += e.pts * 0.8
      t(o, `亡語:召喚一個${e.zh}。`, `Deathrattle: Summon ${e.en}.`)
    },
  },

  // ══════ 回合触发 ══════
  {
    key: 'eot-draw',
    points: 4,
    minRank: 2,
    when: (c) => c.s.intelligence >= 86 && c.cost >= 5,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'draw', count: 1 }] }
      o.points += 4
      t(o, '在你的回合結束時,抽一張牌。', 'At the end of your turn, draw a card.')
    },
  },
  {
    key: 'eot-armor',
    points: 2,
    minRank: 1,
    when: (c) => c.s.leadership >= 80,
    eras: ['song-yuan'],
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'gainArmor', amount: 2 }] }
      o.points += 2
      t(o, '在你的回合結束時,你的主公獲得 2 點護甲。', 'At the end of your turn, your hero gains 2 Armor.')
    },
  },
  {
    key: 'eot-harry',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.war >= 78 && c.s.intelligence < 80,
    emit: (o) => {
      o.endOfTurn = { ops: [{ op: 'damage', amount: 1, target: 'randomEnemyGeneral' }] }
      o.points += 2.5
      t(o, '在你的回合結束時,對隨機一名敵方武將造成 1 點傷害。', 'At the end of your turn, deal 1 damage to a random enemy general.')
    },
  },
  {
    key: 'sot-heal',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.politics >= 80,
    emit: (o) => {
      o.startOfTurn = { ops: [{ op: 'heal', amount: 2, target: 'friendlyHero' }] }
      o.points += 1.5
      t(o, '在你的回合開始時,你的主公恢復 2 點生命。', 'At the start of your turn, restore 2 Health to your hero.')
    },
  },
  {
    key: 'sot-grow',
    points: 3,
    minRank: 1,
    when: (c) => c.s.war >= 82 || c.s.leadership >= 84,
    emit: (o) => {
      o.startOfTurn = { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] }
      o.points += 3
      t(o, '在你的回合開始時,此武將+1/+1。', 'At the start of your turn, this general gains +1/+1.')
    },
  },
  {
    key: 'sot-levy',
    points: 3.5,
    minRank: 3,
    when: (c) => c.s.leadership >= 88,
    emit: (o) => {
      o.startOfTurn = { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] }
      o.points += 3.5
      t(o, '在你的回合開始時,召喚一個 1/1 的死士。', 'At the start of your turn, summon a 1/1 Retainer.')
    },
  },

  // ══════ 攻击 / 受伤触发 ══════
  {
    key: 'oa-scout',
    points: 3,
    minRank: 1,
    when: (c) => c.s.war >= 76 && c.s.intelligence >= 76,
    emit: (o) => {
      o.onAttack = { ops: [{ op: 'draw', count: 1 }] }
      o.points += 3
      t(o, '此武將攻擊後,抽一張牌。', 'After this general attacks, draw a card.')
    },
  },
  {
    key: 'oa-press',
    points: 2,
    when: (c) => c.s.war >= 82,
    eras: ['sui-tang', 'song-yuan'],
    emit: (o) => {
      o.onAttack = { ops: [{ op: 'damage', amount: 1, target: 'enemyHero' }] }
      o.points += 2
      t(o, '此武將攻擊後,對敵方主公造成 1 點傷害。', 'After this general attacks, deal 1 damage to the enemy hero.')
    },
  },
  {
    key: 'oa-momentum',
    points: 2,
    when: (c) => c.s.war >= 80 && c.s.leadership < 82,
    emit: (o) => {
      o.onAttack = { ops: [{ op: 'buffStats', attack: 1, health: 0, target: 'self' }] }
      o.points += 2
      t(o, '此武將攻擊後,獲得+1/+0。', 'After this general attacks, it gains +1/+0.')
    },
  },
  {
    key: 'od-rally',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.leadership >= 78,
    emit: (o) => {
      o.onDamaged = { ops: [{ op: 'summon', defId: 'token-si-shi', count: 1 }] }
      o.points += 2.5
      t(o, '此武將受傷後,召喚一個 1/1 的死士。', 'After this general takes damage, summon a 1/1 Retainer.')
    },
  },
  {
    key: 'od-brace',
    points: 1.5,
    when: (c) => c.s.leadership >= 74 && c.s.politics >= 68,
    emit: (o) => {
      o.onDamaged = { ops: [{ op: 'gainArmor', amount: 1 }] }
      o.points += 1.5
      t(o, '此武將受傷後,你的主公獲得 1 點護甲。', 'After this general takes damage, your hero gains 1 Armor.')
    },
  },
  {
    key: 'enrage',
    points: 1.5,
    when: (c) => c.s.war >= 78 && c.s.politics < 76,
    emit: (o, c) => {
      const n = c.mag < 0.35 ? 3 : 2
      o.enrage = n
      o.points += n * 0.6
      t(o, `激怒:受傷時+${n}/+0。`, `Enrage: +${n}/+0 while damaged.`)
    },
  },
  {
    key: 'os-scholar',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 82,
    eras: ['pre-qin'],
    emit: (o) => {
      o.onSpellCast = { ops: [{ op: 'buffStats', attack: 1, health: 1, target: 'self' }] }
      o.points += 2.5
      t(o, '每當你打出一張錦囊,此武將+1/+1。', 'Whenever you play a stratagem, this general gains +1/+1.')
    },
  },
  {
    key: 'spell-damage',
    points: 1.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 80 && c.archetype === 'strategist',
    emit: (o) => {
      o.spellDamage = 1
      o.points += 1.5
      t(o, '法術傷害+1。', 'Spell Damage +1.')
    },
  },

  // ══════ 光环 ══════
  {
    key: 'aura-atk',
    points: 3,
    minRank: 1,
    when: (c) => c.s.charisma >= 82 || (c.s.leadership >= 84 && c.s.war >= 78),
    emit: (o) => {
      o.aura = { scope: 'friendlyOthers', attack: 1, health: 0 }
      o.points += 3
      t(o, '你的其他武將+1/+0。', 'Your other generals have +1/+0.')
    },
  },
  {
    key: 'aura-hp',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.leadership >= 82,
    eras: ['song-yuan', 'ming-qing'],
    emit: (o) => {
      o.aura = { scope: 'friendlyOthers', attack: 0, health: 1 }
      o.points += 2.5
      t(o, '你的其他武將+0/+1。', 'Your other generals have +0/+1.')
    },
  },
  {
    key: 'aura-both',
    points: 4.5,
    minRank: 3,
    when: (c) => c.s.charisma >= 88 && c.s.leadership >= 84,
    emit: (o) => {
      o.aura = { scope: 'friendlyOthers', attack: 1, health: 1 }
      o.points += 4.5
      t(o, '你的其他武將+1/+1。', 'Your other generals have +1/+1.')
    },
  },

  // ══════ 连击 / 抉择 / 过载 ══════
  {
    key: 'combo-ambush',
    points: 3,
    minRank: 1,
    when: (c) => c.s.intelligence >= 78 && c.s.war >= 72,
    eras: ['pre-qin'],
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'damage', amount: 1, target: 'chosenEnemyGeneral' }] }
      o.combo = { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] }
      o.points += 3
      t(o, '戰吼:造成 1 點傷害。連擊:改為造成 4 點。', 'Battlecry: Deal 1 damage. Combo: Deal 4 instead.')
    },
  },
  {
    key: 'combo-relay',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.politics >= 76 && c.s.intelligence >= 74,
    emit: (o) => {
      o.battlecry = { ops: [{ op: 'draw', count: 1 }] }
      o.combo = { ops: [{ op: 'draw', count: 2 }] }
      o.points += 2.5
      t(o, '戰吼:抽一張牌。連擊:改為抽兩張。', 'Battlecry: Draw a card. Combo: Draw two instead.')
    },
  },
  {
    key: 'choose-scholar',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.intelligence >= 78,
    eras: ['pre-qin'],
    only: ['pre-qin'], // 百家争鸣:一张牌两条路,先秦独有
    emit: (o) => {
      o.choose = {
        modes: [
          {
            label: { zh: '進言', en: 'Counsel' },
            script: { ops: [{ op: 'draw', count: 1 }] },
          },
          {
            label: { zh: '斥責', en: 'Rebuke' },
            script: { ops: [{ op: 'damage', amount: 2, target: 'chosenEnemyGeneral' }] },
          },
        ],
      }
      o.points += 2.5
      t(o, '抉擇:抽一張牌;或造成 2 點傷害。', 'Choose One: Draw a card; or deal 2 damage.')
    },
  },
  {
    key: 'choose-marshal',
    points: 2.5,
    minRank: 1,
    when: (c) => c.s.leadership >= 80,
    eras: ['qin-han'],
    only: ['qin-han'],
    emit: (o) => {
      o.choose = {
        modes: [
          {
            label: { zh: '徵發', en: 'Levy' },
            script: { ops: [{ op: 'summon', defId: 'token-si-shi', count: 2 }] },
          },
          {
            label: { zh: '築壘', en: 'Fortify' },
            script: { ops: [{ op: 'gainArmor', amount: 5 }] },
          },
        ],
      }
      o.points += 2.5
      t(o, '抉擇:召喚兩個 1/1 的死士;或獲得 5 點護甲。', 'Choose One: Summon two 1/1 Retainers; or gain 5 Armor.')
    },
  },
  {
    key: 'overload-raid',
    // 过载是**代价**,所以同样的爆发只收 3 点而不是 5 点 —— 差价就是过载的折扣。
    points: 3,
    minRank: 1,
    when: (c) => c.s.war >= 84 && c.cost >= 3,
    eras: ['song-yuan'], // 蒙古骑射:一次冲垮,下回合喘不过气
    emit: (o) => {
      o.overload = 1
      o.battlecry = { ops: [{ op: 'damage', amount: 4, target: 'chosenEnemyGeneral' }] }
      o.points += 3
      t(o, '戰吼:造成 4 點傷害。過載:(1)', 'Battlecry: Deal 4 damage. Overload: (1)')
    },
  },
]

// ---------- 抽签 ----------

// 效果命中率:按稀有度递增。传奇必中 —— content.test 有一条闸门
//(「所有可收集传奇武将都有中文风味文本」)靠效果文本兜底。
const EFFECT_GATE: Record<Rarity, number> = {
  common: 0.82,
  rare: 0.92,
  epic: 0.97,
  legendary: 1,
}

// 一张卡最多能为效果掏多少点数。留下至少约 3 点身材,
// 否则 1 费卡会被削成 1/1 还背一个 4 点的效果 —— 那种卡没人会打。
function affordable(budget: number): number {
  return Math.max(1.5, budget - 2.6)
}

export function seedMechanics(
  id: string,
  s: Stats,
  archetype: 'warrior' | 'strategist',
  rarity: Rarity,
  hasKeyword: string | null,
  era: Era,
  dynasty: DynastyTag,
  cost: number,
  budget: number,
  deeds: string[] = [],
  traits: string[] = [],
): Seeded {
  const out: Seeded = { keywords: [], points: 0, textZh: [], textEn: [], shape: null }
  if (hasKeyword) {
    out.keywords.push(hasKeyword)
    out.points += KEYWORD_POINTS[hasKeyword] ?? 1
    out.textZh.push(KEYWORD_TEXT[hasKeyword].zh)
    out.textEn.push(KEYWORD_TEXT[hasKeyword].en)
  }

  const ctx: Ctx = {
    id,
    s,
    archetype,
    rarity,
    era,
    dynasty,
    cost,
    budget,
    mag: hash01(id, 'mag'),
    kw: hasKeyword,
    deeds,
    traits,
  }

  // 已经带了关键词的卡再给效果容易变成「什么都会」,命中率打八折。
  // 传奇不打折 —— 传奇本来就该是「什么都会」的那种牌。
  // 同上:事迹**不放宽**这道闸门(见 seedKeyword 里那段实测)。
  //
  // 唯一的例外是**既无事迹也无性格的那批**(史书只留下一句「蜀漢將。隨諸葛亮北伐」)。
  // 他们够不着任何一条看画像的候选,只能拿 0.3 点的无名微效果 ——
  // 而 0.3 低于 payFor 的扣款门槛,**身材一分不动**。
  // 于是这道放行在构成上是中性的(冒险模式塌陷的根因是身材缩水,不是效果变多),
  // 换来的是全池最大的同质组从 39 张散开。
  const anonymous = deeds.length === 0 && traits.length === 0
  const gate = anonymous ? 1 : EFFECT_GATE[rarity] * (hasKeyword && rarity !== 'legendary' ? 0.9 : 1)
  if (hash01(id, 'effgate') >= gate) return out

  // 预算里已经被关键词吃掉的部分要扣掉,免得「关键词 + 大效果」把身材削穿
  const cap = affordable(budget) - out.points
  const live = POOL.filter(
    (cd) =>
      cd.points <= cap &&
      RANK[rarity] >= (cd.minRank ?? 0) &&
      (cd.only === undefined || cd.only.includes(era)) &&
      cd.when(ctx),
  )
  if (live.length === 0) return out

  // 事迹标签点名的效果形状,权重抬 DEED_BOOST 倍 —— 这一行就是
  // 「加权随机」变成「有出处的确定性」的地方。
  const want = deedWants(deeds, traits)
  const w = live.map(
    (cd) =>
      (cd.weight ?? 1) *
      (cd.eras?.includes(era) ? ERA_BOOST : 1) *
      (want.shapes.get(cd.key) ?? 1),
  )
  const total = w.reduce((a, b) => a + b, 0)
  let r = hash01(id, 'effpick') * total
  let chosen = live[live.length - 1]
  for (let i = 0; i < live.length; i++) {
    r -= w[i]
    if (r <= 0) {
      chosen = live[i]
      break
    }
  }
  chosen.emit(out, ctx)
  out.shape = chosen.key
  return out
}
