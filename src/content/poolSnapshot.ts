// 卡池摘要 —— 把一张卡压成一行「影响对局的东西」。
//
// 判定层单放在这里(不是长在测试里),因为写快照的脚本和验快照的测试
// 必须用**同一份**摘要逻辑。两边各写一遍的话,有一天它们会悄悄分叉,
// 而那正好是这道闸门要防的那类事。
//
// 用法见 src/content/poolSnapshot.test.ts 与 scripts/pool-snapshot.ts。
import { COLLECTIBLE_CARDS } from './cards'
import type { CardDef } from '../engine/types'

/** 效果那一坨压成 8 位十六进制。FNV-1a,够散,而且不引依赖。 */
export function fxHash(c: CardDef): string {
  const anyC = c as unknown as Record<string, unknown>
  // 只取**影响对局**的字段。名字、风味句、画师、collectorNo 改了不该让闸门红 ——
  // 那会让所有人习惯性地无脑更新快照,闸门就废了。
  const payload = JSON.stringify([
    anyC.battlecry, anyC.spell, anyC.deathrattle, anyC.endOfTurn, anyC.startOfTurn,
    anyC.onAttack, anyC.onDamaged, anyC.onSpellCast, anyC.combo, anyC.choose,
    anyC.secret, anyC.aura, anyC.bond, anyC.rival, anyC.formation,
    anyC.enrage, anyC.spellDamage, anyC.overload, anyC.supplyCost, anyC.heirloom,
  ])
  let h = 0x811c9dc5
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** 一张卡的一行摘要。可读 —— git diff 直接就是一份「谁被动了」的清单。 */
export function digest(c: CardDef): string {
  // 关键词排序:它的顺序不影响对局,不排的话换个书写顺序就假红一次。
  const kw = [...c.keywords].sort().join(',')
  return (
    `${c.cost}/${c.attack ?? '-'}/${c.health ?? '-'} ` +
    `${c.rarity} ${c.doctrine} ${c.type} [${kw}] fx:${fxHash(c)}`
  )
}

/** 当前卡池的全部摘要,按 id 排序 —— 排序是为了让 diff 稳定。 */
export function poolDigests(): Record<string, string> {
  const out: [string, string][] = []
  for (const c of COLLECTIBLE_CARDS) {
    if (c.token) continue
    out.push([c.id, digest(c)])
  }
  out.sort(([a], [b]) => a.localeCompare(b))
  return Object.fromEntries(out)
}
