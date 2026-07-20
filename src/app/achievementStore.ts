import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Doctrine, GameEvent, LocalizedText } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import { DOCTRINE_NAME } from '../content/names'
import { HEROES_BY_ID } from '../content/overrides/heroes'

// 成就「功名簿」。
//
// 此前唯一的目标系统是**每天零点清空**的军令 —— 玩家没有任何跨天累积的东西可追。
// 成就是永久计数:打过的每一局都在往上加,不会因为今天没上线就白打。
//
// 与军令的两点区别:
// 1. 统计口径是**终身累计**,存在 stats 里;成就本身只是「stat >= goal」的视图。
//    这样加新成就不需要迁移旧存档 —— 老玩家的历史进度立刻就有。
// 2. 奖励以功勋为主、卡包为辅。卡包产出会直接冲击开包经济(一局一包的基线),
//    而功勋是定向的、可控的。

export type StatKey =
  | 'matchesPlayed'
  | 'matchesWon'
  | 'duelKills'
  | 'generalsPlayed'
  | 'stratagemsCast'
  | 'equipmentAttached'
  | 'heroDamage'
  | 'silences'
  | 'freezes'
  | 'shieldsPopped'
  | 'heroPowersUsed'
  | 'cardsCrafted'
  | 'packsOpened'
  | 'arenaBestWins'
  | 'bestTurnDamage'
  | `won_${Doctrine}`

export type Stats = Partial<Record<StatKey, number>>

export interface AchievementDef {
  id: string
  name: LocalizedText
  desc: LocalizedText
  stat: StatKey
  goal: number
  merit: number
  packs?: number
}

const ROMAN = ['Ⅰ', 'Ⅱ', 'Ⅲ', 'Ⅳ']

const tier = (
  idBase: string,
  stat: StatKey,
  name: LocalizedText,
  descOf: (n: number) => LocalizedText,
  goals: number[],
  merits: number[],
): AchievementDef[] =>
  goals.map((goal, i) => ({
    id: `${idBase}-${i + 1}`,
    name: {
      zh: `${name.zh} ${ROMAN[i] ?? i + 1}`,
      en: `${name.en} ${ROMAN[i] ?? i + 1}`,
    },
    desc: descOf(goal),
    stat,
    goal,
    merit: merits[i] ?? 50,
  }))

export const ACHIEVEMENTS: AchievementDef[] = [
  ...tier(
    'ach-win',
    'matchesWon',
    { zh: '百战', en: 'Campaigner' },
    (n) => ({ zh: `累计赢下 ${n} 场对局`, en: `Win ${n} matches` }),
    [10, 50, 200],
    [60, 200, 600],
  ),
  ...tier(
    'ach-duel',
    'duelKills',
    { zh: '斩将', en: 'Duelist' },
    (n) => ({ zh: `单挑击杀 ${n} 名敌将`, en: `Slay ${n} generals in duels` }),
    [25, 100],
    [80, 250],
  ),
  ...tier(
    'ach-damage',
    'heroDamage',
    { zh: '摧城', en: 'Siegebreaker' },
    (n) => ({ zh: `累计对敌方主公造成 ${n} 点伤害`, en: `Deal ${n} damage to enemy heroes` }),
    [500, 2500],
    [80, 260],
  ),
  ...tier(
    'ach-power',
    'heroPowersUsed',
    { zh: '主公技', en: 'Sovereign' },
    (n) => ({ zh: `发动主公技 ${n} 次`, en: `Use your Hero Power ${n} times` }),
    [50, 300],
    [60, 220],
  ),
  ...tier(
    'ach-craft',
    'cardsCrafted',
    { zh: '铸印', en: 'Artificer' },
    (n) => ({ zh: `合成 ${n} 张卡牌`, en: `Craft ${n} cards` }),
    [1, 20],
    [40, 200],
  ),
  ...tier(
    'ach-pack',
    'packsOpened',
    { zh: '启封', en: 'Collector' },
    (n) => ({ zh: `开启 ${n} 个卡包`, en: `Open ${n} packs` }),
    [10, 100],
    [50, 250],
  ),
  {
    id: 'ach-silence',
    name: { zh: '止水', en: 'Still Waters' },
    desc: { zh: '沉默 20 名敌将', en: 'Silence 20 enemy generals' },
    stat: 'silences',
    goal: 20,
    merit: 90,
  },
  {
    id: 'ach-freeze',
    name: { zh: '冰封', en: 'Deep Freeze' },
    desc: { zh: '冻结 30 名敌将', en: 'Freeze 30 enemy generals' },
    stat: 'freezes',
    goal: 30,
    merit: 90,
  },
  {
    id: 'ach-shield',
    name: { zh: '破壁', en: 'Shieldbreaker' },
    desc: { zh: '击碎 30 层铁壁', en: 'Pop 30 Divine Shields' },
    stat: 'shieldsPopped',
    goal: 30,
    merit: 90,
  },
  {
    id: 'ach-burst',
    name: { zh: '雷霆一击', en: 'Thunderclap' },
    desc: { zh: '单回合对敌方主公造成 20 点伤害', en: 'Deal 20 damage to the enemy hero in one turn' },
    stat: 'bestTurnDamage',
    goal: 20,
    merit: 150,
    packs: 1,
  },
  {
    id: 'ach-arena-6',
    name: { zh: '校场六捷', en: 'Six in the Arena' },
    desc: { zh: '竞技场单轮取得 6 胜', en: 'Reach 6 wins in a single Arena run' },
    stat: 'arenaBestWins',
    goal: 6,
    merit: 150,
  },
  {
    id: 'ach-arena-12',
    name: { zh: '校场无敌', en: 'Arena Undefeated' },
    desc: { zh: '竞技场单轮取得 12 胜', en: 'Reach 12 wins in a single Arena run' },
    stat: 'arenaBestWins',
    goal: 12,
    merit: 400,
    packs: 2,
  },
  // 六主义各一条:逼玩家把六套预组都摸一遍,这是最好的「教程之后的教程」
  ...(Object.keys(DOCTRINE_NAME) as (Doctrine | 'neutral')[])
    .filter((d): d is Doctrine => d !== 'neutral')
    .map(
      (d): AchievementDef => ({
        id: `ach-doctrine-${d}`,
        name: { zh: `${DOCTRINE_NAME[d].zh}之主`, en: `${DOCTRINE_NAME[d].en} Sovereign` },
        desc: {
          zh: `以${DOCTRINE_NAME[d].zh}主公赢下 5 场`,
          en: `Win 5 matches with a ${DOCTRINE_NAME[d].en} hero`,
        },
        stat: `won_${d}`,
        goal: 5,
        merit: 70,
      }),
    ),
]

