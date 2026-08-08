// `lint-content` 的判定层 —— 纯函数,不读文件、不打印、不 exit。
//
// 【为什么要抽出来(铁律 11)】
// 这道闸门有 12 条规则、24 处判断,其中 **7 条是 error 级** —— `--strict` 下它们
// 决定 CI 红不红。而在此之前它们**一行测试都没有**。
//
// 这正是本仓库最贵的那种失败模式:一条规则的条件写错了(正则失配、字段名改了、
// 提前 `continue` 了),它就**永远不再报警**,而 CI 一路绿灯。
// `perf-budget` 的 chunk 基线就是这么失效的 —— 正则失配时只 `console.warn`,
// 打包分块一改名它就不守任何东西了,谁都没发现。
//
// 抽出来之后每条规则都能喂合成数据**两个方向**各验一遍:该报的必须报,
// 不该报的必须不报。几毫秒跑完,不必扫两千多张真卡。
import type { CardDef, EffectCondition, EffectOp, EffectScript } from '../src/engine/types'
import { requiresChosenTarget } from '../src/engine/resolve'
import { isNoOp } from './pricing'

export type Level = 'error' | 'warn' | 'info'
export interface Issue {
  level: Level
  rule: string
  card?: string
  msg: string
}

/** 一张卡上所有脚本的扁平列表(含抉择的每个模式、伏兵、连击、军令奖励)。 */
export function allScripts(c: CardDef): EffectScript[] {
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

/**
 * 伏笔(delay)把一整段脚本包在 op 里,所以 ops 是**树**而不是列表。
 * 不展开的话,埋在伏笔里的引用错误一条都查不出来。
 */
export function flattenOps(ops: EffectOp[]): EffectOp[] {
  return ops.flatMap((op) => (op.op === 'delay' ? [op, ...flattenOps(op.script.ops)] : [op]))
}

export function allOps(c: CardDef): EffectOp[] {
  return flattenOps(allScripts(c).flatMap((s) => s.ops))
}

/**
 * 一张卡上所有脚本的**条件**(含伏笔里嵌的那一层)。
 *
 * `thin-mechanic` 只数 op,而条件不是 op —— 于是「引擎支持这个条件、
 * DSL 里有它、卡池里一张都没有」这件事**从来没有任何东西看得见**。
 * 实测出来的结果相当难看,见 checkContent 里 unused-condition 那一段。
 */
export function allConditions(c: CardDef): EffectCondition[] {
  const out: EffectCondition[] = []
  for (const s of allScripts(c)) {
    if (s.condition) out.push(s.condition)
    // 伏笔把一整段脚本包在 op 里,那一段自己也可以带条件
    for (const op of flattenOps(s.ops)) {
      if (op.op === 'delay' && op.script.condition) out.push(op.script.condition)
    }
  }
  return out
}

/**
 * `EffectCondition` 的全部键。
 *
 * **下面那行编译期断言保证这份清单不会漏。** 手写清单的通病是加了新条件没人来更新它,
 * 而这里漏一个的后果正好是「那个新条件永远不会被报成没人用」——
 * 也就是这条规则默默失效。所以让 tsc 来守:漏一个键就编译不过。
 */
export const CONDITION_KEYS = [
  'ifDynastyCount',
  'ifBoardCount',
  'ifHeroHpBelow',
  'ifHandCount',
  'ifKeywordCount',
  'ifMorale',
  'ifSupply',
  'ifSky',
  'ifChain',
  'ifTroopCount',
  'ifField',
  'ifTurnAtLeast',
  'ifGraveyardCount',
  'ifEnemyHeroHpBelow',
] as const

// 漏一个键这里就红 —— 不是注释里的约定,是编译器守的
type MissingConditionKey = Exclude<keyof EffectCondition, (typeof CONDITION_KEYS)[number]>
const _conditionKeysAreComplete: MissingConditionKey extends never ? true : never = true
void _conditionKeysAreComplete

/** op 指向的那张卡的 id(summon / transform / addToHand 三种)。 */
export function referencedId(op: EffectOp): string | undefined {
  if (op.op === 'summon' || op.op === 'summonForEnemy') return op.defId
  if (op.op === 'transform') return op.into
  if (op.op === 'addToHand') return op.defId
  return undefined
}

export interface RuleInput {
  /** 全部卡(含衍生物)—— 结构性规则扫这一份 */
  all: CardDef[]
  /** 可收集的那些 —— 文案/覆盖度规则只该扫这一份(衍生物没有卡面) */
  collectible: CardDef[]
}

/**
 * 跑完全部规则。**顺序与 lint-content 抽出来之前逐条对应**,
 * 所以同一份卡池产出的 issue 集合不变。
 */
export function checkContent({ all, collectible }: RuleInput): Issue[] {
  const issues: Issue[] = []
  const add = (level: Level, rule: string, msg: string, card?: string) =>
    issues.push({ level, rule, msg, card })
  const byId = new Map(all.map((c) => [c.id, c]))

  // ---- error:引用了不存在的卡 ----
  // 失败模式是**运行时静默无事发生**:summon 一个不存在的 defId,引擎查不到就跳过,
  // 玩家只看到「战吼发动了但什么都没出来」。
  for (const c of all) {
    for (const op of allOps(c)) {
      const ref = referencedId(op)
      if (ref && !byId.has(ref)) {
        add('error', 'dangling-ref', `${op.op} 指向不存在的卡 ${ref}`, c.id)
      }
    }
    for (const m of c.bond?.members ?? []) {
      if (!byId.has(m)) add('error', 'dangling-ref', `羁绊成员 ${m} 不存在`, c.id)
    }
    if (c.rival && !byId.has(c.rival.foe)) {
      add('error', 'dangling-ref', `宿敌 ${c.rival.foe} 不存在`, c.id)
    }
  }

  // ---- error:类型与字段对不上 ----
  for (const c of all) {
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
  for (const c of all) {
    for (const s of allScripts(c)) {
      const i = s.ops.findIndex((o) => o.op === 'discover')
      if (i >= 0 && i !== s.ops.length - 1) {
        add('error', 'discover-not-last', `发现之后还有 ${s.ops.length - 1 - i} 个 op,永远不会执行`, c.id)
      }
    }
  }

  // ---- error:军令状 ----
  // 奖励不能要目标:军令达成的那一刻玩家正在做别的事(打牌、交换),没法再弹一次
  // 目标选择,于是 runScript 会走 degradeChosen 把它**退化成随机** ——
  // 卡面写着「消灭一个敌将」,实际打的是随机一个。典型的静默失效。
  for (const c of all) {
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
  for (const c of all) {
    if (c.choose && c.combo) add('error', 'exclusive', '抉择与连击互斥(reducer 的优先级依赖这条)', c.id)
    if (c.choose && (c.battlecry || c.spell)) {
      add('error', 'exclusive', '抉择卡不该再留 battlecry/spell —— 那是死代码', c.id)
    }
  }

  // ---- warn:双语文案 ----
  for (const c of collectible) {
    if (!c.name.en?.trim()) add('warn', 'i18n', '缺英文卡名', c.id)
    if (c.text?.zh && !c.text.en?.trim()) add('warn', 'i18n', '有中文卡面文案但缺英文', c.id)
    const hasEffect = allScripts(c).length > 0 || c.aura || c.bond || c.rival || c.formation
    if (hasEffect && !c.text?.zh?.trim()) {
      add('warn', 'silent-effect', '有效果却没有卡面文案 —— 玩家看不见它会做什么', c.id)
    }
  }

  // ---- warn:军需 / 阵形写没写在卡面上 ----
  for (const c of collectible) {
    if ((c.supplyCost ?? 0) > 0 && !(c.text?.zh ?? '').includes(`軍需 ${c.supplyCost}`)) {
      add('warn', 'text-mismatch', `军需 ${c.supplyCost} 没写在卡面上`, c.id)
    }
    if (c.formation && !(c.text?.zh ?? '').includes(c.formation.name.zh)) {
      add('warn', 'text-mismatch', `阵形「${c.formation.name.zh}」没写在卡面上`, c.id)
    }
  }

  // ---- 数值离谱 ----
  for (const c of collectible) {
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
  for (const c of collectible) {
    for (const op of new Set(allOps(c).map((o) => o.op))) {
      opCount.set(op, (opCount.get(op) ?? 0) + 1)
    }
  }
  for (const [op, n] of [...opCount].sort((a, b) => a[1] - b[1])) {
    if (n <= 2) add('info', 'thin-mechanic', `op ${op} 全池只有 ${n} 张卡在用`)
  }

  // ---- 引擎支持、卡池不用的**条件** ----
  //
  // 【为什么单独有这一条,而不是靠 thin-mechanic】
  // thin-mechanic 数的是 op,而条件不是 op —— 于是「DSL 里有 `ifSupply`、
  // 引擎认得它、而全池一张卡都不用它」这件事**从来没有任何东西看得见**。
  //
  // 2026-08-07 第一次跑出来的结果:`ifSupply` / `ifMorale` / `ifChain` /
  // `ifGraveyardCount` / `ifField` **各 0 张**,而同时有 **145 张卡产屯粮、
  // 111 张卡涨士气**。也就是说这两条资源轴是**只写不读**的:
  // 玩家攒了一局的粮,没有任何一张牌会因此变强。
  //
  // 这和 `pricing.unusedWeights` 抓的是同一类东西(「表里有、卡里没有」),
  // 只是那边是定价权重,这边是引擎能力 —— 都是**在假装被用过**的功能。
  const condCount = new Map<string, number>()
  for (const k of CONDITION_KEYS) condCount.set(k, 0)
  for (const c of collectible) {
    const keys = new Set(allConditions(c).flatMap((cond) => Object.keys(cond)))
    for (const k of keys) condCount.set(k, (condCount.get(k) ?? 0) + 1)
  }
  for (const [k, n] of [...condCount].sort((a, b) => a[1] - b[1])) {
    if (n === 0) {
      add(
        'warn',
        'unused-condition',
        `条件 ${k} 引擎支持、DSL 里有,而**全池一张卡都不用它** —— 它在假装被用过`,
      )
    } else if (n <= 2) {
      add('info', 'thin-condition', `条件 ${k} 全池只有 ${n} 张卡在用`)
    }
  }

  // ---- warn:量为 0 的 op —— 它**恒等于什么都不做** ----
  // 见 scripts/pricing.ts 的 isNoOp。根因在生成层,没有素材源改不了,
  // 所以只报不修 —— 让它可见、不让它变多。
  for (const c of collectible) {
    for (const op of allOps(c)) {
      if (isNoOp(op)) add('warn', 'no-op', `${op.op} 的量是 0 —— 这一步恒等于什么都不做`, c.id)
    }
  }

  return issues
}
