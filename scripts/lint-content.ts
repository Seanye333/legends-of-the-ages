// 内容 lint —— 扫全池,报告结构性问题。
// 运行:npm run lint-content(带 --strict 时有 error 就退出码 1)
//
// 【它和 content.test.ts 的分工】
// 测试是**闸门**:每一条都必须永远为真,红了就不许合。所以那里只放
// 「违反了就一定是 bug」的规则。
//
// lint 是**清单**:它报告的东西大多不是 bug,而是「你可能忘了」——
// 缺英文文案、效果指向了一张不存在的牌、锦囊写了身材、羁绊成员对不上……
// 这些逐条判断都需要人看一眼,做成红线只会逼着大家去糊弄它。
//
// 分三级:
//   error —— 一定是错的(引用了不存在的 id、锦囊带身材)。--strict 下会失败。
//   warn  —— 很可能是忘了(没有英文文案、传奇没有风味文本)。
//   info  —— 值得知道(某个机制全池只有一张卡在用)。
import { CARDS, CARDS_BY_ID, COLLECTIBLE_CARDS } from '../src/content/cards'
import type { CardDef, EffectOp, EffectScript } from '../src/engine/types'
import { requiresChosenTarget } from '../src/engine/resolve'

const STRICT = process.argv.includes('--strict')

type Level = 'error' | 'warn' | 'info'
interface Issue {
  level: Level
  rule: string
  card?: string
  msg: string
}
const issues: Issue[] = []
const add = (level: Level, rule: string, msg: string, card?: string) =>
  issues.push({ level, rule, msg, card })

// 一张卡上所有脚本的扁平列表(含抉择的每个模式、伏兵、连击)
function allScripts(c: CardDef): EffectScript[] {
  const out: (EffectScript | undefined)[] = [
    c.battlecry,
    c.deathrattle,
    c.spell,
    c.endOfTurn,
    c.startOfTurn,
    c.onDamaged,
    c.onAttack,
    c.onSpellCast,
    c.combo,
    c.secret?.script,
    // 军令状的奖励也是一段脚本 —— 漏掉它,「奖励里 summon 了一张不存在的卡」
    // 这种错就永远扫不出来(而它的表现是达成军令后什么都没发生)
    c.quest?.reward,
    ...(c.choose?.modes.map((m) => m.script) ?? []),
  ]
  return out.filter((x): x is EffectScript => x !== undefined)
}

// 伏笔(delay)把一整段脚本包在 op 里,所以 ops 是**树**而不是列表。
// 不展开的话,埋在伏笔里的引用错误一条都查不出来。
function flattenOps(ops: EffectOp[]): EffectOp[] {
  return ops.flatMap((op) => (op.op === 'delay' ? [op, ...flattenOps(op.script.ops)] : [op]))
}

function allOps(c: CardDef): EffectOp[] {
  return flattenOps(allScripts(c).flatMap((s) => s.ops))
}

// ---- error:引用了不存在的卡 ----
// 这一条的失败模式是**运行时静默无事发生**:summon 一个不存在的 defId,
// 引擎查不到就跳过,玩家只看到「战吼发动了但什么都没出来」。
for (const c of CARDS) {
  for (const op of allOps(c)) {
    const ref =
      op.op === 'summon' || op.op === 'summonForEnemy'
        ? op.defId
        : op.op === 'transform'
          ? op.into
          : op.op === 'addToHand'
            ? op.defId
            : undefined
    if (ref && !CARDS_BY_ID[ref]) {
      add('error', 'dangling-ref', `${op.op} 指向不存在的卡 ${ref}`, c.id)
    }
  }
  for (const m of c.bond?.members ?? []) {
    if (!CARDS_BY_ID[m]) add('error', 'dangling-ref', `羁绊成员 ${m} 不存在`, c.id)
  }
  if (c.rival && !CARDS_BY_ID[c.rival.foe]) {
    add('error', 'dangling-ref', `宿敌 ${c.rival.foe} 不存在`, c.id)
  }
}

// ---- error:类型与字段对不上 ----
for (const c of CARDS) {
  if (c.type === 'stratagem' && (c.attack !== undefined || c.health !== undefined)) {
    add('error', 'type-shape', '锦囊不该有攻/血', c.id)
  }
  if (c.type === 'general' && (c.attack === undefined || c.health === undefined)) {
    add('error', 'type-shape', '武将缺攻或血', c.id)
  }
  if (c.type === 'general' && c.secret) {
    add('error', 'type-shape', '伏兵只能是锦囊', c.id)
  }
  if (c.type !== 'general' && c.aura) {
    add('error', 'type-shape', '光环只能挂在武将上(非武将不会留在场上)', c.id)
  }
}

// ---- error:发现必须是脚本的最后一个 op ----
// 引擎见挂起即 break,后面的 op 永远不会跑 —— 写在中间等于静默丢失。
for (const c of CARDS) {
  for (const s of allScripts(c)) {
    const i = s.ops.findIndex((o) => o.op === 'discover')
    if (i >= 0 && i !== s.ops.length - 1) {
      add('error', 'discover-not-last', `发现之后还有 ${s.ops.length - 1 - i} 个 op,永远不会执行`, c.id)
    }
  }
}

