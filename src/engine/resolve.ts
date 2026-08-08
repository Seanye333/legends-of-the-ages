// 结算内核:伤害/治疗/抽牌/死亡处理 + 效果 DSL 解释器。
// 所有数值变化都从这里走,保证事件流与状态变化一一对应。
//
// 【附魔层】attack / health / maxHealth / keywords 是派生字段。
// 任何对数值的修改都必须记成一条 Enchant 再 refreshInstance(),而不是直接赋值。
// 这是沉默、临时增益、光环三件事共用的撤销路径 —— 直接改数值就没法还原了。
import type {
  CardDef,
  CardInstance,
  CostFilter,
  CountSource,
  CardLibrary,
  DelayedScript,
  DiscoverPool,
  Doctrine,
  EffectScript,
  Enchant,
  GameEvent,
  FormationDef,
  GameState,
  Keyword,
  PlayerIdx,
  QuestGoalKind,
  QuestState,
  Sky,
  TargetRef,
} from './types'
import {
  BOARD_LIMIT,
  CLAN_ATTACK,
  CLAN_HEALTH,
  CLAN_QUORUM,
  HAND_LIMIT,
  MANA_CAP,
  MORALE_CAP,
  MORALE_THRESHOLD,
  SKY_CYCLE,
  SKY_SPAN,
  START_HP,
  SUPPLY_CAP,
} from './types'
import { rngInt } from './rng'

export function other(p: PlayerIdx): PlayerIdx {
  return p === 0 ? 1 : 0
}

// ---------- 天时 ----------

// 当前时段。**纯函数 of turn**,不读也不写任何状态 —— 所以天时天然可回放、
// 天然对双方一致、天然不需要迁移。turn 从 1 起算,每 SKY_SPAN 个回合换一段。
export function skyOf(turn: number): Sky {
  const idx = Math.floor(Math.max(0, turn - 1) / SKY_SPAN) % SKY_CYCLE.length
  return SKY_CYCLE[idx]
}

// ---------- 士气 / 粮道 ----------

// 士气变化的唯一入口。夹到 [-MORALE_CAP, MORALE_CAP],无变化时不发事件
// (顶到上限还在赢的局面很常见,那时候再播一次「士气高涨」纯属噪音)。
// **不在这里 refreshAuras** —— 调用点往往要连改两侧(一死一杀),
// 让调用点改完再统一刷一次,省掉一半的整轮重算。
export function changeMorale(
  state: GameState,
  player: PlayerIdx,
  delta: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  const before = p.morale ?? 0
  const after = Math.max(-MORALE_CAP, Math.min(MORALE_CAP, before + delta))
  if (after === before) return
  p.morale = after
  events.push({ type: 'MoraleChanged', player, morale: after, delta: after - before })
}

// 粮道变化的唯一入口。夹到 [0, SUPPLY_CAP]。
//
// 【粮尽 —— 边沿,不是电平】
// 「粮尽惩罚」写成「回合开始时粮道为 0 就扣」是错的:开局粮道**本来就是 0**,
// 那样先手第一个回合当场挨罚,而那跟「断粮」没有任何关系。
// 所以判据是**掉到 0 的那一刻**(before > 0 && after === 0),不是「此刻为 0」:
//   · 开局 0 → 从来没有从上面掉下来过,不触发
//   · 花光军需 → 触发一次(这是这条轴一直缺的「代价」那一侧)
//   · 被敌方断粮打到 0 → 触发(断粮卡的全部意义)
// 判据放在这里而不是各调用点,是因为调用点会增加而这条规则不会:
// 铁律 7 那三处同步点就是这么裂开的。
//
// 惩罚取**士气 -1** 而不是掉血:
//   · 士气全池 111 张写、**只有 2 张读** —— 和粮道一样是只写不读的轴,
//     让粮尽去喂它,一处改动同时给两条轴接上了另一头
//   · 士气自己每回合向 0 收敛一格,所以断一次粮是一段时间窗不是永久债
//   · 连断两次才过 MORALE_THRESHOLD(全场 -1 攻)—— 门槛在规则里,不用另外拍
// **不在这里 refreshAuras**:同 changeMorale,由调用点改完统一刷一次。
export function changeSupply(
  state: GameState,
  player: PlayerIdx,
  delta: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  const before = p.supply ?? 0
  const after = Math.max(0, Math.min(SUPPLY_CAP, before + delta))
  if (after === before) return
  p.supply = after
  events.push({ type: 'SupplyChanged', player, supply: after, delta: after - before })
  // `before > 0` 与上面那句提前返回**重复**(after≠before 且 after=0 ⇒ before>0),
  // 留着是为了让判据自己写清楚它是边沿。真正挡住「0 上再减又扣一次」的是提前返回,
  // 所以别把它当成一层独立的防线 —— 两个方向的变异都验过,红的分别是
  // 「开局那条」(判据滑成电平)和「不重复扣那条」(提前返回被删掉)。
  if (before > 0 && after === 0) changeMorale(state, player, -1, events)
}

// 阵形判定:返回该锚点此刻实际吃到增益的友军下标。
// 纯函数 of (board, 锚点下标, lib) —— 没有任何隐藏状态,所以 refreshAuras 每次整轮重算
// 的结果一定和上一次一致,阵形不会「记得」它上一帧成立过。
export function formationBeneficiaries(
  board: CardInstance[],
  anchorIndex: number,
  formation: FormationDef,
  lib: CardLibrary,
): number[] {
  const n = board.length
  switch (formation.shape) {
    case 'wedge':
      return n >= 3 ? [0] : []
    case 'crane':
      return n >= 4 ? [0, n - 1] : []
    case 'scale': {
      const troop = lib[board[anchorIndex].defId]?.troop
      if (!troop) return []
      const same = board.map((u, i) => (lib[u.defId]?.troop === troop ? i : -1)).filter((i) => i >= 0)
      return same.length >= 3 ? same : []
    }
    case 'serpent':
      return n >= BOARD_LIMIT ? board.map((_, i) => i) : []
    // ---- 第二十九卡包 ----
    // 四种都只看**人数与位置**,不看兵种,而且**门槛统一是 3**:
    // 第一版 偃月/方圓/衡軛 用的是 4,实测 -7.3 / -3.0 / -10.5 —— 站满四个人
    // 这件事本身就是这把尺子(贪心 AI)最不擅长的,门槛写在 4 等于这条阵形不存在。
    // 原有的 长蛇(满员)与 鱼鳞(三个同兵种)正是栽在同一件事上。 —— 鱼鳞那种「要三个同兵种」的门槛
    // 在实战里几乎摆不出来,而阵形这条轴的乐趣本该是「我把谁放在哪一格」。
    case 'crescent':
      // 偶数人时取靠左的那个中 —— 必须定死,不然回放会分叉。
      return n >= 3 ? [Math.floor((n - 1) / 2)] : []
    case 'square':
      // 锚点抱团。锚点在边上时自然只有两个人吃,这是形状本身的性质,不特判。
      return n >= 3
        ? [anchorIndex - 1, anchorIndex, anchorIndex + 1].filter((i) => i >= 0 && i < n)
        : []
    case 'goose': {
      // 雁行是**斜**的:锚点在最右时一个人都吃不到,所以摆位真的有讲究。
      const out: number[] = []
      for (let i = anchorIndex + 1; i < n; i++) out.push(i)
      return n >= 3 ? out : []
    }
    case 'yoke': {
      // 鹤翼的补集:那个给两翼,这个给中军。两张一起上场就是全场。
      const out: number[] = []
      for (let i = 1; i < n - 1; i++) out.push(i)
      return n >= 3 ? out : []
    }
  }
}

export interface GeneralLoc {
  player: PlayerIdx
  index: number
  inst: CardInstance
}

export function findGeneral(state: GameState, iid: number): GeneralLoc | undefined {
  for (const player of [0, 1] as const) {
    const index = state.players[player].board.findIndex((c) => c.iid === iid)
    if (index >= 0) return { player, index, inst: state.players[player].board[index] }
  }
  return undefined
}

// ---------- 附魔层 ----------

// 从卡面基础值 ⊕ 附魔 ⊖ 沉默 重算派生字段。任何改动附魔/伤害后都必须调用。
export function refreshInstance(inst: CardInstance, lib: CardLibrary): void {
  const def = lib[inst.defId]
  let attack = def?.attack ?? 0
  let maxHealth = def?.health ?? 0
  // 沉默清空卡面关键词,但不改卡面攻血(炉石规则)
  const keywords: Keyword[] = inst.silenced ? [] : (def?.keywords.slice() ?? [])
  for (const e of inst.enchants) {
    attack += e.attack
    maxHealth += e.health
    if (e.keywords) {
      for (const kw of e.keywords) if (!keywords.includes(kw)) keywords.push(kw)
    }
  }
  // 铁壁/潜行一旦消耗就不能被 refresh 从卡面加回来
  const shieldIdx = keywords.indexOf('divineShield')
  if (inst.shieldUsed && shieldIdx >= 0) keywords.splice(shieldIdx, 1)
  const stealthIdx = keywords.indexOf('stealth')
  if (inst.stealthBroken && stealthIdx >= 0) keywords.splice(stealthIdx, 1)
  // 溃散:士气触底的那一方失去守護。和上面两条走同一条路 —— 压制必须在这里,
  // 因为这个函数每次受伤/治疗都会重新从卡面算一遍关键词。
  // 溃散:士气触底的那一方失去守護。和上面两条走同一条路 —— 压制必须在这里,
  // 因为这个函数每次受伤/治疗都会重新从卡面算一遍关键词。
  const guardIdx = keywords.indexOf('guard')
  if (inst.routed && guardIdx >= 0) keywords.splice(guardIdx, 1)

  inst.maxHealth = Math.max(1, maxHealth)
  inst.damage = Math.max(0, inst.damage)
  inst.health = inst.maxHealth - inst.damage
  inst.keywords = keywords
  // 激怒(Enrage):受伤时额外攻击,痊愈自动收回。派生在此,不记附魔 —— 所以
  // 每次 refreshInstance(受伤/治疗都会调)都会重算,状态永远跟 damage 一致。
  // 沉默会连同卡面机制一起抹掉激怒(与亡语/光环一致)。放在攻击定型的最后一步。
  const enrage = inst.silenced ? 0 : (def?.enrage ?? 0)
  inst.attack = Math.max(0, attack + (enrage > 0 && inst.damage > 0 ? enrage : 0))
}

