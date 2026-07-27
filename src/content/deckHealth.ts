import type { CardDef } from '../engine/types'
import { CARDS_BY_ID } from './cards'

// 卡组体检:曲线之外的那几项结构指标。
//
// 这套算法原来只活在 `scripts/deck-stats.ts` 里 —— 调预组平衡时用得上,
// 而**真正在构筑的玩家一项都看不到**。对位极化的根因通常不是某张卡强,
// 而是两套牌的骨架不在一个量级(总身材、解场数、守护/抢攻),
// 这些恰恰是新手最不会自己数的东西。
//
// 抽到这里来让脚本与构筑器共用同一份定义:两边算出来的数必须是同一个数,
// 否则「体检说我解场够」和「平衡脚本说这套解场少」会同时成立。

// 「解场」= 能直接处理敌方随从的牌(伤害/AOE/摧毁/弹回)
export function isRemoval(c: CardDef): boolean {
  const ops = [...(c.spell?.ops ?? []), ...(c.battlecry?.ops ?? []), ...(c.deathrattle?.ops ?? [])]
  return ops.some(
    (o) =>
      o.op === 'aoeDamage' ||
      o.op === 'destroy' ||
      o.op === 'returnToHand' ||
      (o.op === 'damage' &&
        (o.target === 'chosenEnemyGeneral' ||
          o.target === 'chosenAny' ||
          o.target === 'allEnemyGenerals' ||
          o.target === 'randomEnemyGeneral')),
  )
}

export function isDraw(c: CardDef): boolean {
  const ops = [...(c.spell?.ops ?? []), ...(c.battlecry?.ops ?? [])]
  return ops.some((o) => o.op === 'draw')
}

export interface DeckHealth {
  cards: number
  avgCost: number
  attack: number
  health: number
  body: number // 总身材 = 攻 + 血
  curve: Record<number, number>
  guards: number
  aggro: number // 冲锋 + 突袭
  removal: number
  draw: number
  spells: number
  equips: number
}

export function deckHealth(cardIds: string[]): DeckHealth {
  const curve: Record<number, number> = {}
  let attack = 0
  let health = 0
  let guards = 0
  let aggro = 0
  let removal = 0
  let draw = 0
  let spells = 0
  let equips = 0
  let cost = 0
  let cards = 0
  for (const id of cardIds) {
    const c = CARDS_BY_ID[id]
    if (!c) continue
    cards++
    cost += c.cost
    curve[c.cost] = (curve[c.cost] ?? 0) + 1
    if (c.type === 'general') {
      attack += c.attack ?? 0
      health += c.health ?? 0
    } else if (c.type === 'stratagem') spells++
    else equips++
    if (c.keywords.includes('guard')) guards++
    if (c.keywords.includes('charge') || c.keywords.includes('rush')) aggro++
    if (isRemoval(c)) removal++
    if (isDraw(c)) draw++
  }
  return {
    cards,
    avgCost: cards ? cost / cards : 0,
    attack,
    health,
    body: attack + health,
    curve,
    guards,
    aggro,
    removal,
    draw,
    spells,
    equips,
  }
}

// 构筑器里的「这项够不够」提示。
//
// 阈值取自**六套预组的实测值**(`npm run deck-stats`,那六套是跨很多轮 sim-balance
// 手调出来的,可以当健康基线):守护一律 12、解场 6~10、总身材 194~216。
// 带子在实测区间上下各放宽一点,免得把「和预组一样健康」的牌判成异常。
//
// **只对守护与解场给判定**:这两项六套预组高度一致,偏离就是真的偏离。
// 抽牌在预组里是 0~4(有的流派根本不带),没有可用的基线,所以只显示数字不判好坏 ——
// 与其给一个拍脑袋的阈值,不如不判。
//
// 只提示不拦截 —— 卡组合法性由 deckErrorText 那层管,这里纯属体检建议。
export type HealthVerdict = 'low' | 'ok' | 'high'

export function verdictOf(kind: 'guards' | 'removal', n: number): HealthVerdict {
  const BANDS: Record<string, [number, number]> = {
    guards: [8, 16],
    removal: [5, 12],
  }
  const [lo, hi] = BANDS[kind]
  return n < lo ? 'low' : n > hi ? 'high' : 'ok'
}
