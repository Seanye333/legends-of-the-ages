// 每日任务:每天三条,当日零点刷新,完成领卡包。
// 进度只从对局事件流统计(与引擎解耦,纯函数可测)。
import { DOCTRINE_NAME } from '../content/names'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GameEvent } from '../engine/types'
import type { Doctrine } from '../engine/types'
import { CARDS_BY_ID } from '../content/cards'
import type { TroopType } from '../engine/types'
import { TROOP_NAME } from '../content/troops'
import { ERA_NAME, ERA_OF, type Era } from '../content/eras'
import { HEROES_BY_ID } from '../content/overrides/heroes'
import { todayStr } from './leaderboard'

// ---------- 任务定义 ----------

export type QuestKind =
  | 'win' // 获胜 N 局
  | 'duelKill' // 单挑击杀 N 名敌将
  | 'playGenerals' // 打出 N 名武将
  | 'playStratagems' // 打出 N 张锦囊
  | 'equipGenerals' // 装备 N 次
  | 'heroDamage' // 对敌方主公造成 N 点伤害
  | 'winWithDoctrine' // 用指定主义主公获胜 N 局
  // ---- 与内容挂钩的军令 ----
  // 任务池原来七种,全是「打出 N 张」「造成 N 点」这类**与卡池无关**的计数,
  // 换掉整个卡池它们一条都不用改 —— 也就是说它们从不引导你去玩任何具体的东西。
  // 下面三种挂在真实内容上:兵种、时代、战场。
  | 'playTroop' // 打出 N 名指定兵种的武将
  | 'playEra' // 打出 N 名指定时代块的武将
  | 'setField' // 布下 N 次战场环境

export interface QuestDef {
  kind: QuestKind
  goal: number
  reward: number // 卡包数
  doctrine?: Doctrine // 仅 winWithDoctrine
  troop?: TroopType // 仅 playTroop
  era?: Era // 仅 playEra
}

export interface QuestState extends QuestDef {
  id: string
  progress: number
  claimed: boolean
}

// 主义名走 content/names.ts 的唯一来源(这里原本自己抄了一份,两边会飘)
const DOCTRINE_ZH = (d: Doctrine) => DOCTRINE_NAME[d].zh
const DOCTRINE_EN = (d: Doctrine) => DOCTRINE_NAME[d].en

export function questText(q: QuestDef): { zh: string; en: string } {
  switch (q.kind) {
    case 'win':
      return { zh: `赢下 ${q.goal} 场对局`, en: `Win ${q.goal} matches` }
    case 'duelKill':
      return { zh: `单挑击杀 ${q.goal} 名敌将`, en: `Slay ${q.goal} generals in duels` }
    case 'playGenerals':
      return { zh: `打出 ${q.goal} 名武将`, en: `Play ${q.goal} generals` }
    case 'playStratagems':
      return { zh: `施放 ${q.goal} 张锦囊`, en: `Cast ${q.goal} stratagems` }
    case 'equipGenerals':
      return { zh: `为武将装备 ${q.goal} 次`, en: `Attach ${q.goal} equipment` }
    case 'heroDamage':
      return { zh: `对敌方主公造成 ${q.goal} 点伤害`, en: `Deal ${q.goal} damage to enemy heroes` }
    case 'playTroop':
      return {
        zh: `打出 ${q.goal} 名${TROOP_NAME[q.troop ?? 'cavalry'].zh}`,
        en: `Play ${q.goal} ${TROOP_NAME[q.troop ?? 'cavalry'].en} generals`,
      }
    case 'playEra':
      return {
        zh: `打出 ${q.goal} 名${ERA_NAME[q.era ?? 'three-kingdoms'].zh}的武将`,
        en: `Play ${q.goal} generals from the ${ERA_NAME[q.era ?? 'three-kingdoms'].en} age`,
      }
    case 'setField':
      return {
        zh: `布下 ${q.goal} 次戰場`,
        en: `Lay down ${q.goal} battlefield${q.goal > 1 ? 's' : ''}`,
      }
    case 'winWithDoctrine':
      return {
        zh: `以${DOCTRINE_ZH(q.doctrine ?? 'royal')}主公赢下 ${q.goal} 场`,
        en: `Win ${q.goal} match with a ${DOCTRINE_EN(q.doctrine ?? 'royal')} hero`,
      }
  }
}