// 挂一条附魔并广播增益事件。授予铁壁时重置消耗标记(相当于补一层新盾)。
export function addEnchant(
  inst: CardInstance,
  lib: CardLibrary,
  ench: Enchant,
  events: GameEvent[] | null,
  player: PlayerIdx,
): void {
  if (ench.keywords?.includes('divineShield')) inst.shieldUsed = false
  inst.enchants.push(ench)
  refreshInstance(inst, lib)
  if (events && (ench.attack !== 0 || ench.health !== 0)) {
    events.push({
      type: 'GeneralBuffed',
      player,
      iid: inst.iid,
      attack: ench.attack,
      health: ench.health,
    })
  }
  if (events && ench.keywords) {
    for (const kw of ench.keywords) {
      events.push({ type: 'KeywordGranted', player, iid: inst.iid, keyword: kw })
    }
  }
}

// 摘掉满足条件的附魔。clampAlive=true 时保证不会因为撤销增益而把单位打死
// (「本回合内 +X/+X」到期不应该杀人;光环消失可以杀人,那是炉石规则)。
function removeEnchants(
  inst: CardInstance,
  lib: CardLibrary,
  pred: (e: Enchant) => boolean,
  events: GameEvent[] | null,
  player: PlayerIdx,
  clampAlive: boolean,
): void {
  const removed = inst.enchants.filter(pred)
  if (removed.length === 0) return
  inst.enchants = inst.enchants.filter((e) => !pred(e))
  refreshInstance(inst, lib)
  if (clampAlive && inst.health <= 0) {
    inst.damage = Math.max(0, inst.maxHealth - 1)
    refreshInstance(inst, lib)
  }
  if (events) {
    const atk = removed.reduce((n, e) => n + e.attack, 0)
    const hp = removed.reduce((n, e) => n + e.health, 0)
    if (atk !== 0 || hp !== 0) {
      events.push({ type: 'GeneralBuffed', player, iid: inst.iid, attack: -atk, health: -hp })
    }
  }
}

// 光环重算:先撤掉所有光环附魔,再从当前在场的光环来源重新发一遍。
// 来源死亡/回手/被沉默都自动失效,不需要任何反向登记。
export function refreshAuras(state: GameState, lib: CardLibrary): void {
  for (const player of [0, 1] as const) {
    for (const inst of state.players[player].board) {
      if (inst.enchants.some((e) => e.auraFrom !== undefined)) {
        inst.enchants = inst.enchants.filter((e) => e.auraFrom === undefined)
        refreshInstance(inst, lib)
      }
    }
  }
  for (const player of [0, 1] as const) {
    const roster = state.players[player].board
    for (let si = 0; si < roster.length; si++) {
      const source = roster[si]
      if (source.silenced) continue
      const aura = lib[source.defId]?.aura
      if (!aura) continue
      for (let i = 0; i < roster.length; i++) {
        const inst = roster[i]
        if (aura.scope === 'friendlyOthers' && inst.iid === source.iid) continue
        // 陣型:只给左右紧邻的两名友军(自己不吃)。
        // 用**下标**而不是 iid 判相邻 —— board 数组的顺序就是战场从左到右的顺序,
        // 一个单位死掉/入场都会让邻居关系当场改变,而 refreshAuras 每次场面变动
        // 都会整轮重算,所以这里不需要任何额外的失效登记。
        if (aura.scope === 'adjacent' && Math.abs(i - si) !== 1) continue
        inst.enchants.push({
          attack: aura.attack,
          health: aura.health,
          keywords: aura.keywords,
          auraFrom: source.iid,
        })
        refreshInstance(inst, lib)
      }
    }
    // 羁绊:同侧场上凑齐 members(锚点自己已在场)才生效,增益发给锚点 + 全体成员。
    // 蹭的是光环这条路 —— 上面那轮已经把所有 auraFrom 附魔撤干净了,所以
    // 「成员被杀/被策反/回手」羁绊会自动断裂并收回增益,不需要任何反向登记。
    const board = state.players[player].board
    for (const source of board) {
      if (source.silenced) continue
      const bond = lib[source.defId]?.bond
      if (!bond) continue
      if (!bond.members.every((m) => board.some((u) => u.defId === m))) continue
      for (const inst of board) {
        if (inst.iid !== source.iid && !bond.members.includes(inst.defId)) continue
        inst.enchants.push({ attack: bond.attack, health: bond.health, auraFrom: source.iid })
        refreshInstance(inst, lib)
      }
    }
    // 家族:同族在场 ≥CLAN_QUORUM 人 → 这些人各吃一份(见 ClanDef)。
    //
    // 和羁绊的区别在于**没有锚点**:不存在「谁发的这份增益」,所以 auraFrom
    // 用哨兵 -3(战场环境占 -1、士气占 -2)。开头那轮「撤掉所有 auraFrom 附魔」
    // 照样清得干净,所以死一个人就自动散,不需要反向登记。
    //
    // 被沉默的人**既不算人头也不吃增益** —— 沉默的语义是「这张卡上写的字都不算数了」,
    // 而家族是写在卡面上的(见 cards.withClanText)。羁绊那轮只挡了锚点,
    // 是因为羁绊的字只写在锚点上;家族每个人身上都有,所以两边都要挡。
    const byClan = new Map<string, CardInstance[]>()
    for (const inst of board) {
      if (inst.silenced) continue
      const clan = lib[inst.defId]?.clan
      if (!clan) continue
      const bucket = byClan.get(clan.id)
      if (bucket) bucket.push(inst)
      else byClan.set(clan.id, [inst])
    }
    // 人头按**不同的人**数,不按张数:同一个人的两张牌不构成一个家族
    //(「兩個司馬懿在場」是同一个人,不是父子)。附带好处是堵掉一条捷径 ——
    // 否则带两张同族传说就自动 +1/+1,而家族本该是构筑上的取舍。
    for (const kin of byClan.values()) {
      if (new Set(kin.map((u) => u.defId)).size < CLAN_QUORUM) continue
      for (const inst of kin) {
        inst.enchants.push({ attack: CLAN_ATTACK, health: CLAN_HEALTH, auraFrom: -3 })
        refreshInstance(inst, lib)
      }
    }
    // 阵形:锚点在场 + 整条战线满足形状 → 按 shape 圈定的那几个位置发增益。
    // 同样蹭光环这条路,所以「死了一个人阵形就散」是自动的。
    for (let si = 0; si < board.length; si++) {
      const source = board[si]
      if (source.silenced) continue
      const formation = lib[source.defId]?.formation
      if (!formation) continue
      for (const i of formationBeneficiaries(board, si, formation, lib)) {
        board[i].enchants.push({
          attack: formation.attack,
          health: formation.health,
          keywords: formation.keywords,
          auraFrom: source.iid,
        })
        refreshInstance(board[i], lib)
      }
    }
  }
  // 战场环境:双方全体(或某个兵种)吃一份增益。
  // 走光环的附魔路径 —— 环境消散(turnsLeft 归零或被下一片覆盖)时增益自动收回。
  // auraFrom 用 -1:场上不会有 iid 为负的单位,所以它天然不会和任何来源撞车,
  // 而上面那轮「撤掉所有 auraFrom 附魔」照样会把它清干净。
  const field = state.field?.rule
  if (field && (field.bothStats || field.troopBonus)) {
    for (const player of [0, 1] as const) {
      for (const inst of state.players[player].board) {
        const bonus = field.bothStats
        if (bonus) {
          inst.enchants.push({ attack: bonus.attack, health: bonus.health, auraFrom: -1 })
          refreshInstance(inst, lib)
        }
        const tb = field.troopBonus
        if (tb && lib[inst.defId]?.troop === tb.troop) {
          inst.enchants.push({ attack: tb.attack, health: tb.health, auraFrom: -1 })
          refreshInstance(inst, lib)
        }
      }
    }
  }

  // 士气:|士气| 过线时,那一方全场 ±1 攻。
  //
  // 只动**攻击**不动血:士气该改变的是这支队伍敢不敢打,不是他们有多硬。
  // 加血还会引出「士气掉下来会不会打死人」这一整类边角,不值得。
  // auraFrom 用 -2(战场环境占了 -1):场上不会有负 iid,所以它天然不撞车,
  // 而开头那轮「撤掉所有 auraFrom 附魔」照样清得干净。
  for (const player of [0, 1] as const) {
    const morale = state.players[player].morale ?? 0
    // 溃散(第二十六卡包):士气**触底**才有,过线只是 ±1 攻。
    // 每次都写(而不是只在触底时写)—— 这是整轮重算,漏掉复位那一半
    // 就变成「溃散过一次就永远散着」,而士气每回合会自己向 0 收敛。
    const routed = morale === -MORALE_CAP
    for (const inst of state.players[player].board) {
      if (!!inst.routed !== routed) {
        inst.routed = routed || undefined
        refreshInstance(inst, lib)
      }
    }
    if (Math.abs(morale) < MORALE_THRESHOLD) continue
    const delta = morale > 0 ? 1 : -1
    for (const inst of state.players[player].board) {
      inst.enchants.push({ attack: delta, health: 0, auraFrom: -2 })
      refreshInstance(inst, lib)
    }
  }

  // 宿敌:羁绊的镜面 —— 条件从「同侧凑齐」变成「敌方场上有那个人」,
  // 而增益**双方一起吃**(历史上真打过的两个人在牌桌上重逢)。
  //
  // 放在单独一轮而不是塞进上面的 player 循环里:它要同时读两侧的场面,
  // 而上面那轮的语义是「只看自己这半边」。两个方向都扫,所以一条声明就够了 ——
  // 无论项羽在我这边还是在对面,「项羽 ⇄ 韩信」都成立。
  for (const player of [0, 1] as const) {
    const mine = state.players[player].board
    const theirs = state.players[other(player)].board
    for (const source of mine) {
      if (source.silenced) continue
      const rival = lib[source.defId]?.rival
      if (!rival) continue
      const foes = theirs.filter((u) => u.defId === rival.foe)
      if (foes.length === 0) continue
      // 锚点只吃一份(对面摆两个宿敌不该让它翻倍),每个宿敌各吃一份
      for (const inst of [source, ...foes]) {
        inst.enchants.push({ attack: rival.attack, health: rival.health, auraFrom: source.iid })
        refreshInstance(inst, lib)
      }
    }
  }
}

