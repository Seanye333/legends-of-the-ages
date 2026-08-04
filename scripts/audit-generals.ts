// 武将档案覆盖率盘点 —— 「把武将做细致」这条主线的进度表。
// 运行:npm run audit-generals
//
// 【为什么要有它】
// 2,258 名武将,靠印象根本说不清「还差多少」。而这条主线的每一步
// (导入源头 → 按事迹播种 → 手写补缺)都需要先知道**先做谁性价比最高**。
// 所以先有尺子,再动手 —— 凭印象写大表必漏,这个项目上交过学费。
import { COLLECTIBLE_CARDS } from '../src/content/cards'
import { LORE as GEN_LORE } from '../src/content/generated/lore.gen'
import { LORE_OVERRIDES } from '../src/content/overrides/lore-quotes'

// 生成层 ⊕ 手写补遗 —— 和游戏里(loreLazy)看到的是同一份,
// 否则这把尺子量的不是玩家看到的东西。
const LORE: Record<string, (typeof GEN_LORE)[string]> = { ...GEN_LORE }
for (const [id, ov] of Object.entries(LORE_OVERRIDES)) LORE[id] = { ...LORE[id], ...ov }
import type { CardDef } from '../src/engine/types'

const G = COLLECTIBLE_CARDS.filter((c) => c.type === 'general')
const pct = (n: number, of = G.length) => `${((100 * n) / of).toFixed(1)}%`

const FIELDS: [string, (c: CardDef) => boolean][] = [
  ['生平 bio', (c) => Boolean(LORE[c.id]?.bio?.zh)],
  ['表字', (c) => Boolean(LORE[c.id]?.courtesy?.zh)],
  ['籍贯', (c) => Boolean(LORE[c.id]?.home?.zh)],
  ['生卒年', (c) => Boolean(LORE[c.id]?.life?.zh)],
  ['官爵', (c) => Boolean(LORE[c.id]?.office?.zh)],
  ['绰号', (c) => Boolean(LORE[c.id]?.alias?.zh)],
  ['五维', (c) => Boolean(LORE[c.id]?.stats)],
  ['性格特质', (c) => Boolean(LORE[c.id]?.traits?.length)],
  ['尊号', (c) => Boolean(LORE[c.id]?.era?.zh)],
  ['名言', (c) => Boolean(LORE[c.id]?.quote?.zh)],
  ['绝命诗', (c) => Boolean(LORE[c.id]?.poem?.zh)],
  ['出战台词', (c) => Boolean(LORE[c.id]?.line?.zh)],
  ['家族', (c) => Boolean(c.clan)],
]

console.log(`武将 ${G.length} 名\n【档案覆盖率】`)
for (const [label, has] of FIELDS) {
  const n = G.filter(has).length
  const bar = '█'.repeat(Math.round((20 * n) / G.length)).padEnd(20, '·')
  console.log(`  ${label.padEnd(10)} ${bar} ${String(n).padStart(5)}  ${pct(n).padStart(6)}`)
}

// 按稀有度分层 —— 手写补缺永远从传奇往下做
console.log('\n【按稀有度:还缺生平的】')
for (const r of ['legendary', 'epic', 'rare', 'common'] as const) {
  const tier = G.filter((c) => c.rarity === r)
  const miss = tier.filter((c) => !LORE[c.id]?.bio?.zh)
  console.log(`  ${r.padEnd(10)} ${String(miss.length).padStart(4)} / ${String(tier.length).padStart(4)} 缺  (${pct(miss.length, tier.length)})`)
  if (miss.length > 0 && miss.length <= 12) {
    console.log(`     ${miss.map((c) => c.name.zh).join('、')}`)
  }
}

// 机制重复度 —— 第二条主线的尺子。
//
// 【2026-08-02 修了这把尺子】
// 原来只看 battlecry / deathrattle / aura 三样,于是**只带回合触发的卡在尺子眼里
// 等于白板**:anon-forage(回合结束屯粮)、anon-runner(攻击后士气)、
// 营建型(回合结束护甲)全被算成同一张牌。
// 那批微效果本来就是**专门为最大同质组做的**,做完了尺子却看不见 ——
// 于是「加了效果、重复度反而涨」这种读数是尺子给的,不是卡池给的。
// 现在把全部机制字段都算进指纹。
const fp = (c: CardDef) =>
  JSON.stringify([
    c.cost, c.attack, c.health, [...c.keywords].sort(), c.troop,
    c.battlecry?.ops, c.deathrattle?.ops, c.aura,
    c.endOfTurn?.ops, c.startOfTurn?.ops, c.onAttack?.ops, c.onDamaged?.ops, c.onSpellCast?.ops,
    c.combo?.ops, c.choose, c.enrage, c.overload, c.spellDamage, c.formation, c.clan?.id,
  ])
const groups = new Map<string, CardDef[]>()
for (const c of G) groups.set(fp(c), [...(groups.get(fp(c)) ?? []), c])
const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
const twinned = sorted.filter((g) => g.length > 1).reduce((n, g) => n + g.length, 0)
console.log('\n【机制重复度】')
console.log(`  不同的费/攻/血组合   ${new Set(G.map((c) => `${c.cost}/${c.attack}/${c.health}`)).size} 种`)
console.log(`  不同的机制指纹       ${groups.size} 种`)
console.log(`  有双胞胎的武将       ${twinned} 名  ${pct(twinned)}   ← 这条要降下来`)
console.log(`  最大同质组           ${sorted[0].length} 张(${sorted[0][0].cost}费 ${sorted[0][0].attack}/${sorted[0][0].health})`)