// 任务池:难度与奖励挂钩(一天最多产出 4 包,不破坏卡包经济)
const POOL: QuestDef[] = [
  { kind: 'win', goal: 1, reward: 1 },
  { kind: 'win', goal: 3, reward: 2 },
  { kind: 'duelKill', goal: 2, reward: 1 },
  { kind: 'duelKill', goal: 4, reward: 2 },
  { kind: 'playGenerals', goal: 20, reward: 1 },
  { kind: 'playGenerals', goal: 35, reward: 2 },
  { kind: 'playStratagems', goal: 5, reward: 1 },
  { kind: 'playStratagems', goal: 10, reward: 2 },
  { kind: 'equipGenerals', goal: 3, reward: 1 },
  { kind: 'heroDamage', goal: 60, reward: 1 },
  { kind: 'heroDamage', goal: 120, reward: 2 },
  // 兵种:骑兵占池 25% 最好凑,水军 9% 最难 —— 目标数按占比给
  { kind: 'playTroop', goal: 6, reward: 1, troop: 'cavalry' },
  { kind: 'playTroop', goal: 4, reward: 1, troop: 'infantry' },
  { kind: 'playTroop', goal: 3, reward: 1, troop: 'archer' },
  { kind: 'playTroop', goal: 2, reward: 2, troop: 'navy' },
  { kind: 'playTroop', goal: 2, reward: 2, troop: 'siege' },
  { kind: 'playEra', goal: 5, reward: 1, era: 'three-kingdoms' },
  { kind: 'playEra', goal: 4, reward: 2, era: 'pre-qin' },
  { kind: 'playEra', goal: 4, reward: 2, era: 'song-yuan' },
  { kind: 'setField', goal: 1, reward: 1 },
  ...(Object.keys(DOCTRINE_ZH) as Doctrine[]).map(
    (doctrine): QuestDef => ({ kind: 'winWithDoctrine', goal: 1, reward: 1, doctrine }),
  ),
]

const DAILY_COUNT = 3

// 日期字符串 → 稳定种子(同一天刷出同一组任务,跨设备也一致)
function hashDate(date: string): number {
  let h = 2166136261
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rollDailyQuests(date: string): QuestState[] {
  let seed = hashDate(date)
  const next = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x100000000
  }
  const pool = [...POOL]
  const picked: QuestState[] = []
  // 同 kind 不重复,保证三条任务玩法各异
  const usedKinds = new Set<QuestKind>()
  while (picked.length < DAILY_COUNT && pool.length > 0) {
    const i = Math.floor(next() * pool.length)
    const [def] = pool.splice(i, 1)
    if (usedKinds.has(def.kind)) continue
    usedKinds.add(def.kind)
    picked.push({
      ...def,
      id: `${date}-${def.kind}-${def.doctrine ?? ''}${def.troop ?? ''}${def.era ?? ''}${def.goal}`,
      progress: 0,
      claimed: false,
    })
  }
  return picked
}

// ---------- 对局结算 → 进度增量(纯函数) ----------

export interface MatchTally {
  win: number
  duelKill: number
  playGenerals: number
  playStratagems: number
  equipGenerals: number
  heroDamage: number
  heroDoctrine?: Doctrine // 我方主公主义(用于 winWithDoctrine)
  // 与内容挂钩的三项。前两项按 key 分桶 —— 一局里六个兵种可能同时有进度。
  playTroop: Partial<Record<TroopType, number>>
  playEra: Partial<Record<Era, number>>
  setField: number
}