// ---- error:军令状的奖励不能要目标 ----
// 军令达成的那一刻玩家正在做别的事(打牌、交换),没法再弹一次目标选择,
// 于是 runScript 会走 degradeChosen 把它**退化成随机** —— 卡面写着「消灭一个敌将」,
// 实际打的是随机一个。这是典型的静默失效:不报错、不崩溃,只是和卡面说的不一样。
for (const c of CARDS) {
  if (!c.quest) continue
  if (c.type !== 'stratagem') {
    add('error', 'type-shape', '军令状只能是锦囊(reducer 只在锦囊分支收军令)', c.id)
  }
  if (requiresChosenTarget(c.quest.reward)) {
    add('error', 'quest-reward-target', '军令奖励要玩家指定目标 —— 达成时无法交互,会静默退化成随机', c.id)
  }
  if (c.quest.goal.count <= 0) {
    add('error', 'quest-goal', `军令目标数是 ${c.quest.goal.count},打出即达成`, c.id)
  }
}

// ---- error:抉择与连击互斥 ----
for (const c of CARDS) {
  if (c.choose && c.combo) add('error', 'exclusive', '抉择与连击互斥(reducer 的优先级依赖这条)', c.id)
  if (c.choose && (c.battlecry || c.spell)) {
    add('error', 'exclusive', '抉择卡不该再留 battlecry/spell —— 那是死代码', c.id)
  }
}

// ---- warn:双语文案 ----
for (const c of COLLECTIBLE_CARDS) {
  if (!c.name.en?.trim()) add('warn', 'i18n', '缺英文卡名', c.id)
  if (c.text?.zh && !c.text.en?.trim()) add('warn', 'i18n', '有中文卡面文案但缺英文', c.id)
  const hasEffect = allScripts(c).length > 0 || c.aura || c.bond || c.rival || c.formation
  if (hasEffect && !c.text?.zh?.trim()) {
    add('warn', 'silent-effect', '有效果却没有卡面文案 —— 玩家看不见它会做什么', c.id)
  }
}

// ---- warn:军需 / 阵形写没写在卡面上(与 content.test.ts 的闸门同源,这里只报告全池)----
for (const c of COLLECTIBLE_CARDS) {
  if ((c.supplyCost ?? 0) > 0 && !(c.text?.zh ?? '').includes(`軍需 ${c.supplyCost}`)) {
    add('warn', 'text-mismatch', `军需 ${c.supplyCost} 没写在卡面上`, c.id)
  }
  if (c.formation && !(c.text?.zh ?? '').includes(c.formation.name.zh)) {
    add('warn', 'text-mismatch', `阵形「${c.formation.name.zh}」没写在卡面上`, c.id)
  }
}

// ---- warn:数值离谱 ----
for (const c of COLLECTIBLE_CARDS) {
  if (c.cost < 0 || c.cost > 10) add('error', 'range', `费用 ${c.cost} 越界`, c.id)
  if (c.type === 'general') {
    if ((c.attack ?? 0) < 0) add('error', 'range', '攻击为负', c.id)
    if ((c.health ?? 0) < 1) add('error', 'range', '生命小于 1', c.id)
  }
  if ((c.overload ?? 0) > 5) add('warn', 'range', `过载 ${c.overload} 过高 —— 基本等于跳过下回合`, c.id)
}

// ---- info:机制覆盖度 ----
// 「全池只有一张卡在用某个机制」通常意味着两件事之一:
// 这个机制刚上线还没铺开,或者它其实没人用得起来。两种都值得知道。
const opCount = new Map<string, number>()
for (const c of COLLECTIBLE_CARDS) {
  for (const op of new Set(allOps(c).map((o) => o.op))) {
    opCount.set(op, (opCount.get(op) ?? 0) + 1)
  }
}
for (const [op, n] of [...opCount].sort((a, b) => a[1] - b[1])) {
  if (n <= 2) add('info', 'thin-mechanic', `op ${op} 全池只有 ${n} 张卡在用`)
}

// ---- 输出 ----
const byLevel = (l: Level) => issues.filter((i) => i.level === l)
const ORDER: Level[] = ['error', 'warn', 'info']
const MARK: Record<Level, string> = { error: '✗', warn: '!', info: '·' }

for (const level of ORDER) {
  const list = byLevel(level)
  if (list.length === 0) continue
  console.log(`\n${MARK[level]} ${level.toUpperCase()} —— ${list.length} 条`)
  // 按规则分组:同一条规则触发几十次时,一条条列出来没人读得完
  const byRule = new Map<string, Issue[]>()
  for (const i of list) {
    const arr = byRule.get(i.rule) ?? []
    arr.push(i)
    byRule.set(i.rule, arr)
  }
  for (const [rule, arr] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  [${rule}] ${arr.length} 条`)
    for (const i of arr.slice(0, 8)) {
      const who = i.card ? `${i.card}(${CARDS_BY_ID[i.card]?.name.zh ?? '?'})` : '—'
      console.log(`    ${who}: ${i.msg}`)
    }
    if (arr.length > 8) console.log(`    …… 还有 ${arr.length - 8} 条`)
  }
}

const errors = byLevel('error').length
console.log(
  `\n扫了 ${CARDS.length} 张(可收集 ${COLLECTIBLE_CARDS.length} 张):` +
    ` ${errors} error / ${byLevel('warn').length} warn / ${byLevel('info').length} info`,
)
if (errors === 0) console.log('✓ 没有结构性错误。')
if (STRICT && errors > 0) process.exit(1)