// ---------- 事件流 → 统计增量(纯函数,可测) ----------

export function tallyStats(events: GameEvent[], myHeroId: string): Stats {
  const out: Stats = {}
  const add = (k: StatKey, n: number) => {
    if (n > 0) out[k] = (out[k] ?? 0) + n
  }
  const doctrine = HEROES_BY_ID[myHeroId]?.doctrine

  // 单回合脸伤:回合切换时清零,取整局最大值
  let turnFaceDamage = 0
  let bestTurn = 0

  for (const ev of events) {
    switch (ev.type) {
      case 'GameEnded':
        add('matchesPlayed', 1)
        if (ev.winner === 0) {
          add('matchesWon', 1)
          if (doctrine) add(`won_${doctrine}`, 1)
        }
        break
      case 'TurnStarted':
        turnFaceDamage = 0
        break
      case 'HeroDamaged':
        if (ev.player === 1) {
          add('heroDamage', ev.amount)
          turnFaceDamage += ev.amount
          bestTurn = Math.max(bestTurn, turnFaceDamage)
        }
        break
      case 'CardPlayed': {
        if (ev.player !== 0) break
        const def = CARDS_BY_ID[ev.defId]
        if (def?.type === 'general') add('generalsPlayed', 1)
        else if (def?.type === 'stratagem') add('stratagemsCast', 1)
        break
      }
      case 'EquipmentAttached':
        if (ev.player === 0) add('equipmentAttached', 1)
        break
      case 'DuelFought':
        if (ev.challenger === 0 && ev.defenderDied) add('duelKills', 1)
        break
      case 'HeroPowerUsed':
        if (ev.player === 0) add('heroPowersUsed', 1)
        break
      // 下面三条按「受影响方是敌人」计:是我干的
      case 'GeneralSilenced':
        if (ev.player === 1) add('silences', 1)
        break
      case 'GeneralFrozen':
        if (ev.player === 1) add('freezes', 1)
        break
      case 'DivineShieldPopped':
        if (ev.player === 1) add('shieldsPopped', 1)
        break
      default:
        break
    }
  }
  if (bestTurn > 0) out.bestTurnDamage = bestTurn
  return out
}

// bestTurnDamage / arenaBestWins 是「取最大」而不是「累加」
const MAX_STATS = new Set<StatKey>(['bestTurnDamage', 'arenaBestWins'])

export function mergeStats(base: Stats, delta: Stats): Stats {
  const out: Stats = { ...base }
  for (const [k, v] of Object.entries(delta) as [StatKey, number][]) {
    out[k] = MAX_STATS.has(k) ? Math.max(out[k] ?? 0, v) : (out[k] ?? 0) + v
  }
  return out
}

// ---------- Store ----------

interface AchievementStoreState {
  stats: Stats
  claimed: string[]
  recordMatch(events: GameEvent[], myHeroId: string): void
  bump(stat: StatKey, n?: number): void
  claim(id: string): AchievementDef | null
  claimableCount(): number
}

export const useAchievements = create<AchievementStoreState>()(
  persist(
    (set, get) => ({
      stats: {},
      claimed: [],

      recordMatch(events, myHeroId) {
        set((s) => ({ stats: mergeStats(s.stats, tallyStats(events, myHeroId)) }))
      },

      // 对局之外的计数(开包、合成、竞技场轮次)从各自的 store 打进来
      bump(stat, n = 1) {
        set((s) => ({ stats: mergeStats(s.stats, { [stat]: n }) }))
      },

      claim(id) {
        const def = ACHIEVEMENTS.find((a) => a.id === id)
        if (!def) return null
        const s = get()
        if (s.claimed.includes(id)) return null
        if ((s.stats[def.stat] ?? 0) < def.goal) return null
        set({ claimed: [...s.claimed, id] })
        return def
      },

      claimableCount() {
        const s = get()
        return ACHIEVEMENTS.filter(
          (a) => !s.claimed.includes(a.id) && (s.stats[a.stat] ?? 0) >= a.goal,
        ).length
      },
    }),
    { name: 'qiangu-achievements' },
  ),
)