// 统计一局的事件流。玩家恒为 0 号(本地帧)。
export function tallyMatch(events: GameEvent[], myHeroId: string): MatchTally {
  const tally: MatchTally = {
    win: 0,
    duelKill: 0,
    playGenerals: 0,
    playTroop: {},
    playEra: {},
    setField: 0,
    playStratagems: 0,
    equipGenerals: 0,
    heroDamage: 0,
  }
  tally.heroDoctrine = HEROES_BY_ID[myHeroId]?.doctrine
  for (const ev of events) {
    switch (ev.type) {
      case 'GameEnded':
        if (ev.winner === 0) tally.win += 1
        break
      case 'CardPlayed': {
        if (ev.player !== 0) break
        const def = CARDS_BY_ID[ev.defId]
        if (def?.type === 'general') {
          tally.playGenerals += 1
          if (def.troop) tally.playTroop[def.troop] = (tally.playTroop[def.troop] ?? 0) + 1
          const era = ERA_OF[def.dynasty]
          if (era) tally.playEra[era] = (tally.playEra[era] ?? 0) + 1
        } else if (def?.type === 'stratagem') tally.playStratagems += 1
        break
      }
      case 'EquipmentAttached':
        if (ev.player === 0) tally.equipGenerals += 1
        break
      case 'DuelFought':
        if (ev.challenger === 0 && ev.defenderDied) tally.duelKill += 1
        break
      case 'HeroDamaged':
        if (ev.player === 1) tally.heroDamage += ev.amount
        break
      case 'FieldChanged':
        // 布下才算(rule 存在);消散那一条不算
        if (ev.rule) tally.setField += 1
        break
      default:
        break
    }
  }
  return tally
}

export function applyTally(quests: QuestState[], tally: MatchTally): QuestState[] {
  return quests.map((q) => {
    if (q.progress >= q.goal) return q
    let gain = 0
    switch (q.kind) {
      case 'win':
        gain = tally.win
        break
      case 'duelKill':
        gain = tally.duelKill
        break
      case 'playGenerals':
        gain = tally.playGenerals
        break
      case 'playStratagems':
        gain = tally.playStratagems
        break
      case 'equipGenerals':
        gain = tally.equipGenerals
        break
      case 'heroDamage':
        gain = tally.heroDamage
        break
      case 'playTroop':
        gain = q.troop ? (tally.playTroop[q.troop] ?? 0) : 0
        break
      case 'playEra':
        gain = q.era ? (tally.playEra[q.era] ?? 0) : 0
        break
      case 'setField':
        gain = tally.setField
        break
      case 'winWithDoctrine':
        gain = tally.heroDoctrine === q.doctrine ? tally.win : 0
        break
    }
    if (gain <= 0) return q
    return { ...q, progress: Math.min(q.goal, q.progress + gain) }
  })
}

// ---------- Store ----------

interface QuestStoreState {
  date: string
  quests: QuestState[]
  refreshIfNewDay(): void
  recordMatch(events: GameEvent[], myHeroId: string): void
  claim(id: string): number // 返回发放的卡包数(0 = 不可领)
}

export const useQuests = create<QuestStoreState>()(
  persist(
    (set, get) => ({
      date: todayStr(),
      quests: rollDailyQuests(todayStr()),

      refreshIfNewDay() {
        const today = todayStr()
        if (get().date === today) return
        set({ date: today, quests: rollDailyQuests(today) })
      },

      recordMatch(events, myHeroId) {
        get().refreshIfNewDay()
        set((s) => ({ quests: applyTally(s.quests, tallyMatch(events, myHeroId)) }))
      },

      claim(id) {
        const q = get().quests.find((x) => x.id === id)
        if (!q || q.claimed || q.progress < q.goal) return 0
        set((s) => ({
          quests: s.quests.map((x) => (x.id === id ? { ...x, claimed: true } : x)),
        }))
        return q.reward
      },
    }),
    { name: 'qiangu-quests' },
  ),
)
