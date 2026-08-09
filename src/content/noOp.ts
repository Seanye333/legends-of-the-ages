import type { CardDef, EffectOp, EffectScript } from '../engine/types'

// 「量为 0 的一步」—— 它**恒等于什么都不做**。
//
// 【为什么这份判据住在 src/ 而不是 scripts/】
// 三个地方要用同一份定义,而它们分属两侧:
//   · scripts/pricing.ts   —— 不让它进统计(混进 draw 组会给定价校准掺沙子)
//   · scripts/contentRules —— 让它可见(lint-content 的 no-op 规则)
//   · src/content/cards.ts —— 把它**剥掉**(下面这个 stripNoOps)
// 抄成两份的下场 pricing.ts 的注释里已经写过一次了:有一天一边加了新 op、
// 另一边没加,两份对同一张卡的判断悄悄分叉,而且谁都不会红。
// 第三处在浏览器包里,所以共用的那一份只能住在 src/。

// 「哪个 op 的量记在哪个字段上」。
// 这份表跟着卡池进浏览器包,而首屏主包的基线余量不到 1KB(见 perf-budget)——
// 所以试过改写成「字段 → op 列表」少写二十遍 `['amount']`:
// **量下来一个字节都没省**(189.8 KB 不动),gzip 早把重复的那截压掉了。
// 于是留可读的这一版。
const ZERO_FIELDS: Record<string, string[]> = {
  damage: ['amount'], heal: ['amount'], aoeDamage: ['amount'], damageAll: ['amount'],
  damagePer: ['amount'], gainArmor: ['amount'], gainMana: ['amount'], gainMorale: ['amount'],
  gainSupply: ['amount'], reduceCost: ['amount'],
  draw: ['count'], summon: ['count'], summonForEnemy: ['count'], tutor: ['count'],
  recruit: ['count'], discardRandom: ['count'], stealCard: ['count'], resurrect: ['count'],
  addToHand: ['count'], mill: ['count'], shuffleIntoDeck: ['count'],
  // 增益两项都为 0 才算废;+1/+0 是有意义的
  buffStats: ['attack', 'health'], buffPer: ['attack', 'health'],
}

export function isNoOp(op: { op: string }): boolean {
  const fields = ZERO_FIELDS[op.op]
  if (!fields) return false
  const rec = op as unknown as Record<string, unknown>
  const vals = fields.map((f) => rec[f]).filter((v): v is number => typeof v === 'number')
  return vals.length > 0 && vals.every((v) => v === 0)
}

/**
 * 剥掉一串 op 里的空操作。没有可剥的就**原样返回同一个数组**
 * —— 调用方靠引用相等判断「这一段动没动」,免得整张卡白复制一遍。
 *
 * 伏笔(delay)把一整段脚本包在 op 里,所以要递归。伏笔里剥空了就把伏笔本身丢掉:
 * 一个到期什么都不做的伏笔,连「等三回合」这个提示都不该给。
 */
function stripOps(ops: EffectOp[]): EffectOp[] {
  let changed = false
  const out: EffectOp[] = []
  for (const op of ops) {
    if (isNoOp(op)) {
      changed = true
      continue
    }
    if (op.op === 'delay') {
      const inner = stripOps(op.script.ops)
      if (inner !== op.script.ops) {
        changed = true
        if (inner.length > 0) out.push({ ...op, script: { ...op.script, ops: inner } })
        continue
      }
    }
    out.push(op)
  }
  return changed ? out : ops
}

/**
 * 剥完还剩东西才剥。
 *
 * 【为什么整段都是空操作时反而不动它】
 * 那是另一回事:一张卡写着「戰吼:……」而战吼里一步实事都没有,
 * 说明**卡面在说谎**,该让 lint-content 继续报出来,而不是在这里悄悄抹平。
 * 这个函数只负责一件事:把生成层留下的、夹在实事中间的那半步噪声去掉。
 */
function stripScript(s: EffectScript): EffectScript {
  const ops = stripOps(s.ops)
  return ops === s.ops || ops.length === 0 ? s : { ...s, ops }
}

const SLOTS = [
  'battlecry', 'deathrattle', 'spell', 'endOfTurn', 'startOfTurn',
  'onDamaged', 'onAttack', 'onSpellCast', 'combo',
] as const

/**
 * 把一张卡上所有脚本里的空操作剥掉。
 *
 * 【这一层只对生成层的卡用】(见 cards.ts 的调用处)
 * 六张卡的战吼是 `[{gainSupply:1}, {draw:0}]` —— 王允 · 孫匡 · 張英 ·
 * 陶應 · 劉範 · 楊復恭。根子在素材源头的生成器,而改那个要姊妹仓库
 * `../ThreeKingdomMastersIOS`,这台机器上没有。
 * 合并层本来就是「改不动生成层时在这里改」的地方(applyBattleFixes / applyTuning
 * 都在同一条链上),所以剥在这儿。
 *
 * **手写的卡包不走这一层** —— 那些改得动,该让 lint-content 的 no-op 规则
 * 直接报出来,而不是被这个函数替它们擦干净。
 */
export function stripNoOps(card: CardDef): CardDef {
  const patch: Record<string, unknown> = {}

  for (const k of SLOTS) {
    const s = card[k]
    if (s) {
      const next = stripScript(s)
      if (next !== s) patch[k] = next
    }
  }
  // 伏兵、军令状的奖励、抉择的每个模式 —— 都是脚本,一个都不能漏。
  // 漏了的表现是「lint 还在报,而报的那张卡你怎么看都没问题」。
  if (card.secret) {
    const next = stripScript(card.secret.script)
    if (next !== card.secret.script) patch.secret = { ...card.secret, script: next }
  }
  if (card.quest) {
    const next = stripScript(card.quest.reward)
    if (next !== card.quest.reward) patch.quest = { ...card.quest, reward: next }
  }
  if (card.choose) {
    const modes = card.choose.modes.map((m) => {
      const next = stripScript(m.script)
      return next === m.script ? m : { ...m, script: next }
    })
    if (modes.some((m, i) => m !== card.choose!.modes[i])) {
      patch.choose = { ...card.choose, modes }
    }
  }

  return Object.keys(patch).length === 0 ? card : { ...card, ...patch }
}