export function silenceGeneral(
  loc: GeneralLoc,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  const inst = loc.inst
  if (inst.silenced) return
  inst.silenced = true
  // 光环附魔留给 refreshAuras 处理(来源可能还在),其余一律清空
  inst.enchants = inst.enchants.filter((e) => e.auraFrom !== undefined)
  inst.frozen = false
  refreshInstance(inst, lib)
  // 沉默不会把单位打死:溢出的伤害按当前上限截断
  if (inst.health <= 0) {
    inst.damage = Math.max(0, inst.maxHealth - 1)
    refreshInstance(inst, lib)
  }
  events.push({ type: 'GeneralSilenced', player: loc.player, iid: inst.iid })
}

export function freezeGeneral(loc: GeneralLoc, events: GameEvent[]): void {
  if (loc.inst.frozen) return
  loc.inst.frozen = true
  events.push({ type: 'GeneralFrozen', player: loc.player, iid: loc.inst.iid })
}

// 潜行在自身发起攻击后解除
export function breakStealth(loc: GeneralLoc, lib: CardLibrary, events: GameEvent[]): void {
  const inst = loc.inst
  if (!inst.keywords.includes('stealth')) return
  removeEnchants(
    inst,
    lib,
    (e) => (e.keywords?.includes('stealth') ?? false) && e.auraFrom === undefined,
    null,
    loc.player,
    false,
  )
  // 卡面自带潜行:用一条「反向附魔」压制不现实,直接标记沉默级别的移除
  if (inst.keywords.includes('stealth')) {
    inst.stealthBroken = true
    refreshInstance(inst, lib)
  }
  events.push({ type: 'StealthBroken', player: loc.player, iid: inst.iid })
}

// 回合结束:撤销所有「本回合内」附魔
export function expireTemporaryEnchants(
  state: GameState,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  for (const player of [0, 1] as const) {
    for (const inst of state.players[player].board) {
      removeEnchants(inst, lib, (e) => e.duration === 'endOfTurn', events, player, true)
    }
  }
}

// ---------- 抽牌 / 伤害 / 治疗 ----------

export function drawCards(
  state: GameState,
  player: PlayerIdx,
  count: number,
  events: GameEvent[],
): void {
  const p = state.players[player]
  for (let i = 0; i < count; i++) {
    const card = p.deck.pop()
    if (!card) {
      // 疲劳:每次空抽伤害递增
      p.fatigue += 1
      events.push({ type: 'FatigueDamage', player, amount: p.fatigue })
      damageHero(state, player, p.fatigue, events)
      continue
    }
    if (p.hand.length >= HAND_LIMIT) {
      p.graveyard.push(card.defId)
      events.push({ type: 'CardBurned', player, defId: card.defId })
      continue
    }
    p.hand.push(card)
    events.push({ type: 'CardDrawn', player, iid: card.iid, defId: card.defId })
  }
}

export function damageHero(
  state: GameState,
  player: PlayerIdx,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  const p = state.players[player]
  const absorbed = Math.min(p.armor, amount)
  p.armor -= absorbed
  const dealt = amount - absorbed
  p.heroHp -= dealt
  events.push({ type: 'HeroDamaged', player, amount: dealt, hpAfter: p.heroHp })
}

export function healHero(
  state: GameState,
  player: PlayerIdx,
  amount: number,
  events: GameEvent[],
): void {
  if (amount <= 0) return
  const p = state.players[player]
  // 上限读主公自己的血量,而不是写死 30 —— 高血主公/冒险模式 Boss 才不会治不满
  const healed = Math.min(amount, (p.heroMaxHp || START_HP) - p.heroHp)
  if (healed <= 0) return
  p.heroHp += healed
  events.push({ type: 'HeroHealed', player, amount: healed, hpAfter: p.heroHp })
}

const MAX_TRIGGER_DEPTH = 3

export function damageGeneral(
  state: GameState,
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
  lib: CardLibrary,
  depth = 0,
): void {
  if (amount <= 0) return
  const inst = loc.inst
  // 铁壁:抵消整次伤害,不论多少
  if (inst.keywords.includes('divineShield')) {
    inst.shieldUsed = true
    removeEnchants(
      inst,
      lib,
      (e) => (e.keywords?.includes('divineShield') ?? false) && e.auraFrom === undefined,
      null,
      loc.player,
      false,
    )
    refreshInstance(inst, lib)
    events.push({ type: 'DivineShieldPopped', player: loc.player, iid: inst.iid })
    return
  }
  inst.damage += amount
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralDamaged',
    player: loc.player,
    iid: inst.iid,
    amount,
    healthAfter: inst.health,
  })
  // 受伤触发器(自身仍存活才触发,带递归深度上限)
  const def = lib[inst.defId]
  if (def?.onDamaged && inst.health > 0 && !inst.silenced && depth < MAX_TRIGGER_DEPTH) {
    events.push({
      type: 'EffectTriggered',
      player: loc.player,
      sourceIid: inst.iid,
      sourceDefId: inst.defId,
      kind: 'onDamaged',
    })
    runScript(state, events, lib, def.onDamaged, {
      player: loc.player,
      sourceDefId: inst.defId,
      sourceIid: inst.iid,
      degradeChosen: true,
      kind: 'onDamaged',
      depth: depth + 1,
    })
  }
}

// 真·消灭:无视铁壁,直接打到 0(与「造成等于当前血量的伤害」不同)
export function destroyGeneral(
  loc: GeneralLoc,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  const inst = loc.inst
  if (inst.health <= 0) return
  const before = inst.health
  inst.damage = inst.maxHealth
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralDamaged',
    player: loc.player,
    iid: inst.iid,
    amount: before,
    healthAfter: inst.health,
  })
}

// 「每打出一个锦囊后」触发器:施法方**自己**在场的、带 onSpellCast 的武将各触发一次
// (法术流 payoff,像法力浮龙/legends 的「施法+攻」)。只在施法方的 PlayCard 里调,
// 所以只吃自己的锦囊,不吃对手的。
//
// 先把「施法那一刻」在场的 iid 快照下来再逐个跑:触发脚本自己可能让单位进出场,
// 拿实时 board 迭代会漏触发或重复触发。跑之前重取一次、校验还活着、没被沉默。
export function fireOnSpellCast(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  player: PlayerIdx,
): void {
  const iids = state.players[player].board
    .filter((c) => lib[c.defId]?.onSpellCast && !c.silenced)
    .map((c) => c.iid)
  for (const iid of iids) {
    const loc = findGeneral(state, iid)
    if (!loc || loc.player !== player || loc.inst.health <= 0 || loc.inst.silenced) continue
    const def = lib[loc.inst.defId]
    if (!def?.onSpellCast) continue
    events.push({
      type: 'EffectTriggered',
      player,
      sourceIid: iid,
      sourceDefId: loc.inst.defId,
      kind: 'onSpellCast',
    })
    runScript(state, events, lib, def.onSpellCast, {
      player,
      sourceDefId: loc.inst.defId,
      sourceIid: iid,
      degradeChosen: true,
      kind: 'onSpellCast',
      depth: 1,
    })
    processDeaths(state, events, lib)
  }
}

export function healGeneral(
  _state: GameState,
  loc: GeneralLoc,
  amount: number,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  if (amount <= 0) return
  const inst = loc.inst
  const healed = Math.min(amount, inst.damage)
  if (healed <= 0) return
  inst.damage -= healed
  refreshInstance(inst, lib)
  events.push({
    type: 'GeneralHealed',
    player: loc.player,
    iid: inst.iid,
    amount: healed,
    healthAfter: inst.health,
  })
}

