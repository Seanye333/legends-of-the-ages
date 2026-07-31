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

export function seedKeyword(id: string, s: Stats, archetype: string, rarity: Rarity, era: Era, dynasty: DynastyTag, cost = 4): string | null {
  // 约 44% 的卡带关键词(此前约三分之一)
  if (hash01(id, 'kwgate') >= 0.44) return null
  const ctx: KwCtx = { id, s, archetype: archetype as Ctx['archetype'], rarity, era, dynasty, cost }
  const live = KEYWORD_POOL.filter((k) => k.when(ctx))
  if (live.length === 0) return null
  const w = live.map((k) => k.weight * (k.eras?.includes(era) ? ERA_BOOST : 1))
  const total = w.reduce((a, b) => a + b, 0)
  let r = hash01(id, 'kwpick') * total
  for (let i = 0; i < live.length; i++) {
    r -= w[i]
    if (r <= 0) return live[i].kw
  }
  return live[live.length - 1].kw
}

// ---------- 效果候选池 ----------
//
// 权重是相对的,不是概率。同一张卡通常有 10-25 个候选命中条件,
// 权重决定它们之间的份额。定价(points)必须诚实 —— 它会从身材里扣。

const POOL: Cand[] = [
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
  }

  // 已经带了关键词的卡再给效果容易变成「什么都会」,命中率打八折。
  // 传奇不打折 —— 传奇本来就该是「什么都会」的那种牌。
  const gate = EFFECT_GATE[rarity] * (hasKeyword && rarity !== 'legendary' ? 0.9 : 1)
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

  const w = live.map((cd) => (cd.weight ?? 1) * (cd.eras?.includes(era) ? ERA_BOOST : 1))
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