// 死亡结算:光环重算 → 清场 → 遗计 → 循环直到稳定(遗计与光环消失都可能连锁致死)
export function processDeaths(state: GameState, events: GameEvent[], lib: CardLibrary): void {
  for (let guard = 0; guard < 100; guard++) {
    refreshAuras(state, lib)
    const dead: { player: PlayerIdx; inst: CardInstance }[] = []
    for (const player of [0, 1] as const) {
      const p = state.players[player]
      for (let i = p.board.length - 1; i >= 0; i--) {
        if (p.board[i].health <= 0) {
          const [inst] = p.board.splice(i, 1)
          p.graveyard.push(inst.defId)
          dead.push({ player, inst })
        }
      }
    }
    if (dead.length === 0) return
    // 死亡事件按 iid 排序保证确定性(splice 逆序扫描)
    dead.sort((a, b) => a.inst.iid - b.inst.iid)
    for (const d of dead) {
      events.push({ type: 'GeneralDied', player: d.player, iid: d.inst.iid, defId: d.inst.defId })
    }
    // 士气:己方倒下一个 -1,对面倒下一个 +1。
    //
    // 一换一的交换于是净变化为零(双方各 +1 -1),而**白赚一个**才是 2 点摆动 ——
    // 这正是「士气」该奖励的东西:不是打得多,是打得划算。
    // 放在亡语**之前**:亡语能召唤新单位,而这一波士气讲的是「刚刚倒下了谁」。
    for (const d of dead) {
      changeMorale(state, d.player, -1, events)
      changeMorale(state, other(d.player), 1, events)
    }
    // 将星陨落:传奇武将倒下时,**双方各再 -1**。
    //
    // 【第一版是「失主 -1、斩将方 +1」,那个版本把闸门弄红了】
    // 它等于把传奇交易的士气摆动从 2 格放大到 4 格,而那正好是滚雪球的形状:
    // 打得动传奇的那一方赚得更多,赚了之后身材更好、更打得动传奇。
    // 实测 魏武揮鞭 从 57.8% 冲到 **61.8%**,并且拉出两个 25% / 74% 的极化对位。
    //
    // 现在这一版是**差值中性**的:双方同吃,所以「斩掉一个传奇」相对
    // 「斩掉一个普通武将」并不多赚一格 —— 它不制造优势,只把**两支队伍一起**
    // 往溃散那条线上推。史书里将星陨落也从来不是一方的好消息。
    // 副产品是一个真的决策:你自己的传奇死了会连带把对面也往下压一格,
    // 对面已经 -2 的时候,这一下就是苦肉计。
    //
    // 分成单独一轮而不是并进上面那个循环:上面那一轮是**每个死者**都吃的通则,
    // 这一轮是例外。混在一起以后想读「传奇死了会怎样」得先在心里做减法。
    //
    // `LegendFell` 只是给 UI 的播报信号,状态全在士气里 —— 事件丢了对局也不会错
    // (同 SkyChanged 的取舍)。铁律 7 的三处同步照样要补,漏了就是**静默丢失**。
    for (const d of dead) {
      if (lib[d.inst.defId]?.rarity !== 'legendary') continue
      events.push({
        type: 'LegendFell',
        player: d.player,
        iid: d.inst.iid,
        defId: d.inst.defId,
      })
      changeMorale(state, d.player, -1, events)
      changeMorale(state, other(d.player), -1, events)
    }
    refreshAuras(state, lib)
    // 傳承:阵亡者身上带 heirloom 的附魔(装备)改挂到另一名友军身上。
    //
    // 放在亡语**之前**:亡语可能召唤新单位,而「刀应该传给谁」讲的是
    // 这个人倒下的那一刻场上还站着谁 —— 让亡语召出来的新兵接刀,时序上不对。
    // 被沉默的单位不传承(沉默连装备一起抹掉了,它身上已经没有那条附魔)。
    // 收刀的人选:场上**最左**的友军(board 顺序 = 战场从左到右),确定性优先于花哨。
    for (const d of dead) {
      const passed = d.inst.enchants.filter((e) => e.heirloom !== undefined)
      if (passed.length === 0) continue
      const heir = state.players[d.player].board[0]
      if (!heir) continue
      for (const e of passed) {
        heir.enchants.push({ ...e })
        events.push({
          type: 'EquipmentAttached',
          player: d.player,
          targetIid: heir.iid,
          defId: e.heirloom!,
        })
      }
      refreshInstance(heir, lib)
    }
    for (const d of dead) {
      // 被沉默的单位不触发亡语
      if (d.inst.silenced) continue
      const def = lib[d.inst.defId]
      if (def?.deathrattle) {
        events.push({
          type: 'EffectTriggered',
          player: d.player,
          sourceIid: d.inst.iid,
          sourceDefId: d.inst.defId,
          kind: 'deathrattle',
        })
        runScript(state, events, lib, def.deathrattle, {
          player: d.player,
          sourceDefId: d.inst.defId,
          degradeChosen: true,
          kind: 'deathrattle',
        })
      }
    }
    // 军令状「斩将」计数:每有一个单位倒下,**对面**记一笔。
    // 放在亡语之后 —— 奖励也是脚本,让它在这一波死亡完全结算完之后再跑,
    // 否则奖励召出来的单位会被同一轮的光环重算当成「刚才就在场」。
    // 衍生物不算:一张召唤牌能刷出一堆送死的兵,那样军令状就成了自动完成的。
    for (const d of dead) {
      if (lib[d.inst.defId]?.token) continue
      noteQuest(state, other(d.player), 'killGenerals', events, lib)
    }
  }
}

// ---------- 效果 DSL ----------

const CHOSEN_TARGETS = new Set([
  'chosenEnemyGeneral',
  'chosenAny',
  'chosenFriendly',
  'chosenFriendlyGeneral',
  // 夷三族:它**也要玩家选一个**(选谁是这张牌的全部决策),
  // 只是选完之后打中的是一组。漏在这个集合外面的后果不是报错,
  // 是这张牌变成「不需要目标」→ chosen 恒为 undefined → 恒定什么都不做。
  'clanOfChosenEnemy',
])

export function requiresChosenTarget(script: EffectScript | undefined): boolean {
  if (!script) return false
  return script.ops.some((op) => 'target' in op && CHOSEN_TARGETS.has(op.target))
}

// 潜行单位不能被敌方选为目标
function selectableByEnemy(inst: CardInstance): boolean {
  return !inst.keywords.includes('stealth')
}

// 该脚本可选目标池(供 UI 高亮与 AI 枚举;单挑目标池另见 combat.ts)
export function chosenTargetPool(
  state: GameState,
  player: PlayerIdx,
  script: EffectScript | undefined,
): TargetRef[] {
  if (!script) return []
  const pool: TargetRef[] = []
  const scopes = new Set(script.ops.filter((op) => 'target' in op).map((op) => op.target))
  const enemy = other(player)
  if (scopes.has('chosenEnemyGeneral') || scopes.has('clanOfChosenEnemy')) {
    for (const c of state.players[enemy].board) {
      if (selectableByEnemy(c)) pool.push({ kind: 'general', iid: c.iid })
    }
  }
  if (scopes.has('chosenAny')) {
    for (const p of [0, 1] as const) {
      for (const c of state.players[p].board) {
        if (p === player || selectableByEnemy(c)) pool.push({ kind: 'general', iid: c.iid })
      }
      pool.push({ kind: 'hero', player: p })
    }
  }
  if (scopes.has('chosenFriendly') || scopes.has('chosenFriendlyGeneral')) {
    for (const c of state.players[player].board) pool.push({ kind: 'general', iid: c.iid })
    if (scopes.has('chosenFriendly')) pool.push({ kind: 'hero', player })
  }
  // 去重(chosenEnemyGeneral 与 chosenAny 同时存在时)
  const seen = new Set<string>()
  return pool.filter((t) => {
    const key = t.kind === 'hero' ? `h${t.player}` : `g${t.iid}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function conditionMet(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  script: EffectScript,
): boolean {
  const cond = script.condition
  if (!cond) return true
  if (cond.ifDynastyCount) {
    const { dynasty, atLeast } = cond.ifDynastyCount
    const count = state.players[player].board.filter(
      (c) => lib[c.defId]?.dynasty === dynasty,
    ).length
    if (count < atLeast) return false
  }
  if (cond.ifBoardCount) {
    const { side, atLeast } = cond.ifBoardCount
    const who = side === 'friendly' ? player : other(player)
    if (state.players[who].board.length < atLeast) return false
  }
  if (cond.ifHeroHpBelow !== undefined) {
    if (state.players[player].heroHp >= cond.ifHeroHpBelow) return false
  }
  if (cond.ifHandCount) {
    if (state.players[player].hand.length < cond.ifHandCount.atLeast) return false
  }
  if (cond.ifKeywordCount) {
    const { keyword, atLeast } = cond.ifKeywordCount
    const count = state.players[player].board.filter((c) => c.keywords.includes(keyword)).length
    if (count < atLeast) return false
  }
  if (cond.ifMorale && (state.players[player].morale ?? 0) < cond.ifMorale.atLeast) return false
  if (cond.ifSupply && (state.players[player].supply ?? 0) < cond.ifSupply.atLeast) return false
  if (cond.ifSky && skyOf(state.turn) !== cond.ifSky) return false
  if (cond.ifChain && (state.players[player].chain ?? 0) < cond.ifChain.atLeast) return false
  // ---- 第二十二卡包 ----
  if (cond.ifTroopCount) {
    const { troop, atLeast } = cond.ifTroopCount
    const count = state.players[player].board.filter((c) => lib[c.defId]?.troop === troop).length
    if (count < atLeast) return false
  }
  if (cond.ifField) {
    if (!state.field) return false
    if (cond.ifField.id && state.field.rule.id !== cond.ifField.id) return false
  }
  if (cond.ifTurnAtLeast !== undefined && state.turn < cond.ifTurnAtLeast) return false
  if (cond.ifGraveyardCount) {
    // 只数武将 —— 与 friendlyGraveyard 计数一致,否则「死了多少人」会把锦囊也算进去
    const n = state.players[player].graveyard.filter((id) => lib[id]?.type === 'general').length
    if (n < cond.ifGraveyardCount.atLeast) return false
  }
  if (cond.ifEnemyHeroHpBelow !== undefined) {
    if (state.players[other(player)].heroHp >= cond.ifEnemyHeroHpBelow) return false
  }
  return true
}

// buffPer 的计数来源。只数**我方场面**。
// friendlyDynasty 用来源卡的势力,和 friendlyDynastyGenerals 目标一致。
function countFor(
  state: GameState,
  player: PlayerIdx,
  sourceDefId: string,
  lib: CardLibrary,
  per: CountSource,
): number {
  const board = state.players[player].board
  switch (per.kind) {
    case 'friendlyGenerals':
      return board.length
    case 'friendlyKeyword':
      return board.filter((c) => c.keywords.includes(per.keyword)).length
    case 'friendlyDynasty': {
      const dynasty = lib[sourceDefId]?.dynasty
      return board.filter((c) => lib[c.defId]?.dynasty === dynasty).length
    }
    case 'friendlyBattle': {
      // 同赴过任意一场战役即算同袍。不含自己 —— 和 friendlyDynasty 一致:
      // 「每有一名同袍」读起来就不该把自己数进去。
      const mine = lib[sourceDefId]?.battles
      if (!mine?.length) return 0
      const set = new Set(mine)
      return board.filter(
        (c) => c.defId !== sourceDefId && (lib[c.defId]?.battles ?? []).some((b) => set.has(b)),
      ).length
    }
    case 'friendlyTroop':
      return board.filter((c) => lib[c.defId]?.troop === per.troop).length
    // 降将:**含自己**(和 friendlyDynasty / friendlyBattle 相反)。
    // 那两条数的是「同伴」,所以把自己排除掉读起来才对;这一条数的是
    // 「这支队伍里有多少人是从别处来的」—— 一支降将组成的队伍,
    // 领头那个自己也是降将,没有理由不算他。
    case 'friendlyDefector':
      return board.filter((c) => lib[c.defId]?.defector).length
    case 'friendlyGraveyard':
      return state.players[player].graveyard.filter((id) => lib[id]?.type === 'general').length
    case 'enemyGenerals':
      return state.players[other(player)].board.length
    case 'handCount':
      return state.players[player].hand.length
  }
}

// 「最」类目标的挑选。**并列时取 iid 最小**(入场最早的那个)——
// 引擎纯度要求同一状态永远给同一答案,`sort` 的稳定性靠不住,所以这里手写归约。
function pickExtreme(
  board: CardInstance[],
  metric: (c: CardInstance) => number,
  mode: 'min' | 'max',
): CardInstance | undefined {
  let best: CardInstance | undefined
  for (const c of board) {
    if (!best) {
      best = c
      continue
    }
    const d = metric(c) - metric(best)
    if (mode === 'min' ? d < 0 : d > 0) best = c
    // 并列不换人:board 顺序里靠前的 iid 更小 —— 但 seize 会把单位挪到队尾,
    // 所以不能靠下标,得真的比 iid
    else if (d === 0 && c.iid < best.iid) best = c
  }
  return best
}

// 在场友方单位提供的法术伤害加成
export function spellPowerOf(state: GameState, player: PlayerIdx, lib: CardLibrary): number {
  let n = 0
  for (const c of state.players[player].board) {
    if (c.silenced) continue
    n += lib[c.defId]?.spellDamage ?? 0
  }
  return n
}

function resolveRefs(
  state: GameState,
  player: PlayerIdx,
  sourceIid: number | undefined,
  sourceDefId: string,
  lib: CardLibrary,
  target: string,
  chosen: TargetRef | undefined,
  degradeChosen: boolean,
): TargetRef[] {
  const enemy = other(player)
  switch (target) {
    case 'chosenFriendly':
    case 'chosenFriendlyGeneral': {
      if (chosen) return [chosen]
      if (degradeChosen) {
        // 亡语/回合结束等无法交互的场景:退化为随机友方武将
        const board = state.players[player].board
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        return [{ kind: 'general', iid: board[roll.value].iid }]
      }
      return []
    }
    case 'chosenEnemyGeneral':
    case 'chosenAny': {
      if (chosen) return [chosen]
      if (degradeChosen) {
        // 遗计等无法选择的场景:退化为随机敌方武将
        const board = state.players[enemy].board.filter(selectableByEnemy)
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        return [{ kind: 'general', iid: board[roll.value].iid }]
      }
      return []
    }
    // 夷三族:选中的那个 + 敌方场上所有与他同族的人。
    //
    // 顺序按 board 下标(不按 iid)—— board 顺序就是战场从左到右,
    // 而 destroy 会逐个走 processDeaths,顺序必须确定,否则回放分叉。
    // 潜行只挡「被选中」那一步:已经选好了族长再去株连,躲在暗处的族人一样跑不掉。
    case 'clanOfChosenEnemy': {
      let head = chosen
      if (!head && degradeChosen) {
        const board = state.players[enemy].board.filter(selectableByEnemy)
        if (board.length === 0) return []
        const roll = rngInt(state.rng, board.length)
        state.rng = roll.next
        head = { kind: 'general', iid: board[roll.value].iid }
      }
      if (!head || head.kind !== 'general') return []
      const inst = state.players[enemy].board.find((c) => c.iid === head.iid)
      if (!inst) return []
      const clanId = lib[inst.defId]?.clan?.id
      // 无族的人只诛他自己 —— 这条目标的下限就是一张普通的单体解场
      if (!clanId) return [head]
      return state.players[enemy].board
        .filter((c) => lib[c.defId]?.clan?.id === clanId)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    }
    case 'allEnemyGenerals':
      return state.players[enemy].board.map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allFriendlyGenerals':
      return state.players[player].board.map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allFriendlyOthers':
      return state.players[player].board
        .filter((c) => c.iid !== sourceIid)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    case 'allGenerals':
      return [0, 1].flatMap((p) =>
        state.players[p as PlayerIdx].board.map((c) => ({ kind: 'general' as const, iid: c.iid })),
      )
    case 'randomFriendlyGeneral': {
      const board = state.players[player].board
      if (board.length === 0) return []
      const roll = rngInt(state.rng, board.length)
      state.rng = roll.next
      return [{ kind: 'general', iid: board[roll.value].iid }]
    }
    case 'randomEnemyGeneral': {
      const board = state.players[enemy].board.filter(selectableByEnemy)
      if (board.length === 0) return []
      const roll = rngInt(state.rng, board.length)
      state.rng = roll.next
      return [{ kind: 'general', iid: board[roll.value].iid }]
    }
    case 'self':
      return sourceIid !== undefined ? [{ kind: 'general', iid: sourceIid }] : []
    case 'friendlyDynastyGenerals': {
      const dynasty = lib[sourceDefId]?.dynasty
      return state.players[player].board
        .filter((c) => lib[c.defId]?.dynasty === dynasty)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    }
    case 'enemyHero':
      return [{ kind: 'hero', player: enemy }]
    case 'friendlyHero':
      return [{ kind: 'hero', player }]
    // ---- 第二十二卡包:「最」类 ----
    // 不消耗 rng —— 这是和 random 系最大的差别:它是**确定**的,
    // 所以 AI 能推、玩家能算、回放天然一致。
    case 'weakestEnemyGeneral': {
      const pick = pickExtreme(state.players[enemy].board.filter(selectableByEnemy), (c) => c.health, 'min')
      return pick ? [{ kind: 'general', iid: pick.iid }] : []
    }
    case 'strongestEnemyGeneral': {
      const pick = pickExtreme(state.players[enemy].board.filter(selectableByEnemy), (c) => c.attack, 'max')
      return pick ? [{ kind: 'general', iid: pick.iid }] : []
    }
    case 'weakestFriendlyGeneral': {
      const pick = pickExtreme(state.players[player].board, (c) => c.health, 'min')
      return pick ? [{ kind: 'general', iid: pick.iid }] : []
    }
    case 'strongestFriendlyGeneral': {
      const pick = pickExtreme(state.players[player].board, (c) => c.attack, 'max')
      return pick ? [{ kind: 'general', iid: pick.iid }] : []
    }
    case 'adjacentFriendly': {
      const board = state.players[player].board
      const si = board.findIndex((c) => c.iid === sourceIid)
      if (si < 0) return []
      return [board[si - 1], board[si + 1]]
        .filter((c): c is CardInstance => c !== undefined)
        .map((c) => ({ kind: 'general', iid: c.iid }))
    }
    default:
      return []
  }
}

export interface ScriptCtx {
  player: PlayerIdx
  sourceDefId: string
  sourceIid?: number
  chosen?: TargetRef
  degradeChosen?: boolean
  kind?:
    | 'battlecry'
    | 'deathrattle'
    | 'spell'
    | 'endOfTurn'
    | 'startOfTurn'
    | 'onDamaged'
    | 'onAttack'
    | 'onSpellCast'
    | 'heroPower'
    | 'secret'
    | 'combo'
    | 'delayed'
    | 'quest'
  depth?: number
}

export function runScript(
  state: GameState,
  events: GameEvent[],
  lib: CardLibrary,
  script: EffectScript,
  ctx: ScriptCtx,
): void {
  const { player, sourceDefId, sourceIid, chosen, kind } = ctx
  const degradeChosen = ctx.degradeChosen ?? false
  const depth = ctx.depth ?? 0
  if (!conditionMet(state, player, lib, script)) return
  // 法术伤害只加成锦囊(战吼/主公技不吃加成,与炉石一致)
  const bonus = kind === 'spell' ? spellPowerOf(state, player, lib) : 0
  const refs = (target: string) =>
    resolveRefs(state, player, sourceIid, sourceDefId, lib, target, chosen, degradeChosen)

  for (const op of script.ops) {
    // 发现把对局停在 pendingChoice 上等玩家挑牌 —— 一旦挂起,本脚本剩下的 op 不再跑。
    // 所以「发现必须是脚本最后一个 op」不是约定,是这里强制的。
    if (state.pendingChoice) break
    switch (op.op) {
      case 'damage': {
        for (const ref of refs(op.target)) {
          if (ref.kind === 'hero') damageHero(state, ref.player, op.amount + bonus, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
          }
        }
        break
      }
      case 'heal': {
        for (const ref of refs(op.target)) {
          if (ref.kind === 'hero') healHero(state, ref.player, op.amount, events)
          else {
            const loc = findGeneral(state, ref.iid)
            if (loc) healGeneral(state, loc, op.amount, events, lib)
          }
        }
        break
      }
      case 'draw':
        drawCards(state, player, op.count, events)
        break
      case 'buffStats': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          addEnchant(
            loc.inst,
            lib,
            { attack: op.attack, health: op.health, duration: op.duration },
            events,
            loc.player,
          )
        }
        break
      }
      case 'seize': {
        // 策反:把敌方武将夺到我方场上。三国最有味道的一手 —— 阵前倒戈。
        //
        // 规则取炉石「精神控制」那一套,但有三条本作特有的处理:
        //   · **我方满场则无事发生**(不是把它杀掉),避免「打出去反而少一个单位」的坑;
        //   · 夺过来的单位**当回合不能动**(exhausted),否则等于附赠一次冲锋;
        //   · 潜行/铁壁等消耗标记原样带走 —— 它还是那个单位,只是换了旗号。
        // 伤害与附魔全部保留:附魔层是唯一写入路径,这里只搬运实例,不重算数值。
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          if (loc.player === player) continue // 只夺敌方的
          const mine = state.players[player]
          if (mine.board.length >= BOARD_LIMIT) break // 满场:整条效果到此为止
          const from = state.players[loc.player]
          const idx = from.board.findIndex((u) => u.iid === ref.iid)
          if (idx < 0) continue
          const [inst] = from.board.splice(idx, 1)
          inst.exhausted = true
          inst.attacksUsed = 0
          mine.board.push(inst)
          events.push({
            type: 'GeneralSeized',
            player,
            iid: inst.iid,
            defId: inst.defId,
            from: loc.player,
            position: mine.board.length - 1,
          })
        }
        break
      }
      case 'tutor': {
        // 求贤:从**牌库**里随机抽一张指定类型的牌进手(那张从库里消耗掉)。
        //
        // 与 draw 的差别是**确定性**:抽牌看天,求贤指定类别 —— 缺解场就搜锦囊,
        // 缺身材就搜武将。这是第五条轴:不动场面、不动牌差总量,动的是**抽到什么**。
        // 与 recruit 的差别:recruit 直接上场(tempo),tutor 进手(资源与选择权)。
        // 复用 CardGenerated(defId 本就对对手抹),不新增事件。
        const me = state.players[player]
        for (let i = 0; i < op.count; i++) {
          const pool = me.deck
            .map((c, idx) => ({ defId: c.defId, idx }))
            .filter((x) => lib[x.defId]?.type === op.kind)
          if (pool.length === 0) break
          const roll = rngInt(state.rng, pool.length)
          state.rng = roll.next
          const pick = pool[roll.value]
          const [card] = me.deck.splice(pick.idx, 1)
          if (me.hand.length >= HAND_LIMIT) {
            events.push({ type: 'CardBurned', player, defId: card.defId })
            continue
          }
          me.hand.push(card)
          events.push({ type: 'CardGenerated', player, iid: card.iid, defId: card.defId })
        }
        break
      }
      case 'banish': {
        // 焚尸(放逐):把武将直接移出战场 —— **不算死亡**。
        //
        // 它补的是卡池里一个真空:此前没有任何一张牌能解掉「亡语/复生」流派 ——
        // 消灭只会把它送进墓地,正好喂给复生。放逐则彻底带走:
        //   · 不发 GeneralDied,所以不触发亡语,也不会被「护送」类目标误判成阵亡;
        //   · **不进墓地**,所以复生搜不到它。
        // 代价是必须新增一个事件(UI 三处 + 覆盖样本已同步)。
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const board = state.players[loc.player].board
          const idx = board.findIndex((u) => u.iid === ref.iid)
          if (idx < 0) continue
          const [gone] = board.splice(idx, 1)
          events.push({
            type: 'GeneralBanished',
            player: loc.player,
            iid: gone.iid,
            defId: gone.defId,
          })
        }
        break
      }
      case 'copyGeneral': {
        // 疑兵:照**卡面**再造一个(不带伤、不带附魔)—— 复制的是那张牌,不是那个残躯。
        // 理由:带附魔复制会把「buff 一个再复制」变成无限滚雪球,而照卡面复制的上限
        // 恒等于那张牌本身的身材,好定价。复用 makeBoardInstance + GeneralSummoned,
        // 不新增事件、不动 UI 三处。满场即停。
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const p = state.players[player]
          if (p.board.length >= BOARD_LIMIT) break
          const def = lib[loc.inst.defId]
          if (!def || def.type !== 'general') continue
          const inst = makeBoardInstance(state, def.id, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
            iid: inst.iid,
            defId: def.id,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'swapStats': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const inst = loc.inst
          // 交换**当前**攻击与最大生命,用一条附魔的 delta 完成 —— 复用附魔层与
          // GeneralBuffed 事件,不需要新事件。伤害尽量保留:8/8 挨过 1 刀(现血 7)换完
          // 仍带那道伤。但换位本身**不杀人** —— 旧伤若超过新的最大生命(拿 1/8 的墙换成
          // 8/1),就把伤夹到存活(留 1 血),沿用沉默撤增益那套 clampAlive,别让「换个位置」
          // 变成秒杀,那太反直觉、也会诱发自换自杀的坑。
          const dAtk = inst.maxHealth - inst.attack
          const dHp = inst.attack - inst.maxHealth
          if (dAtk !== 0 || dHp !== 0) {
            addEnchant(inst, lib, { attack: dAtk, health: dHp }, events, loc.player)
            if (inst.health <= 0) {
              inst.damage = Math.max(0, inst.maxHealth - 1)
              refreshInstance(inst, lib)
            }
          }
        }
        break
      }
      case 'buffPer': {
        // 计数在**施加前**定死:自己也在场时会被算进 friendlyGenerals/friendlyDynasty,
        // 但增益是同一批一次性加的,不会自我滚雪球(先数,再加)。
        const n = countFor(state, player, sourceDefId, lib, op.per)
        if (n > 0) {
          for (const ref of refs(op.target)) {
            if (ref.kind !== 'general') continue
            const loc = findGeneral(state, ref.iid)
            if (!loc) continue
            addEnchant(
              loc.inst,
              lib,
              { attack: op.attack * n, health: op.health * n },
              events,
              loc.player,
            )
          }
        }
        break
      }
      case 'damagePer': {
        // 计数先定死再打(和 buffPer 同理)。amount×count 一次性算好,
        // 免得「打死一个又少一个」这种边打边数的怪异结算。
        const dmg = countFor(state, player, sourceDefId, lib, op.per) * op.amount
        if (dmg > 0) {
          for (const ref of refs(op.target)) {
            if (ref.kind === 'hero') damageHero(state, ref.player, dmg, events)
            else {
              const loc = findGeneral(state, ref.iid)
              if (loc) damageGeneral(state, loc, dmg, events, lib, depth)
            }
          }
        }
        break
      }
      case 'recruit': {
        // 搜将:从我方牌库随机拉武将上场(锦囊/衍生物不算)。牌库里那张被消耗掉。
        // 每次都重扫牌库下标 —— 上一次抽走会让下标漂移;复用 GeneralSummoned,不新增事件。
        const p = state.players[player]
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT; i++) {
          const genIdx = p.deck
            .map((c, idx) => ({ defId: c.defId, idx }))
            .filter((x) => lib[x.defId]?.type === 'general')
          if (genIdx.length === 0) break
          const roll = rngInt(state.rng, genIdx.length)
          state.rng = roll.next
          const pick = genIdx[roll.value]
          p.deck.splice(pick.idx, 1)
          const inst = makeBoardInstance(state, pick.defId, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
            iid: inst.iid,
            defId: pick.defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'summon':
      case 'summonForEnemy': {
        const def = lib[op.defId]
        if (!def) break
        const side = op.op === 'summon' ? player : other(player)
        const p = state.players[side]
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT; i++) {
          const inst = makeBoardInstance(state, def.id, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player: side,
            iid: inst.iid,
            defId: inst.defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'aoeDamage': {
        const enemy = other(player)
        for (const c of state.players[enemy].board.slice()) {
          const loc = findGeneral(state, c.iid)
          if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
        }
        break
      }
      case 'damageAll': {
        for (const side of [0, 1] as const) {
          for (const c of state.players[side].board.slice()) {
            const loc = findGeneral(state, c.iid)
            if (loc) damageGeneral(state, loc, op.amount + bonus, events, lib, depth)
          }
        }
        break
      }
      case 'destroy': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) destroyGeneral(loc, events, lib)
        }
        break
      }
      case 'grantKeyword': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          if (loc.inst.keywords.includes(op.keyword) && op.keyword !== 'divineShield') continue
          addEnchant(
            loc.inst,
            lib,
            { attack: 0, health: 0, keywords: [op.keyword], duration: op.duration },
            events,
            loc.player,
          )
        }
        break
      }
      case 'silence': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) silenceGeneral(loc, lib, events)
        }
        break
      }
      case 'freeze': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (loc) freezeGeneral(loc, events)
        }
        break
      }
      case 'gainMana': {
        const p = state.players[player]
        if (op.temporary) {
          p.mana.current = Math.min(MANA_CAP, p.mana.current + op.amount)
        } else {
          p.mana.max = Math.min(MANA_CAP, p.mana.max + op.amount)
          p.mana.current = Math.min(p.mana.max, p.mana.current + op.amount)
        }
        events.push({ type: 'ManaGained', player, amount: op.amount, temporary: op.temporary })
        break
      }
      case 'gainArmor': {
        const p = state.players[player]
        p.armor += op.amount
        events.push({ type: 'ArmorGained', player, amount: op.amount, armorAfter: p.armor })
        break
      }
      case 'returnToHand': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          const owner = state.players[loc.player]
          owner.board.splice(loc.index, 1)
          events.push({
            type: 'GeneralReturned',
            player: loc.player,
            iid: loc.inst.iid,
            defId: loc.inst.defId,
          })
          if (owner.hand.length >= HAND_LIMIT) {
            owner.graveyard.push(loc.inst.defId)
            events.push({ type: 'CardBurned', player: loc.player, defId: loc.inst.defId })
            continue
          }
          // 回手即重置为卡面原值(附魔/受伤/沉默/冻结全部清除)
          resetInstance(loc.inst, lib)
          owner.hand.push(loc.inst)
        }
        break
      }
      case 'discardRandom': {
        const foe = state.players[other(player)]
        for (let i = 0; i < op.count && foe.hand.length > 0; i++) {
          const roll = rngInt(state.rng, foe.hand.length)
          state.rng = roll.next
          const [discarded] = foe.hand.splice(roll.value, 1)
          foe.graveyard.push(discarded.defId)
          events.push({
            type: 'CardDiscarded',
            player: other(player),
            iid: discarded.iid,
            defId: discarded.defId,
          })
        }
        break
      }
      case 'stealCard': {
        // 离间:从对手手牌随机拿 N 张到我方手里。discardRandom 的镜像,但牌不进墓地 —— 换手。
        //
        // 不新增事件:对手侧发 CardDiscarded(他手里少一张),我方侧发 CardGenerated
        // (我手里多一张,且该事件的 defId 本就对对手抹去)。UI 三处零改动。
        // 我方手牌已满则那张**烧掉**(只发 CardDiscarded),与抽牌满手的处理一致 ——
        // 不能让它留在对手手里,否则「离间」会变成一张什么都没发生的废牌。
        const foe = state.players[other(player)]
        const me = state.players[player]
        for (let i = 0; i < op.count && foe.hand.length > 0; i++) {
          const roll = rngInt(state.rng, foe.hand.length)
          state.rng = roll.next
          const [taken] = foe.hand.splice(roll.value, 1)
          events.push({
            type: 'CardDiscarded',
            player: other(player),
            iid: taken.iid,
            defId: taken.defId,
          })
          if (me.hand.length >= HAND_LIMIT) {
            events.push({ type: 'CardBurned', player, defId: taken.defId })
            continue
          }
          me.hand.push(taken)
          events.push({ type: 'CardGenerated', player, iid: taken.iid, defId: taken.defId })
        }
        break
      }
      case 'discover': {
        beginDiscover(state, player, op.pool, op.count ?? 3, lib, events, sourceDefId)
        break
      }
      case 'reduceCost': {
        reduceHandCost(state, player, sourceDefId, lib, op.amount, op.filter, events)
        break
      }
      case 'addToHand': {
        const def = lib[op.defId]
        if (!def) break
        const p = state.players[player]
        for (let i = 0; i < op.count; i++) {
          if (p.hand.length >= HAND_LIMIT) {
            events.push({ type: 'CardBurned', player, defId: op.defId })
            continue
          }
          const inst = makeBoardInstance(state, op.defId, lib)
          p.hand.push(inst)
          events.push({ type: 'CardGenerated', player, iid: inst.iid, defId: op.defId })
        }
        break
      }
      case 'transform': {
        if (!lib[op.into]) break
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          // 原地替换成全新实例:不触发亡语(变形不是死亡),保持位置。新单位当回合眩晕。
          const fresh = makeBoardInstance(state, op.into, lib)
          state.players[loc.player].board[loc.index] = fresh
          events.push({
            type: 'GeneralTransformed',
            player: loc.player,
            iid: ref.iid,
            intoIid: fresh.iid,
            defId: op.into,
          })
        }
        break
      }
      case 'resurrect': {
        // 从墓地随机召回死去的**友方武将**(按卡面复生)。墓地混着锦囊,先滤出武将。
        const p = state.players[player]
        const deadGenerals = p.graveyard.filter((id) => lib[id]?.type === 'general' && !lib[id]?.token)
        for (let i = 0; i < op.count && p.board.length < BOARD_LIMIT && deadGenerals.length > 0; i++) {
          const roll = rngInt(state.rng, deadGenerals.length)
          state.rng = roll.next
          const [defId] = deadGenerals.splice(roll.value, 1)
          const inst = makeBoardInstance(state, defId, lib)
          p.board.push(inst)
          events.push({
            type: 'GeneralSummoned',
            player,
            iid: inst.iid,
            defId,
            position: p.board.length - 1,
            attack: inst.attack,
            health: inst.health,
          })
        }
        break
      }
      case 'setField': {
        // 同时只有一片战场:后布的直接覆盖前一片(包括对手布的)。
        // 规则整份存进 state —— 引擎不查内容表(见 types.ts FieldRule 的说明)。
        state.field = { rule: op.rule, turnsLeft: op.turns }
        events.push({ type: 'FieldChanged', rule: op.rule })
        refreshAuras(state, lib)
        break
      }
      case 'gainMorale': {
        // 鼓舞给自己,挫敌给对面。改完立刻刷光环 —— 过线/掉线要当场反映在身材上,
        // 不然「打出鼓舞」和「全场 +1 攻」中间会隔着一次不相干的场面变动。
        changeMorale(state, op.side === 'enemy' ? other(player) : player, op.amount, events)
        refreshAuras(state, lib)
        break
      }
      case 'gainSupply': {
        // 断粮可能把对手打到粮尽(=士气 -1),所以和 gainMorale 一样当场刷光环:
        // 过线/掉线要立刻反映在身材上,不能等下一次不相干的场面变动。
        changeSupply(state, op.side === 'enemy' ? other(player) : player, op.amount, events)
        refreshAuras(state, lib)
        break
      }
      // ---- 第二十二卡包 ----
      case 'mill': {
        // 断粮道:从牌库**顶**削 N 张进墓地。顶 = 数组末尾(drawCards 用的是 pop)。
        // 削到空库不补疲劳伤害 —— 疲劳只由「抽」触发,磨牌拨快的是那条计时器,
        // 不是自己直接造成伤害;两者叠在一起会让磨牌流的定价彻底失控。
        // 复用 CardDiscarded:被削掉的牌面是公开的(磨牌看得见磨到了什么,这是这条轴的乐趣)。
        const who = op.side === 'friendly' ? player : other(player)
        const target = state.players[who]
        for (let i = 0; i < op.count; i++) {
          const card = target.deck.pop()
          if (!card) break
          target.graveyard.push(card.defId)
          events.push({ type: 'CardDiscarded', player: who, iid: card.iid, defId: card.defId })
        }
        break
      }
      case 'shuffleIntoDeck': {
        const def = lib[op.defId]
        if (!def) break
        const who = op.side === 'enemy' ? other(player) : player
        const target = state.players[who]
        for (let i = 0; i < op.count; i++) {
          const inst = makeBoardInstance(state, op.defId, lib)
          // 随机位置插入(length+1 个空档,包含牌顶与牌底)—— 洗进去就该在任何地方
          const roll = rngInt(state.rng, target.deck.length + 1)
          state.rng = roll.next
          target.deck.splice(roll.value, 0, inst)
        }
        if (op.count > 0) {
          events.push({ type: 'CardShuffledIn', player: who, defId: op.defId, count: op.count })
        }
        break
      }
      case 'dispel': {
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc) continue
          // 光环附魔不摘(auraFrom 那批由 refreshAuras 全权管理,摘了下一帧就回来,
          // 白白发一串莫名其妙的「增益消退」)。clampAlive:驱散不杀人。
          removeEnchants(
            loc.inst,
            lib,
            (e) => e.auraFrom === undefined,
            events,
            loc.player,
            true,
          )
        }
        break
      }
      case 'delay': {
        // 埋伏笔。turns 记的是「还要经过几个**我方**回合」,
        // 所以 turns:1 = 下个回合开始时结算(而不是本回合末)。
        const p = state.players[player]
        p.delayed = p.delayed ?? []
        p.delayed.push({ turnsLeft: Math.max(1, op.turns), script: op.script, sourceDefId })
        events.push({ type: 'DelaySet', player, defId: sourceDefId, turns: Math.max(1, op.turns) })
        break
      }
      case 'borrow': {
        // 借将:同 seize 的搬运,外加记下原主。满场则整条效果到此为止(与 seize 一致)。
        // 已经是借来的不再转借(borrowedFrom 只有一格,链式借用会丢掉最初的主人)。
        for (const ref of refs(op.target)) {
          if (ref.kind !== 'general') continue
          const loc = findGeneral(state, ref.iid)
          if (!loc || loc.player === player) continue
          if (loc.inst.borrowedFrom !== undefined) continue
          const mine = state.players[player]
          if (mine.board.length >= BOARD_LIMIT) break
          const from = state.players[loc.player]
          const idx = from.board.findIndex((u) => u.iid === ref.iid)
          if (idx < 0) continue
          const [inst] = from.board.splice(idx, 1)
          inst.borrowedFrom = loc.player
          // 借来的当回合能动 —— 这是它和 seize 最大的区别:seize 拿的是长期资产
          // (所以要眩晕一回合),借将拿的就是**这一回合的这一次冲锋**,眩晕等于什么都没借到。
          inst.exhausted = false
          inst.attacksUsed = 0
          mine.board.push(inst)
          events.push({
            type: 'GeneralSeized',
            player,
            iid: inst.iid,
            defId: inst.defId,
            from: loc.player,
            position: mine.board.length - 1,
          })
        }
        break
      }
      default: {
        const exhaustive: never = op
        void exhaustive
      }
    }
    // 每个操作后结算死亡,避免后续操作作用在已死单位上
    processDeaths(state, events, lib)
  }
}

// ---------- 实例工厂 ----------

// ---------- 第二十二卡包:军令状 / 伏笔 / 耐久 ----------

// 军令状记账。**唯一入口** —— 三种计数各自的触发点(打出锦囊、打出武将、斩将)
// 都只调它,达成即当场结算奖励并把这道军令从领受区摘掉。
//
// 奖励脚本走 degradeChosen:达成的那一刻玩家正在做别的事(打牌、交换),
// 没法再弹一次目标选择,所以要目标的奖励会退化成随机 —— 内容层因此
// 只该给军令状写不需要点目标的奖励(和亡语同一条约束)。
export function noteQuest(
  state: GameState,
  player: PlayerIdx,
  kind: QuestGoalKind,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  const p = state.players[player]
  if (!p.quests || p.quests.length === 0) return
  // 先扫一遍要结算的,再逐个跑 —— 奖励脚本可能反过来改动 quests(理论上),
  // 边遍历边改数组是这一类 bug 的经典来源
  const done: QuestState[] = []
  for (const q of p.quests) {
    if (q.goal.kind !== kind) continue
    q.progress += 1
    if (q.progress >= q.goal.count) done.push(q)
    else {
      events.push({
        type: 'QuestProgressed',
        player,
        defId: q.defId,
        progress: q.progress,
        goal: q.goal.count,
      })
    }
  }
  if (done.length === 0) return
  p.quests = p.quests.filter((q) => !done.includes(q))
  for (const q of done) {
    events.push({ type: 'QuestCompleted', player, defId: q.defId })
    events.push({
      type: 'EffectTriggered',
      player,
      sourceDefId: q.defId,
      kind: 'quest',
    })
    runScript(state, events, lib, q.reward, {
      player,
      sourceDefId: q.defId,
      degradeChosen: true,
      kind: 'quest',
    })
  }
}

// 伏笔到期:每逢自己的回合开始扣一格,归零的当场结算。
// 在**抽牌之前**跑(见 reducer.beginTurn 的调用点)——「东风起」应该先改变战场,
// 再轮到你摸这一张牌,顺序反了玩家会觉得这一回合的开局是乱的。
export function tickDelayed(
  state: GameState,
  player: PlayerIdx,
  events: GameEvent[],
  lib: CardLibrary,
): void {
  const p = state.players[player]
  if (!p.delayed || p.delayed.length === 0) return
  const due: DelayedScript[] = []
  for (const d of p.delayed) {
    d.turnsLeft -= 1
    if (d.turnsLeft <= 0) due.push(d)
  }
  if (due.length === 0) return
  p.delayed = p.delayed.filter((d) => !due.includes(d))
  for (const d of due) {
    events.push({
      type: 'EffectTriggered',
      player,
      sourceDefId: d.sourceDefId,
      kind: 'delayed',
    })
    runScript(state, events, lib, d.script, {
      player,
      sourceDefId: d.sourceDefId,
      degradeChosen: true,
      kind: 'delayed',
    })
    processDeaths(state, events, lib)
  }
}

// 装备耐久:持有者每发起一次攻击,身上带 uses 的附魔各扣一格,归零即损毁。
//
// 扣的是**发起攻击**而不是「造成伤害」:被反击、被伏兵化解、打空气都照扣 ——
// 刀砍出去了就是砍出去了。这样玩家数得清还剩几次,不需要去理解伤害结算的分支。
export function wearEquipment(
  state: GameState,
  attackerIid: number,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  const loc = findGeneral(state, attackerIid)
  if (!loc) return
  const inst = loc.inst
  if (!inst.enchants.some((e) => e.uses !== undefined)) return
  const broken: string[] = []
  for (const e of inst.enchants) {
    if (e.uses === undefined) continue
    e.uses -= 1
    if (e.uses <= 0) broken.push(e.equip ?? '')
  }
  if (broken.length === 0) return
  // 摘掉耗尽的那几条。clampAlive:一把 +0/+3 的盾牌碎掉不该顺手把人也带走 ——
  // 那会让「给他装备」变成一个有隐藏代价的动作,没人能算得清。
  removeEnchants(inst, lib, (e) => e.uses !== undefined && e.uses <= 0, events, loc.player, true)
  for (const defId of broken) {
    events.push({ type: 'EquipmentBroken', player: loc.player, iid: inst.iid, defId })
  }
}

// 手牌中成长:回合结束时,手牌里带 handGrowth 的牌各长一格。
// 走附魔层(而不是直接改数值)—— 于是它打出去之后仍然带着这些增益,
// 而沉默/回手那套既有的撤销路径照样管得住它。
export function growHandCards(
  state: GameState,
  player: PlayerIdx,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  for (const inst of state.players[player].hand) {
    const g = lib[inst.defId]?.handGrowth
    if (!g) continue
    // events 传 null:GeneralBuffed 的飘字锚在场上单位的 DOM 上,手牌没有那个锚点。
    // 手牌成长有自己的事件(HandCardGrew),挂在主帅上。
    addEnchant(inst, lib, { attack: g.attack, health: g.health }, null, player)
    events.push({
      type: 'HandCardGrew',
      player,
      iid: inst.iid,
      defId: inst.defId,
      attack: g.attack,
      health: g.health,
    })
  }
}

// 借将归还:回合结束时,把所有「现在的所属方 ≠ 原属方」的单位送回去。
//
// 扫**两侧**而不是只扫借用方:借来的人可能又被对手策反回去了(那时 borrowedFrom
// 恰好等于当前所属方,直接把标记清掉即可),扫单侧会留下一个永远归还不掉的幽灵标记。
// 原主满场则**放逐**(不入墓、不触发亡语)—— 借来的兵还不回去就散了。
// 定成阵亡的话,「借一个再让他还不回去」会变成一张稳定的硬解,那不是这条轴该有的强度。
export function returnBorrowed(
  state: GameState,
  lib: CardLibrary,
  events: GameEvent[],
): void {
  for (const side of [0, 1] as const) {
    const board = state.players[side].board
    for (let i = board.length - 1; i >= 0; i--) {
      const inst = board[i]
      const owner = inst.borrowedFrom
      if (owner === undefined) continue
      if (owner === side) {
        inst.borrowedFrom = undefined
        continue
      }
      board.splice(i, 1)
      inst.borrowedFrom = undefined
      const home = state.players[owner]
      if (home.board.length >= BOARD_LIMIT) {
        events.push({ type: 'GeneralBanished', player: side, iid: inst.iid, defId: inst.defId })
        continue
      }
      inst.exhausted = true
      inst.attacksUsed = 0
      home.board.push(inst)
      events.push({
        type: 'GeneralSeized',
        player: owner,
        iid: inst.iid,
        defId: inst.defId,
        from: side,
        position: home.board.length - 1,
      })
    }
  }
  refreshAuras(state, lib)
}

export function resetInstance(inst: CardInstance, lib: CardLibrary): void {
  inst.enchants = []
  inst.damage = 0
  inst.borrowedFrom = undefined
  inst.silenced = false
  inst.frozen = false
  inst.shieldUsed = false
  inst.stealthBroken = false
  inst.exhausted = false
  inst.attacksUsed = 0
  refreshInstance(inst, lib)
}

// ---------- 费用消减 / 牌生成 ----------

// 有效费用 = max(0, 卡面费 + 实例 costDelta)。手牌打出/合法性判定都走它。
export function effectiveCost(inst: CardInstance, lib: CardLibrary): number {
  return Math.max(0, (lib[inst.defId]?.cost ?? 0) + inst.costDelta)
}

// 减少手牌中匹配 filter 的牌的费用。dynasty 用来源卡的势力。
export function reduceHandCost(
  state: GameState,
  player: PlayerIdx,
  sourceDefId: string,
  lib: CardLibrary,
  amount: number,
  filter: CostFilter,
  events: GameEvent[],
): void {
  const srcDynasty = lib[sourceDefId]?.dynasty
  for (const inst of state.players[player].hand) {
    const def = lib[inst.defId]
    if (!def) continue
    const match =
      filter === 'all' ||
      (filter === 'dynasty' && def.dynasty === srcDynasty) ||
      (filter === 'generals' && def.type === 'general') ||
      (filter === 'stratagems' && def.type === 'stratagem')
    if (!match) continue
    const before = effectiveCost(inst, lib)
    inst.costDelta -= amount
    const after = effectiveCost(inst, lib)
    if (after !== before) {
      events.push({ type: 'CardCostChanged', player, iid: inst.iid, cost: after })
    }
  }
}

// ---------- 发现 ----------

// 发现的候选池。用**来源卡的主义**判定「我方主义」——
// 引擎只有 heroId、拿不到主义,而「你打出一张王道卡 → 发现王道卡」在体感上
// 和「你的主公是王道」是一回事,还免去了把主义塞进引擎。
function discoverCandidates(
  lib: CardLibrary,
  pool: DiscoverPool,
  sourceDoctrine: Doctrine | 'neutral',
): string[] {
  const all = Object.values(lib).filter((c) => !c.token)
  const mine = (c: CardDef) => c.doctrine === sourceDoctrine || c.doctrine === 'neutral'
  let picked: CardDef[]
  switch (pool) {
    case 'myStratagem':
      picked = all.filter((c) => c.type === 'stratagem' && mine(c))
      break
    case 'myGeneral':
      picked = all.filter((c) => c.type === 'general' && mine(c))
      break
    case 'anyKeyword':
      picked = all.filter((c) => c.type === 'general' && c.keywords.length > 0)
      break
    case 'costlyGeneral':
      picked = all.filter((c) => c.type === 'general' && c.cost >= 6)
      break
  }
  // 按 collectorNo 排序:候选集合必须**确定**,采样才可复现(引擎纯度铁律)
  return picked.sort((a, b) => a.collectorNo - b.collectorNo).map((c) => c.id)
}

// 从候选池里用种子 RNG 取 count 张不重复的,挂上 pendingChoice。
// 池子比 count 小就全给(常见于窄主义 + 窄谓词)。
export function beginDiscover(
  state: GameState,
  player: PlayerIdx,
  pool: DiscoverPool,
  count: number,
  lib: CardLibrary,
  events: GameEvent[],
  sourceDefId: string,
): void {
  const doctrine = lib[sourceDefId]?.doctrine ?? 'neutral'
  const candidates = discoverCandidates(lib, pool, doctrine)
  if (candidates.length === 0) return // 无候选:发现直接落空,不挂起对局
  // 部分 Fisher–Yates:只洗出前 count 个就够
  const bag = candidates.slice()
  const options: string[] = []
  for (let i = 0; i < count && bag.length > 0; i++) {
    const roll = rngInt(state.rng, bag.length)
    state.rng = roll.next
    options.push(bag.splice(roll.value, 1)[0])
  }
  state.pendingChoice = { player, options, reason: 'discover' }
  events.push({ type: 'DiscoverStarted', player, options, reason: 'discover' })
}

export function makeBoardInstance(
  state: GameState,
  defId: string,
  lib: CardLibrary,
): CardInstance {
  const inst: CardInstance = {
    iid: state.nextIid++,
    defId,
    attack: 0,
    health: 0,
    maxHealth: 0,
    keywords: [],
    exhausted: true,
    attacksUsed: 0,
    enchants: [],
    damage: 0,
    silenced: false,
    frozen: false,
    shieldUsed: false,
    stealthBroken: false,
    costDelta: 0,
  }
  refreshInstance(inst, lib)
  return inst
}
